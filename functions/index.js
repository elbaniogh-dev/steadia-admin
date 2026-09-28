const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();
const db = getFirestore();

exports.sendNotification = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Must be signed in.");
  }

  const adminDoc = await db.collection("admins").doc(uid).get();
  if (!adminDoc.exists) {
    throw new HttpsError("permission-denied", "Not an admin.");
  }

  const { title, body, targetType, targetUserIds } = request.data;

  if (!title || !body) {
    throw new HttpsError("invalid-argument", "title and body are required.");
  }
  if (targetType !== "all" && targetType !== "selected") {
    throw new HttpsError("invalid-argument", "targetType must be 'all' or 'selected'.");
  }
  if (targetType === "selected" && (!Array.isArray(targetUserIds) || targetUserIds.length === 0)) {
    throw new HttpsError("invalid-argument", "targetUserIds required when targetType is 'selected'.");
  }

  const docData = {
    title,
    body,
    createdAt: FieldValue.serverTimestamp(),
    sentBy: uid,
    targetType,
  };
  if (targetType === "selected") {
    docData.targetUserIds = targetUserIds;
  }
  await db.collection("notifications").add(docData);

  if (targetType === "all") {
    await getMessaging().send({
      topic: "all_users",
      notification: { title, body },
    });
  }

  return { success: true };
});