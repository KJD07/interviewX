"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";

export default function ForgotPasswordPage() {
  const { forgotPassword } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await forgotPassword(email);
      router.push(`/reset-password?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--page)" }}
    >
      <div className="w-full max-w-sm fade-up">
        <div className="mb-10">
          <span
            className="text-2xl font-bold tracking-tight cursor-blink"
            style={{ color: "var(--ink)" }}
          >
            EvaluLabs
          </span>
          <p className="mt-2 text-sm" style={{ color: "var(--ink-dim)" }}>
            Enter your email and we'll send you a code to reset your password.
          </p>
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
            className="w-full rounded-full py-2.5 text-sm font-semibold transition-opacity disabled:opacity-50"
            style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
          >
            {submitting ? "Sending…" : "Send reset code"}
          </button>
        </form>

        <p className="mt-6 text-sm text-center" style={{ color: "var(--ink-faint)" }}>
          <Link href="/login" className="hover:underline" style={{ color: "var(--accent)" }}>
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
