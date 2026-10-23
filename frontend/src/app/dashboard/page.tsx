"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppShell from "@/components/AppShell";
import TopupModal from "@/components/TopupModal";
import { interviews, ApiError } from "@/lib/api";
import type { InterviewSession } from "@/lib/api";
import { planOf, isPaidPlan, isPlatformFree, ATS_UNLIMITED_LABEL } from "@/lib/plans";
import PaginationControls from "@/components/PaginationControls";
import RealInterviewReportsCard from "@/components/RealInterviewReportsCard";
import RealInterviewReportModal from "@/components/RealInterviewReportModal";
import LineChart from "@/components/LineChart";
import { useSearchAndPaginate } from "@/hooks/useSearchAndPaginate";
import { Skeleton, SkeletonTable } from "@/components/Skeleton";
import {
  PageContainer, PageHeader, Card, StatTile, EmptyState, Notice, Segmented, SearchField,
  IconSpark, IconChat, IconBriefcase, IconDoc, IconArrowRight, scoreColor,
} from "@/components/ui";

const STATUS_MAP = {
  in_progress: { label: "In progress", cls: "tag tag-warn", dot: "var(--warn)", pulse: true },
  scoring: { label: "Scoring", cls: "tag", dot: "var(--accent)", pulse: true },
  completed: { label: "Completed", cls: "tag tag-success", dot: "var(--success)", pulse: false },
  abandoned: { label: "Abandoned", cls: "tag", dot: "var(--ink-faint)", pulse: false },
} as const;

function StatusBadge({ status }: { status: InterviewSession["status"] }) {
  const s = STATUS_MAP[status];
  return (
    <span className={`${s.cls} justify-self-start`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.pulse ? "el-pulse" : ""}`} style={{ background: s.dot }} />
      {s.label}
    </span>
  );
}

function ScorePill({ value, variant = "default" }: { value: number | undefined; variant?: "default" | "overall" }) {
  if (value === undefined) return <span style={{ color: "var(--ink-faint)" }}>—</span>;
  return (
    <span
      className="font-mono tabular-nums"
      style={{ color: scoreColor(value), fontWeight: variant === "overall" ? 700 : 500, fontSize: variant === "overall" ? 15 : 14 }}
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

function avg(nums: (number | undefined)[]) {
  const xs = nums.filter((v): v is number => v !== undefined);
  return xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : undefined;
}

// One equal-size tile in the dashboard's quick-actions row.
function ActionTile({
  icon,
  title,
  body,
  onClick,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  onClick: () => void;
  badge?: string;
}) {
  return (
    <button onClick={onClick} className="ui-card card-hover group h-full p-4 sm:p-5 text-left flex flex-col gap-3 sm:gap-4">
      <div className="flex items-center justify-between gap-3">
        <span
          className="w-10 h-10 rounded-[12px] flex items-center justify-center"
          style={{ background: "var(--surface-2)", color: "var(--ink)" }}
        >
          {icon}
        </span>
        {badge && <span className="tag tag-success hidden sm:inline-flex">{badge}</span>}
      </div>
      <div className="flex-1">
        <p className="font-display text-[15px] sm:text-[17px] font-bold leading-snug tracking-[-0.02em]" style={{ color: "var(--ink)" }}>
          {title}
        </p>
        <p className="hidden sm:block text-[13px] mt-1 leading-relaxed" style={{ color: "var(--ink-dim)" }}>
          {body}
        </p>
      </div>
      <span
        className="hidden sm:flex items-center gap-1.5 text-[13px] font-semibold transition-transform duration-300 group-hover:translate-x-0.5"
        style={{ color: "var(--ink)" }}
      >
        Open <IconArrowRight />
      </span>
    </button>
  );
}

export default function DashboardPage() {
  const { user, logout, refreshUser } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [showTopup, setShowTopup] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "in_progress">("all");
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportsVersion, setReportsVersion] = useState(0);

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
  }, [refreshUser]); // stable (useCallback with no deps): still runs once

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  const plan = planOf(user?.subscription_plan);
  const isPro = isPaidPlan(user?.subscription_plan);
  const platformFree = isPlatformFree(user);
  const hasInsights = plan.hasInsights;
  const monthlyUsed = user?.interviews_this_month ?? 0;
  const monthlyLimit = user?.monthly_limit ?? plan.monthlyLimit; // null = unlimited
  const bonusInterviews = user?.bonus_interviews ?? 0;
  // Plan quota used up AND no purchased top-up credits left — bonus credits
  // let a user keep going past their monthly limit without upgrading.
  const limitReached = monthlyLimit !== null && monthlyUsed >= monthlyLimit && bonusInterviews <= 0;
  const lastCompleted = sessions.find((s) => s.status === "completed");

  // Snapshot stats always cover every completed session — the table's status
  // filter below narrows the list, not the summary.
  const completedSessions = sessions.filter((s) => s.status === "completed");
  const avgOverall = avg(completedSessions.map((s) => s.scores?.overall));
  const avgComm = avg(completedSessions.map((s) => s.scores?.communication));
  const avgTech = avg(completedSessions.map((s) => s.scores?.technical));
  const bestOverall = completedSessions.reduce<number | undefined>((best, s) => {
    const v = s.scores?.overall;
    return v !== undefined && (best === undefined || v > best) ? v : best;
  }, undefined);
  // Oldest → newest overall scores for the readiness sparkline.
  const overallTrend = [...completedSessions]
    .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime())
    .map((s) => s.scores?.overall)
    .filter((v): v is number => v !== undefined)
    .slice(-12);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const statusFilteredSessions =
    statusFilter === "all" ? sessions : sessions.filter((s) => s.status === statusFilter);

  const sessionSearch = useSearchAndPaginate(
    statusFilteredSessions,
    (s) => `${s.company_name ?? ""} ${s.role_title ?? ""} Session #${s.id}`
  );

  const openSession = (s: InterviewSession) =>
    router.push(s.status === "completed" ? `/interview/${s.id}/results` : `/interview/${s.id}`);

  const quickActions = (
    <section className="mb-6">
      <div className="font-label mb-3">Quick actions</div>
      <div className={`grid grid-cols-2 gap-3 sm:gap-4 ${hasInsights ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
        <ActionTile
          icon={<IconSpark />}
          title="Mock interview"
          body="Pick a company, role and round for a full AI interview."
          onClick={() => router.push("/companies")}
        />
        <ActionTile
          icon={<IconChat />}
          title="Typed practice"
          body="Answer one question at a time and get an instant score."
          onClick={() => router.push("/practice")}
        />
        <ActionTile
          icon={<IconBriefcase />}
          title="Live jobs"
          body="Fresh openings from company career pages, ranked for you."
          onClick={() => router.push("/jobs")}
        />
        {/* Report submission is gated to plans with insights server-side. */}
        {hasInsights && (
          <ActionTile
            icon={<IconDoc />}
            title="Report an interview"
            body="Share what a real interview asked — approved reports earn 5 free interviews."
            badge="+5 interviews"
            onClick={() => setShowReportModal(true)}
          />
        )}
      </div>
    </section>
  );

  const noSessionsEmpty = (
    <EmptyState
      icon={<IconSpark />}
      title="No interviews yet"
      body="Pick a company and role to run your first AI mock interview. Your scores and trends will show up here."
      action={
        <button onClick={() => router.push("/companies")} className="btn btn-primary">
          Browse companies
        </button>
      }
    />
  );

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
              <span className="tag uppercase tracking-wider">
                {platformFree ? (user?.ats_unlimited ? ATS_UNLIMITED_LABEL : "Free") : plan.label}
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

        <PageContainer>
          <PageHeader
            eyebrow={`${greeting}, ${user?.username ?? ""}`}
            title={hasInsights ? "Dashboard" : "Home"}
            subtitle="Your interview practice, scores and next steps in one place."
            actions={
              <>
                <button onClick={() => router.push("/pricing")} className="btn btn-secondary flex-1 sm:flex-none">
                  {platformFree
                    ? user?.ats_unlimited ? "Manage ATS Unlimited" : "Unlimited ATS"
                    : isPro ? "Manage subscription" : "Upgrade"}
                </button>
                <button
                  onClick={() => router.push("/companies")}
                  disabled={limitReached}
                  className="btn btn-primary flex-1 sm:flex-none"
                >
                  <span style={{ color: "var(--lime)" }}>+</span> Start interview
                </button>
              </>
            }
          />

          {fetchError && (
            <Notice tone="error" className="mb-6">{fetchError}</Notice>
          )}

          {/* ── Snapshot: readiness hero + four equal stat tiles ── */}
          {hasInsights && loadingSessions && (
            <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-4 mb-6">
              <Skeleton className="h-[252px] !rounded-[18px]" />
              <div className="grid grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((n) => <Skeleton key={n} className="h-[118px] !rounded-[18px]" />)}
              </div>
            </div>
          )}

          {hasInsights && !loadingSessions && !fetchError && sessions.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-4 mb-6">
              <button
                onClick={() => router.push("/progress")}
                className="group rounded-[18px] p-6 text-left flex flex-col justify-between gap-5 min-h-[252px] transition-colors hover:bg-[#17171A]"
                style={{ background: "var(--hero-bg)", color: "var(--hero-text)" }}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--lime)" }}>
                    Readiness · avg overall
                  </span>
                  <span className="font-mono text-[11px]" style={{ color: "#A3A29A" }}>
                    {completedSessions.length} completed
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] items-end gap-5">
                  <span className="font-display text-[56px] font-bold leading-[0.9] tracking-[-0.05em] tabular-nums">
                    {avgOverall ?? "—"}
                    <span className="text-[20px] font-medium" style={{ color: "#7E7D74" }}>/10</span>
                  </span>
                  {overallTrend.length > 1 && (
                    <LineChart data={overallTrend} color="var(--lime)" fill="rgba(216,250,75,0.14)" height={64} endDot />
                  )}
                </div>
                <span
                  className="flex items-center gap-1.5 text-[13px] font-semibold transition-transform duration-300 group-hover:translate-x-0.5"
                  style={{ color: "var(--hero-text)" }}
                >
                  View full progress <IconArrowRight />
                </span>
              </button>

              <div className="grid grid-cols-2 gap-4">
                <StatTile label="Best score" value={bestOverall ?? "—"} suffix={bestOverall !== undefined ? "/10" : undefined} tone="lime" />
                <StatTile label="Interviews" value={completedSessions.length} hint={`${sessions.length} started`} />
                <StatTile label="Communication" value={avgComm ?? "—"} suffix={avgComm !== undefined ? "/10" : undefined} hint="Average" />
                <StatTile label="Technical" value={avgTech ?? "—"} suffix={avgTech !== undefined ? "/10" : undefined} hint="Average" />
              </div>
            </div>
          )}

          {!loadingSessions && quickActions}

          {/* Free plan: no dashboard/history — just their most recent plain score */}
          {!hasInsights ? (
            loadingSessions ? (
              <Skeleton className="h-[220px] !rounded-[18px]" />
            ) : fetchError ? null : lastCompleted ? (
              <Card className="text-center !py-10">
                <div className="font-label mb-3">Your last score</div>
                <div className="font-display text-[56px] font-bold leading-none tabular-nums mb-2" style={{ color: "var(--ink)" }}>
                  {lastCompleted.scores?.overall ?? "—"}
                  <span className="text-xl font-medium" style={{ color: "var(--ink-faint)" }}>/10</span>
                </div>
                <p className="text-sm mb-6" style={{ color: "var(--ink-dim)" }}>
                  Overall score from your most recent interview.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2.5">
                  <button onClick={() => router.push(`/interview/${lastCompleted.id}/results`)} className="btn btn-secondary">
                    View result
                  </button>
                  <button onClick={() => router.push("/progress")} className="btn btn-secondary">
                    See your score trend
                  </button>
                  <button onClick={() => router.push("/pricing")} className="btn btn-primary">
                    Unlock full insights →
                  </button>
                </div>
              </Card>
            ) : (
              noSessionsEmpty
            )
          ) : /* Paid plans: full history table with score columns */
          loadingSessions ? (
            <div className="fade-up">
              <div className="flex items-center justify-between mb-3">
                <Skeleton className="h-3 w-20 rounded" />
                <Skeleton className="h-8 w-48 rounded-full" />
              </div>
              <SkeletonTable />
            </div>
          ) : fetchError ? null : sessions.length === 0 ? (
            noSessionsEmpty
          ) : (
            <Card padded={false} className="overflow-hidden mb-6">
              <div
                className="px-5 sm:px-6 pt-5 pb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between border-b"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="flex items-baseline gap-2.5">
                  <h2 className="font-display text-[19px] font-bold tracking-[-0.02em]" style={{ color: "var(--ink)" }}>
                    Sessions
                  </h2>
                  <span className="font-mono text-[11px]" style={{ color: "var(--ink-faint)" }}>
                    {sessionSearch.matchCount} {sessionSearch.matchCount === 1 ? "session" : "sessions"}
                  </span>
                </div>
                <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                  <SearchField
                    value={sessionSearch.query}
                    onChange={sessionSearch.setQuery}
                    placeholder="Search by company or role…"
                    className="!h-10 sm:w-[260px]"
                  />
                  <Segmented
                    value={statusFilter}
                    onChange={setStatusFilter}
                    options={[
                      { id: "all", label: "All" },
                      { id: "completed", label: "Completed" },
                      { id: "in_progress", label: "In progress" },
                    ]}
                  />
                </div>
              </div>

              {sessionSearch.results.length === 0 ? (
                <p className="px-6 py-12 text-center text-sm" style={{ color: "var(--ink-dim)" }}>
                  {sessionSearch.isSearching
                    ? `No sessions match "${sessionSearch.query}".`
                    : "No sessions match this filter."}
                </p>
              ) : (
                <>
                  {/* Mobile: stacked rows */}
                  <ul className="sm:hidden divide-y" style={{ borderColor: "var(--border)" }}>
                    {sessionSearch.results.map((s) => (
                      <li
                        key={s.id}
                        onClick={() => openSession(s)}
                        className="dash-row px-5 py-4 cursor-pointer"
                        style={{ borderColor: "var(--border)" }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold truncate" style={{ color: "var(--ink)" }}>
                              {s.company_name ?? `Session #${s.id}`}
                            </p>
                            <p className="text-xs mt-0.5 truncate" style={{ color: "var(--ink-faint)" }}>
                              {[s.role_title, formatDate(s.started_at)].filter(Boolean).join(" · ")}
                            </p>
                          </div>
                          <StatusBadge status={s.status} />
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2">
                          {[
                            { label: "Comm", value: s.scores?.communication },
                            { label: "Tech", value: s.scores?.technical },
                            { label: "Overall", value: s.scores?.overall, overall: true },
                          ].map((x) => (
                            <div key={x.label} className="rounded-xl px-3 py-2" style={{ background: "var(--surface-alt)", border: "1px solid var(--border)" }}>
                              <p className="font-mono text-[9px] uppercase tracking-[0.14em]" style={{ color: "var(--ink-faint)" }}>
                                {x.label}
                              </p>
                              <div className="mt-1">
                                <ScorePill value={x.value} variant={x.overall ? "overall" : "default"} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>

                  {/* Desktop: table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <div
                      className="grid font-mono text-[10px] uppercase tracking-[0.14em] px-6 py-3"
                      style={{
                        gridTemplateColumns: "minmax(220px,1fr) 130px 70px 70px 80px 110px",
                        columnGap: "24px",
                        background: "var(--surface-alt)",
                        color: "var(--ink-faint)",
                        borderBottom: "1px solid var(--border)",
                        minWidth: "820px",
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
                        onClick={() => openSession(s)}
                        className="dash-row grid items-center px-6 py-3.5 cursor-pointer transition-colors"
                        style={{
                          gridTemplateColumns: "minmax(220px,1fr) 130px 70px 70px 80px 110px",
                          columnGap: "24px",
                          borderBottom: i < sessionSearch.results.length - 1 ? "1px solid var(--border)" : "none",
                          minWidth: "820px",
                        }}
                      >
                        <span className="min-w-0">
                          <span className="block text-[15px] font-semibold truncate" style={{ color: "var(--ink)" }}>
                            {s.company_name ?? `Session #${s.id}`}
                          </span>
                          {s.role_title && (
                            <span className="block text-[13px] truncate" style={{ color: "var(--ink-faint)" }}>
                              {s.role_title}
                            </span>
                          )}
                        </span>
                        <StatusBadge status={s.status} />
                        <ScorePill value={s.scores?.communication} />
                        <ScorePill value={s.scores?.technical} />
                        <ScorePill value={s.scores?.overall} variant="overall" />
                        <span className="text-xs" style={{ color: "var(--ink-faint)" }}>
                          {formatDate(s.started_at)}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {!sessionSearch.isSearching && sessionSearch.totalPages > 1 && (
                <div className="pb-5 border-t" style={{ borderColor: "var(--border)" }}>
                  <PaginationControls
                    page={sessionSearch.page}
                    totalPages={sessionSearch.totalPages}
                    onChange={sessionSearch.setPage}
                  />
                </div>
              )}
            </Card>
          )}

          {hasInsights && !loadingSessions && (
            <RealInterviewReportsCard reloadKey={reportsVersion} onNew={() => setShowReportModal(true)} />
          )}
        </PageContainer>
      </div>
      </AppShell>

      {showTopup && <TopupModal onClose={() => setShowTopup(false)} />}
      {showReportModal && (
        <RealInterviewReportModal
          onClose={() => setShowReportModal(false)}
          onSubmitted={() => {
            setShowReportModal(false);
            setReportsVersion((v) => v + 1);
          }}
        />
      )}
    </ProtectedRoute>
  );
}
