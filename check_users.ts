import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
import * as schema from './src/db/schema';
import { eq } from 'drizzle-orm';
import fs from 'fs';

dotenv.config();

console.log("DB URL:", process.env.DATABASE_URL);

async function checkUsers() {
    try {
        const connection = await mysql.createConnection(process.env.DATABASE_URL!);
        const db = drizzle(connection, { mode: 'default', schema });

        const users = await db.query.user.findMany();
        console.log("Found Users:", JSON.stringify(users, null, 2));

        const admin = users.find(u => u.email === 'admin@uhudbuilders.com');
        if (admin) {
            console.log("✅ Admin user found:", admin.email);
        } else {
            console.log("❌ Admin user NOT found!");
        }

        await connection.end();
    } catch (error) {
        console.error("Error checking users:", error);
    }
}

checkUsers();
