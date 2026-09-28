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
import Sidebar from "@/components/Sidebar";

export default function AdminsPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [removeError, setRemoveError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/");
        return;
      }
      try {
        const adminSnap = await getDoc(doc(db, "admins", currentUser.uid));
        if (!adminSnap.exists() || adminSnap.data().role !== "owner") {
          router.push("/dashboard");
          return;
        }
        setIsOwner(true);
      } catch (err) {
        setLoadError("Failed to verify admin access. Try refreshing the page.");
        setLoading(false);
      }
      setCheckingAuth(false);
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!isOwner) return;
    fetchAdmins();
  }, [isOwner]);

  const fetchAdmins = async () => {
    setLoadError("");
    try {
      const snap = await getDocs(collection(db, "admins"));
      setAdmins(snap.docs.map((d) => ({ uid: d.id, ...d.data() })));
    } catch (err) {
      setLoadError("Failed to load admin list. Try refreshing the page.");
    }
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

    setRemoveError("");
    try {
      await deleteDoc(doc(db, "admins", uid));
      fetchAdmins();
    } catch (err) {
      setRemoveError("Failed to remove admin. Try again.");
    }
  };

  if (checkingAuth || loading) {
    return (
      <div className="min-h-screen bg-[#0a0b0f] text-slate-100 flex items-center justify-center">
        Checking access...
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-[#0a0b0f] text-slate-100">
      <Sidebar />
      <main className="flex-1 p-4 sm:p-8 min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-slate-50">Manage Admins</h1>
        <p className="text-slate-500 text-sm mt-1 mb-6">
          Grant or revoke admin access to the dashboard
        </p>

        {loadError && (
          <div className="bg-rose-950/40 border border-rose-900/60 text-rose-300 text-sm rounded-xl px-4 py-3 mb-6 flex flex-wrap items-center justify-between gap-3 max-w-md">
            <span>{loadError}</span>
            <button
              onClick={fetchAdmins}
              className="text-sm border border-rose-900/60 px-3 py-1.5 rounded-lg hover:text-rose-100 text-rose-300"
            >
              Retry
            </button>
          </div>
        )}

        {removeError && (
          <div className="bg-rose-950/40 border border-rose-900/60 text-rose-300 text-sm rounded-xl px-4 py-3 mb-6 max-w-md">
            {removeError}
          </div>
        )}

        <form
          onSubmit={handleAddAdmin}
          className="mb-10 max-w-md bg-[#12141a]/60 border border-[#1f232b] rounded-2xl p-5"
        >
          <label className="block text-sm text-slate-500 mb-2">
            Add admin by email
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              type="email"
              required
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="someone@example.com"
              className="flex-1 min-w-[150px] bg-[#0d0e13] border border-[#1f232b] rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/40"
            />
            <button
              type="submit"
              disabled={submitting}
              className="bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-indigo-400"
            >
              {submitting ? "Adding..." : "Add"}
            </button>
          </div>
          {formError && <p className="text-rose-400 text-sm mt-2">{formError}</p>}
          {formSuccess && (
            <p className="text-emerald-400 text-sm mt-2">{formSuccess}</p>
          )}
        </form>

        <h2 className="text-lg font-semibold mb-3 text-slate-50">
          Current Admins ({admins.length})
        </h2>
        <div className="rounded-2xl border border-[#1f232b] overflow-hidden overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[400px]">
            <thead className="bg-[#12141a]/80 text-slate-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {admins.map((a) => (
                <tr key={a.uid} className="border-t border-[#1f232b]/80 hover:bg-[#1f232b]/40">
                  <td className="px-4 py-3 text-slate-300">{a.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full text-xs px-2.5 py-1 capitalize ${
                        a.role === "owner"
                          ? "bg-slate-800/60 text-slate-400"
                          : "bg-emerald-500/10 text-emerald-400"
                      }`}
                    >
                      {a.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {a.role !== "owner" && (
                      <button
                        onClick={() => handleRemoveAdmin(a.uid, a.role)}
                        className="text-rose-400 hover:text-rose-300 text-xs border border-rose-900/60 hover:border-rose-800 px-2.5 py-1 rounded-full"
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
      </main>
    </div>
  );
}