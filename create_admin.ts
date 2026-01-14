import * as fs from 'fs';
import * as path from 'path';

console.log("CWD:", process.cwd());
const envPath = path.resolve(process.cwd(), '.env');
const envContent = `DATABASE_URL="mysql://u632925822_db_user_2:Redowan173123@148.222.53.5:3306/u632925822_db_uhud_2"
BETTER_AUTH_SECRET=f8e9d2c1a4b5e7d8f9e0a1b2c3d4e5f6g7h8i9j0k1l2m3n4
BETTER_AUTH_URL=https://mediumvioletred-mandrill-596025.hostingersite.com
VITE_BETTER_AUTH_URL=https://mediumvioletred-mandrill-596025.hostingersite.com
FRONTEND_URL=http://localhost:5173
`;

try {
    console.log("Forcing UTF-8 write to .env...");
    fs.writeFileSync(envPath, envContent, { encoding: 'utf8', flag: 'w' });
    console.log("✅ .env re-written as UTF-8.");
} catch (e) {
    console.error("Failed to write .env:", e);
}

// Now manually parse just in case, but dotenv (in db/index.ts) should work now.
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
            let val = valueParts.join('=');
            val = val.trim().replace(/^["'](.*)["']$/, '$1');
            process.env[key.trim()] = val;
        }
    });
}
console.log("DB URL (Manual):", process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@'));

import mysql from 'mysql2/promise';

async function testConnection() {
    console.log("Testing raw connection...");
    const url = process.env.DATABASE_URL;
    try {
        const conn = await mysql.createConnection(url!);
        console.log("✅ Raw Connection SUCCESS!");
        await conn.end();
        return true;
    } catch (e: any) {
        console.error("❌ Raw Connection FAILED:", e.message);
        return false;
    }
}

async function main() {
    await testConnection();

    // Dynamic import to ensure env vars are loaded first
    const { auth } = await import("./src/auth");

    console.log("Creating admin user...");
    try {
        const user = await auth.api.signUpEmail({
            body: {
                email: "admin@uhudbuilders.com",
                password: "password123",
                name: "Admin User",
                image: ""
            }
        });
        // ... remainder of file unchanged
        console.log("✅ Admin user created successfully!");
        console.log("Email: admin@uhudbuilders.com");
        console.log("Password: password123");
    } catch (e: any) {
        if (e.message && e.message.includes("User already exists")) {
            console.log("⚠️ User 'admin@uhudbuilders.com' already exists.");
            console.log("If you don't know the password, we might need to reset it (not implemented in this script yet).");
        } else {
            console.error("❌ Failed to create user:", e.message || e);
            console.error(JSON.stringify(e, null, 2));
        }
    }
    process.exit(0);
}

main();
