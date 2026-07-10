"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppShell from "@/components/AppShell";
import { interviews, ApiError } from "@/lib/api";
import type { InterviewSession } from "@/lib/api";
import { planOf, isPaidPlan } from "@/lib/plans";

function StatusBadge({ status }: { status: InterviewSession["status"] }) {
  const map = {
    in_progress: { label: "In progress", bg: "rgba(99,102,241,0.15)", color: "var(--accent)" },
    completed: { label: "Completed", bg: "rgba(34,197,94,0.12)", color: "#22c55e" },
    abandoned: { label: "Abandoned", bg: "rgba(100,116,139,0.15)", color: "var(--ink-dim)" },
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
  if (value === undefined) return <span style={{ color: "var(--ink-faint)" }}>—</span>;
  const color = value >= 7 ? "#22c55e" : value >= 5 ? "#f59e0b" : "var(--danger)";
  return (
    <span className="font-semibold tabular-nums" style={{ color }}>
      {value}<span className="text-xs font-normal" style={{ color: "var(--ink-faint)" }}>/10</span>
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

  const plan = planOf(user?.subscription_plan);
  const isPro = isPaidPlan(user?.subscription_plan);
  const hasInsights = plan.hasInsights;
  const monthlyUsed = (user as any)?.interviews_this_month ?? 0;
  const monthlyLimit = plan.monthlyLimit; // null = unlimited
  const limitReached = monthlyLimit !== null && monthlyUsed >= monthlyLimit;
  const lastCompleted = sessions.find((s) => s.status === "completed");

  // Analytics computed from history (paid plans only)
  const completedSessions = sessions.filter((s) => s.status === "completed");
  const avg = (nums: number[]) =>
    nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 : undefined;
  const avgOverall = avg(completedSessions.map((s) => s.scores?.overall).filter((v): v is number => v !== undefined));
  const avgComm = avg(completedSessions.map((s) => s.scores?.communication).filter((v): v is number => v !== undefined));
  const avgTech = avg(completedSessions.map((s) => s.scores?.technical).filter((v): v is number => v !== undefined));
  const bestOverall = completedSessions.reduce<number | undefined>((best, s) => {
    const v = s.scores?.overall;
    return v !== undefined && (best === undefined || v > best) ? v : best;
  }, undefined);

  return (
    <ProtectedRoute>
      <AppShell>
      <div className="min-h-screen" style={{ background: "var(--page)" }}>

        {/* Nav — only shown for free plan; paid plans use the sidebar instead */}
        {!isPro && (
          <nav
            className="flex items-center justify-between px-6 py-4 border-b"
            style={{ borderColor: "var(--surface)" }}
          >
            <span className="text-lg font-bold tracking-tight" style={{ color: "var(--ink)" }}>
              InterviewX
            </span>
            <div className="flex items-center gap-4">
              <span
                className="text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider"
                style={{ background: "var(--surface)", color: "var(--ink-dim)" }}
              >
                {plan.label}
              </span>
              <span className="text-sm" style={{ color: "var(--ink-dim)" }}>
                {user?.username}
              </span>
              <button
                onClick={handleLogout}
                className="text-sm hover:underline"
                style={{ color: "var(--ink-faint)" }}
              >
                Sign out
              </button>
            </div>
          </nav>
        )}

        <main className="max-w-4xl mx-auto px-6 py-10 fade-up">

          {/* Header row */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="font-display text-2xl font-bold" style={{ color: "var(--ink)" }}>
                {hasInsights ? "Dashboard" : "Home"}
              </h1>
              {monthlyLimit !== null && (
                <p className="mt-1 text-sm" style={{ color: "var(--ink-dim)" }}>
                  {monthlyUsed}/{monthlyLimit} {plan.id === "free" ? "free " : ""}interviews used this month.{" "}
                  <button
                    onClick={() => router.push("/upgrade")}
                    className="underline"
                    style={{ color: "var(--accent)" }}
                  >
                    {limitReached ? "Upgrade to continue →" : "Upgrade for more →"}
                  </button>
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {!isPro ? (
                <button
                  onClick={() => router.push("/upgrade")}
                  className="px-5 py-2.5 rounded-full text-sm font-semibold"
                  style={{ background: "var(--accent-glow)", color: "var(--accent)", border: "1px solid var(--accent)" }}
                >
                  Upgrade ↗
                </button>
              ) : (
                <button
                  onClick={() => router.push("/upgrade")}
                  className="px-5 py-2.5 rounded-full text-sm font-semibold"
                  style={{ background: "transparent", color: "var(--ink-dim)", border: "1px solid var(--ink-faint)" }}
                >
                  Manage subscription
                </button>
              )}
              <button
                onClick={() => router.push("/companies")}
                disabled={limitReached}
                className="px-5 py-2.5 rounded-full text-sm font-semibold transition-opacity disabled:opacity-40"
                style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
              >
                + Start interview
              </button>
            </div>
          </div>

          {/* Paid plans: detailed analytics summary */}
          {hasInsights && !loadingSessions && !fetchError && completedSessions.length > 0 && (
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--ink-dim)" }}>
                Performance snapshot
              </p>
              <button
                onClick={() => router.push("/progress")}
                className="px-3.5 py-1.5 rounded-full text-xs font-semibold transition-opacity hover:opacity-80"
                style={{ background: "var(--accent-glow)", color: "var(--accent)", border: "1px solid var(--accent)" }}
              >
                View full progress →
              </button>
            </div>
          )}
          {hasInsights && !loadingSessions && !fetchError && completedSessions.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              {[
                { label: "Interviews completed", value: completedSessions.length },
                { label: "Avg. overall", value: avgOverall !== undefined ? `${avgOverall}/10` : "—" },
                { label: "Avg. communication", value: avgComm !== undefined ? `${avgComm}/10` : "—" },
                { label: "Best score", value: bestOverall !== undefined ? `${bestOverall}/10` : "—" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-lg px-4 py-4"
                  style={{ background: "var(--surface)", border: "1px solid var(--border-mid)" }}
                >
                  <p className="text-2xl font-bold tabular-nums" style={{ color: "var(--ink)" }}>
                    {stat.value}
                  </p>
                  <p className="text-xs mt-1" style={{ color: "var(--ink-dim)" }}>
                    {stat.label}
                  </p>
                </div>
              ))}
              {avgTech !== undefined && (
                <div
                  className="rounded-lg px-4 py-4 col-span-2 sm:col-span-1"
                  style={{ background: "var(--surface)", border: "1px solid var(--border-mid)" }}
                >
                  <p className="text-2xl font-bold tabular-nums" style={{ color: "var(--ink)" }}>
                    {avgTech}/10
                  </p>
                  <p className="text-xs mt-1" style={{ color: "var(--ink-dim)" }}>
                    Avg. technical
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Free plan: no dashboard/history — just their most recent plain score */}
          {!hasInsights ? (
            loadingSessions ? (
              <p className="text-sm" style={{ color: "var(--ink-dim)" }}>
                Loading…
              </p>
            ) : fetchError ? (
              <p className="text-sm" style={{ color: "var(--danger)" }}>
                {fetchError}
              </p>
            ) : lastCompleted ? (
              <div
                className="rounded-xl px-6 py-8 text-center"
                style={{ background: "var(--surface)", border: "1px solid var(--border-mid)" }}
              >
                <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: "var(--ink-dim)" }}>
                  Your last score
                </p>
                <div className="text-5xl font-black tabular-nums mb-2" style={{ color: "var(--ink)" }}>
                  {lastCompleted.scores?.overall ?? "—"}
                  <span className="text-xl font-normal" style={{ color: "var(--ink-faint)" }}>/10</span>
                </div>
                <p className="text-sm mb-6" style={{ color: "var(--ink-dim)" }}>
                  Overall score from your most recent interview.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => router.push(`/interview/${lastCompleted.id}/results`)}
                    className="px-5 py-2.5 rounded-full text-sm font-semibold"
                    style={{
                      background: "transparent",
                      color: "var(--ink)",
                      border: "1px solid var(--border-mid)",
                    }}
                  >
                    View result
                  </button>
                  <button
                    onClick={() => router.push("/upgrade")}
                    className="px-5 py-2.5 rounded-full text-sm font-semibold"
                    style={{ background: "var(--accent-glow)", color: "var(--accent)", border: "1px solid var(--accent)" }}
                  >
                    Unlock full insights →
                  </button>
                </div>
                <button
                  onClick={() => router.push("/progress")}
                  className="mt-4 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-opacity hover:opacity-80"
                  style={{ background: "var(--surface)", color: "var(--ink-dim)", border: "1px solid var(--border-mid)" }}
                >
                  See your score trend so far →
                </button>
              </div>
            ) : (
              <div
                className="rounded-lg p-10 text-center"
                style={{ background: "var(--surface)", border: "1px solid var(--border-mid)" }}
              >
                <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
                  No interviews yet.
                </p>
                <p className="mt-1 text-sm" style={{ color: "var(--ink-dim)" }}>
                  Pick a company and role to run your first AI interview.
                </p>
                <button
                  onClick={() => router.push("/companies")}
                  className="mt-5 px-5 py-2 rounded-full text-sm font-semibold"
                  style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
                >
                  Browse companies
                </button>
              </div>
            )
          ) : /* Paid plans: full history table with score columns */
          loadingSessions ? (
            <p className="text-sm" style={{ color: "var(--ink-dim)" }}>
              Loading sessions…
            </p>
          ) : fetchError ? (
            <p className="text-sm" style={{ color: "var(--danger)" }}>
              {fetchError}
            </p>
          ) : sessions.length === 0 ? (
            <div
              className="rounded-lg p-10 text-center"
              style={{ background: "var(--surface)", border: "1px solid var(--border-mid)" }}
            >
              <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
                No interviews yet.
              </p>
              <p className="mt-1 text-sm" style={{ color: "var(--ink-dim)" }}>
                Pick a company and role to run your first AI interview.
              </p>
              <button
                onClick={() => router.push("/companies")}
                className="mt-5 px-5 py-2 rounded-full text-sm font-semibold"
                style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
              >
                Browse companies
              </button>
            </div>
          ) : (
            <div
              className="rounded-lg overflow-hidden"
              style={{ border: "1px solid var(--border-mid)" }}
            >
              {/* Table header */}
              <div
                className="grid text-xs font-medium uppercase tracking-wider px-5 py-3"
                style={{
                  gridTemplateColumns: "1fr 80px 60px 60px 60px 100px",
                  background: "var(--surface)",
                  color: "var(--ink-dim)",
                  borderBottom: "1px solid var(--border-mid)",
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
                        ? "1px solid var(--border-mid)"
                        : "none",
                    background: i % 2 === 0 ? "transparent" : "rgba(30,41,59,0.4)",
                  }}
                >
                  <span className="text-sm font-medium" style={{ color: "var(--ink)" }}>
                    {s.company_name ?? `Session #${s.id}`}
                    {s.role_title && (
                      <span className="ml-1.5 font-normal" style={{ color: "var(--ink-faint)" }}>
                        · {s.role_title}
                      </span>
                    )}
                  </span>
                  <StatusBadge status={s.status} />
                  <ScorePill value={s.scores?.communication} />
                  <ScorePill value={s.scores?.technical} />
                  <ScorePill value={s.scores?.overall} />
                  <span
                    className="text-xs text-right"
                    style={{ color: "var(--ink-faint)" }}
                  >
                    {formatDate(s.started_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
      </AppShell>
    </ProtectedRoute>
  );
}