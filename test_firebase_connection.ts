
import { db } from './src/firebase';
import { collection, getDocs, query, limit } from 'firebase/firestore';
import { getAuth, signInAnonymously } from "firebase/auth";
import * as dotenv from 'dotenv';
import xhr from 'xmlhttprequest-ssl';
import WebSocket from 'ws';

// Polyfill
(global as any).XMLHttpRequest = xhr.XMLHttpRequest;
(global as any).WebSocket = WebSocket;

dotenv.config();

async function testConnection() {
    console.log("Testing Firebase connection with anonymous auth...");
    try {
        const auth = getAuth();
        await signInAnonymously(auth);
        console.log("Signed in anonymously. UID:", auth.currentUser?.uid);

        const projectsRef = collection(db, "projects");
        const q = query(projectsRef, limit(1));
        const snapshot = await getDocs(q);
        console.log("Success! Found documents:", snapshot.size);
        snapshot.docs.forEach(d => console.log(d.id, d.data()));
    } catch (err) {
        console.error("Firebase Error Full Details:", err);
        // @ts-ignore
        if (err.code) console.error("Error Code:", err.code);
        // @ts-ignore
        if (err.message) console.error("Error Message:", err.message);
    }
}

testConnection();
