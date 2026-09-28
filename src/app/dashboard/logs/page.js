"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  startAfter,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import Sidebar from "@/components/Sidebar";

const PAGE_SIZE = 25;

export default function LogsPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [pageCursors, setPageCursors] = useState([null]);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/");
        return;
      }
      try {
        const adminSnap = await getDoc(doc(db, "admins", user.uid));
        if (!adminSnap.exists() || adminSnap.data().role !== "owner") {
          router.push("/dashboard");
          return;
        }
      } catch (err) {
        setError("Failed to verify admin access. Try refreshing the page.");
        setLoading(false);
      }
      setCheckingAuth(false);
    });
    return () => unsubscribe();
  }, [router]);

  const loadPage = async (pageIndex, cursorsOverride) => {
    setLoading(true);
    setError("");
    try {
      const cursors = cursorsOverride || pageCursors;
      const cursor = cursors[pageIndex];

      const constraints = [orderBy("timestamp", "desc")];
      if (cursor) constraints.push(startAfter(cursor));
      constraints.push(limit(PAGE_SIZE + 1));

      const snap = await getDocs(query(collection(db, "admin_logs"), ...constraints));
      const docs = snap.docs;
      const more = docs.length > PAGE_SIZE;
      const pageDocs = more ? docs.slice(0, PAGE_SIZE) : docs;

      setLogs(pageDocs.map((d) => ({ id: d.id, ...d.data() })));
      setHasNextPage(more);
      setCurrentPage(pageIndex);

      if (pageDocs.length > 0) {
        setPageCursors((prev) => {
          const updated = [...prev];
          updated[pageIndex + 1] = pageDocs[pageDocs.length - 1];
          return updated;
        });
      }
    } catch (err) {
      setError("Failed to load activity log. Try refreshing the page.");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (checkingAuth) return;
    loadPage(0, [null]);
  }, [checkingAuth]);

  const formatDate = (timestamp) => {
    if (!timestamp) return "—";
    return timestamp.toDate().toLocaleString();
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
        <h1 className="text-2xl font-bold tracking-tight text-slate-50">Admin Activity Log</h1>
        <p className="text-slate-500 text-sm mt-1 mb-6">
          A record of admin actions across the app
        </p>

        {error && (
          <div className="bg-rose-950/40 border border-rose-900/60 text-rose-300 text-sm rounded-xl px-4 py-3 mb-6 flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            <button
              onClick={() => loadPage(currentPage)}
              className="text-sm border border-rose-900/60 px-3 py-1.5 rounded-lg hover:text-rose-100 text-rose-300"
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <p className="text-slate-500">Loading...</p>
        ) : logs.length === 0 && !error ? (
          <div className="bg-[#12141a]/60 border border-[#1f232b] rounded-2xl p-5">
            <p className="text-slate-500 text-sm">No activity logged yet.</p>
          </div>
        ) : logs.length > 0 ? (
          <>
            <div className="rounded-2xl border border-[#1f232b] overflow-hidden overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[800px]">
                <thead className="bg-[#12141a]/80 text-slate-500 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 font-medium">When</th>
                    <th className="px-4 py-3 font-medium">Admin</th>
                    <th className="px-4 py-3 font-medium">Action</th>
                    <th className="px-4 py-3 font-medium">Collection</th>
                    <th className="px-4 py-3 font-medium">Details</th>
                    <th className="px-4 py-3 font-medium">User</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-t border-[#1f232b]/80 hover:bg-[#1f232b]/40">
                      <td className="px-4 py-3 whitespace-nowrap text-slate-400">
                        {formatDate(log.timestamp)}
                      </td>
                      <td className="px-4 py-3">{log.adminEmail}</td>
                      <td className="px-4 py-3 capitalize">{log.action}</td>
                      <td className="px-4 py-3 text-slate-400">{log.targetCollection || "—"}</td>
                      <td className="px-4 py-3 text-slate-400">{log.details || "—"}</td>
                      <td className="px-4 py-3">
                        {log.targetUserId ? (
                          <button
                            onClick={() => router.push(`/dashboard/${log.targetUserId}`)}
                            className="text-xs border border-[#1f232b] px-2.5 py-1 rounded-full text-indigo-400 hover:text-indigo-300 hover:border-indigo-500/50"
                          >
                            View
                          </button>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center mt-4">
              <button
                onClick={() => loadPage(currentPage - 1)}
                disabled={currentPage === 0}
                className="text-sm text-slate-300 hover:text-slate-50 border border-[#1f232b] hover:border-indigo-500/50 px-4 py-2 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-[#1f232b]"
              >
                ← Previous
              </button>
              <span className="text-slate-500 text-sm">Page {currentPage + 1}</span>
              <button
                onClick={() => loadPage(currentPage + 1)}
                disabled={!hasNextPage}
                className="text-sm text-slate-300 hover:text-slate-50 border border-[#1f232b] hover:border-indigo-500/50 px-4 py-2 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-[#1f232b]"
              >
                Next →
              </button>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}