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
    <div className="min-h-screen bg-black text-white p-8">
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

      {loading ? (
        <p className="text-neutral-400">Loading...</p>
      ) : users.length === 0 ? (
        <p className="text-neutral-500 text-sm">No inactive users right now.</p>
      ) : (
        <div className="border border-neutral-800 rounded-xl overflow-hidden">
          <table className="w-full text-left text-sm">
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
                  <td className="px-4 py-3">{formatDate(user.lastSeen)}</td>
                  <td className="px-4 py-3">{daysSince(user.lastSeen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}