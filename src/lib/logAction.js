import { db } from "./firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export async function logAction({ adminEmail, action, targetUserId, targetCollection, targetDocId, details }) {
  try {
    await addDoc(collection(db, "admin_logs"), {
      adminEmail,
      action,
      targetUserId,
      targetCollection: targetCollection || null,
      targetDocId: targetDocId || null,
      details: details || null,
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    console.error("Failed to write admin log:", err);
  }
}