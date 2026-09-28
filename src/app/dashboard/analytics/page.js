"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import Sidebar from "@/components/Sidebar";
import { Users, Receipt, Wallet, Package, Boxes, Contact } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const SIGNUP_DAYS = 30;

const buildSignupSeries = (userDocs) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const buckets = [];
  const indexByKey = {};

  for (let i = SIGNUP_DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    indexByKey[d.toDateString()] = buckets.length;
    buckets.push({
      label: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      signups: 0,
    });
  }

  userDocs.forEach((d) => {
    const ts = d.data().createdAt;
    if (!ts || !ts.toDate) return;
    const key = ts.toDate().toDateString();
    if (key in indexByKey) buckets[indexByKey[key]].signups++;
  });

  return buckets;
};

export default function AnalyticsPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [signupSeries, setSignupSeries] = useState([]);
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
      setSignupSeries(buildSignupSeries(usersSnap.docs));
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
      <div className="min-h-screen bg-[#0a0b0f] text-slate-100 flex items-center justify-center">
        Checking access...
      </div>
    );
  }

  const cards = [
    { label: "Total Users", value: stats.userCount, icon: Users },
    { label: "Total Transactions", value: stats.txCount, icon: Receipt },
    { label: "Total Transaction Amount", value: formatNaira(stats.txTotal), icon: Wallet },
    { label: "Total Stock Items", value: stats.stockCount, icon: Package },
    { label: "Total Stock Value (cost)", value: formatNaira(stats.stockValue), icon: Boxes },
    { label: "Total Contacts", value: stats.contactCount, icon: Contact },
  ];

  const recentSignups = signupSeries.reduce((sum, p) => sum + p.signups, 0);

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-[#0a0b0f] text-slate-100">
      <Sidebar />

      <main className="flex-1 p-4 sm:p-8 min-w-0">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-slate-50">Analytics</h1>
          <p className="text-slate-500 text-sm mt-1">Totals across all users</p>
        </div>

        {error && (
          <div className="bg-rose-950/40 border border-rose-900/60 text-rose-300 text-sm rounded-xl px-4 py-3 mb-6 flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            <button
              onClick={computeStats}
              className="text-sm border border-rose-900/60 px-3 py-1.5 rounded-lg hover:text-rose-100 text-rose-300 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <p className="text-slate-500">Crunching numbers across all users...</p>
        ) : !error ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
              {cards.map((card) => {
                const Icon = card.icon;
                return (
                  <div
                    key={card.label}
                    className="bg-[#12141a]/60 border border-[#1f232b] rounded-2xl p-5"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-slate-500 text-xs uppercase tracking-wide">
                        {card.label}
                      </p>
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                        <Icon size={16} className="text-indigo-400" />
                      </div>
                    </div>
                    <p className="text-2xl font-bold tracking-tight break-words text-slate-50">
                      {card.value}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="bg-[#12141a]/60 border border-[#1f232b] rounded-2xl p-5">
              <div className="flex flex-wrap items-end justify-between gap-2 mb-4">
                <div>
                  <h2 className="text-sm font-medium text-slate-100">New signups</h2>
                  <p className="text-slate-500 text-xs mt-0.5">Last {SIGNUP_DAYS} days</p>
                </div>
                <p className="text-2xl font-bold tracking-tight text-slate-50">{recentSignups}</p>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={signupSeries} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="signupFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#818cf8" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#1f232b" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "#64748b", fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                      minTickGap={24}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: "#64748b", fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#0d0e13",
                        border: "1px solid #1f232b",
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                      labelStyle={{ color: "#94a3b8" }}
                      itemStyle={{ color: "#818cf8" }}
                      cursor={{ stroke: "#312e81" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="signups"
                      name="Signups"
                      stroke="#6366f1"
                      strokeWidth={2}
                      fill="url(#signupFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}