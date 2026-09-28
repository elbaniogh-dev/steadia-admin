"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  getDocs,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import Sidebar from "@/components/Sidebar";
import { Send, Users, UserCheck } from "lucide-react";

export default function NotificationsPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [adminUid, setAdminUid] = useState(null);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [targetType, setTargetType] = useState("all"); // "all" | "selected"

  const [allUsers, setAllUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [userSearch, setUserSearch] = useState("");

  const [sending, setSending] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/");
        return;
      }
      setAdminUid(user.uid);
      setCheckingAuth(false);
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (checkingAuth) return;
    loadHistory();
  }, [checkingAuth]);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, "notifications"), orderBy("createdAt", "desc"), limit(20))
      );
      setHistory(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      // silent — history is a nice-to-have, not critical
    }
    setHistoryLoading(false);
  };

  const loadUsersForSelection = async () => {
    if (allUsers.length > 0) return; // already loaded
    setUsersLoading(true);
    try {
      const snap = await getDocs(collection(db, "users"));
      setAllUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      setErrorMsg("Failed to load users list.");
    }
    setUsersLoading(false);
  };

  const handleTargetTypeChange = (value) => {
    setTargetType(value);
    if (value === "selected") loadUsersForSelection();
  };

  const toggleUser = (uid) => {
    setSelectedUserIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const filteredUsers = allUsers.filter((u) =>
    (u.email || "").toLowerCase().includes(userSearch.toLowerCase())
  );

  const handleSend = async (e) => {
    e.preventDefault();
    setStatusMsg("");
    setErrorMsg("");

    if (!title.trim() || !body.trim()) {
      setErrorMsg("Title and message are required.");
      return;
    }
    if (targetType === "selected" && selectedUserIds.length === 0) {
      setErrorMsg("Select at least one user, or switch to All Users.");
      return;
    }

    setSending(true);
    try {
      const docData = {
        title: title.trim(),
        body: body.trim(),
        createdAt: serverTimestamp(),
        sentBy: adminUid,
        targetType,
      };
      if (targetType === "selected") {
        docData.targetUserIds = selectedUserIds;
      }

      await addDoc(collection(db, "notifications"), docData);

      setStatusMsg(
        targetType === "all"
          ? "Sent to the in-app inbox for all users."
          : `Sent to the in-app inbox for ${selectedUserIds.length} selected user(s).`
      );
      setTitle("");
      setBody("");
      setSelectedUserIds([]);
      setTargetType("all");
      loadHistory();
    } catch (err) {
      setErrorMsg("Failed to send. Check your connection and try again.");
    }
    setSending(false);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "just now";
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
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-50">Notifications</h1>
          <p className="text-slate-500 text-sm mt-1">
            Send a message to the in-app inbox for all users or a selected group.
          </p>
        </div>

        {errorMsg && (
          <div className="bg-rose-950/40 border border-rose-900/60 text-rose-300 text-sm rounded-xl px-4 py-3 mb-6">
            {errorMsg}
          </div>
        )}
        {statusMsg && (
          <div className="bg-emerald-950/40 border border-emerald-900/60 text-emerald-300 text-sm rounded-xl px-4 py-3 mb-6">
            {statusMsg}
          </div>
        )}

        <form
          onSubmit={handleSend}
          className="bg-[#12141a]/60 border border-[#1f232b] rounded-2xl p-5 mb-8 space-y-4"
        >
          <div>
            <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1.5">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. New feature: transaction filters"
              className="w-full bg-[#0d0e13] border border-[#1f232b] rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/40"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1.5">
              Message
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              placeholder="What do you want to tell them?"
              className="w-full bg-[#0d0e13] border border-[#1f232b] rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/40 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wide text-slate-500 mb-2">
              Send to
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleTargetTypeChange("all")}
                className={`inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-full border transition-colors ${
                  targetType === "all"
                    ? "bg-indigo-500 border-indigo-500 text-white"
                    : "border-[#1f232b] text-slate-300 hover:bg-[#1f232b]/60"
                }`}
              >
                <Users size={14} />
                All Users
              </button>
              <button
                type="button"
                onClick={() => handleTargetTypeChange("selected")}
                className={`inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-full border transition-colors ${
                  targetType === "selected"
                    ? "bg-indigo-500 border-indigo-500 text-white"
                    : "border-[#1f232b] text-slate-300 hover:bg-[#1f232b]/60"
                }`}
              >
                <UserCheck size={14} />
                Select Specific Users
              </button>
            </div>
          </div>

          {targetType === "selected" && (
            <div className="border border-[#1f232b] rounded-xl p-3 bg-[#0d0e13]">
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Filter by email..."
                className="w-full bg-transparent border border-[#1f232b] rounded-lg px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-600 mb-2 focus:outline-none focus:border-indigo-500/60"
              />
              <p className="text-xs text-slate-500 mb-2">
                {selectedUserIds.length} selected
              </p>
              <div className="max-h-56 overflow-y-auto space-y-1">
                {usersLoading ? (
                  <p className="text-sm text-slate-500 px-1">Loading users...</p>
                ) : filteredUsers.length === 0 ? (
                  <p className="text-sm text-slate-500 px-1">No users match.</p>
                ) : (
                  filteredUsers.map((u) => (
                    <label
                      key={u.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#1f232b]/60 cursor-pointer text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selectedUserIds.includes(u.id)}
                        onChange={() => toggleUser(u.id)}
                        className="accent-indigo-500"
                      />
                      <span className="text-slate-200">{u.email || u.id}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={sending}
            className="inline-flex items-center gap-2 bg-indigo-500 text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-indigo-400 disabled:opacity-50 transition-colors"
          >
            <Send size={15} />
            {sending ? "Sending..." : "Send"}
          </button>
        </form>

        <div>
          <h2 className="text-sm font-semibold text-slate-300 mb-3">Recently Sent</h2>
          {historyLoading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-slate-500">Nothing sent yet.</p>
          ) : (
            <div className="space-y-2">
              {history.map((n) => (
                <div
                  key={n.id}
                  className="bg-[#12141a]/60 border border-[#1f232b] rounded-xl px-4 py-3"
                >
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <p className="text-sm font-medium text-slate-100">{n.title}</p>
                      <p className="text-sm text-slate-400 mt-0.5">{n.body}</p>
                    </div>
                    <span className="text-xs text-slate-500 whitespace-nowrap">
                      {formatDate(n.createdAt)}
                    </span>
                  </div>
                  <span
                    className={`inline-block mt-2 text-xs px-2.5 py-1 rounded-full ${
                      n.targetType === "all"
                        ? "bg-indigo-500/10 text-indigo-400"
                        : "bg-slate-800/60 text-slate-400"
                    }`}
                  >
                    {n.targetType === "all"
                      ? "All users"
                      : `${n.targetUserIds?.length ?? 0} selected user(s)`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}