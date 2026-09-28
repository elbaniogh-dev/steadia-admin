"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getCountFromServer,
  query,
  orderBy,
  limit,
  startAfter,
  where,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import Sidebar from "@/components/Sidebar";
import { Search, LogOut, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 25;

export default function DashboardPage() {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [totalCount, setTotalCount] = useState(null);
  const [error, setError] = useState("");

  const [pageCursors, setPageCursors] = useState([null]);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const currentPageRef = useRef(0);

  const [searchInput, setSearchInput] = useState("");
  const [searchActive, setSearchActive] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/");
        return;
      }
      try {
        const adminSnap = await getDoc(doc(db, "admins", user.uid));
        if (adminSnap.exists() && adminSnap.data().role === "owner") {
          setIsOwner(true);
        }
      } catch (err) {
        setError("Failed to verify admin access. Try refreshing the page.");
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

      const constraints = [orderBy("createdAt", "desc")];
      if (cursor) constraints.push(startAfter(cursor));
      constraints.push(limit(PAGE_SIZE + 1));

      const snap = await getDocs(query(collection(db, "users"), ...constraints));
      const docs = snap.docs;
      const more = docs.length > PAGE_SIZE;
      const pageDocs = more ? docs.slice(0, PAGE_SIZE) : docs;

      setUsers(pageDocs.map((d) => ({ id: d.id, ...d.data() })));
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
      setError("Failed to load users. Try refreshing the page.");
    }
    setLoading(false);
  };

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  useEffect(() => {
    if (checkingAuth) return;

    getCountFromServer(collection(db, "users"))
      .then((snap) => setTotalCount(snap.data().count))
      .catch(() => setTotalCount(null));

    loadPage(0, [null]);

    const interval = setInterval(() => {
      if (!searchActive) loadPage(currentPageRef.current);
    }, 30000);
    return () => clearInterval(interval);
  }, [checkingAuth]);

  const handleSearch = async (e) => {
    e.preventDefault();
    const term = searchInput.trim().toLowerCase();
    if (!term) return;

    setSearching(true);
    setSearchActive(true);
    setSearchError("");

    try {
      const snap = await getDocs(
        query(
          collection(db, "users"),
          orderBy("email"),
          where("email", ">=", term),
          where("email", "<=", term + "\uf8ff"),
          limit(50)
        )
      );
      setSearchResults(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      setSearchError("Search failed. Try again.");
      setSearchResults([]);
    }

    setSearching(false);
  };

  const clearSearch = () => {
    setSearchInput("");
    setSearchActive(false);
    setSearchResults([]);
    setSearchError("");
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push("/");
    } catch (err) {
      setError("Failed to sign out. Try again.");
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "—";
    return timestamp.toDate().toLocaleString();
  };

  const isOnline = (lastActive) => {
    if (!lastActive) return false;
    const diffMs = Date.now() - lastActive.toDate().getTime();
    return diffMs < 60000;
  };

  const INACTIVE_DAYS = 14;

  const isInactive = (lastSeen) => {
    if (!lastSeen) return true;
    const diffMs = Date.now() - lastSeen.toDate().getTime();
    return diffMs > INACTIVE_DAYS * 24 * 60 * 60 * 1000;
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#0a0b0f] text-slate-100 flex items-center justify-center">
        Checking access...
      </div>
    );
  }

  const displayedUsers = searchActive ? searchResults : users;

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-[#0a0b0f] text-slate-100">
      <Sidebar />
      <main className="flex-1 p-4 sm:p-8 min-w-0">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-50">Steadia Admin</h1>
            <p className="text-slate-500 text-sm mt-1">
              {totalCount === null
                ? "Loading total..."
                : `${totalCount} total users`}
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-slate-50 border border-[#1f232b] hover:bg-[#1f232b]/60 px-4 py-2 rounded-full transition-colors"
          >
            <LogOut size={15} />
            Sign Out
          </button>
        </div>

        {error && (
          <div className="bg-rose-950/40 border border-rose-900/60 text-rose-300 text-sm rounded-xl px-4 py-3 mb-6">
            {error}
          </div>
        )}

        <div className="bg-[#12141a]/60 border border-[#1f232b] rounded-2xl p-5 mb-6">
          <form
            onSubmit={handleSearch}
            className="flex flex-wrap items-center gap-2"
          >
            <div className="relative flex-1 min-w-[180px]">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
              />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by email..."
                className="w-full bg-[#0d0e13] border border-[#1f232b] rounded-full pl-9 pr-4 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/40"
              />
            </div>
            <button
              type="submit"
              disabled={searching}
              className="bg-indigo-500 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-indigo-400 disabled:opacity-50 transition-colors"
            >
              {searching ? "Searching..." : "Search"}
            </button>
            {searchActive && (
              <button
                type="button"
                onClick={clearSearch}
                className="text-sm text-slate-300 hover:text-slate-50 border border-[#1f232b] hover:bg-[#1f232b]/60 px-4 py-2 rounded-full transition-colors"
              >
                Clear
              </button>
            )}
          </form>

          {searchError && (
            <div className="bg-rose-950/40 border border-rose-900/60 text-rose-300 text-sm rounded-xl px-4 py-3 mt-4">
              {searchError}
            </div>
          )}
        </div>

        {loading && !searchActive ? (
          <p className="text-slate-500 text-sm">Loading...</p>
        ) : (
          <>
            {searchActive && (
              <p className="text-slate-500 text-sm mb-3">
                {searchResults.length} result
                {searchResults.length !== 1 ? "s" : ""} for &quot;{searchInput}
                &quot;
              </p>
            )}

            <div className="border border-[#1f232b] rounded-2xl overflow-hidden overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[650px]">
                <thead className="bg-[#12141a]/80 text-slate-500 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Signed Up</th>
                    <th className="px-4 py-3 font-medium">Last Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedUsers.map((user) => (
                    <tr
                      key={user.id}
                      onClick={() => router.push(`/dashboard/${user.id}`)}
                      className="border-t border-[#1f232b]/80 hover:bg-[#1f232b]/40 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">{user.email || "—"}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${
                            isOnline(user.lastActive)
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-slate-800/60 text-slate-400"
                          }`}
                        >
                          <span
                            className={`inline-block w-1.5 h-1.5 rounded-full ${
                              isOnline(user.lastActive)
                                ? "bg-emerald-500"
                                : "bg-slate-600"
                            }`}
                          ></span>
                          {isOnline(user.lastActive) ? "Online" : "Offline"}
                        </span>
                        {isInactive(user.lastSeen) && (
                          <span className="ml-2 text-xs bg-amber-500/10 text-amber-400 px-2.5 py-1 rounded-full">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-300">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-300">
                        {formatDate(user.lastSeen)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!searchActive && (
              <div className="flex justify-between items-center mt-4">
                <button
                  onClick={() => loadPage(currentPage - 1)}
                  disabled={currentPage === 0}
                  className="inline-flex items-center gap-1.5 text-sm text-slate-300 hover:text-slate-50 border border-[#1f232b] hover:bg-[#1f232b]/60 px-4 py-2 rounded-full disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
                >
                  <ChevronLeft size={15} />
                  Previous
                </button>
                <span className="text-slate-500 text-sm">
                  Page {currentPage + 1}
                </span>
                <button
                  onClick={() => loadPage(currentPage + 1)}
                  disabled={!hasNextPage}
                  className="inline-flex items-center gap-1.5 text-sm text-slate-300 hover:text-slate-50 border border-[#1f232b] hover:bg-[#1f232b]/60 px-4 py-2 rounded-full disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
                >
                  Next
                  <ChevronRight size={15} />
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}