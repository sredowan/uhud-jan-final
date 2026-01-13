import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import xhr from 'xmlhttprequest-ssl';
import WebSocket from 'ws';
import mysql from 'mysql2/promise';

// Polyfill for Firebase (Might not be needed for Admin SDK but keeping for safety if mixed usage exists)
(global as any).XMLHttpRequest = xhr.XMLHttpRequest;
(global as any).WebSocket = WebSocket;

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});


// Initialize Firebase Admin SDK
// Initialize Firebase Admin SDK
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const serviceAccount = require("../serviceAccountKey.json");

try {
    initializeApp({
        credential: cert(serviceAccount as any),
        databaseURL: "https://uhd-first-default-rtdb.firebaseio.com"
    });
    console.log("Firebase Admin SDK initialized successfully");
} catch (error) {
    console.error("Failed to initialize Firebase Admin:", error);
}

const db = getFirestore();

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS
app.use(cors({
    origin: ["http://localhost:5173", "http://localhost:3001", "http://localhost:5174", "http://localhost:5175", "https://mediumvioletred-mandrill-596025.hostingersite.com"],
    credentials: true
}));

// Ensure uploads directory exists (go up one level from src)
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// JSON middleware
app.use(express.json());

// --- API Routes ---

// 1. Projects
app.get('/api/projects', async (req, res) => {
    console.log("GET /api/projects - Request received");
    try {
        const projectsRef = db.collection("projects");
        console.log("Querying projects collection...");
        const snapshot = await projectsRef.orderBy("order", "asc").get();
        console.log(`Found ${snapshot.size} projects`);

        const projectsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(projectsData);
    } catch (err: any) {
        const logPath = path.join(__dirname, '..', 'server_error.log');
        fs.appendFileSync(logPath, `Error fetching projects: ${err.message}\n${err.stack}\n`);
        console.error("Error fetching projects:", err);
        res.status(500).json({ error: "Failed to fetch projects", details: err.message });
    }
});

app.post('/api/projects', async (req, res) => {
    try {
        const { units, ...projectData } = req.body;
        const projectsRef = db.collection("projects");

        const newProjectData = {
            ...projectData,
            order: Date.now(),
            createdAt: new Date().toISOString()
        };

        const newProjectRef = await projectsRef.add(newProjectData);

        if (units && units.length > 0) {
            const unitsRef = newProjectRef.collection("units");
            for (const u of units) {
                await unitsRef.add(u);
            }
        }
        res.json({ id: newProjectRef.id, ...newProjectData });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to create project" });
    }
});

// 2. Gallery
app.get('/api/gallery', async (req, res) => {
    try {
        const snapshot = await db.collection("gallery_items").orderBy("createdAt", "desc").get();
        const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        res.json(items);
    } catch (err) { res.status(500).json({ error: "Failed to fetch gallery" }); }
});

app.post('/api/gallery', async (req, res) => {
    try {
        const newItem = {
            ...req.body,
            createdAt: new Date().toISOString()
        };
        const docRef = await db.collection("gallery_items").add(newItem);
        res.json({ id: docRef.id, ...newItem });
    } catch (err) { res.status(500).json({ error: "Failed to add gallery item" }); }
});

// 3. Messages
app.get('/api/messages', async (req, res) => {
    try {
        const snapshot = await db.collection("messages").orderBy("date", "desc").get();
        const msgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        res.json(msgs);
    } catch (err) { res.status(500).json({ error: "Failed to fetch messages" }); }
});

app.post('/api/messages', async (req, res) => {
    try {
        const newMsg = {
            ...req.body,
            date: new Date().toISOString()
        };
        const docRef = await db.collection("messages").add(newMsg);
        res.json({ id: docRef.id, ...newMsg });
    } catch (err) { res.status(500).json({ error: "Failed to send message" }); }
});

// 4. Settings
app.get('/api/settings', async (req, res) => {
    try {
        const docRef = db.collection("site_settings").doc("global");
        const docSnap = await docRef.get();
        if (docSnap.exists) {
            res.json(docSnap.data()?.settings || {});
        } else {
            res.json({});
        }
    } catch (err) { res.status(500).json({ error: "Failed to fetch settings" }); }
});

app.post('/api/settings', async (req, res) => {
    try {
        const docRef = db.collection("site_settings").doc("global");
        await docRef.set({
            settings: req.body,
            updatedAt: new Date().toISOString()
        }, { merge: true });
        res.json(req.body);
    } catch (err) { res.status(500).json({ error: "Failed to save settings" }); }
});

// 5. File Upload (Multer)
app.use('/uploads', express.static(uploadDir));

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'file-' + uniqueSuffix + ext);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }
});

app.post('/api/upload', upload.single('file'), (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        const fileUrl = `/uploads/${req.file.filename}`;
        res.json({ success: true, url: fileUrl, filename: req.file.filename });
    } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ error: 'Upload failed' });
    }
});


// Serve static files from 'dist' directory (Vite build) - Production only
const distDir = path.join(__dirname, '..', 'dist');
app.use(express.static(distDir));

// Debug Route
app.get('/debug.txt', async (req, res) => {
    res.setHeader('Content-Type', 'text/plain');
    const logs = [];
    const log = (msg) => logs.push(msg);

    log('--- Hostinger Debug Report ---');
    log(`Date: ${new Date().toISOString()}`);
    log(`Node Version: ${process.version}`);

    // 1. Env Vars
    log('\n[1] Environment Variables:');
    const required = ['DATABASE_URL', 'BETTER_AUTH_SECRET', 'BETTER_AUTH_URL'];
    const missing = required.filter(k => !process.env[k]);
    if (missing.length) log(`❌ Missing: ${missing.join(', ')}`);
    else log('✅ All required env vars present.');

    // 2. MySQL Connection
    log('\n[2] MySQL Database Connection:');
    if (process.env.DATABASE_URL) {
        try {
            const conn = await mysql.createConnection(process.env.DATABASE_URL);
            await conn.ping();
            await conn.end();
            log('✅ Connection successful!');
        } catch (err) {
            log(`❌ Connection failed: ${err.message}`);
        }
    } else {
        log('SKIP: No DATABASE_URL found.');
    }

    res.send(logs.join('\n'));
});

// Catch-all handler
app.get(/.*/, (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'API Not Found' });
    res.sendFile(path.join(distDir, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
