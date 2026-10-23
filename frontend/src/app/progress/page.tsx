"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppShell from "@/components/AppShell";
import { interviews, ApiError } from "@/lib/api";
import type {
  ProgressResponse,
  ProgressResponseDetailed,
  ProgressTopic,
  ProgressCompany,
} from "@/lib/api";
import { isPaidPlan } from "@/lib/plans";
import PaginationControls from "@/components/PaginationControls";
import { useSearchAndPaginate } from "@/hooks/useSearchAndPaginate";
import { Skeleton, SkeletonStatCard } from "@/components/Skeleton";
import { trackEvent } from "@/lib/posthog";
import LineChart from "@/components/LineChart";
import { PageContainer, PageHeader, Card, CardHeader, EmptyState, Notice, SearchField, ScoreBar, IconSpark, scoreColor } from "@/components/ui";

function MomentumBadge({ momentum, onDark = false }: { momentum: number | null; onDark?: boolean }) {
  if (momentum === null || momentum === undefined) return null;
  const up = momentum > 0.05;
  const down = momentum < -0.05;
  // On the ink card the light-surface red/green go muddy — use the tinted pair.
  const color = up
    ? onDark ? "var(--lime)" : "var(--success)"
    : down
    ? onDark ? "#E58A72" : "var(--danger)"
    : onDark ? "#A3A29A" : "var(--ink-dim)";
  const arrow = up ? "↑" : down ? "↓" : "→";
  return (
    <span className="font-mono text-xs" style={{ color }}>
      {arrow} {momentum > 0 ? "+" : ""}
      {momentum} / session
    </span>
  );
}

function ConsistencyBadge({
  consistency,
  onDark = false,
}: {
  consistency: "high" | "medium" | "low" | null;
  onDark?: boolean;
}) {
  if (!consistency) return null;
  const label = { high: "Consistent", medium: "Somewhat consistent", low: "Inconsistent" }[consistency];
  return (
    <span
      className="text-xs px-3 py-1.5 rounded-full"
      style={
        onDark
          ? { background: "rgba(216,250,75,0.16)", color: "var(--lime)" }
          : { background: "var(--surface-2)", color: "var(--ink-dim)" }
      }
    >
      {label}
    </span>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ProgressPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<ProgressResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    trackEvent("progress_viewed");
    interviews
      .progress()
      .then(setData)
      .catch((err) => {
        setError(err instanceof ApiError ? err.detail : "Could not load progress.");
      })
      .finally(() => setLoading(false));
  }, []);

  const isPro = isPaidPlan(user?.subscription_plan);

  const heroScore = (() => {
    if (!data || data.overall_trend.length === 0) return undefined;
    const last3 = data.overall_trend.slice(-3);
    return Math.round((last3.reduce((a, b) => a + b, 0) / last3.length) * 10) / 10;
  })();

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="min-h-screen" style={{ background: "var(--page)" }}>
          {!isPro && (
            <nav
              className="flex items-center justify-between px-6 py-4 border-b"
              style={{ borderColor: "var(--surface)" }}
            >
              <button
                onClick={() => router.push("/dashboard")}
                className="text-lg font-bold tracking-tight"
                style={{ color: "var(--ink)" }}
              >
                EvaluLabs
              </button>
              <button
                onClick={() => router.push("/dashboard")}
                className="text-sm hover:underline"
                style={{ color: "var(--ink-dim)" }}
              >
                ← Back to dashboard
              </button>
            </nav>
          )}

          <PageContainer>
            <PageHeader
              eyebrow={data && data.overall_trend.length > 0 ? `Last ${data.overall_trend.length} sessions` : "Progress"}
              title="Your progress"
              subtitle="How you're trending across every mock interview you've completed."
              actions={
                <button onClick={() => router.push("/companies")} className="btn btn-primary">
                  <span style={{ color: "var(--lime)" }}>+</span> New interview
                </button>
              }
            />

            {loading ? (
              <div className="space-y-4 fade-up">
                <Skeleton className="h-[220px] !rounded-[18px]" />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[1, 2, 3].map((n) => <SkeletonStatCard key={n} />)}
                </div>
              </div>
            ) : error ? (
              <Notice tone="error">{error}</Notice>
            ) : !data || data.total_completed === 0 ? (
              <EmptyState
                icon={<IconSpark />}
                title="No completed interviews yet"
                body="Finish your first mock interview to start seeing your progress here."
                action={
                  <button onClick={() => router.push("/companies")} className="btn btn-primary">
                    Browse companies
                  </button>
                }
              />
            ) : (
              <>
                {/* Hero readiness card */}
                <div
                  className="mb-4 grid grid-cols-1 gap-8 rounded-[18px] p-6 sm:p-7 lg:grid-cols-[1fr_1.1fr] lg:items-center"
                  style={{ background: "var(--hero-bg)", color: "var(--hero-text)" }}
                >
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.16em] mb-3.5" style={{ color: "var(--lime)" }}>
                      Overall readiness · last 3 avg
                    </div>
                    <div className="flex flex-wrap items-end gap-3.5 mb-3.5">
                      <span className="font-display text-[52px] sm:text-[66px] font-bold leading-[0.9] tracking-[-0.05em] tabular-nums">
                        {heroScore ?? "—"}
                      </span>
                      <span className="font-display text-[22px] mb-2" style={{ color: "#7E7D74" }}>/10</span>
                      <span className="mb-3">
                        <MomentumBadge momentum={data.momentum} onDark />
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <ConsistencyBadge consistency={data.consistency} onDark />
                      <span
                        className="text-xs px-3 py-1.5 rounded-full"
                        style={{ background: "rgba(255,255,255,0.08)", color: "#A3A29A" }}
                      >
                        {data.total_completed} completed interview{data.total_completed === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                  <div>
                    <LineChart
                      data={data.overall_trend}
                      color="var(--lime)"
                      fill="rgba(216,250,75,0.14)"
                      height={96}
                      endDot
                    />
                    <div
                      className="flex justify-between font-mono text-[10px] mt-2 uppercase"
                      style={{ color: "#57564F" }}
                    >
                      <span>Session 01</span>
                      <span>
                        Session {String(data.overall_trend.length).padStart(2, "0")}
                      </span>
                    </div>
                  </div>
                </div>

                {data.locked ? (
                  <LockedTeaser router={router} />
                ) : (
                  <DetailedView data={data} router={router} />
                )}
              </>
            )}
          </PageContainer>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}

// ── Free plan: locked teaser ─────────────────────────────────────────────────

function LockedTeaser({ router }: { router: ReturnType<typeof useRouter> }) {
  return (
    <Card className="relative overflow-hidden">
      <div className="blur-sm pointer-events-none select-none opacity-60">
        <p className="font-label mb-3">
          Topic breakdown
        </p>
        <div className="space-y-3">
          {["System Design", "SQL Joins", "Communication clarity"].map((t) => (
            <div key={t} className="flex items-center gap-3">
              <span className="text-sm w-40 shrink-0" style={{ color: "var(--ink)" }}>
                {t}
              </span>
              <div className="flex-1 h-2 rounded-full" style={{ background: "var(--border-mid)" }}>
                <div className="h-2 rounded-full" style={{ width: "55%", background: "var(--accent)" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
        <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
          Unlock topic-by-topic tracking
        </p>
        <p className="text-xs mt-1 max-w-xs" style={{ color: "var(--ink-dim)" }}>
          See exactly which skills are improving, per-company readiness, and a
          consistency score — available on Pro, Premium, and Max.
        </p>
        <button
          onClick={() => router.push("/pricing")}
          className="btn btn-primary mt-4"
        >
          Upgrade to unlock →
        </button>
      </div>
    </Card>
  );
}

// ── Paid plan: full breakdown ────────────────────────────────────────────────

function DetailedView({
  data,
  router,
}: {
  data: ProgressResponseDetailed;
  router: ReturnType<typeof useRouter>;
}) {
  const dims: {
    key: keyof ProgressResponseDetailed["dimension_trends"];
    label: string;
    color: string;
    fill: string;
  }[] = [
    { key: "communication", label: "Communication", color: "var(--success)", fill: "rgba(63,143,94,0.1)" },
    { key: "technical", label: "Technical", color: "var(--ink)", fill: "rgba(12,12,11,0.07)" },
    { key: "problem_solving", label: "Problem solving", color: "var(--warn)", fill: "rgba(180,115,30,0.12)" },
  ];

  const companySearch = useSearchAndPaginate(data.companies, (c) => c.company);

  return (
    <div className="space-y-4">
      {/* Per-dimension trendlines */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {dims.map((d) => {
          const series = data.dimension_trends[d.key];
          const withValues = series.filter((v): v is number => typeof v === "number");
          const latest = withValues[withValues.length - 1];
          return (
            <div key={d.key} className="ui-card p-5">
              <div className="flex items-baseline justify-between mb-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--ink-faint)" }}>
                  {d.label}
                </span>
                <span className="font-display text-[24px] font-bold leading-none tracking-[-0.03em] tabular-nums" style={{ color: d.color }}>
                  {latest ?? "—"}
                  {latest !== undefined && <span className="text-[13px] font-medium" style={{ color: "var(--ink-faint)" }}>/10</span>}
                </span>
              </div>
              <LineChart data={series} color={d.color} fill={d.fill} height={56} />
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.35fr_1fr] lg:items-start">
        {/* Topic breakdown — weakest first, doubles as "what to practise" */}
        {data.topics.length > 0 && (
          <Card>
            <CardHeader title="What to practise next" meta="Weakest first" />
            <div className="grid gap-0.5">
              {data.topics.map((t: ProgressTopic) => {
                const color = scoreColor(t.average);
                return (
                  <div
                    key={t.name}
                    className="grid grid-cols-[1.15fr_1fr_34px_30px] items-center gap-3.5 rounded-[9px] p-2 transition-colors hover:bg-[var(--surface-alt)]"
                  >
                    <span className="text-sm break-words" style={{ color: "var(--ink)" }} title={t.name}>
                      {t.name}
                    </span>
                    <ScoreBar value={t.average} />
                    <span className="font-mono text-[13px] font-bold text-right tabular-nums" style={{ color }}>
                      {t.average}
                    </span>
                    <span className="font-mono text-[11px] text-right" style={{ color: "var(--ink-faint)" }}>
                      {t.attempts}×
                    </span>
                  </div>
                );
              })}
            </div>
            <button
              onClick={() => router.push("/companies")}
              className="btn btn-primary mt-[18px] max-w-full"
            >
              <span className="truncate">
              Practise {data.topics[0]?.name ?? "your weakest topic"} →</span>
            </button>
          </Card>
        )}

        {/* Company comparison + readiness */}
        {data.companies.length > 0 && (
          <Card>
            <CardHeader title="Performance by company" meta={`${data.companies.length} total`} />

            {data.companies.length > 5 && (
              <SearchField
                value={companySearch.query}
                onChange={companySearch.setQuery}
                placeholder="Search companies…"
                className="!h-10 mb-3.5"
              />
            )}

            {companySearch.results.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--ink-dim)" }}>
                No companies match &quot;{companySearch.query}&quot;.
              </p>
            ) : (
              <div className="grid gap-0.5">
                {companySearch.results.map((c: ProgressCompany) => {
                  const color = scoreColor(c.average);
                  return (
                    <div
                      key={c.company}
                      className="rounded-[9px] px-2 py-2.5 transition-colors hover:bg-[var(--surface-alt)]"
                    >
                      <div className="flex items-baseline justify-between gap-3 mb-[7px]">
                        <span className="text-sm font-semibold break-words" style={{ color: "var(--ink)" }}>
                          {c.company}
                          {c.ready && (
                            <span className="tag tag-success ml-2 !h-5 !text-[10px] align-middle">Ready</span>
                          )}
                        </span>
                        <span className="flex items-baseline gap-2.5 shrink-0">
                          <span className="text-xs" style={{ color: "var(--ink-faint)" }}>
                            {c.attempts} attempt{c.attempts === 1 ? "" : "s"}
                          </span>
                          <span className="font-mono text-[13px] font-bold tabular-nums" style={{ color }}>
                            {c.average}/10
                          </span>
                        </span>
                      </div>
                      <ScoreBar value={c.average} height={5} />
                    </div>
                  );
                })}
              </div>
            )}

            {!companySearch.isSearching && (
              <PaginationControls
                page={companySearch.page}
                totalPages={companySearch.totalPages}
                onChange={companySearch.setPage}
              />
            )}
          </Card>
        )}
      </div>
    </div>
  );
}