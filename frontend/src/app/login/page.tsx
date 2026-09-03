"use client";
import { Suspense, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import AuthPageShell, {
  authInputClass,
  authInputStyle,
  authLabelClass,
} from "@/components/AuthPageShell";

function getRedirectPath(next: string | null) {
  return next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

const LOGIN_POINTS = [
  { label: "Interview", value: "Panel-grade pressure" },
  { label: "Scores", value: "Four dimensions, 0-10" },
  { label: "Mode", value: "Voice or text" },
];

function LoginContent() {
  const { login, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = getRedirectPath(searchParams.get("next"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) router.replace(redirectPath);
  }, [user, router, redirectPath]);

  const handleGoogleError = useCallback((msg: string) => setError(msg), []);
  const handleGoogleStart = useCallback(() => setSubmitting(true), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
      router.push(redirectPath);
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
    <AuthPageShell
      eyebrow="CANDIDATES · HIRING TEAMS"
      title={
        <>
          One login for both sides of the <em className="font-accent">table</em>.
        </>
      }
      subtitle="Practice against verified questions, or screen candidates with your own bank. Same interviewer. Same scores."
      points={LOGIN_POINTS}
      extra={
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link
            href="/"
            className="card-hover flex flex-col rounded-[20px] bg-[var(--ink)] p-5 text-[var(--page)]"
          >
            <span className="font-mono text-[10px] tracking-[0.16em] text-[var(--lime)]">
              EVALULABS
            </span>
            <span className="font-display mt-3 text-[18px] font-semibold tracking-[-0.02em]">
              Mock interviews
            </span>
            <span className="mt-1.5 text-[13px] leading-relaxed text-[#A3A29A]">
              Verified company questions, voice mode, and a readiness score that climbs.
            </span>
          </Link>
          <Link
            href="/contact"
            className="card-hover flex flex-col rounded-[20px] bg-[var(--lime)] p-5 text-[var(--ink)]"
          >
            <span className="font-mono text-[10px] tracking-[0.16em]">HIRE WITH US</span>
            <span className="font-display mt-3 text-[18px] font-semibold tracking-[-0.02em]">
              Talk to sales
            </span>
            <span className="mt-1.5 text-[13px] leading-relaxed text-[#3C4118]">
              Hiring teams and colleges don&apos;t self-serve. We stand up the workspace with you.
            </span>
          </Link>
        </div>
      }
    >
      <p className="font-mono text-[10px] tracking-[0.16em] text-[var(--olive)]">SIGN IN</p>
      <h2 className="font-display mt-2 text-[22px] font-bold tracking-[-0.03em] text-[var(--ink)] sm:text-[26px]">
        Welcome back
      </h2>

      <div className="mt-6">
        <GoogleSignInButton
          redirectPath={redirectPath}
          onError={handleGoogleError}
          onStart={handleGoogleStart}
        />
      </div>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-[var(--border-mid)]" />
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--ink-faint)]">
          or email
        </span>
        <div className="h-px flex-1 bg-[var(--border-mid)]" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="email" className={authLabelClass}>
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={authInputClass}
            style={authInputStyle}
            placeholder="you@example.com"
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label htmlFor="password" className="font-label">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-[var(--olive)] hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={authInputClass}
            style={authInputStyle}
            placeholder="••••••••"
          />
        </div>

        {error && (
          <p
            className="rounded-[12px] px-3.5 py-2.5 text-sm"
            style={{
              background: "rgba(179,64,42,0.08)",
              border: "1px solid rgba(179,64,42,0.28)",
              color: "var(--danger)",
            }}
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-[var(--ink)] py-3.5 text-[15px] font-semibold text-[var(--page)] hover:bg-[var(--accent-dim)] disabled:opacity-50"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--ink-faint)]">
        No account?{" "}
        <Link href="/register" className="font-semibold text-[var(--olive)] hover:underline">
          Create one
        </Link>
        <span className="mt-2 block text-[13px]">
          Hiring a team?{" "}
          <Link href="/contact" className="font-semibold text-[var(--olive)] hover:underline">
            Talk to sales
          </Link>
        </span>
      </p>
    </AuthPageShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
