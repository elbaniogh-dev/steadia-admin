"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export default function AdminsPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [emailInput, setEmailInput] = useState("");
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/");
        return;
      }
      const adminSnap = await getDoc(doc(db, "admins", currentUser.uid));
      console.log("Signed-in uid:", currentUser.uid);
      console.log("Admin doc exists:", adminSnap.exists());
      console.log("Admin doc data:", adminSnap.data());
      if (!adminSnap.exists() || adminSnap.data().role !== "owner") {
        router.push("/dashboard");
        return;
      }
      setIsOwner(true);
      setCheckingAuth(false);
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!isOwner) return;
    fetchAdmins();
  }, [isOwner]);

  const fetchAdmins = async () => {
    const snap = await getDocs(collection(db, "admins"));
    setAdmins(snap.docs.map((d) => ({ uid: d.id, ...d.data() })));
    setLoading(false);
  };

  const handleAddAdmin = async (e) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");
    setSubmitting(true);

    try {
      const usersQuery = query(
        collection(db, "users"),
        where("email", "==", emailInput.trim())
      );
      const userSnap = await getDocs(usersQuery);

      if (userSnap.empty) {
        setFormError(
          "No Steadia user found with that email. They need to have signed in to the app at least once."
        );
        setSubmitting(false);
        return;
      }

      const targetUid = userSnap.docs[0].id;

      await setDoc(doc(db, "admins", targetUid), {
        role: "admin",
        email: emailInput.trim(),
      });

      setFormSuccess(`${emailInput.trim()} is now an admin.`);
      setEmailInput("");
      fetchAdmins();
    } catch (err) {
      setFormError("Something went wrong: " + err.message);
    }

    setSubmitting(false);
  };

  const handleRemoveAdmin = async (uid, role) => {
    if (role === "owner") {
      alert("You can't remove the owner.");
      return;
    }
    if (!confirm("Remove this admin's access?")) return;

    await deleteDoc(doc(db, "admins", uid));
    fetchAdmins();
  };

  if (checkingAuth || loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <button
        onClick={() => router.push("/dashboard")}
        className="text-sm text-neutral-400 hover:text-white mb-6"
      >
        ← Back to all users
      </button>

      <h1 className="text-2xl font-bold mb-6">Manage Admins</h1>

      <form onSubmit={handleAddAdmin} className="mb-10 max-w-md">
        <label className="block text-sm text-neutral-400 mb-2">
          Add admin by email
        </label>
        <div className="flex gap-2">
          <input
            type="email"
            required
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder="someone@example.com"
            className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={submitting}
            className="bg-white text-black px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {submitting ? "Adding..." : "Add"}
          </button>
        </div>
        {formError && <p className="text-red-400 text-sm mt-2">{formError}</p>}
        {formSuccess && (
          <p className="text-green-400 text-sm mt-2">{formSuccess}</p>
        )}
      </form>

      <h2 className="text-lg font-semibold mb-3">
        Current Admins ({admins.length})
      </h2>
      <div className="border border-neutral-800 rounded-xl overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-900 text-neutral-400">
            <tr>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.uid} className="border-t border-neutral-800">
                <td className="px-4 py-3">{a.email}</td>
                <td className="px-4 py-3 capitalize">{a.role}</td>
                <td className="px-4 py-3 text-right">
                  {a.role !== "owner" && (
                    <button
                      onClick={() => handleRemoveAdmin(a.uid, a.role)}
                      className="text-red-400 hover:text-red-300 text-xs"
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}