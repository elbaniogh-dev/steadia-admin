"use client";

import { useEffect, useState } from "react";
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

const PAGE_SIZE = 25;

export default function DashboardPage() {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [totalCount, setTotalCount] = useState(null);

  const [pageCursors, setPageCursors] = useState([null]);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [searchActive, setSearchActive] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/");
        return;
      }
      const adminSnap = await getDoc(doc(db, "admins", user.uid));
      if (adminSnap.exists() && adminSnap.data().role === "owner") {
        setIsOwner(true);
      }
      setCheckingAuth(false);
    });
    return () => unsubscribe();
  }, [router]);

  const loadPage = async (pageIndex, cursorsOverride) => {
    setLoading(true);
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

    setLoading(false);
  };

  useEffect(() => {
    if (checkingAuth) return;

    getCountFromServer(collection(db, "users")).then((snap) => {
      setTotalCount(snap.data().count);
    });

    loadPage(0, [null]);

    const interval = setInterval(() => {
      if (!searchActive) loadPage(currentPage);
    }, 30000);
    return () => clearInterval(interval);
  }, [checkingAuth]);

  const handleSearch = async (e) => {
    e.preventDefault();
    const term = searchInput.trim().toLowerCase();
    if (!term) return;

    setSearching(true);
    setSearchActive(true);

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
    setSearching(false);
  };

  const clearSearch = () => {
    setSearchInput("");
    setSearchActive(false);
    setSearchResults([]);
  };

  const handleSignOut = async () => {
    await signOut(auth);
    router.push("/");
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

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Checking access...
      </div>
    );
  }

  const displayedUsers = searchActive ? searchResults : users;

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Steadia Admin</h1>
          <p className="text-neutral-400 text-sm">
            {totalCount === null ? "Loading total..." : `${totalCount} total users`}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => router.push("/dashboard/analytics")}
            className="text-sm text-neutral-400 hover:text-white border border-neutral-700 px-4 py-2 rounded-lg"
          >
            Analytics
          </button>
          {isOwner && (
            <button
              onClick={() => router.push("/dashboard/admins")}
              className="text-sm text-neutral-400 hover:text-white border border-neutral-700 px-4 py-2 rounded-lg"
            >
              Manage Admins
            </button>
          )}
          {isOwner && (
            <button
              onClick={() => router.push("/dashboard/logs")}
              className="text-sm text-neutral-400 hover:text-white border border-neutral-700 px-4 py-2 rounded-lg"
            >
              View Logs
            </button>
          )}
          <button
            onClick={handleSignOut}
            className="text-sm text-neutral-400 hover:text-white border border-neutral-700 px-4 py-2 rounded-lg"
          >
            Sign Out
          </button>
        </div>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 mb-6 max-w-md">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by email..."
          className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={searching}
          className="bg-white text-black px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {searching ? "Searching..." : "Search"}
        </button>
        {searchActive && (
          <button
            type="button"
            onClick={clearSearch}
            className="text-sm text-neutral-400 hover:text-white border border-neutral-700 px-4 py-2 rounded-lg"
          >
            Clear
          </button>
        )}
      </form>

      {loading && !searchActive ? (
        <p className="text-neutral-400">Loading...</p>
      ) : (
        <>
          {searchActive && (
            <p className="text-neutral-500 text-sm mb-3">
              {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} for &quot;{searchInput}&quot;
            </p>
          )}

          <div className="border border-neutral-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-900 text-neutral-400">
                <tr>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Signed Up</th>
                  <th className="px-4 py-3">Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {displayedUsers.map((user) => (
                  <tr
                    key={user.id}
                    onClick={() => router.push(`/dashboard/${user.id}`)}
                    className="border-t border-neutral-800 hover:bg-neutral-900 cursor-pointer"
                  >
                    <td className="px-4 py-3">{user.email || "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block w-2 h-2 rounded-full mr-2 ${
                          isOnline(user.lastActive) ? "bg-green-500" : "bg-neutral-600"
                        }`}
                      ></span>
                      {isOnline(user.lastActive) ? "Online" : "Offline"}
                    </td>
                    <td className="px-4 py-3">{formatDate(user.createdAt)}</td>
                    <td className="px-4 py-3">{formatDate(user.lastSeen)}</td>
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
          )}
        </>
      )}
    </div>
  );
}