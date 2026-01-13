import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyBP-bB5u7hXMaCroqr7Vb1CvkEtWWahWWA",
  authDomain: "uhd-first.firebaseapp.com",
  databaseURL: "https://uhd-first-default-rtdb.firebaseio.com",
  projectId: "uhd-first",
  storageBucket: "uhd-first.firebasestorage.app",
  messagingSenderId: "595908995722",
  appId: "1:595908995722:web:18f6941ea1e0dda1785b73",
  measurementId: "G-M8CBTVQS90"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
// Analytics can only differ in browser environment
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;