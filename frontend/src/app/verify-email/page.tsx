"use client";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";

function VerifyEmailForm() {
  const { verifyEmail, resendOtp, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailFromQuery = searchParams.get("email") || "";

  const [email, setEmail] = useState(emailFromQuery);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (user) router.replace("/dashboard");
  }, [user, router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setSubmitting(true);
    try {
      await verifyEmail(email, code);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!email || cooldown > 0) return;
    setError("");
    setInfo("");
    setResending(true);
    try {
      await resendOtp(email);
      setInfo("A new code has been sent to your email.");
      setCooldown(30);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Couldn't resend the code. Try again shortly.");
    } finally {
      setResending(false);
    }
  };

  const inputStyle = {
    background: "var(--surface)",
    border: "1px solid var(--border-mid)",
    color: "var(--ink)",
  };

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: "var(--page)" }}
    >
      <div className="w-full max-w-sm fade-up">
        <div className="mb-10">
          <span
            className="text-2xl font-bold tracking-tight cursor-blink"
            style={{ color: "var(--ink)" }}
          >
            InterviewX
          </span>
          <p className="mt-2 text-sm" style={{ color: "var(--ink-dim)" }}>
            Enter the 6-digit code we emailed you to verify your account.
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
              style={inputStyle}
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="code"
              className="block text-xs font-medium mb-1.5 tracking-wider uppercase"
              style={{ color: "var(--ink-dim)" }}
            >
              Verification code
            </label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              autoComplete="one-time-code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="w-full rounded px-3.5 py-2.5 text-sm tracking-[0.5em] text-center"
              style={inputStyle}
              placeholder="000000"
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

          {info && (
            <p
              className="text-sm rounded px-3 py-2"
              style={{
                background: "rgba(34,197,94,0.1)",
                border: "1px solid rgba(34,197,94,0.3)",
                color: "#4ade80",
              }}
            >
              {info}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || code.length !== 6}
            className="w-full rounded py-2.5 text-sm font-semibold transition-opacity disabled:opacity-50"
            style={{ background: "var(--accent)", color: "var(--ink)" }}
          >
            {submitting ? "Verifying…" : "Verify email"}
          </button>
        </form>

        <p className="mt-6 text-sm text-center" style={{ color: "var(--ink-faint)" }}>
          Didn't get a code?{" "}
          <button
            type="button"
            onClick={handleResend}
            disabled={resending || cooldown > 0 || !email}
            className="font-medium hover:underline disabled:opacity-50 disabled:no-underline"
            style={{ color: "var(--accent)" }}
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : resending ? "Sending…" : "Resend code"}
          </button>
        </p>

        <p className="mt-2 text-sm text-center" style={{ color: "var(--ink-faint)" }}>
          <Link href="/login" className="hover:underline" style={{ color: "var(--accent)" }}>
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailForm />
    </Suspense>
  );
}
