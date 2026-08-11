"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";
import GoogleSignInButton from "@/components/GoogleSignInButton";

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
  const inputStyle = useMemo(
    () => ({
      background: "var(--surface)",
      border: "1px solid var(--border-mid)",
      color: "var(--ink)",
    }),
    []
  );

  const labelStyle = useMemo(
    () => ({ color: "var(--ink-dim)" }),
    []
  );

  const buttonStyle = useMemo(
    () => ({ background: "var(--accent)", color: "var(--accent-ink)" }),
    []
  );

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
            const fieldErrors: Record<string, string> = {};
            let genericError = err.detail;
            for (const key of Object.keys(body)) {
              const value = (body as any)[key];
              if (Array.isArray(value)) {
                fieldErrors[key] = value.join(" ");
              } else if (typeof value === "string") {
                fieldErrors[key] = value;
              }
            }
            if (Object.keys(fieldErrors).length > 0) {
              setFieldErrors(fieldErrors);
              genericError =
                fieldErrors.detail ||
                fieldErrors.non_field_errors ||
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
            EvaluLabs
          </span>
          <p className="mt-2 text-sm" style={{ color: "var(--ink-dim)" }}>
            Create your account to start practising.
          </p>
        </div>

        <div className="mb-6">
          <GoogleSignInButton onError={handleGoogleError} onStart={handleGoogleStart} />
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
              style={labelStyle}
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
            {fieldErrors.email && (
              <p className="mt-1 text-xs" style={{ color: "var(--danger)" }}>
                {fieldErrors.email}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="username"
              className="block text-xs font-medium mb-1.5 tracking-wider uppercase"
              style={labelStyle}
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded px-3.5 py-2.5 text-sm"
              style={inputStyle}
              placeholder="rahul_dev"
            />
            {fieldErrors.username && (
              <p className="mt-1 text-xs" style={{ color: "var(--danger)" }}>
                {fieldErrors.username}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-medium mb-1.5 tracking-wider uppercase"
              style={labelStyle}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded px-3.5 py-2.5 text-sm"
              style={inputStyle}
              placeholder="Min 8 characters"
            />
            {showPasswordRules && (
              <div className="mt-3 space-y-1 text-xs">
                <p
                  style={{
                    color: passwordMinLength ? "var(--success)" : "var(--danger)",
                  }}
                >
                  • At least 8 characters
                </p>
                <p
                  style={{
                    color: passwordNotNumeric ? "var(--success)" : "var(--danger)",
                  }}
                >
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
              <p className="mt-1 text-xs" style={{ color: "var(--danger)" }}>
                {fieldErrors.password}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="password2"
              className="block text-xs font-medium mb-1.5 tracking-wider uppercase"
              style={labelStyle}
            >
              Confirm password
            </label>
            <input
              id="password2"
              type="password"
              autoComplete="new-password"
              required
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              className="w-full rounded px-3.5 py-2.5 text-sm"
              style={{
                ...inputStyle,
                borderColor: fieldErrors.password2
                  ? "var(--danger)"
                  : "var(--border-mid)",
              }}
              placeholder="Repeat password"
            />
            {password2.length > 0 && (
              <p className="mt-2 text-xs" style={{ color: passwordsMatch ? "var(--success)" : "var(--danger)" }}>
                • Passwords match
              </p>
            )}
            {fieldErrors.password2 && (
              <p className="mt-1 text-xs" style={{ color: "var(--danger)" }}>
                {fieldErrors.password2}
              </p>
            )}
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
            disabled={submitting || !canSubmit}
            className="w-full rounded-full py-2.5 text-sm font-semibold transition-opacity disabled:opacity-50"
            style={buttonStyle}
          >
            {submitting ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-sm text-center" style={{ color: "var(--ink-faint)" }}>
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium hover:underline"
            style={{ color: "var(--accent)" }}
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}