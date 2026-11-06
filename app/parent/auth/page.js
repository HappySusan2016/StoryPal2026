"use client";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { auth, googleProvider } from "../../lib/firebaseClient";

const envMissing =
  !process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
  !process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
  !process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
  !process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

export default function ParentAuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        // Slight delay to let UI update
        setTimeout(() => router.push("/parent"), 150);
      }
    });
    return () => unsub();
  }, [router]);

  const passwordMismatch =
    mode === "signup" && password && confirm && password !== confirm;

  const disableSubmit = useMemo(() => {
    if (envMissing) return true;
    if (!email || !password) return true;
    if (passwordMismatch) return true;
    return loading;
  }, [email, password, passwordMismatch, loading]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (disableSubmit) return;
    setError("");
    setLoading(true);
    try {
      if (mode === "signin") {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      router.push("/parent");
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError("");
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      router.push("/parent");
    } catch (err) {
      setError(err.message || "Google sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    setError("");
    setLoading(true);
    try {
      await signOut(auth);
      setEmail("");
      setPassword("");
      setConfirm("");
    } catch (err) {
      setError(err.message || "Sign out failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl bg-white/90 backdrop-blur shadow-lg border border-zinc-100 p-8 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-zinc-900">
            {mode === "signin" ? "Sign in" : "Create your account"}
          </h1>
          <p className="text-sm text-zinc-600">
            Access your saved modules, passports, and reflections.
          </p>
        </div>

        {envMissing && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-sm p-3">
            Firebase env vars are missing. Add the{" "}
            <code>NEXT_PUBLIC_FIREBASE_*</code> keys to run auth.
          </div>
        )}

        {user && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm p-3 flex items-center justify-between">
            <div>
              <div className="font-semibold">Signed in</div>
              <div>{user.email}</div>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="text-sm px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Sign out
            </button>
          </div>
        )}

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 text-red-800 text-sm p-3">
            {error}
          </div>
        ) : null}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="block text-sm text-zinc-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-zinc-200 bg-white/90 px-4 py-3 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-slate-300/60 focus:border-slate-300"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm text-zinc-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-zinc-200 bg-white/90 px-4 py-3 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-slate-300/60 focus:border-slate-300"
            />
          </div>

          {mode === "signup" && (
            <div className="space-y-2">
              <label className="block text-sm text-zinc-700">
                Confirm password
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-zinc-200 bg-white/90 px-4 py-3 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-rose-300/60 focus:border-rose-300"
              />
              {passwordMismatch && (
                <p className="text-xs text-red-600">Passwords do not match.</p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={disableSubmit}
            className="w-full rounded-xl bg-zinc-900 text-white py-3 font-semibold hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading
              ? "Working..."
              : mode === "signin"
              ? "Sign in"
              : "Create account"}
          </button>
        </form>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-zinc-200" />
          <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            or
          </span>
          <div className="flex-1 h-px bg-zinc-200" />
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={loading || envMissing}
          className="w-full rounded-xl border border-zinc-200 bg-white py-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
        >
          Continue with Google
        </button>

        <div className="text-center text-sm text-zinc-600">
          {mode === "signin" ? (
            <>
              New here?{" "}
              <button
                type="button"
                className="text-[#5b217f] font-semibold"
                style={{ cursor: "pointer" }}
                onClick={() => {
                  setMode("signup");
                  setError("");
                }}
              >
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                className="text-[#5b217f] font-semibold"
                style={{ cursor: "pointer" }}
                onClick={() => {
                  setMode("signin");
                  setError("");
                }}
              >
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
