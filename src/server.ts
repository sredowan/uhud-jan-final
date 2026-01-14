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
import { eq, desc, asc, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';


// 1. Config & Setup
dotenv.config(); // Load .env
dotenv.config({ path: '.env.production' }); // Fallback

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// 2. Database Init
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

        // Auto-Migration
        console.log("Checking for pending migrations...");
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
    }
}
initDB();

const ensureDb = (req, res, next) => {
    if (!db) return res.status(503).json({ error: "Database Service Unavailable" });
    next();
};

// 3. Express App
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
    origin: ["http://localhost:5173", "http://localhost:3001", "http://localhost:5174", "http://localhost:5175", "https://mediumvioletred-mandrill-596025.hostingersite.com"],
    credentials: true
}));

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

app.use(express.json());

import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth";
app.all("/api/auth/*path", toNodeHandler(auth));

// Root Route
// Root Route removed to allow frontend serving via express.static and catch-all


// --- API Routes ---

// Migration Endpoint


// Projects API
app.get('/api/projects', ensureDb, async (req, res) => {
    try {
        const projectsData = await db.query.projects.findMany({
            orderBy: [asc(schema.projects.order)],
        });

        const unitsData = await db.query.projectUnits.findMany();

        const safeParse = (val: any) => {
            if (typeof val === 'string') {
                try { return JSON.parse(val); } catch (e) { return []; }
            }
            return Array.isArray(val) ? val : [];
        };

        const projectsWithUnits = projectsData.map(project => ({
            ...project,
            buildingAmenities: safeParse(project.buildingAmenities),
            units: unitsData
                .filter(unit => unit.projectId === project.id)
                .map(unit => ({
                    ...unit,
                    features: safeParse(unit.features)
                }))
        }));

        res.json(projectsWithUnits);
    } catch (err: any) {
        console.error("Error fetching projects:", err);
        res.status(500).json({ error: "Failed to fetch projects" });
    }
});

app.post('/api/projects', ensureDb, async (req, res) => {
    try {
        const { units, ...projectData } = req.body;
        const projectId = uuidv4();
        await db.insert(schema.projects).values({
            id: projectId,
            ...projectData,
            order: Date.now(),
        });
        if (units && units.length > 0) {
            const unitsWithId = units.map(u => ({ id: uuidv4(), projectId, ...u }));
            await db.insert(schema.projectUnits).values(unitsWithId);
        }

        // Manual fetch instead of relational query
        const newProject = await db.query.projects.findFirst({
            where: eq(schema.projects.id, projectId),
        });
        const projectUnits = await db.query.projectUnits.findMany({
            where: eq(schema.projectUnits.projectId, projectId)
        });

        const safeParse = (val: any) => {
            if (typeof val === 'string') {
                try { return JSON.parse(val); } catch (e) { return []; }
            }
            return Array.isArray(val) ? val : [];
        };

        res.json({
            ...newProject,
            buildingAmenities: safeParse(newProject.buildingAmenities),
            units: projectUnits.map(u => ({ ...u, features: safeParse(u.features) }))
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to create project" });
    }
});

app.put('/api/projects/:id', ensureDb, async (req, res) => {
    try {
        const { id } = req.params;
        const { units, ...projectData } = req.body;

        await db.update(schema.projects)
            .set({ ...projectData, updatedAt: new Date() })
            .where(eq(schema.projects.id, id));

        if (units) {
            // Simplest strategy: Delete old units and re-add new ones (or complex diffing)
            // For now, let's assuming full replacement of units if provided
            await db.delete(schema.projectUnits).where(eq(schema.projectUnits.projectId, id));

            if (units.length > 0) {
                const unitsWithId = units.map(u => ({
                    id: u.id || uuidv4(),
                    projectId: id,
                    ...u
                }));
                await db.insert(schema.projectUnits).values(unitsWithId);
            }
        }

        // Manual fetch instead of relational query
        const updatedProject = await db.query.projects.findFirst({
            where: eq(schema.projects.id, id),
        });
        const projectUnits = await db.query.projectUnits.findMany({
            where: eq(schema.projectUnits.projectId, id)
        });

        const safeParse = (val: any) => {
            if (typeof val === 'string') {
                try { return JSON.parse(val); } catch (e) { return []; }
            }
            return Array.isArray(val) ? val : [];
        };

        res.json({
            ...updatedProject,
            buildingAmenities: safeParse(updatedProject.buildingAmenities),
            units: projectUnits.map(u => ({ ...u, features: safeParse(u.features) }))
        });
    } catch (err: any) {
        console.error("Error updating project:", err);
        res.status(500).json({ error: "Failed to update project" });
    }
});

app.delete('/api/projects/:id', ensureDb, async (req, res) => {
    try {
        const { id } = req.params;

        // Manual Cascade Delete: Delete units first
        await db.delete(schema.projectUnits).where(eq(schema.projectUnits.projectId, id));

        // Then delete the project
        await db.delete(schema.projects).where(eq(schema.projects.id, id));

        res.json({ success: true, id });
    } catch (err: any) {
        console.error("Error deleting project:", err);
        res.status(500).json({ error: "Failed to delete project: " + err.message });
    }
});

// Gallery API
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
        const newItem = { id: uuidv4(), ...req.body };
        await db.insert(schema.galleryItems).values(newItem);
        res.json(newItem);
    } catch (err) { res.status(500).json({ error: "Failed to add gallery item" }); }
});

// Messages API
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
        const newMsg = { id: uuidv4(), ...req.body, date: new Date() };
        await db.insert(schema.messages).values(newMsg);
        res.json(newMsg);
    } catch (err) { res.status(500).json({ error: "Failed to send message" }); }
});

// Settings API
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
            await db.insert(schema.siteSettings).values({ id: 1, settings: req.body });
        }
        res.json(req.body);
    } catch (err) { res.status(500).json({ error: "Failed to save settings" }); }
});

// File Upload
app.use('/uploads', express.static(uploadDir));
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'file-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

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

// Static Files
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

    // Env Vars
    log('\n[1] Environment Variables:');
    const required = ['DATABASE_URL', 'BETTER_AUTH_SECRET', 'BETTER_AUTH_URL'];
    const missing = required.filter(k => !process.env[k]);

    // Firebase Check


    if (missing.length) log(`❌ Missing: ${missing.join(', ')}`);
    else log('✅ All required env vars present.');

    // DB Connection
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

    // Data Counts
    log('\n[3] Data Counts:');
    if (db) {
        try {
            const pCount = await db.select({ count: sql`count(*)` }).from(schema.projects);
            const gCount = await db.select({ count: sql`count(*)` }).from(schema.galleryItems);
            const mCount = await db.select({ count: sql`count(*)` }).from(schema.messages);
            log(`Projects: ${pCount[0].count}`);
            log(`Gallery: ${gCount[0].count}`);
            log(`Messages: ${mCount[0].count}`);

            // Debug: Show first project structure
            // Manual fetch for debug too
            const sample = await db.query.projects.findFirst();
            const sampleUnits = sample ? await db.query.projectUnits.findMany({ where: eq(schema.projectUnits.projectId, sample.id) }) : [];

            log(`\n[4] Sample Data Structure:`);
            log(JSON.stringify({ ...sample, units: sampleUnits }, null, 2));

        } catch (e) {
            log(`❌ Failed to count data: ${e.message}`);
            log(e.stack);
        }
    } else {
        log('SKIP: DB not initialized');
    }

    res.send(logs.join('\n'));
});

// Catch-all
app.get(/.*/, (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'API Not Found' });
    res.sendFile(path.join(distDir, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
