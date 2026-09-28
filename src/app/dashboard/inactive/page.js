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
import Sidebar from "@/components/Sidebar";

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
      <div className="min-h-screen bg-[#0a0b0f] text-slate-100 flex items-center justify-center">
        Checking access...
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-[#0a0b0f] text-slate-100">
      <Sidebar />
      <main className="flex-1 p-4 sm:p-8 min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-slate-50">Inactive Users</h1>
        <p className="text-slate-500 text-sm mt-1 mb-6">
          {INACTIVE_DAYS}+ days since last seen
        </p>

        {error && (
          <div className="bg-rose-950/40 border border-rose-900/60 text-rose-300 text-sm rounded-xl px-4 py-3 mb-6 flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            <button
              onClick={fetchInactive}
              className="text-sm border border-rose-900/60 px-3 py-1.5 rounded-lg hover:text-rose-100 text-rose-300"
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <p className="text-slate-500">Loading...</p>
        ) : users.length === 0 && !error ? (
          <div className="bg-[#12141a]/60 border border-[#1f232b] rounded-2xl p-5">
            <p className="text-slate-500 text-sm">No inactive users right now.</p>
          </div>
        ) : users.length > 0 ? (
          <div className="rounded-2xl border border-[#1f232b] overflow-hidden overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[500px]">
              <thead className="bg-[#12141a]/80 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Last Seen</th>
                  <th className="px-4 py-3 font-medium">Days Inactive</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    onClick={() => router.push(`/dashboard/${user.id}`)}
                    className="border-t border-[#1f232b]/80 hover:bg-[#1f232b]/40 cursor-pointer"
                  >
                    <td className="px-4 py-3">{user.email || "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-400">
                      {formatDate(user.lastSeen)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-amber-500/10 text-amber-400 text-xs px-2.5 py-1">
                        {daysSince(user.lastSeen)}d
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </main>
    </div>
  );
}