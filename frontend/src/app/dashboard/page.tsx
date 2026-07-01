"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { interviews, ApiError } from "@/lib/api";
import type { InterviewSession } from "@/lib/api";

function StatusBadge({ status }: { status: InterviewSession["status"] }) {
  const map = {
    in_progress: { label: "In progress", bg: "rgba(99,102,241,0.15)", color: "var(--indigo)" },
    completed: { label: "Completed", bg: "rgba(34,197,94,0.12)", color: "#22c55e" },
    abandoned: { label: "Abandoned", bg: "rgba(100,116,139,0.15)", color: "var(--slate)" },
  };
  const s = map[status];
  return (
    <span
      className="text-xs font-medium px-2 py-0.5 rounded-full"
      style={{ background: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  );
}

function ScorePill({ value }: { value: number | undefined }) {
  if (value === undefined) return <span style={{ color: "var(--slate-dim)" }}>—</span>;
  const color = value >= 7 ? "#22c55e" : value >= 5 ? "#f59e0b" : "var(--danger)";
  return (
    <span className="font-semibold tabular-nums" style={{ color }}>
      {value}<span className="text-xs font-normal" style={{ color: "var(--slate-dim)" }}>/10</span>
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}

export default function DashboardPage() {
  const { user, logout, refreshUser } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [fetchError, setFetchError] = useState("");

  useEffect(() => {
    refreshUser().catch(() => { });
    interviews.list()
      .then(setSessions)
      .catch((err) => {
        if (err instanceof ApiError) setFetchError(err.detail);
        else setFetchError("Could not load sessions.");
      })
      .finally(() => setLoadingSessions(false));
  }, []);

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  const isPro = user?.subscription_plan === "premium";
  const monthlyUsed = (user as any)?.interviews_this_month ?? 0;
  const FREE_LIMIT = 2;

  return (
    <ProtectedRoute>
      <div className="min-h-screen" style={{ background: "var(--navy)" }}>

        {/* Nav */}
        <nav
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: "var(--navy-light)" }}
        >
          <span className="text-lg font-bold tracking-tight" style={{ color: "var(--white)" }}>
            InterviewX
          </span>
          <div className="flex items-center gap-4">
            {/* Plan badge */}
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider"
              style={
                isPro
                  ? { background: "var(--indigo-glow)", color: "var(--indigo)" }
                  : { background: "var(--navy-light)", color: "var(--slate)" }
              }
            >
              {isPro ? "Pro" : "Free"}
            </span>
            <span className="text-sm" style={{ color: "var(--slate)" }}>
              {user?.username}
            </span>
            <button
              onClick={handleLogout}
              className="text-sm hover:underline"
              style={{ color: "var(--slate-dim)" }}
            >
              Sign out
            </button>
          </div>
        </nav>

        <main className="max-w-4xl mx-auto px-6 py-10 fade-up">

          {/* Header row */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: "var(--white)" }}>
                Dashboard
              </h1>
              {!isPro && (
                <p className="mt-1 text-sm" style={{ color: "var(--slate)" }}>
                  {monthlyUsed}/{FREE_LIMIT} free interviews used this month.{" "}
                  <button
                    onClick={() => router.push("/upgrade")}
                    className="underline"
                    style={{ color: "var(--indigo)" }}
                  >
                    {monthlyUsed >= FREE_LIMIT ? "Upgrade to continue →" : "Upgrade for unlimited →"}
                  </button>
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {!isPro ? (
                <button
                  onClick={() => router.push("/upgrade")}
                  className="px-5 py-2.5 rounded text-sm font-semibold"
                  style={{ background: "var(--indigo-glow)", color: "var(--indigo)", border: "1px solid var(--indigo)" }}
                >
                  Upgrade ↗
                </button>
              ) : (
                <button
                  onClick={() => router.push("/upgrade")}
                  className="px-5 py-2.5 rounded text-sm font-semibold"
                  style={{ background: "transparent", color: "var(--slate)", border: "1px solid var(--slate-dim)" }}
                >
                  Manage subscription
                </button>
              )}
              <button
                onClick={() => router.push("/companies")}
                disabled={!isPro && monthlyUsed >= FREE_LIMIT}
                className="px-5 py-2.5 rounded text-sm font-semibold transition-opacity disabled:opacity-40"
                style={{ background: "var(--indigo)", color: "var(--white)" }}
              >
                + Start interview
              </button>
            </div>
          </div>

          {/* Sessions table */}
          {loadingSessions ? (
            <p className="text-sm" style={{ color: "var(--slate)" }}>
              Loading sessions…
            </p>
          ) : fetchError ? (
            <p className="text-sm" style={{ color: "var(--danger)" }}>
              {fetchError}
            </p>
          ) : sessions.length === 0 ? (
            <div
              className="rounded-lg p-10 text-center"
              style={{ background: "var(--navy-light)", border: "1px solid var(--navy-mid)" }}
            >
              <p className="text-sm font-medium" style={{ color: "var(--white)" }}>
                No interviews yet.
              </p>
              <p className="mt-1 text-sm" style={{ color: "var(--slate)" }}>
                Pick a company and role to run your first AI interview.
              </p>
              <button
                onClick={() => router.push("/companies")}
                className="mt-5 px-5 py-2 rounded text-sm font-semibold"
                style={{ background: "var(--indigo)", color: "var(--white)" }}
              >
                Browse companies
              </button>
            </div>
          ) : (
            <div
              className="rounded-lg overflow-hidden"
              style={{ border: "1px solid var(--navy-mid)" }}
            >
              {/* Table header */}
              <div
                className="grid text-xs font-medium uppercase tracking-wider px-5 py-3"
                style={{
                  gridTemplateColumns: "1fr 80px 60px 60px 60px 100px",
                  background: "var(--navy-light)",
                  color: "var(--slate)",
                  borderBottom: "1px solid var(--navy-mid)",
                }}
              >
                <span>Session</span>
                <span>Status</span>
                <span>Comm.</span>
                <span>Tech.</span>
                <span>Overall</span>
                <span className="text-right">Date</span>
              </div>

              {sessions.map((s, i) => (
                <div
                  key={s.id}
                  onClick={() =>
                    router.push(
                      s.status === "completed"
                        ? `/interview/${s.id}/results`
                        : `/interview/${s.id}`
                    )
                  }
                  className="grid items-center px-5 py-4 cursor-pointer transition-colors hover:bg-slate-800"
                  style={{
                    gridTemplateColumns: "1fr 80px 60px 60px 60px 100px",
                    borderBottom:
                      i < sessions.length - 1
                        ? "1px solid var(--navy-mid)"
                        : "none",
                    background: i % 2 === 0 ? "transparent" : "rgba(30,41,59,0.4)",
                  }}
                >
                  <span className="text-sm font-medium" style={{ color: "var(--white)" }}>
                    Session #{s.id}
                  </span>
                  <StatusBadge status={s.status} />
                  <ScorePill value={s.scores?.communication} />
                  <ScorePill value={s.scores?.technical} />
                  <ScorePill value={s.scores?.overall} />
                  <span
                    className="text-xs text-right"
                    style={{ color: "var(--slate-dim)" }}
                  >
                    {formatDate(s.started_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}