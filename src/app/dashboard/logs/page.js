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

      <h1 className="text-2xl font-bold mb-6">Admin Activity Log</h1>

      {error && (
        <div className="bg-red-950 border border-red-800 text-red-300 text-sm rounded-lg px-4 py-3 mb-6 flex flex-wrap items-center justify-between gap-3">
          <span>{error}</span>
          <button
            onClick={() => loadPage(currentPage)}
            className="text-sm border border-red-800 px-3 py-1.5 rounded-lg hover:text-white text-red-300"
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-neutral-400">Loading...</p>
      ) : logs.length === 0 && !error ? (
        <p className="text-neutral-500 text-sm">No activity logged yet.</p>
      ) : logs.length > 0 ? (
        <>
          <div className="border border-neutral-800 rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[800px]">
              <thead className="bg-neutral-900 text-neutral-400">
                <tr>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Admin</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Collection</th>
                  <th className="px-4 py-3">Details</th>
                  <th className="px-4 py-3">User</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-t border-neutral-800">
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(log.timestamp)}</td>
                    <td className="px-4 py-3">{log.adminEmail}</td>
                    <td className="px-4 py-3 capitalize">{log.action}</td>
                    <td className="px-4 py-3">{log.targetCollection || "—"}</td>
                    <td className="px-4 py-3">{log.details || "—"}</td>
                    <td className="px-4 py-3">
                      {log.targetUserId ? (
                        <button
                          onClick={() => router.push(`/dashboard/${log.targetUserId}`)}
                          className="text-blue-400 hover:underline text-xs"
                        >
                          View
                        </button>
                      ) : (
                        "—"
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
              className="text-sm text-neutral-400 hover:text-white border border-neutral-700 px-4 py-2 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ← Previous
            </button>
            <span className="text-neutral-500 text-sm">Page {currentPage + 1}</span>
            <button
              onClick={() => loadPage(currentPage + 1)}
              disabled={!hasNextPage}
              className="text-sm text-neutral-400 hover:text-white border border-neutral-700 px-4 py-2 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}