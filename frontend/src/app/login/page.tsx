"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";
import GoogleSignInButton from "@/components/GoogleSignInButton";

export default function LoginPage() {
  const { login, user } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Already logged in → go to dashboard
  useEffect(() => {
    if (user) router.replace("/dashboard");
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "EMAIL_NOT_VERIFIED") {
          router.push(`/verify-email?email=${encodeURIComponent(email)}`);
          return;
        }
        setError(err.detail);
      } else {
        setError("Something went wrong. Check your connection and try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--page)" }}>
      <div className="w-full max-w-sm fade-up">

        {/* Logo mark */}
        <div className="mb-10">
          <span
            className="text-2xl font-bold tracking-tight cursor-blink"
            style={{ color: "var(--ink)" }}
          >
            InterviewX
          </span>
          <p className="mt-2 text-sm" style={{ color: "var(--ink-dim)" }}>
            Sign in to continue practising.
          </p>
        </div>

        <div className="mb-6">
          <GoogleSignInButton onError={setError} onStart={() => setSubmitting(true)} />
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="h-px flex-1" style={{ background: "var(--border-mid)" }} />
          <span className="text-xs" style={{ color: "var(--ink-faint)" }}>or</span>
          <div className="h-px flex-1" style={{ background: "var(--border-mid)" }} />
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-medium mb-1.5 tracking-wider uppercase"
              style={{ color: "var(--ink-dim)" }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded px-3.5 py-2.5 text-sm"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border-mid)",
                color: "var(--ink)",
              }}
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-medium mb-1.5 tracking-wider uppercase"
              style={{ color: "var(--ink-dim)" }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded px-3.5 py-2.5 text-sm"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border-mid)",
                color: "var(--ink)",
              }}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p
              className="text-sm rounded px-3 py-2"
              style={{
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.3)",
                color: "var(--danger)",
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded py-2.5 text-sm font-semibold transition-opacity disabled:opacity-50"
            style={{ background: "var(--accent)", color: "var(--ink)" }}
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-sm text-center" style={{ color: "var(--ink-faint)" }}>
          No account?{" "}
          <Link
            href="/register"
            className="font-medium hover:underline"
            style={{ color: "var(--accent)" }}
          >
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}