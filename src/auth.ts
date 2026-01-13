import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db"; // Adjust path to your db instance

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: "mysql",
    }),
    emailAndPassword: {
        enabled: true
    },
    baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3001",
    trustedOrigins: ["http://localhost:5173", "http://localhost:3001", "https://mediumvioletred-mandrill-596025.hostingersite.com"],
    advanced: {
        crossSubDomainCookies: {
            enabled: true
        }
    }
});
