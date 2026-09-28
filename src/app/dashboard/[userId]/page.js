"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { logAction } from "@/lib/logAction";
import Sidebar from "@/components/Sidebar";

export default function UserDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.userId;

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [user, setUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");

  const [editingTxId, setEditingTxId] = useState(null);
  const [txDraft, setTxDraft] = useState({});
  const [editingStockId, setEditingStockId] = useState(null);
  const [stockDraft, setStockDraft] = useState({});
  const [editingContactId, setEditingContactId] = useState(null);
  const [contactDraft, setContactDraft] = useState({});

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push("/");
      } else {
        setCheckingAuth(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (checkingAuth) return;
    fetchAll();
  }, [checkingAuth, userId]);

  const fetchAll = async () => {
    setLoadError("");
    try {
      const userSnap = await getDoc(doc(db, "users", userId));
      if (!userSnap.exists()) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setUser({ id: userSnap.id, ...userSnap.data() });

      const [txSnap, stockSnap, contactSnap] = await Promise.all([
        getDocs(collection(db, "users", userId, "transactions")),
        getDocs(collection(db, "users", userId, "stock_items")),
        getDocs(collection(db, "users", userId, "contacts")),
      ]);

      setTransactions(txSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setStockItems(stockSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setContacts(contactSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      setLoadError("Failed to load this user's data. Try refreshing the page.");
    }
    setLoading(false);
  };

  const formatFirestoreDate = (timestamp) => {
    if (!timestamp) return "—";
    return timestamp.toDate().toLocaleString();
  };

  const formatIsoDate = (isoString) => {
    if (!isoString) return "—";
    return new Date(isoString).toLocaleString();
  };

  // ---------- CSV export ----------

  const escapeCsvValue = (value) => {
    const str = value === null || value === undefined ? "" : String(value);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };

  const downloadCsv = (filename, headers, rows) => {
    const headerLine = headers.map(escapeCsvValue).join(",");
    const dataLines = rows.map((row) => row.map(escapeCsvValue).join(","));
    const csvContent = [headerLine, ...dataLines].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportTransactionsCsv = () => {
    const headers = ["Date", "Type", "Description", "Amount", "Category"];
    const rows = transactions.map((t) => [
      formatIsoDate(t.date),
      t.type || "",
      t.description || "",
      t.amount ?? "",
      t.category || "",
    ]);
    downloadCsv(`${user.email || userId}_transactions.csv`, headers, rows);
  };

  const exportStockCsv = () => {
    const headers = ["Name", "Quantity", "Cost Price", "Selling Price"];
    const rows = stockItems.map((s) => [
      s.name || "",
      s.quantity ?? "",
      s.costPrice ?? "",
      s.sellingPrice ?? "",
    ]);
    downloadCsv(`${user.email || userId}_stock.csv`, headers, rows);
  };

  const exportContactsCsv = () => {
    const headers = ["Name", "Phone", "Balance"];
    const rows = contacts.map((c) => [c.name || "", c.phone || "", c.balance ?? ""]);
    downloadCsv(`${user.email || userId}_contacts.csv`, headers, rows);
  };

  // ---------- Transactions ----------

  const startEditTx = (t) => {
    setActionError("");
    setEditingTxId(t.id);
    setTxDraft({
      date: t.date || "",
      type: t.type || "",
      description: t.description || "",
      amount: t.amount ?? "",
      category: t.category || "",
    });
  };

  const cancelEditTx = () => {
    setEditingTxId(null);
    setTxDraft({});
  };

  const saveEditTx = async (id) => {
    setActionError("");
    try {
      await updateDoc(doc(db, "users", userId, "transactions", id), {
        date: txDraft.date,
        type: txDraft.type,
        description: txDraft.description,
        amount: Number(txDraft.amount),
        category: txDraft.category,
      });
      await logAction({
        adminEmail: auth.currentUser?.email || "unknown",
        action: "edit",
        targetUserId: userId,
        targetCollection: "transactions",
        targetDocId: id,
        details: `Edited transaction: ${txDraft.description} (${txDraft.amount})`,
      });
      setEditingTxId(null);
      setTxDraft({});
      fetchAll();
    } catch (err) {
      setActionError("Failed to save transaction. Try again.");
    }
  };

  const deleteTx = async (id) => {
    if (!confirm("Delete this transaction? This cannot be undone.")) return;
    setActionError("");
    try {
      const tx = transactions.find((t) => t.id === id);
      await deleteDoc(doc(db, "users", userId, "transactions", id));
      await logAction({
        adminEmail: auth.currentUser?.email || "unknown",
        action: "delete",
        targetUserId: userId,
        targetCollection: "transactions",
        targetDocId: id,
        details: tx ? `Deleted transaction: ${tx.description} (${tx.amount})` : "Deleted transaction",
      });
      fetchAll();
    } catch (err) {
      setActionError("Failed to delete transaction. Try again.");
    }
  };

  // ---------- Stock items ----------

  const startEditStock = (s) => {
    setActionError("");
    setEditingStockId(s.id);
    setStockDraft({
      name: s.name || "",
      quantity: s.quantity ?? "",
      costPrice: s.costPrice ?? "",
      sellingPrice: s.sellingPrice ?? "",
    });
  };

  const cancelEditStock = () => {
    setEditingStockId(null);
    setStockDraft({});
  };

  const saveEditStock = async (id) => {
    setActionError("");
    try {
      await updateDoc(doc(db, "users", userId, "stock_items", id), {
        name: stockDraft.name,
        quantity: Number(stockDraft.quantity),
        costPrice: Number(stockDraft.costPrice),
        sellingPrice: Number(stockDraft.sellingPrice),
      });
      await logAction({
        adminEmail: auth.currentUser?.email || "unknown",
        action: "edit",
        targetUserId: userId,
        targetCollection: "stock_items",
        targetDocId: id,
        details: `Edited stock item: ${stockDraft.name}`,
      });
      setEditingStockId(null);
      setStockDraft({});
      fetchAll();
    } catch (err) {
      setActionError("Failed to save stock item. Try again.");
    }
  };

  const deleteStock = async (id) => {
    if (!confirm("Delete this stock item? This cannot be undone.")) return;
    setActionError("");
    try {
      const stockItem = stockItems.find((s) => s.id === id);
      await deleteDoc(doc(db, "users", userId, "stock_items", id));
      await logAction({
        adminEmail: auth.currentUser?.email || "unknown",
        action: "delete",
        targetUserId: userId,
        targetCollection: "stock_items",
        targetDocId: id,
        details: stockItem ? `Deleted stock item: ${stockItem.name}` : "Deleted stock item",
      });
      fetchAll();
    } catch (err) {
      setActionError("Failed to delete stock item. Try again.");
    }
  };

  // ---------- Contacts ----------

  const startEditContact = (c) => {
    setActionError("");
    setEditingContactId(c.id);
    setContactDraft({
      name: c.name || "",
      phone: c.phone || "",
      balance: c.balance ?? "",
    });
  };

  const cancelEditContact = () => {
    setEditingContactId(null);
    setContactDraft({});
  };

  const saveEditContact = async (id) => {
    setActionError("");
    try {
      await updateDoc(doc(db, "users", userId, "contacts", id), {
        name: contactDraft.name,
        phone: contactDraft.phone,
        balance: Number(contactDraft.balance),
      });
      await logAction({
        adminEmail: auth.currentUser?.email || "unknown",
        action: "edit",
        targetUserId: userId,
        targetCollection: "contacts",
        targetDocId: id,
        details: `Edited contact: ${contactDraft.name}`,
      });
      setEditingContactId(null);
      setContactDraft({});
      fetchAll();
    } catch (err) {
      setActionError("Failed to save contact. Try again.");
    }
  };

  const deleteContact = async (id) => {
    if (!confirm("Delete this contact? This cannot be undone.")) return;
    setActionError("");
    try {
      const contact = contacts.find((c) => c.id === id);
      await deleteDoc(doc(db, "users", userId, "contacts", id));
      await logAction({
        adminEmail: auth.currentUser?.email || "unknown",
        action: "delete",
        targetUserId: userId,
        targetCollection: "contacts",
        targetDocId: id,
        details: contact ? `Deleted contact: ${contact.name}` : "Deleted contact",
      });
      fetchAll();
    } catch (err) {
      setActionError("Failed to delete contact. Try again.");
    }
  };

  // ---------- Render ----------

  if (checkingAuth || loading) {
    return (
      <div className="min-h-screen bg-[#0a0b0f] text-slate-100 flex items-center justify-center">
        Checking access...
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex flex-col lg:flex-row min-h-screen bg-[#0a0b0f] text-slate-100">
        <Sidebar />
        <main className="flex-1 p-4 sm:p-8 min-w-0 flex items-center justify-center">
          <p className="text-slate-500">User not found.</p>
        </main>
      </div>
    );
  }

  const inputClass =
    "bg-[#0d0e13] border border-[#1f232b] text-slate-100 rounded-lg px-2 py-1 text-sm w-full focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/40";

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-[#0a0b0f] text-slate-100">
      <Sidebar />
      <main className="flex-1 p-4 sm:p-8 min-w-0">
        <h1 className="text-2xl font-bold tracking-tight break-words text-slate-50">
          {user.email || "Unknown user"}
        </h1>
        <p className="text-slate-500 text-sm mt-1 mb-6 break-all">User ID: {user.id}</p>

        {loadError && (
          <div className="bg-rose-950/40 border border-rose-900/60 text-rose-300 text-sm rounded-xl px-4 py-3 mb-6 flex flex-wrap items-center justify-between gap-3">
            <span>{loadError}</span>
            <button
              onClick={fetchAll}
              className="text-sm border border-rose-900/60 px-3 py-1.5 rounded-lg hover:text-rose-100 text-rose-300"
            >
              Retry
            </button>
          </div>
        )}

        {actionError && (
          <div className="bg-rose-950/40 border border-rose-900/60 text-rose-300 text-sm rounded-xl px-4 py-3 mb-6">
            {actionError}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10 max-w-md">
          <div className="bg-[#12141a]/60 border border-[#1f232b] rounded-2xl p-5">
            <p className="text-slate-500 text-xs mb-1">Signed Up</p>
            <p className="text-slate-100">{formatFirestoreDate(user.createdAt)}</p>
          </div>
          <div className="bg-[#12141a]/60 border border-[#1f232b] rounded-2xl p-5">
            <p className="text-slate-500 text-xs mb-1">Last Seen</p>
            <p className="text-slate-100">{formatFirestoreDate(user.lastSeen)}</p>
          </div>
        </div>

        {/* Transactions */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-slate-50">
              Transactions ({transactions.length})
            </h2>
            {transactions.length > 0 && (
              <button
                onClick={exportTransactionsCsv}
                className="text-sm text-slate-300 hover:text-slate-100 border border-[#1f232b] hover:border-slate-600 px-3 py-1.5 rounded-lg"
              >
                Export CSV
              </button>
            )}
          </div>
          {transactions.length === 0 ? (
            <div className="bg-[#12141a]/60 border border-[#1f232b] rounded-2xl p-5">
              <p className="text-slate-500 text-sm">No transactions.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-[#1f232b] overflow-hidden overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[800px]">
                <thead className="bg-[#12141a]/80 text-slate-500 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Description</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) =>
                    editingTxId === t.id ? (
                      <tr key={t.id} className="border-t border-[#1f232b]/80 bg-[#1f232b]/40">
                        <td className="px-4 py-2">
                          <input
                            type="datetime-local"
                            className={inputClass}
                            value={txDraft.date ? txDraft.date.slice(0, 16) : ""}
                            onChange={(e) =>
                              setTxDraft({ ...txDraft, date: new Date(e.target.value).toISOString() })
                            }
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            className={inputClass}
                            value={txDraft.type}
                            onChange={(e) => setTxDraft({ ...txDraft, type: e.target.value })}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            className={inputClass}
                            value={txDraft.description}
                            onChange={(e) => setTxDraft({ ...txDraft, description: e.target.value })}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            className={inputClass}
                            value={txDraft.amount}
                            onChange={(e) => setTxDraft({ ...txDraft, amount: e.target.value })}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            className={inputClass}
                            value={txDraft.category}
                            onChange={(e) => setTxDraft({ ...txDraft, category: e.target.value })}
                          />
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <button
                            onClick={() => saveEditTx(t.id)}
                            className="text-xs text-white bg-indigo-500 px-2.5 py-1 rounded-full mr-2 hover:bg-indigo-400"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelEditTx}
                            className="text-xs text-slate-300 border border-[#1f232b] px-2.5 py-1 rounded-full hover:text-slate-100 hover:border-slate-600"
                          >
                            Cancel
                          </button>
                        </td>
                      </tr>
                    ) : (
                      <tr key={t.id} className="border-t border-[#1f232b]/80 hover:bg-[#1f232b]/40">
                        <td className="px-4 py-3 whitespace-nowrap text-slate-500">{formatIsoDate(t.date)}</td>
                        <td className="px-4 py-3 capitalize text-slate-300">{t.type}</td>
                        <td className="px-4 py-3 text-slate-300">{t.description}</td>
                        <td className="px-4 py-3 text-slate-300">{t.amount}</td>
                        <td className="px-4 py-3 text-slate-500">{t.category || "—"}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button
                            onClick={() => startEditTx(t)}
                            className="text-xs text-slate-300 border border-[#1f232b] px-2.5 py-1 rounded-full mr-2 hover:text-slate-100 hover:border-slate-600"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteTx(t.id)}
                            className="text-xs text-rose-400 border border-rose-900/60 px-2.5 py-1 rounded-full hover:text-rose-300 hover:border-rose-800"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Stock */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-slate-50">
              Stock Items ({stockItems.length})
            </h2>
            {stockItems.length > 0 && (
              <button
                onClick={exportStockCsv}
                className="text-sm text-slate-300 hover:text-slate-100 border border-[#1f232b] hover:border-slate-600 px-3 py-1.5 rounded-lg"
              >
                Export CSV
              </button>
            )}
          </div>
          {stockItems.length === 0 ? (
            <div className="bg-[#12141a]/60 border border-[#1f232b] rounded-2xl p-5">
              <p className="text-slate-500 text-sm">No stock items.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-[#1f232b] overflow-hidden overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[700px]">
                <thead className="bg-[#12141a]/80 text-slate-500 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Quantity</th>
                    <th className="px-4 py-3 font-medium">Cost Price</th>
                    <th className="px-4 py-3 font-medium">Selling Price</th>
                    <th className="px-4 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {stockItems.map((s) =>
                    editingStockId === s.id ? (
                      <tr key={s.id} className="border-t border-[#1f232b]/80 bg-[#1f232b]/40">
                        <td className="px-4 py-2">
                          <input
                            className={inputClass}
                            value={stockDraft.name}
                            onChange={(e) => setStockDraft({ ...stockDraft, name: e.target.value })}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            className={inputClass}
                            value={stockDraft.quantity}
                            onChange={(e) => setStockDraft({ ...stockDraft, quantity: e.target.value })}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            className={inputClass}
                            value={stockDraft.costPrice}
                            onChange={(e) => setStockDraft({ ...stockDraft, costPrice: e.target.value })}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            className={inputClass}
                            value={stockDraft.sellingPrice}
                            onChange={(e) => setStockDraft({ ...stockDraft, sellingPrice: e.target.value })}
                          />
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <button
                            onClick={() => saveEditStock(s.id)}
                            className="text-xs text-white bg-indigo-500 px-2.5 py-1 rounded-full mr-2 hover:bg-indigo-400"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelEditStock}
                            className="text-xs text-slate-300 border border-[#1f232b] px-2.5 py-1 rounded-full hover:text-slate-100 hover:border-slate-600"
                          >
                            Cancel
                          </button>
                        </td>
                      </tr>
                    ) : (
                      <tr key={s.id} className="border-t border-[#1f232b]/80 hover:bg-[#1f232b]/40">
                        <td className="px-4 py-3 text-slate-300">{s.name}</td>
                        <td className="px-4 py-3 text-slate-300">{s.quantity}</td>
                        <td className="px-4 py-3 text-slate-300">{s.costPrice}</td>
                        <td className="px-4 py-3 text-slate-300">{s.sellingPrice}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button
                            onClick={() => startEditStock(s)}
                            className="text-xs text-slate-300 border border-[#1f232b] px-2.5 py-1 rounded-full mr-2 hover:text-slate-100 hover:border-slate-600"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteStock(s.id)}
                            className="text-xs text-rose-400 border border-rose-900/60 px-2.5 py-1 rounded-full hover:text-rose-300 hover:border-rose-800"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Contacts */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-slate-50">
              Contacts ({contacts.length})
            </h2>
            {contacts.length > 0 && (
              <button
                onClick={exportContactsCsv}
                className="text-sm text-slate-300 hover:text-slate-100 border border-[#1f232b] hover:border-slate-600 px-3 py-1.5 rounded-lg"
              >
                Export CSV
              </button>
            )}
          </div>
          {contacts.length === 0 ? (
            <div className="bg-[#12141a]/60 border border-[#1f232b] rounded-2xl p-5">
              <p className="text-slate-500 text-sm">No contacts.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-[#1f232b] overflow-hidden overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[550px]">
                <thead className="bg-[#12141a]/80 text-slate-500 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Phone</th>
                    <th className="px-4 py-3 font-medium">Balance</th>
                    <th className="px-4 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((c) =>
                    editingContactId === c.id ? (
                      <tr key={c.id} className="border-t border-[#1f232b]/80 bg-[#1f232b]/40">
                        <td className="px-4 py-2">
                          <input
                            className={inputClass}
                            value={contactDraft.name}
                            onChange={(e) => setContactDraft({ ...contactDraft, name: e.target.value })}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            className={inputClass}
                            value={contactDraft.phone}
                            onChange={(e) => setContactDraft({ ...contactDraft, phone: e.target.value })}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            className={inputClass}
                            value={contactDraft.balance}
                            onChange={(e) => setContactDraft({ ...contactDraft, balance: e.target.value })}
                          />
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <button
                            onClick={() => saveEditContact(c.id)}
                            className="text-xs text-white bg-indigo-500 px-2.5 py-1 rounded-full mr-2 hover:bg-indigo-400"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelEditContact}
                            className="text-xs text-slate-300 border border-[#1f232b] px-2.5 py-1 rounded-full hover:text-slate-100 hover:border-slate-600"
                          >
                            Cancel
                          </button>
                        </td>
                      </tr>
                    ) : (
                      <tr key={c.id} className="border-t border-[#1f232b]/80 hover:bg-[#1f232b]/40">
                        <td className="px-4 py-3 text-slate-300">{c.name}</td>
                        <td className="px-4 py-3 text-slate-500">{c.phone || "—"}</td>
                        <td className="px-4 py-3 text-slate-300">{c.balance}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button
                            onClick={() => startEditContact(c)}
                            className="text-xs text-slate-300 border border-[#1f232b] px-2.5 py-1 rounded-full mr-2 hover:text-slate-100 hover:border-slate-600"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteContact(c.id)}
                            className="text-xs text-rose-400 border border-rose-900/60 px-2.5 py-1 rounded-full hover:text-rose-300 hover:border-rose-800"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}