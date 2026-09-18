"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

const INACTIVE_DAYS = 14;

export default function InactiveUsersPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/");
        return;
      }
      setCheckingAuth(false);
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (checkingAuth) return;
    fetchInactive();
  }, [checkingAuth]);

  const fetchInactive = async () => {
    setLoading(true);
    setError("");
    try {
      const cutoff = Timestamp.fromDate(
        new Date(Date.now() - INACTIVE_DAYS * 24 * 60 * 60 * 1000)
      );

      const snap = await getDocs(
        query(
          collection(db, "users"),
          where("lastSeen", "<=", cutoff),
          orderBy("lastSeen", "asc"),
          limit(200)
        )
      );

      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      setError("Failed to load inactive users. Try refreshing the page.");
    }
    setLoading(false);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "—";
    return timestamp.toDate().toLocaleString();
  };

  const daysSince = (timestamp) => {
    if (!timestamp) return "—";
    const diffMs = Date.now() - timestamp.toDate().getTime();
    return Math.floor(diffMs / (24 * 60 * 60 * 1000));
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Checking access...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 sm:p-8">
      <button
        onClick={() => router.push("/dashboard")}
        className="text-sm text-neutral-400 hover:text-white mb-6"
      >
        ← Back to dashboard
      </button>

      <h1 className="text-2xl font-bold mb-1">Inactive Users</h1>
      <p className="text-neutral-500 text-sm mb-6">
        {INACTIVE_DAYS}+ days since last seen
      </p>

      {error && (
        <div className="bg-red-950 border border-red-800 text-red-300 text-sm rounded-lg px-4 py-3 mb-6 flex flex-wrap items-center justify-between gap-3">
          <span>{error}</span>
          <button
            onClick={fetchInactive}
            className="text-sm border border-red-800 px-3 py-1.5 rounded-lg hover:text-white text-red-300"
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-neutral-400">Loading...</p>
      ) : users.length === 0 && !error ? (
        <p className="text-neutral-500 text-sm">No inactive users right now.</p>
      ) : users.length > 0 ? (
        <div className="border border-neutral-800 rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[500px]">
            <thead className="bg-neutral-900 text-neutral-400">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Last Seen</th>
                <th className="px-4 py-3">Days Inactive</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr
                  key={user.id}
                  onClick={() => router.push(`/dashboard/${user.id}`)}
                  className="border-t border-neutral-800 hover:bg-neutral-900 cursor-pointer"
                >
                  <td className="px-4 py-3">{user.email || "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(user.lastSeen)}</td>
                  <td className="px-4 py-3">{daysSince(user.lastSeen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}