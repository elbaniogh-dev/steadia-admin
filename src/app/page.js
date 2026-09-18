"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if this person is actually registered as an admin.
      const adminDoc = await getDoc(doc(db, "admins", user.uid));

      if (!adminDoc.exists()) {
        await auth.signOut();
        setError("This account does not have admin access.");
        setLoading(false);
        return;
      }

      router.push("/dashboard");
    } catch (err) {
      console.error(err);
      setError("Sign in failed. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4">
      <div className="bg-neutral-900 rounded-2xl p-10 w-full max-w-sm text-center border border-neutral-800">
        <h1 className="text-2xl font-bold text-white mb-2">Steadia Admin</h1>
        <p className="text-neutral-400 text-sm mb-8">Sign in to continue</p>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full bg-white text-black font-semibold py-3 rounded-lg hover:bg-neutral-200 transition disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Continue with Google"}
        </button>

        {error && (
          <p className="text-red-500 text-sm mt-4">{error}</p>
        )}
      </div>
    </div>
  );
}