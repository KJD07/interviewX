"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";

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

  useEffect(() => {
    if (user) router.replace("/dashboard");
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setFieldErrors({});

    if (password !== password2) {
      setFieldErrors({ password2: "Passwords don't match." });
      return;
    }

    setSubmitting(true);
    try {
      await register(email, username, password, password2);
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        // Django may return field-level errors as a JSON object
        setError(err.detail);
      } else {
        setError("Something went wrong. Check your connection and try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = {
    background: "var(--navy-light)",
    border: "1px solid var(--navy-mid)",
    color: "var(--white)",
  };

  const labelStyle = {
    color: "var(--slate)",
  };

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: "var(--navy)" }}
    >
      <div className="w-full max-w-sm fade-up">
        <div className="mb-10">
          <span
            className="text-2xl font-bold tracking-tight cursor-blink"
            style={{ color: "var(--white)" }}
          >
            InterviewX
          </span>
          <p className="mt-2 text-sm" style={{ color: "var(--slate)" }}>
            Create your account to start practising.
          </p>
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
                  : "var(--navy-mid)",
              }}
              placeholder="Repeat password"
            />
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
            disabled={submitting}
            className="w-full rounded py-2.5 text-sm font-semibold transition-opacity disabled:opacity-50"
            style={{ background: "var(--indigo)", color: "var(--white)" }}
          >
            {submitting ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-sm text-center" style={{ color: "var(--slate-dim)" }}>
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium hover:underline"
            style={{ color: "var(--indigo)" }}
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}