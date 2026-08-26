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
  in_progress: { label: "In progress", bg: "#FBF8D6", color: "#6B6B3D", dot: "#D4B94A" },
  completed: { label: "Completed", bg: "#DEF3E0", color: "#3FA562", dot: "#3FA562" },
  abandoned: { label: "Abandoned", bg: "var(--surface-2)", color: "var(--ink-dim)", dot: "var(--ink-faint)" },
} as const;

function StatusBadge({ status }: { status: InterviewSession["status"] }) {
  const s = STATUS_MAP[status];
  return (
    <span
      className="inline-flex items-center justify-center justify-self-start gap-1.5 text-xs font-medium leading-none px-2.5 py-1.5 rounded-full whitespace-nowrap"
      style={{ background: s.bg, color: s.color }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.dot }} />
      {s.label}
    </span>
  );
}

function ScorePill({ value, variant = "default" }: { value: number | undefined; variant?: "default" | "overall" }) {
  if (value === undefined) return <span style={{ color: "var(--ink-faint)" }}>—</span>;
  const color =
    value <= 2 ? "var(--danger)" :
    variant === "overall" ? "#B8862F" :
    value >= 7 ? "var(--success)" : "var(--ink)";
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
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
            <div className="w-full sm:w-auto">
              <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight mb-2 sm:mb-0" style={{ color: "var(--ink)" }}>
                {hasInsights ? "Dashboard" : "Home"}
              </h1>
            </div>
            <div className="flex w-full sm:w-auto items-center gap-3 flex-col sm:flex-row">
              <button
                onClick={() => router.push("/pricing")}
                className="w-full sm:w-auto px-4 py-2 rounded-full text-sm font-medium transition-colors hover:bg-[var(--surface-2)]"
                style={{ background: "transparent", color: "var(--ink)", border: "1px solid var(--border-mid)" }}
              >
                {isPro ? "Manage subscription" : "Upgrade"}
              </button>
              <button
                onClick={() => router.push("/companies")}
                disabled={limitReached}
                className="w-full sm:w-auto px-4 py-2 rounded-full text-sm font-semibold transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:hover:scale-100"
                style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
              >
                + Start interview
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
            <div className="mb-3 rounded-[18px] border shadow-sm" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-4 sm:p-5">
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--ink-dim)" }}>
                  Performance snapshot
                </p>
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
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
                    {statCards.map((stat) => (
                      <div
                        key={stat.label}
                        className="rounded-[16px] p-4 shadow-sm transition-all duration-200 hover:-translate-y-[1px]"
                        style={
                          stat.lime
                            ? { background: "var(--lime)" }
                            : { background: "var(--surface)", border: "1px solid var(--border)" }
                        }
                      >
                        <p className="font-display text-[24px] sm:text-[30px] leading-none font-semibold tracking-tight tabular-nums mb-2" style={{ color: "var(--ink)" }}>
                          {stat.value}
                        </p>
                        <p className="text-[11px] sm:text-[12px]" style={{ color: stat.lime ? "var(--ink)" : "var(--ink-dim)" }}>
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
          {hasInsights && !loadingSessions && !fetchError && <RealInterviewReportsCard />}

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
              <div
                className="mb-4 flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <p className="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--ink-dim)" }}>
                  <span style={{ color: "var(--ink-faint)" }}>◇</span> Sessions
                </p>
                <div className="grid w-full grid-cols-3 gap-2 sm:w-auto sm:flex sm:items-center">
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
                        className="whitespace-nowrap rounded-full px-2.5 py-2 text-center text-[12px] font-medium leading-none transition-colors sm:px-4 sm:py-1.5 sm:text-[13px]"
                        style={
                          active
                            ? { background: "var(--accent)", color: "var(--accent-ink)" }
                            : { background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--border-mid)" }
                        }
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div
                className="rounded-2xl p-2 mb-4 flex items-center gap-3"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <span className="pl-3" style={{ color: "var(--ink-faint)" }}>⌕</span>
                <input
                  type="text"
                  value={sessionSearch.query}
                  onChange={(e) => sessionSearch.setQuery(e.target.value)}
                  placeholder="Search sessions by company or role…"
                  className="flex-1 bg-transparent outline-none text-[14.5px] py-2.5"
                  style={{ color: "var(--ink)" }}
                />
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
                      className="rounded-3xl overflow-hidden shadow-[0_8px_32px_rgba(28,26,22,0.06)]"
                      style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
                    >
                      {/* Table header */}
                      <div
                        className="grid text-xs font-medium uppercase tracking-wider px-5 py-3"
                        style={{
                          gridTemplateColumns: "1fr 130px 70px 70px 80px 110px",
                          columnGap: "24px",
                          background: "var(--surface-2)",
                          color: "var(--ink-dim)",
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
                          className="dash-row grid items-center px-5 py-4 cursor-pointer transition-colors"
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