import { createRequire } from "module";
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from '../src/db/schema';
import * as dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();
// Fallback to prod env if local is missing (for server usage)
dotenv.config({ path: '.env.production' });

const require = createRequire(import.meta.url);

async function migrate() {
    console.log("🚀 Starting migration...");

    // 1. Init Firebase
    let dbFS;
    try {
        const serviceAccount = require("../serviceAccountKey.json");
        initializeApp({
            credential: cert(serviceAccount as any),
            databaseURL: "https://uhd-first-default-rtdb.firebaseio.com"
        });
        dbFS = getFirestore();
        console.log("✅ Firebase initialized");
    } catch (e) {
        console.error("❌ Failed to init Firebase:", e.message);
        console.log("Make sure serviceAccountKey.json is in the root folder!");
        return;
    }

    // 2. Init MySQL
    let dbMySQL;
    let pool;
    try {
        pool = mysql.createPool({ uri: process.env.DATABASE_URL });
        dbMySQL = drizzle(pool, { mode: 'default', schema });
        console.log("✅ MySQL initialized");
    } catch (e) {
        console.error("❌ Failed to init MySQL:", e.message);
        return;
    }

    // --- MIGRATION LOGIC ---

    // 3. Migrate Projects
    console.log("\n📦 Migrating Projects...");
    const projectsSnap = await dbFS.collection('projects').get();
    for (const doc of projectsSnap.docs) {
        const data = doc.data();
        const pId = doc.id; // Use Firebase ID if possible, or UUID? Schema uses varchar(36), so FB ID might fit if it's not too long.
        // Actually FB IDs are usually 20 chars, so they fit in varchar(36).

        console.log(`   > Migrating Project: ${data.title}`);

        // Insert Project
        await dbMySQL.insert(schema.projects).values({
            id: pId,
            title: data.title || "Untitled",
            location: data.location || "",
            price: data.price ? String(data.price) : null,
            description: data.description || "",
            status: data.status || "Ongoing",
            imageUrl: data.imageUrl || "",
            logoUrl: data.logoUrl || null,
            buildingAmenities: data.buildingAmenities || [],
            order: data.order || 0,
            // Convert timestamps if needed, or let defaultNow handle if missing
            // createdAt: new Date(data.createdAt), 
        }).onDuplicateKeyUpdate({ set: { id: pId } }); // skip if exists

        // Limit sub-collection?
        // Check for units
        // Assuming unit structure... (logic to be adapted if needed)
    }

    // 4. Migrate Gallery
    console.log("\n🖼 Migrating Gallery...");
    const gallerySnap = await dbFS.collection('gallery_items').get();
    for (const doc of gallerySnap.docs) {
        const data = doc.data();
        await dbMySQL.insert(schema.galleryItems).values({
            id: doc.id,
            url: data.url || "",
            caption: data.caption || "",
            category: data.category || "General"
        }).onDuplicateKeyUpdate({ set: { id: doc.id } });
    }

    // 5. Migrate Messages
    console.log("\n💬 Migrating Messages...");
    const msgSnap = await dbFS.collection('messages').get();
    for (const doc of msgSnap.docs) {
        const data = doc.data();
        await dbMySQL.insert(schema.messages).values({
            id: doc.id,
            name: data.name || "Unknown",
            email: data.email || "no-email",
            phone: data.phone || "",
            message: data.message || "",
            date: data.date ? new Date(data.date) : new Date(),
            read: data.read || false
        }).onDuplicateKeyUpdate({ set: { id: doc.id } });
    }

    // 6. Settings
    console.log("\n⚙️ Migrating Settings...");
    const settingsDoc = await dbFS.collection('site_settings').doc('global').get();
    if (settingsDoc.exists) {
        const data = settingsDoc.data();
        await dbMySQL.insert(schema.siteSettings).values({
            id: 1,
            settings: data?.settings || {}
        }).onDuplicateKeyUpdate({ set: { settings: data?.settings || {} } });
    }

    console.log("\n✅ Migration Complete!");
    await pool.end();
}

migrate();
