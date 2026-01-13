import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';
import { createRequire } from "module";
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import * as schema from './db/schema';
import { eq, desc, asc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';


dotenv.config(); // Load .env if exists
dotenv.config({ path: '.env.production' }); // Load .env.production as fallback

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});


// Database Initialization (MySQL)
let db;
let pool;
async function initDB() {
    try {
        const dbUrl = process.env.DATABASE_URL;
        if (!dbUrl) throw new Error("DATABASE_URL missing");

        console.log("Initializing MySQL...");
        pool = mysql.createPool({ uri: dbUrl });
        db = drizzle(pool, { mode: 'default', schema });
        console.log("✅ MySQL Database initialized successfully");

        // --- AUTO-MIGRATION (Schema Push) ---
        // This ensures tables exist without needing SSH 'drizzle-kit push'
        console.log("Checking for pending migrations...");

        // Path to migrations folder. 
        // In local dev: './drizzle' (relative to root)
        // In prod dist: needs to be accessible. We assume 'drizzle' folder is copied to root or we point to it.
        // Let's try to resolve it.
        const migrationFolder = path.join(__dirname, '..', 'drizzle');

        if (fs.existsSync(migrationFolder)) {
            console.log(`Running migrations from: ${migrationFolder}`);
            await migrate(db, { migrationsFolder: migrationFolder });
            console.log("✅ Database schema migrated successfully");
        } else {
            console.warn(`⚠️ Migration folder not found at ${migrationFolder}. Skipping auto-migration.`);
        }
    } catch (error) {
        console.error("Failed to initialize MySQL Connection or Run Migrations:", error.message);
        // db remains undefined or partially init
    }
}

// Initialize DB on start
initDB();

// Helper to check DB status before requests
const ensureDb = (req, res, next) => {
    if (!db) {
        return res.status(503).json({ error: "Database Service Unavailable" });
    }
    next();
};

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

// Basic Health Check (No DB dependency)
app.get('/', (req, res) => {
    res.status(200).send('Server is Running! Visit /debug.txt for status.');
});

// --- API Routes ---

// SPECIAL: Data Migration Endpoint (Run manually by user)
app.get('/api/admin/run-firebase-migration', async (req, res) => {
    if (!db) return res.status(503).json({ error: "MySQL not connected" });

    console.log("🚀 Starting Manual Data Migration...");
    const logs = [];
    const log = (m) => { console.log(m); logs.push(m); };

    try {
        // 1. Init Firebase (Local scope only)
        let dbFS;
        try {
            let serviceAccount;
            try {
                serviceAccount = require("../serviceAccountKey.json");
            } catch (err) {
                console.log("⚠️ serviceAccountKey.json not found, trying Env Var...");
                if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
                    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
                } else {
                    throw new Error("Missing serviceAccountKey.json AND FIREBASE_SERVICE_ACCOUNT_JSON env var");
                }
            }

            // Check if already init
            try {
                // Legacy check/init logic
                // If we are here, we have serviceAccount object
                const fsApp = initializeApp({
                    credential: cert(serviceAccount),
                    databaseURL: "https://uhd-first-default-rtdb.firebaseio.com"
                }, 'migration-' + Date.now());
                dbFS = getFirestore(fsApp);
                log("✅ Firebase initialized for migration");
            } catch (initErr) {
                throw new Error("Firebase Init Error: " + initErr.message);
            }

        } catch (e) {
            log("❌ Failed to init Firebase: " + e.message);
            log("SOLUTION: Upload 'serviceAccountKey.json' to root OR set 'FIREBASE_SERVICE_ACCOUNT_JSON' env var.");
            return res.status(500).json({ logs, error: "Firebase Init Failed" });
        }

        // 3. Migrate Projects
        log("📦 Migrating Projects...");
        const projectsSnap = await dbFS.collection('projects').get();
        let pCount = 0;
        for (const doc of projectsSnap.docs) {
            const data = doc.data();
            await db.insert(schema.projects).values({
                id: doc.id,
                title: data.title || "Untitled",
                location: data.location || "",
                price: data.price ? String(data.price) : null,
                description: data.description || "",
                status: data.status || "Ongoing",
                imageUrl: data.imageUrl || "",
                logoUrl: data.logoUrl || null,
                buildingAmenities: data.buildingAmenities || [],
                order: data.order || 0,
            }).onDuplicateKeyUpdate({ set: { id: doc.id } });
            pCount++;
        }
        log(`Synced ${pCount} Projects.`);

        // 4. Migrate Gallery
        log("🖼 Migrating Gallery...");
        const gallerySnap = await dbFS.collection('gallery_items').get();
        let gCount = 0;
        for (const doc of gallerySnap.docs) {
            const data = doc.data();
            await db.insert(schema.galleryItems).values({
                id: doc.id,
                url: data.url || "",
                caption: data.caption || "",
                category: data.category || "General"
            }).onDuplicateKeyUpdate({ set: { id: doc.id } });
            gCount++;
        }
        log(`Synced ${gCount} Gallery Items.`);

        // 5. Migrate Messages
        log("💬 Migrating Messages...");
        const msgSnap = await dbFS.collection('messages').get();
        let mCount = 0;
        for (const doc of msgSnap.docs) {
            const data = doc.data();
            await db.insert(schema.messages).values({
                id: doc.id,
                name: data.name || "Unknown",
                email: data.email || "no-email",
                phone: data.phone || "",
                message: data.message || "",
                date: data.date ? new Date(data.date) : new Date(),
                read: data.read || false
            }).onDuplicateKeyUpdate({ set: { id: doc.id } });
            mCount++;
        }
        log(`Synced ${mCount} Messages.`);

        // 6. Settings
        log("⚙️ Migrating Settings...");
        const settingsDoc = await dbFS.collection('site_settings').doc('global').get();
        if (settingsDoc.exists) {
            const data = settingsDoc.data();
            await db.insert(schema.siteSettings).values({
                id: 1,
                settings: data?.settings || {}
            }).onDuplicateKeyUpdate({ set: { settings: data?.settings || {} } });
            log("Synced Settings.");
        }

        log("✅ Migration Complete!");
        res.json({ success: true, logs });

    } catch (err) {
        log("❌ Migration Error: " + err.message);
        res.status(500).json({ error: err.message, logs });
    }
});


// 1. Projects
app.get('/api/projects', ensureDb, async (req, res) => {
    console.log("GET /api/projects - Request received");
    try {
        // Fetch projects with units
        const projectsData = await db.query.projects.findMany({
            orderBy: [asc(schema.projects.order)],
            with: {
                units: true
            }
        });

        console.log(`Found ${projectsData.length} projects`);
        res.json(projectsData);
    } catch (err: any) {
        console.error("Error fetching projects:", err);
        res.status(500).json({ error: "Failed to fetch projects", details: err.message });
    }
});

app.post('/api/projects', ensureDb, async (req, res) => {
    try {
        const { units, ...projectData } = req.body;
        const projectId = uuidv4();

        // 1. Insert Project
        await db.insert(schema.projects).values({
            id: projectId,
            ...projectData,
            order: Date.now(), // Use timestamp as simple order for now
            // createdAt/updatedAt handled by defaultNow() in schema
        });

        // 2. Insert Units if any
        if (units && units.length > 0) {
            const unitsWithId = units.map(u => ({
                id: uuidv4(),
                projectId: projectId,
                ...u
            }));
            await db.insert(schema.projectUnits).values(unitsWithId);
        }

        const newProject = await db.query.projects.findFirst({
            where: eq(schema.projects.id, projectId),
            with: { units: true }
        });

        res.json(newProject);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to create project" });
    }
});

// 2. Gallery
app.get('/api/gallery', ensureDb, async (req, res) => {
    try {
        const items = await db.query.galleryItems.findMany({
            orderBy: [desc(schema.galleryItems.createdAt)]
        });
        res.json(items);
    } catch (err) { res.status(500).json({ error: "Failed to fetch gallery" }); }
});

app.post('/api/gallery', ensureDb, async (req, res) => {
    try {
        const newItem = {
            id: uuidv4(),
            ...req.body,
        };
        await db.insert(schema.galleryItems).values(newItem);
        res.json(newItem);
    } catch (err) { res.status(500).json({ error: "Failed to add gallery item" }); }
});

// 3. Messages
app.get('/api/messages', ensureDb, async (req, res) => {
    try {
        const msgs = await db.query.messages.findMany({
            orderBy: [desc(schema.messages.date)]
        });
        res.json(msgs);
    } catch (err) { res.status(500).json({ error: "Failed to fetch messages" }); }
});

app.post('/api/messages', ensureDb, async (req, res) => {
    try {
        const newMsg = {
            id: uuidv4(),
            ...req.body,
            date: new Date()
        };
        await db.insert(schema.messages).values(newMsg);
        res.json(newMsg);
    } catch (err) { res.status(500).json({ error: "Failed to send message" }); }
});

// 4. Settings
app.get('/api/settings', ensureDb, async (req, res) => {
    try {
        const settings = await db.query.siteSettings.findFirst({
            where: eq(schema.siteSettings.id, 1)
        });
        res.json(settings?.settings || {});
    } catch (err) { res.status(500).json({ error: "Failed to fetch settings" }); }
});

app.post('/api/settings', ensureDb, async (req, res) => {
    try {
        const existing = await db.query.siteSettings.findFirst({
            where: eq(schema.siteSettings.id, 1)
        });

        if (existing) {
            await db.update(schema.siteSettings)
                .set({ settings: req.body, updatedAt: new Date() })
                .where(eq(schema.siteSettings.id, 1));
        } else {
            await db.insert(schema.siteSettings).values({
                id: 1,
                settings: req.body
            });
        }
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
        if (!(req as any).file) return res.status(400).json({ error: 'No file uploaded' });
        const fileUrl = `/uploads/${(req as any).file.filename}`;
        res.json({ success: true, url: fileUrl, filename: (req as any).file.filename });
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
