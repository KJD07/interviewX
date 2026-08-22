"use client";

import { useState } from "react";
import Link from "next/link";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import GoogleSignInButton from "@/components/GoogleSignInButton";

export default function AdminLoginPage() {
  const { login, user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Something went wrong. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (user && !user.is_staff) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--page)" }}>
        <div className="w-full max-w-sm text-center fade-up">
          <span className="text-2xl font-bold tracking-tight cursor-blink" style={{ color: "var(--ink)" }}>
            EvaluLabs
          </span>
          <h1 className="mt-10 text-xl font-semibold" style={{ color: "var(--ink)" }}>
            Staff access required
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--ink-dim)" }}>
            This area is restricted to authorized staff accounts.
          </p>
          <Link
            href="/dashboard"
            className="inline-block mt-6 rounded-full px-5 py-2.5 text-sm font-semibold"
            style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
          >
            Back to dashboard
          </Link>
        </div>
      </main>
    );
  }

  if (user?.is_staff) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--page)" }}>
        <div className="w-full max-w-sm text-center fade-up">
          <span className="text-2xl font-bold tracking-tight cursor-blink" style={{ color: "var(--ink)" }}>
            EvaluLabs
          </span>
          <h1 className="mt-10 text-xl font-semibold" style={{ color: "var(--ink)" }}>
            Staff access confirmed
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--ink-dim)" }}>
            You are signed in with an authorized staff account.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--page)" }}>
      <div className="w-full max-w-sm sm:max-w-md p-6 sm:p-8 fade-up">
        <div className="mb-8 sm:mb-10">
          <span className="text-xl sm:text-2xl font-bold tracking-tight cursor-blink" style={{ color: "var(--ink)" }}>
            EvaluLabs
          </span>
          <p className="mt-2 text-sm sm:text-base" style={{ color: "var(--ink-dim)" }}>
            Staff sign in
          </p>
        </div>

        <div className="mb-6">
          <GoogleSignInButton adminOnly onError={setError} onStart={() => setSubmitting(true)} />
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="h-px flex-1" style={{ background: "var(--border-mid)" }} />
          <span className="text-sm" style={{ color: "var(--ink-faint)" }}>or</span>
          <div className="h-px flex-1" style={{ background: "var(--border-mid)" }} />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          <div>
            <label htmlFor="admin-email" className="block text-xs font-medium mb-1.5 tracking-wider uppercase" style={{ color: "var(--ink-dim)" }}>
              Email
            </label>
            <input
              id="admin-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded px-3.5 py-2.5 text-sm"
              style={{ background: "var(--surface)", border: "1px solid var(--border-mid)", color: "var(--ink)" }}
              placeholder="staff@example.com"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="admin-password" className="block text-xs font-medium tracking-wider uppercase" style={{ color: "var(--ink-dim)" }}>
                Password
              </label>
              <Link href="/forgot-password" className="text-xs font-medium hover:underline" style={{ color: "var(--accent)" }}>
                Forgot password?
              </Link>
            </div>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded px-3.5 py-2.5 text-sm"
              style={{ background: "var(--surface)", border: "1px solid var(--border-mid)", color: "var(--ink)" }}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-sm rounded px-3 py-2" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "var(--danger)" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || loading}
            className="w-full rounded-full py-2.5 sm:py-3 text-sm font-semibold transition-opacity disabled:opacity-50"
            style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
