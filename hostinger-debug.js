
import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load usage
// Run: node hostinger-debug.js

dotenv.config({ path: '.env.production' });
// Fallback to .env if .env.production not found
if (!process.env.DATABASE_URL) dotenv.config();

console.log('--- Hostinger Debug Script ---');
console.log('Node Version:', process.version);
console.log('Current Directory:', process.cwd());

// 1. Check Environment Variables
console.log('\n[1] Checking Environment Variables...');
const requiredVars = ['DATABASE_URL', 'BETTER_AUTH_SECRET', 'BETTER_AUTH_URL'];
const missingVars = requiredVars.filter(key => !process.env[key]);

if (missingVars.length > 0) {
    console.error('❌ Missing Environment Variables:', missingVars.join(', '));
} else {
    console.log('✅ All required environment variables are present.');
}

// 2. Check Build Output
console.log('\n[2] Checking Build Output...');
const distPath = path.resolve(process.cwd(), 'dist');
const indexHtmlPath = path.resolve(distPath, 'index.html');

if (fs.existsSync(distPath) && fs.existsSync(indexHtmlPath)) {
    console.log('✅ Build output (dist/index.html) exists.');
} else {
    console.error('❌ Build output missing. Did you run "npm run build"?');
    if (!fs.existsSync(distPath)) console.error('   - dist/ folder not found.');
    else if (!fs.existsSync(indexHtmlPath)) console.error('   - dist/index.html not found.');
}

// 3. Test Database Connection
console.log('\n[3] Testing MySQL Database Connection...');
if (process.env.DATABASE_URL) {
    (async () => {
        try {
            const connection = await mysql.createConnection(process.env.DATABASE_URL);
            await connection.ping();
            console.log('✅ Successfully connected to the database!');
            await connection.end();
            process.exit(0);
        } catch (error) {
            console.error('❌ Database connection failed:');
            console.error(error.message);
            process.exit(1);
        }
    })();
} else {
    console.log('⏭️ Skipping DB check (no DATABASE_URL).');
}
