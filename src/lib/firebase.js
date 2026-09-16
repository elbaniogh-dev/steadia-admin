import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCWZRg3PK0ZQilN5lrePk2qYymV6dXHlC8",
  authDomain: "steadia863.firebaseapp.com",
  projectId: "steadia863",
  storageBucket: "steadia863.firebasestorage.app",
  messagingSenderId: "508683157565",
  appId: "1:508683157565:web:0caa99ed4edfba62f22a54",
};

// Prevents Firebase from being initialized twice, which Next.js can
// accidentally trigger during development.
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);