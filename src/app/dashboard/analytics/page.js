"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export default function AnalyticsPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stats, setStats] = useState({
    userCount: 0,
    txCount: 0,
    txTotal: 0,
    stockCount: 0,
    stockValue: 0,
    contactCount: 0,
  });

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
    computeStats();
  }, [checkingAuth]);

  const computeStats = async () => {
    setLoading(true);
    setError("");
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      const userIds = usersSnap.docs.map((d) => d.id);

      let txCount = 0;
      let txTotal = 0;
      let stockCount = 0;
      let stockValue = 0;
      let contactCount = 0;

      await Promise.all(
        userIds.map(async (uid) => {
          const [txSnap, stockSnap, contactSnap] = await Promise.all([
            getDocs(collection(db, "users", uid, "transactions")),
            getDocs(collection(db, "users", uid, "stock_items")),
            getDocs(collection(db, "users", uid, "contacts")),
          ]);

          txSnap.docs.forEach((d) => {
            txCount++;
            const amount = Number(d.data().amount) || 0;
            txTotal += amount;
          });

          stockSnap.docs.forEach((d) => {
            stockCount++;
            const qty = Number(d.data().quantity) || 0;
            const cost = Number(d.data().costPrice) || 0;
            stockValue += qty * cost;
          });

          contactCount += contactSnap.docs.length;
        })
      );

      setStats({
        userCount: userIds.length,
        txCount,
        txTotal,
        stockCount,
        stockValue,
        contactCount,
      });
    } catch (err) {
      setError("Failed to compute analytics. Try refreshing the page.");
    }
    setLoading(false);
  };

  const formatNaira = (n) => {
    return "₦" + n.toLocaleString("en-NG", { maximumFractionDigits: 2 });
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

      <h1 className="text-2xl font-bold mb-6">Analytics</h1>

      {error && (
        <div className="bg-red-950 border border-red-800 text-red-300 text-sm rounded-lg px-4 py-3 mb-6 flex flex-wrap items-center justify-between gap-3 max-w-4xl">
          <span>{error}</span>
          <button
            onClick={computeStats}
            className="text-sm border border-red-800 px-3 py-1.5 rounded-lg hover:text-white text-red-300"
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-neutral-400">Crunching numbers across all users...</p>
      ) : !error ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl">
          <div className="border border-neutral-800 rounded-xl p-5">
            <p className="text-neutral-500 text-xs mb-1">Total Users</p>
            <p className="text-2xl font-bold">{stats.userCount}</p>
          </div>
          <div className="border border-neutral-800 rounded-xl p-5">
            <p className="text-neutral-500 text-xs mb-1">Total Transactions</p>
            <p className="text-2xl font-bold">{stats.txCount}</p>
          </div>
          <div className="border border-neutral-800 rounded-xl p-5">
            <p className="text-neutral-500 text-xs mb-1">Total Transaction Amount</p>
            <p className="text-2xl font-bold break-words">{formatNaira(stats.txTotal)}</p>
          </div>
          <div className="border border-neutral-800 rounded-xl p-5">
            <p className="text-neutral-500 text-xs mb-1">Total Stock Items</p>
            <p className="text-2xl font-bold">{stats.stockCount}</p>
          </div>
          <div className="border border-neutral-800 rounded-xl p-5">
            <p className="text-neutral-500 text-xs mb-1">Total Stock Value (cost)</p>
            <p className="text-2xl font-bold break-words">{formatNaira(stats.stockValue)}</p>
          </div>
          <div className="border border-neutral-800 rounded-xl p-5">
            <p className="text-neutral-500 text-xs mb-1">Total Contacts</p>
            <p className="text-2xl font-bold">{stats.contactCount}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}