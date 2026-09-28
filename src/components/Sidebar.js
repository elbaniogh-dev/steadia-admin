"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import {
  LayoutDashboard,
  BarChart3,
  UserX,
  ScrollText,
  ShieldCheck,
  LogOut,
  Menu,
  X,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Users", icon: LayoutDashboard, ownerOnly: false },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3, ownerOnly: false },
  { href: "/dashboard/inactive", label: "Inactive Users", icon: UserX, ownerOnly: false },
  { href: "/dashboard/logs", label: "Activity Log", icon: ScrollText, ownerOnly: true },
  { href: "/dashboard/admins", label: "Manage Admins", icon: ShieldCheck, ownerOnly: true },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isOwner, setIsOwner] = useState(false);
  const [email, setEmail] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      setEmail(user.email || "");
      try {
        const adminSnap = await getDoc(doc(db, "admins", user.uid));
        if (adminSnap.exists() && adminSnap.data().role === "owner") {
          setIsOwner(true);
        }
      } catch (err) {
        // Sidebar stays usable even if this check fails; pages guard their own access.
      }
    });
    return () => unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await signOut(auth);
    router.push("/");
  };

  const visibleItems = navItems.filter((item) => !item.ownerOnly || isOwner);

  return (
    <>
      <div className="lg:hidden flex items-center justify-between bg-[#0d0e13] border-b border-[#1f232b] px-4 py-3 sticky top-0 z-30">
        <span className="font-bold text-slate-50 tracking-tight">Steadia Admin</span>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="text-slate-400">
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      <aside
        className={`
          bg-[#0d0e13] border-r border-[#1f232b] flex-col w-64 shrink-0
          lg:sticky lg:top-0 lg:h-screen lg:flex
          ${mobileOpen ? "flex fixed inset-0 z-20" : "hidden"}
        `}
      >
        <div className="px-6 py-6 hidden lg:block">
          <h1 className="text-lg font-bold text-slate-50 tracking-tight">Steadia Admin</h1>
          <p className="text-xs text-slate-500 mt-0.5">SMB Tracker</p>
        </div>

        <nav className="flex-1 px-3 pt-20 pb-4 lg:pt-0 lg:pb-0 space-y-1 overflow-y-auto">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <button
                key={item.href}
                onClick={() => {
                  router.push(item.href);
                  setMobileOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  active
                    ? "bg-indigo-500/10 text-indigo-400 font-medium"
                    : "text-slate-400 hover:text-slate-100 hover:bg-[#1f232b]/60"
                }`}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-[#1f232b] px-3 py-4">
          {email && <p className="px-3 text-xs text-slate-500 mb-2 truncate">{email}</p>}
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:text-slate-100 hover:bg-[#1f232b]/60 transition-colors"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}