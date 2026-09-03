"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import AuthPageShell, {
  authInputClass,
  authInputStyle,
  authLabelClass,
} from "@/components/AuthPageShell";

const REGISTER_POINTS = [
  { label: "Start", value: "No card required" },
  { label: "First session", value: "Under a minute" },
  { label: "Bank", value: "Real company questions" },
];

export default function RegisterPage() {
  const { register, user } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const emailPrefix = useMemo(
    () => email.trim().split("@")[0].toLowerCase(),
    [email]
  );
  const passwordLower = useMemo(() => password.toLowerCase(), [password]);
  const usernameLower = useMemo(
    () => username.trim().toLowerCase(),
    [username]
  );

  const passwordMinLength = useMemo(() => password.length >= 8, [password]);
  const passwordNotNumeric = useMemo(
    () => (password.length > 0 ? !/^[0-9]+$/.test(password) : true),
    [password]
  );
  const passwordNotSimilarToUsername = useMemo(
    () =>
      usernameLower.length > 0
        ? !passwordLower.includes(usernameLower)
        : true,
    [passwordLower, usernameLower]
  );
  const passwordNotSimilarToEmail = useMemo(
    () =>
      emailPrefix.length > 0 ? !passwordLower.includes(emailPrefix) : true,
    [emailPrefix, passwordLower]
  );
  const passwordsMatch = useMemo(
    () => (password2.length > 0 ? password === password2 : false),
    [password, password2]
  );
  const showPasswordRules = useMemo(
    () => password.length > 0 || password2.length > 0,
    [password, password2]
  );
  const canSubmit = useMemo(
    () =>
      email.trim() !== "" &&
      username.trim() !== "" &&
      passwordMinLength &&
      passwordNotNumeric &&
      password2.length > 0 &&
      passwordsMatch &&
      passwordNotSimilarToUsername &&
      passwordNotSimilarToEmail,
    [
      email,
      username,
      passwordMinLength,
      passwordNotNumeric,
      password2,
      passwordsMatch,
      passwordNotSimilarToUsername,
      passwordNotSimilarToEmail,
    ]
  );

  useEffect(() => {
    if (user) router.replace("/");
  }, [user, router]);

  const handleGoogleStart = useCallback(() => setSubmitting(true), []);
  const handleGoogleError = useCallback((message: string) => setError(message), []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      setFieldErrors({});

      if (!passwordMinLength) {
        setFieldErrors({ password: "Password must be at least 8 characters." });
        return;
      }

      if (!passwordNotNumeric) {
        setFieldErrors({ password: "Password cannot be only numbers." });
        return;
      }

      if (!passwordNotSimilarToUsername || !passwordNotSimilarToEmail) {
        setFieldErrors({
          password:
            "Password should not be too similar to your username or email.",
        });
        return;
      }

      if (!passwordsMatch) {
        setFieldErrors({ password2: "Passwords don't match." });
        return;
      }

      setSubmitting(true);
      try {
        const result = await register(email, username, password, password2);
        router.push(`/verify-email?email=${encodeURIComponent(result.email)}`);
      } catch (err) {
        if (err instanceof ApiError) {
          const body = err.body;
          if (body && typeof body === "object") {
            const nextFieldErrors: Record<string, string> = {};
            let genericError = err.detail;
            for (const key of Object.keys(body)) {
              const value = (body as Record<string, unknown>)[key];
              if (Array.isArray(value)) {
                nextFieldErrors[key] = value.join(" ");
              } else if (typeof value === "string") {
                nextFieldErrors[key] = value;
              }
            }
            if (Object.keys(nextFieldErrors).length > 0) {
              setFieldErrors(nextFieldErrors);
              genericError =
                nextFieldErrors.detail ||
                nextFieldErrors.non_field_errors ||
                genericError;
            }
            setError(genericError);
          } else {
            setError(err.detail);
          }
        } else {
          setError("Something went wrong. Check your connection and try again.");
        }
      } finally {
        setSubmitting(false);
      }
    },
    [
      email,
      username,
      password,
      password2,
      passwordMinLength,
      passwordNotNumeric,
      passwordNotSimilarToEmail,
      passwordNotSimilarToUsername,
      passwordsMatch,
      register,
      router,
    ]
  );

  return (
    <AuthPageShell
      eyebrow="START FREE"
      title={
        <>
          Your first mock in under a <em className="font-accent">minute</em>.
        </>
      }
      subtitle="Create an account to practise against verified questions. No card required. Hiring teams — talk to sales instead of signing up here."
      points={REGISTER_POINTS}
      extra={
        <Link
          href="/contact"
          className="card-hover mt-4 flex flex-col rounded-[20px] bg-[var(--lime)] p-5 text-[var(--ink)]"
        >
          <span className="font-mono text-[10px] tracking-[0.16em]">HIRING TEAMS · COLLEGES</span>
          <span className="font-display mt-3 text-[18px] font-semibold tracking-[-0.02em]">
            Don&apos;t register here to hire.
          </span>
          <span className="mt-1.5 text-[13px] leading-relaxed text-[#3C4118]">
            Enterprise workspaces are set up with our team. Talk to sales and we&apos;ll stand up
            your question bank, invites and scored reports.
          </span>
          <span className="mt-3 text-sm font-semibold">Talk to sales →</span>
        </Link>
      }
    >
      <p className="font-mono text-[10px] tracking-[0.16em] text-[var(--olive)]">CREATE ACCOUNT</p>
      <h2 className="font-display mt-2 text-[22px] font-bold tracking-[-0.03em] text-[var(--ink)] sm:text-[26px]">
        Start practising
      </h2>

      <div className="mt-6">
        <GoogleSignInButton onError={handleGoogleError} onStart={handleGoogleStart} />
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
          {fieldErrors.email && (
            <p className="mt-1.5 text-xs text-[var(--danger)]">{fieldErrors.email}</p>
          )}
        </div>

        <div>
          <label htmlFor="username" className={authLabelClass}>
            Username
          </label>
          <input
            id="username"
            type="text"
            autoComplete="username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={authInputClass}
            style={authInputStyle}
            placeholder="rahul_dev"
          />
          {fieldErrors.username && (
            <p className="mt-1.5 text-xs text-[var(--danger)]">{fieldErrors.username}</p>
          )}
        </div>

        <div>
          <label htmlFor="password" className={authLabelClass}>
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={authInputClass}
            style={authInputStyle}
            placeholder="Min 8 characters"
          />
          {showPasswordRules && (
            <div className="mt-3 space-y-1 text-xs">
              <p style={{ color: passwordMinLength ? "var(--success)" : "var(--danger)" }}>
                • At least 8 characters
              </p>
              <p style={{ color: passwordNotNumeric ? "var(--success)" : "var(--danger)" }}>
                • Cannot be only numbers
              </p>
              <p
                style={{
                  color:
                    passwordNotSimilarToUsername && passwordNotSimilarToEmail
                      ? "var(--success)"
                      : "var(--danger)",
                }}
              >
                • Should not be too similar to username or email
              </p>
            </div>
          )}
          {fieldErrors.password && (
            <p className="mt-1.5 text-xs text-[var(--danger)]">{fieldErrors.password}</p>
          )}
        </div>

        <div>
          <label htmlFor="password2" className={authLabelClass}>
            Confirm password
          </label>
          <input
            id="password2"
            type="password"
            autoComplete="new-password"
            required
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            className={authInputClass}
            style={{
              ...authInputStyle,
              borderColor: fieldErrors.password2 ? "var(--danger)" : "var(--border-mid)",
            }}
            placeholder="Repeat password"
          />
          {password2.length > 0 && (
            <p
              className="mt-2 text-xs"
              style={{ color: passwordsMatch ? "var(--success)" : "var(--danger)" }}
            >
              • Passwords match
            </p>
          )}
          {fieldErrors.password2 && (
            <p className="mt-1.5 text-xs text-[var(--danger)]">{fieldErrors.password2}</p>
          )}
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
          disabled={submitting || !canSubmit}
          className="w-full rounded-full bg-[var(--ink)] py-3.5 text-[15px] font-semibold text-[var(--page)] hover:bg-[var(--accent-dim)] disabled:opacity-50"
        >
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--ink-faint)]">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-[var(--olive)] hover:underline">
          Sign in
        </Link>
      </p>
    </AuthPageShell>
  );
}
