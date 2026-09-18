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

  // Which row is currently being edited, per section, and the draft values.
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

    setLoading(false);
  };

  const formatFirestoreDate = (timestamp) => {
    if (!timestamp) return "—";
    return timestamp.toDate().toLocaleString();
  };

  // Transaction dates are stored as plain ISO text strings (Steadia's
  // toMap()/fromMap() pattern), not Firestore's native timestamp type.
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
  };

  const deleteTx = async (id) => {
    if (!confirm("Delete this transaction? This cannot be undone.")) return;
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
  };

  // ---------- Stock items ----------

  const startEditStock = (s) => {
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
  };

  const deleteStock = async (id) => {
    if (!confirm("Delete this stock item? This cannot be undone.")) return;
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
  };

  // ---------- Contacts ----------

  const startEditContact = (c) => {
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
  };

  const deleteContact = async (id) => {
    if (!confirm("Delete this contact? This cannot be undone.")) return;
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
  };

  // ---------- Render ----------

  if (checkingAuth || loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Loading...
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p>User not found.</p>
      </div>
    );
  }

  const inputClass =
    "bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm w-full";

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <button
        onClick={() => router.push("/dashboard")}
        className="text-sm text-neutral-400 hover:text-white mb-6"
      >
        ← Back to all users
      </button>

      <h1 className="text-2xl font-bold mb-1">{user.email || "Unknown user"}</h1>
      <p className="text-neutral-500 text-sm mb-8">User ID: {user.id}</p>

      <div className="grid grid-cols-2 gap-4 mb-10 max-w-md">
        <div className="border border-neutral-800 rounded-xl p-4">
          <p className="text-neutral-500 text-xs mb-1">Signed Up</p>
          <p>{formatFirestoreDate(user.createdAt)}</p>
        </div>
        <div className="border border-neutral-800 rounded-xl p-4">
          <p className="text-neutral-500 text-xs mb-1">Last Seen</p>
          <p>{formatFirestoreDate(user.lastSeen)}</p>
        </div>
      </div>

      {/* Transactions */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">
            Transactions ({transactions.length})
          </h2>
          {transactions.length > 0 && (
            <button
              onClick={exportTransactionsCsv}
              className="text-sm text-neutral-400 hover:text-white border border-neutral-700 px-3 py-1.5 rounded-lg"
            >
              Export CSV
            </button>
          )}
        </div>
        {transactions.length === 0 ? (
          <p className="text-neutral-500 text-sm">No transactions.</p>
        ) : (
          <div className="border border-neutral-800 rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[800px]">
              <thead className="bg-neutral-900 text-neutral-400">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) =>
                  editingTxId === t.id ? (
                    <tr key={t.id} className="border-t border-neutral-800 bg-neutral-900/50">
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
                        <button onClick={() => saveEditTx(t.id)} className="text-green-400 text-xs mr-3">
                          Save
                        </button>
                        <button onClick={cancelEditTx} className="text-neutral-400 text-xs">
                          Cancel
                        </button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={t.id} className="border-t border-neutral-800">
                      <td className="px-4 py-3">{formatIsoDate(t.date)}</td>
                      <td className="px-4 py-3 capitalize">{t.type}</td>
                      <td className="px-4 py-3">{t.description}</td>
                      <td className="px-4 py-3">{t.amount}</td>
                      <td className="px-4 py-3">{t.category || "—"}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button onClick={() => startEditTx(t)} className="text-blue-400 text-xs mr-3">
                          Edit
                        </button>
                        <button onClick={() => deleteTx(t.id)} className="text-red-400 text-xs">
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
          <h2 className="text-lg font-semibold">
            Stock Items ({stockItems.length})
          </h2>
          {stockItems.length > 0 && (
            <button
              onClick={exportStockCsv}
              className="text-sm text-neutral-400 hover:text-white border border-neutral-700 px-3 py-1.5 rounded-lg"
            >
              Export CSV
            </button>
          )}
        </div>
        {stockItems.length === 0 ? (
          <p className="text-neutral-500 text-sm">No stock items.</p>
        ) : (
          <div className="border border-neutral-800 rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[700px]">
              <thead className="bg-neutral-900 text-neutral-400">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Quantity</th>
                  <th className="px-4 py-3">Cost Price</th>
                  <th className="px-4 py-3">Selling Price</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {stockItems.map((s) =>
                  editingStockId === s.id ? (
                    <tr key={s.id} className="border-t border-neutral-800 bg-neutral-900/50">
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
                        <button onClick={() => saveEditStock(s.id)} className="text-green-400 text-xs mr-3">
                          Save
                        </button>
                        <button onClick={cancelEditStock} className="text-neutral-400 text-xs">
                          Cancel
                        </button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={s.id} className="border-t border-neutral-800">
                      <td className="px-4 py-3">{s.name}</td>
                      <td className="px-4 py-3">{s.quantity}</td>
                      <td className="px-4 py-3">{s.costPrice}</td>
                      <td className="px-4 py-3">{s.sellingPrice}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button onClick={() => startEditStock(s)} className="text-blue-400 text-xs mr-3">
                          Edit
                        </button>
                        <button onClick={() => deleteStock(s.id)} className="text-red-400 text-xs">
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
          <h2 className="text-lg font-semibold">
            Contacts ({contacts.length})
          </h2>
          {contacts.length > 0 && (
            <button
              onClick={exportContactsCsv}
              className="text-sm text-neutral-400 hover:text-white border border-neutral-700 px-3 py-1.5 rounded-lg"
            >
              Export CSV
            </button>
          )}
        </div>
        {contacts.length === 0 ? (
          <p className="text-neutral-500 text-sm">No contacts.</p>
        ) : (
          <div className="border border-neutral-800 rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[550px]">
              <thead className="bg-neutral-900 text-neutral-400">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Balance</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) =>
                  editingContactId === c.id ? (
                    <tr key={c.id} className="border-t border-neutral-800 bg-neutral-900/50">
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
                        <button onClick={() => saveEditContact(c.id)} className="text-green-400 text-xs mr-3">
                          Save
                        </button>
                        <button onClick={cancelEditContact} className="text-neutral-400 text-xs">
                          Cancel
                        </button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={c.id} className="border-t border-neutral-800">
                      <td className="px-4 py-3">{c.name}</td>
                      <td className="px-4 py-3">{c.phone || "—"}</td>
                      <td className="px-4 py-3">{c.balance}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button onClick={() => startEditContact(c)} className="text-blue-400 text-xs mr-3">
                          Edit
                        </button>
                        <button onClick={() => deleteContact(c.id)} className="text-red-400 text-xs">
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
    </div>
  );
}