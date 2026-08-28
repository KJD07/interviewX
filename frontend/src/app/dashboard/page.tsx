"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppShell from "@/components/AppShell";
import TopupModal from "@/components/TopupModal";
import { interviews, ApiError } from "@/lib/api";
import type { InterviewSession } from "@/lib/api";
import { planOf, isPaidPlan } from "@/lib/plans";
import PaginationControls from "@/components/PaginationControls";
import RealInterviewReportsCard from "@/components/RealInterviewReportsCard";
import { useSearchAndPaginate } from "@/hooks/useSearchAndPaginate";
import { Skeleton, SkeletonStatCard, SkeletonTable } from "@/components/Skeleton";

const STATUS_MAP = {
  in_progress: { label: "In progress", bg: "rgba(180,115,30,0.14)", color: "#7A5A12", dot: "var(--warn)", pulse: true },
  completed: { label: "Completed", bg: "var(--success-bg)", color: "#2F6B48", dot: "var(--success)", pulse: false },
  abandoned: { label: "Abandoned", bg: "var(--surface-2)", color: "var(--ink-dim)", dot: "var(--ink-faint)", pulse: false },
} as const;

function StatusBadge({ status }: { status: InterviewSession["status"] }) {
  const s = STATUS_MAP[status];
  return (
    <span
      className="inline-flex items-center justify-center justify-self-start gap-1.5 text-xs font-medium leading-none px-2.5 py-1.5 rounded-full whitespace-nowrap"
      style={{ background: s.bg, color: s.color }}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.pulse ? "el-pulse" : ""}`}
        style={{ background: s.dot }}
      />
      {s.label}
    </span>
  );
}

function ScorePill({ value, variant = "default" }: { value: number | undefined; variant?: "default" | "overall" }) {
  if (value === undefined) return <span style={{ color: "var(--ink-faint)" }}>—</span>;
  // Same anchors the grader uses: 0-2 is a fail, 3-5 shaky, 6+ solid.
  const color = value >= 6 ? "var(--success)" : value >= 3 ? "var(--warn)" : "var(--danger)";
  return (
    <span
      className="font-mono tabular-nums"
      style={{ color, fontWeight: variant === "overall" ? 700 : 500, fontSize: variant === "overall" ? 15 : 14 }}
    >
      {value}<span className="text-[11px] font-normal" style={{ color: "var(--ink-faint)" }}>/10</span>
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
  const [showTopup, setShowTopup] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "in_progress">("all");
  const [showSnapshot, setShowSnapshot] = useState(true);

  useEffect(() => {
    // Guards against setState firing after the user has already navigated
    // away — without it, a slow response landing post-unmount would still
    // update state on a component React has discarded.
    let cancelled = false;
    refreshUser().catch(() => { });
    interviews.list()
      .then((data) => {
        if (!cancelled) setSessions(data);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError) setFetchError(err.detail);
        else setFetchError("Could not load sessions.");
      })
      .finally(() => {
        if (!cancelled) setLoadingSessions(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  const plan = planOf(user?.subscription_plan);
  const isPro = isPaidPlan(user?.subscription_plan);
  const hasInsights = plan.hasInsights;
  const monthlyUsed = user?.interviews_this_month ?? 0;
  const monthlyLimit = user?.monthly_limit ?? plan.monthlyLimit; // null = unlimited
  const bonusInterviews = user?.bonus_interviews ?? 0;
  // Plan quota used up AND no purchased top-up credits left — bonus credits
  // let a user keep going past their monthly limit without upgrading.
  const limitReached = monthlyLimit !== null && monthlyUsed >= monthlyLimit && bonusInterviews <= 0;
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

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const statusFilteredSessions =
    statusFilter === "all" ? sessions : sessions.filter((s) => s.status === statusFilter);

  const sessionSearch = useSearchAndPaginate(
    statusFilteredSessions,
    (s) => `${s.company_name ?? ""} ${s.role_title ?? ""} Session #${s.id}`
  );

  const analyticsSessions =
    statusFilter === "all" ? sessions : sessions.filter((s) => s.status === statusFilter);

  const analyticsCompleted = analyticsSessions.filter((s) => s.status === "completed");
  const analyticsAvg = (nums: number[]) =>
    nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 : undefined;
  const analyticsAvgOverall = analyticsAvg(
    analyticsCompleted.map((s) => s.scores?.overall).filter((v): v is number => v !== undefined)
  );
  const analyticsAvgComm = analyticsAvg(
    analyticsCompleted.map((s) => s.scores?.communication).filter((v): v is number => v !== undefined)
  );
  const analyticsAvgTech = analyticsAvg(
    analyticsCompleted.map((s) => s.scores?.technical).filter((v): v is number => v !== undefined)
  );
  const analyticsBestOverall = analyticsCompleted.reduce<number | undefined>((best, s) => {
    const v = s.scores?.overall;
    return v !== undefined && (best === undefined || v > best) ? v : best;
  }, undefined);

  const statCards: { label: string; value: string | number; lime?: boolean }[] = [
    { label: "Interviews", value: analyticsCompleted.length },
    { label: "Avg. overall", value: analyticsAvgOverall !== undefined ? `${analyticsAvgOverall}/10` : "—" },
    { label: "Avg. communication", value: analyticsAvgComm !== undefined ? `${analyticsAvgComm}/10` : "—" },
    ...(analyticsAvgTech !== undefined
      ? [{ label: "Avg. technical", value: `${analyticsAvgTech}/10` }]
      : []),
    { label: "Best score", value: analyticsBestOverall !== undefined ? `${analyticsBestOverall}/10` : "—", lime: true },
  ];

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
              EvaluLabs
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

        <main className="max-w-6xl mx-auto px-4 sm:px-8 py-10 fade-up">

          {/* Header row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-[30px] gap-4">
            <div className="w-full sm:w-auto">
              <div className="font-label mb-2.5">
                {greeting}, {user?.username}
              </div>
              <h1 className="font-display text-[34px] sm:text-[44px] font-bold leading-none tracking-[-0.035em]" style={{ color: "var(--ink)" }}>
                {hasInsights ? "Dashboard" : "Home"}
              </h1>
            </div>
            <div className="flex w-full sm:w-auto items-center gap-2.5 flex-col sm:flex-row">
              <button
                onClick={() => router.push("/pricing")}
                className="w-full sm:w-auto px-[18px] py-3 rounded-full text-sm font-semibold transition-colors hover:bg-[var(--surface)]"
                style={{ background: "transparent", color: "var(--ink)", border: "1px solid var(--border-mid)" }}
              >
                {isPro ? "Manage subscription" : "Upgrade"}
              </button>
              <button
                onClick={() => router.push("/companies")}
                disabled={limitReached}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 rounded-full text-sm font-semibold transition-colors hover:bg-[var(--accent-dim)] disabled:opacity-40"
                style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
              >
                <span style={{ color: "var(--lime)" }}>+</span> Start interview
              </button>
            </div>
          </div>

          {/* Paid plans: analytics skeleton while sessions are loading */}
          {hasInsights && loadingSessions && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 mb-8 fade-up">
              {[1, 2, 3, 4, 5].map((n) => <SkeletonStatCard key={n} />)}
            </div>
          )}

          {/* Paid plans: detailed analytics summary */}
          {hasInsights && !loadingSessions && !fetchError && completedSessions.length > 0 && (
            <div className="mb-3.5 rounded-[18px] border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-4 sm:p-5">
                <p className="font-label">Performance snapshot</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => router.push("/progress")}
                    className="hidden sm:inline-flex px-4 py-2 rounded-full text-[13.5px] font-medium transition-colors hover:bg-[var(--surface-2)]"
                    style={{ background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--border-mid)" }}
                  >
                    View full progress →
                  </button>
                  <button
                    onClick={() => setShowSnapshot((v) => !v)}
                    className="sm:hidden px-2.5 py-1.5 rounded-full text-[11px] font-medium"
                    style={{ background: "var(--surface-2)", color: "var(--ink)" }}
                  >
                    {showSnapshot ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <div className={showSnapshot ? "block" : "hidden"}>
                <div className="px-4 pb-4 sm:px-5 sm:pb-5">
                  <div
                    className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px overflow-hidden rounded-[16px]"
                    style={{ background: "var(--border-mid)", border: "1px solid var(--border-mid)" }}
                  >
                    {statCards.map((stat) => (
                      <div
                        key={stat.label}
                        className="h-full px-[22px] py-5"
                        style={{ background: stat.lime ? "var(--lime)" : "var(--surface)" }}
                      >
                        <p className="font-display text-[26px] sm:text-[34px] leading-none font-bold tracking-[-0.035em] tabular-nums" style={{ color: "var(--ink)" }}>
                          {stat.value}
                        </p>
                        <p className="text-[12px] mt-2" style={{ color: stat.lime ? "#3C4118" : "var(--ink-dim)" }}>
                          {stat.label}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="sm:hidden mt-4">
                    <button
                      onClick={() => router.push("/progress")}
                      className="w-full px-4 py-2.5 rounded-full text-sm font-medium"
                      style={{ background: "var(--surface-2)", color: "var(--ink)", border: "1px solid var(--border-mid)" }}
                    >
                      View full progress →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Persistent entry point for submitting real-interview data — earns
              5 bonus interviews per approved report. Paid plans only, since
              submission itself is gated the same way server-side. */}
          {hasInsights && !loadingSessions && !fetchError && (
            <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-3.5 mb-[34px]">
              <RealInterviewReportsCard />
              <button
                onClick={() => router.push("/progress")}
                className="rounded-[16px] p-[22px] text-left flex flex-col justify-between transition-colors hover:bg-[#17171A]"
                style={{ background: "var(--hero-bg)", color: "var(--hero-text)" }}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--lime)" }}>
                    Readiness
                  </span>
                  <span className="font-mono text-[11px]" style={{ color: "#A3A29A" }}>
                    {analyticsCompleted.length} completed
                  </span>
                </div>
                <div className="flex items-end justify-between gap-3 mt-4">
                  <span className="font-display text-[40px] font-bold leading-none tracking-[-0.04em] tabular-nums">
                    {analyticsAvgOverall ?? "—"}
                    <span className="text-[18px] font-medium" style={{ color: "#7E7D74" }}>/10</span>
                  </span>
                  <span className="text-[13px]" style={{ color: "#A3A29A" }}>View full progress →</span>
                </div>
              </button>
            </div>
          )}

          {/* Free plan: no dashboard/history — just their most recent plain score */}
          {!hasInsights ? (
            loadingSessions ? (
              <div
                className="rounded-3xl px-6 py-8 text-center fade-up"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <Skeleton className="h-3 w-28 rounded mb-4 mx-auto" />
                <Skeleton className="h-12 w-24 rounded-xl mb-3 mx-auto" />
                <Skeleton className="h-3 w-56 rounded mb-6 mx-auto" />
                <div className="flex items-center justify-center gap-3">
                  <Skeleton className="h-10 w-32 rounded-full" />
                  <Skeleton className="h-10 w-40 rounded-full" />
                </div>
              </div>
            ) : fetchError ? (
              <p className="text-sm" style={{ color: "var(--danger)" }}>
                {fetchError}
              </p>
            ) : lastCompleted ? (
              <div
                className="rounded-3xl px-6 py-8 text-center shadow-[0_8px_32px_rgba(28,26,22,0.06)]"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
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
                    onClick={() => router.push("/pricing")}
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
            <div className="fade-up">
              <div className="flex items-center justify-between mb-3">
                <Skeleton className="h-3 w-20 rounded" />
                <Skeleton className="h-8 w-48 rounded-full" />
              </div>
              <Skeleton className="h-12 w-full rounded-2xl mb-4" />
              <SkeletonTable />
            </div>
          ) : fetchError ? (
            <p className="text-sm" style={{ color: "var(--danger)" }}>
              {fetchError}
            </p>
          ) : sessions.length === 0 ? (
            <div
              className="rounded-3xl p-10 text-center shadow-[0_8px_32px_rgba(28,26,22,0.06)]"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
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
            <>
              <div className="mb-3.5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div className="flex items-baseline gap-3">
                  <h2 className="font-display text-2xl font-bold tracking-[-0.025em]" style={{ color: "var(--ink)" }}>
                    Sessions
                  </h2>
                  <span className="font-mono text-[11px]" style={{ color: "var(--ink-faint)" }}>
                    {sessionSearch.matchCount}{" "}
                    {sessionSearch.matchCount === 1 ? "session" : "sessions"}
                  </span>
                </div>
                <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                  <input
                    type="text"
                    value={sessionSearch.query}
                    onChange={(e) => sessionSearch.setQuery(e.target.value)}
                    placeholder="Search by company or role…"
                    className="rounded-full px-4 py-2.5 text-sm outline-none sm:w-[260px]"
                    style={{ background: "var(--surface)", border: "1px solid var(--border-mid)", color: "var(--ink)" }}
                  />
                  <div
                    className="grid grid-cols-3 gap-1 rounded-full p-[3px] sm:flex sm:items-center"
                    style={{ background: "var(--surface)", border: "1px solid var(--border-mid)" }}
                  >
                    {[
                      { key: "all" as const, label: "All" },
                      { key: "completed" as const, label: "Completed" },
                      { key: "in_progress" as const, label: "In progress" },
                    ].map((opt) => {
                      const active = statusFilter === opt.key;
                      return (
                        <button
                          key={opt.key}
                          onClick={() => setStatusFilter(opt.key)}
                          className="whitespace-nowrap rounded-full px-[15px] py-2 text-center text-[13px] leading-none transition-colors"
                          style={
                            active
                              ? { background: "var(--accent)", color: "var(--accent-ink)", fontWeight: 600 }
                              : { background: "transparent", color: "var(--ink-dim)", fontWeight: 500 }
                          }
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {sessionSearch.results.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--ink-dim)" }}>
                  {sessionSearch.isSearching
                    ? `No sessions match "${sessionSearch.query}".`
                    : "No sessions match this filter."}
                </p>
              ) : (
                <>
                  <div className="space-y-3 sm:hidden">
                    {sessionSearch.results.map((s) => (
                      <div
                        key={s.id}
                        onClick={() =>
                          router.push(
                            s.status === "completed"
                              ? `/interview/${s.id}/results`
                              : `/interview/${s.id}`
                          )
                        }
                        className="rounded-2xl p-4 cursor-pointer transition-colors"
                        style={{
                          background: "var(--surface)",
                          border: "1px solid var(--border)",
                          boxShadow: "0 8px 24px rgba(28,26,22,0.04)",
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold truncate" style={{ color: "var(--ink)" }}>
                              {s.company_name ?? `Session #${s.id}`}
                            </p>
                            {s.role_title && (
                              <p className="text-xs mt-1 truncate" style={{ color: "var(--ink-faint)" }}>
                                {s.role_title}
                              </p>
                            )}
                          </div>
                          <StatusBadge status={s.status} />
                        </div>

                        <div className="mt-3 grid grid-cols-3 gap-2">
                          <div className="rounded-xl px-2 py-2" style={{ background: "var(--page)" }}>
                            <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--ink-faint)" }}>
                              Comm
                            </p>
                            <div className="mt-1">
                              <ScorePill value={s.scores?.communication} />
                            </div>
                          </div>
                          <div className="rounded-xl px-2 py-2" style={{ background: "var(--page)" }}>
                            <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--ink-faint)" }}>
                              Tech
                            </p>
                            <div className="mt-1">
                              <ScorePill value={s.scores?.technical} />
                            </div>
                          </div>
                          <div className="rounded-xl px-2 py-2" style={{ background: "var(--page)" }}>
                            <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--ink-faint)" }}>
                              Overall
                            </p>
                            <div className="mt-1">
                              <ScorePill value={s.scores?.overall} variant="overall" />
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-3 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
                          <span className="text-[11px]" style={{ color: "var(--ink-faint)" }}>
                            {formatDate(s.started_at)}
                          </span>
                          <span className="text-[11px] font-medium" style={{ color: "var(--ink-dim)" }}>
                            Open →
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="hidden sm:block overflow-x-auto">
                    <div
                      className="rounded-[16px] overflow-hidden"
                      style={{ border: "1px solid var(--border-mid)", background: "var(--surface)" }}
                    >
                      {/* Table header */}
                      <div
                        className="grid font-mono text-[10px] uppercase tracking-[0.14em] px-[22px] py-3"
                        style={{
                          gridTemplateColumns: "1fr 130px 70px 70px 80px 110px",
                          columnGap: "24px",
                          background: "var(--surface-alt)",
                          color: "var(--ink-faint)",
                          borderBottom: "1px solid var(--border)",
                          minWidth: "920px",
                        }}
                      >
                        <span>Session</span>
                        <span>Status</span>
                        <span>Comm.</span>
                        <span>Tech.</span>
                        <span>Overall</span>
                        <span>Date</span>
                      </div>

                      {sessionSearch.results.map((s, i) => (
                        <div
                          key={s.id}
                          onClick={() =>
                            router.push(
                              s.status === "completed"
                                ? `/interview/${s.id}/results`
                                : `/interview/${s.id}`
                            )
                          }
                          className="dash-row grid items-center px-[22px] py-3.5 cursor-pointer transition-colors"
                          style={{
                            gridTemplateColumns: "1fr 130px 70px 70px 80px 110px",
                            columnGap: "24px",
                            borderBottom:
                              i < sessionSearch.results.length - 1
                                ? "1px solid var(--border)"
                                : "none",
                            minWidth: "920px",
                          }}
                        >
                          <span>
                            <span className="block text-[15px] font-semibold" style={{ color: "var(--ink)" }}>
                              {s.company_name ?? `Session #${s.id}`}
                            </span>
                            {s.role_title && (
                              <span className="block text-[13px]" style={{ color: "var(--ink-faint)" }}>
                                {s.role_title}
                              </span>
                            )}
                          </span>
                          <StatusBadge status={s.status} />
                          <ScorePill value={s.scores?.communication} />
                          <ScorePill value={s.scores?.technical} />
                          <ScorePill value={s.scores?.overall} variant="overall" />
                          <span
                            className="text-xs"
                            style={{ color: "var(--ink-faint)" }}
                          >
                            {formatDate(s.started_at)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {!sessionSearch.isSearching && (
                <PaginationControls
                  page={sessionSearch.page}
                  totalPages={sessionSearch.totalPages}
                  onChange={sessionSearch.setPage}
                />
              )}
            </>
          )}
        </main>
      </div>
      </AppShell>

      {showTopup && <TopupModal onClose={() => setShowTopup(false)} />}
    </ProtectedRoute>
  );
}