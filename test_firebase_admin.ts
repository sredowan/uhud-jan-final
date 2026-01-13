
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import serviceAccount from './serviceAccountKey.json' assert { type: "json" };

dotenv.config();

console.log("Initializing Admin SDK...");

try {
    initializeApp({
        credential: cert(serviceAccount),
        databaseURL: "https://uhd-first-default-rtdb.firebaseio.com"
    });
    console.log("Admin SDK Initialized.");

    const db = getFirestore();

    async function testData() {
        console.log("Fetching projects with orderBy...");
        const snapshot = await db.collection("projects").orderBy("order", "asc").limit(1).get();
        console.log("Projects found:", snapshot.size);
        snapshot.forEach(doc => {
            console.log(doc.id, doc.data());
        });
    }

    testData().catch(err => console.error("Test function error:", err));

} catch (err: any) {
    console.error("Initialization error:", err);
}
