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
import { SkeletonStatCard } from "@/components/Skeleton";

// ── Small SVG line chart (no chart library — keeps bundle light) ───────────────

function LineChart({
  data,
  color = "var(--accent)",
  fill,
  height = 72,
  max = 10,
  endDot = false,
}: {
  data: (number | null | undefined)[];
  color?: string;
  fill?: string;
  height?: number;
  max?: number;
  endDot?: boolean;
}) {
  const width = 100; // percentage-based viewBox, scales with container
  const points = data
    .map((v, i) => ({ v, i }))
    .filter((p): p is { v: number; i: number } => typeof p.v === "number");

  if (points.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-xs"
        style={{ height, color: "var(--ink-faint)" }}
      >
        No data yet
      </div>
    );
  }

  const n = data.length;
  const xFor = (i: number) => (n <= 1 ? width / 2 : (i / (n - 1)) * width);
  const yFor = (v: number) => height - (v / max) * height;

  const pathD = points
    .map((p, idx) => `${idx === 0 ? "M" : "L"} ${xFor(p.i)} ${yFor(p.v)}`)
    .join(" ");
  // Same line, closed along the baseline — the tinted area under the trend.
  const areaD = `${pathD} L ${xFor(points[points.length - 1].i)} ${height} L ${xFor(points[0].i)} ${height} Z`;
  const last = points[points.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height }}
    >
      {fill && <path d={areaD} fill={fill} />}
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {endDot && <circle cx={xFor(last.i)} cy={yFor(last.v)} r={1.8} fill={color} />}
    </svg>
  );
}

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

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-[16px] px-4 py-5 sm:px-[22px] sm:py-[22px] ${className}`}
      style={{ background: "var(--surface)", border: "1px solid var(--border-mid)" }}
    >
      {children}
    </div>
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

          <main className="max-w-[1080px] mx-auto px-4 sm:px-[44px] pt-6 sm:pt-9 pb-[60px] fade-up">
            <div className="mb-[26px]">
              {data && data.overall_trend.length > 0 && (
                <div className="font-label mb-2.5">Last {data.overall_trend.length} sessions</div>
              )}
              <h1
                className="font-display text-[32px] sm:text-[44px] font-bold leading-none"
                style={{ color: "var(--ink)", letterSpacing: "-0.035em" }}
              >
                Your progress
              </h1>
              <p className="mt-2 text-sm sm:text-[15px]" style={{ color: "var(--ink-dim)" }}>
                How you&apos;re trending across every mock interview you&apos;ve completed.
              </p>
            </div>

            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 fade-up">
                {[1, 2, 3, 4].map((n) => <SkeletonStatCard key={n} />)}
              </div>
            ) : error ? (
              <p className="text-sm" style={{ color: "var(--danger)" }}>
                {error}
              </p>
            ) : !data || data.total_completed === 0 ? (
              <Card className="text-center py-10">
                <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
                  No completed interviews yet.
                </p>
                <p className="mt-1 text-sm" style={{ color: "var(--ink-dim)" }}>
                  Finish your first mock interview to start seeing your progress here.
                </p>
                <button
                  onClick={() => router.push("/companies")}
                  className="mt-5 px-5 py-2 rounded-full text-sm font-semibold"
                  style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
                >
                  Browse companies
                </button>
              </Card>
            ) : (
              <>
                {/* Hero readiness card */}
                <div
                  className="mb-3.5 grid grid-cols-1 gap-8 rounded-[18px] p-[26px] lg:grid-cols-[1fr_1.1fr] lg:items-center"
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
          </main>
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
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--ink-dim)" }}>
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
          className="mt-4 px-5 py-2 rounded-full text-sm font-semibold"
          style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
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
    <div className="space-y-3.5">
      {/* Per-dimension trendlines */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {dims.map((d) => {
          const series = data.dimension_trends[d.key];
          const withValues = series.filter((v): v is number => typeof v === "number");
          const latest = withValues[withValues.length - 1];
          return (
            <div
              key={d.key}
              className="rounded-[16px] p-5"
              style={{ background: "var(--surface)", border: "1px solid var(--border-mid)" }}
            >
              <div className="flex items-baseline justify-between mb-2.5">
                <span className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                  {d.label}
                </span>
                <span className="font-mono text-[15px] font-bold tabular-nums" style={{ color: d.color }}>
                  {latest ?? "—"}
                </span>
              </div>
              <LineChart data={series} color={d.color} fill={d.fill} height={56} />
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.35fr_1fr] lg:items-start">
        {/* Topic breakdown — weakest first, doubles as "what to practise" */}
        {data.topics.length > 0 && (
          <Card>
            <div className="flex items-center justify-between gap-4 mb-[18px]">
              <h2 className="font-display text-xl font-bold tracking-[-0.025em]" style={{ color: "var(--ink)" }}>
                What to practise next
              </h2>
              <span className="font-mono text-[11px]" style={{ color: "var(--ink-faint)" }}>
                Weakest first
              </span>
            </div>
            <div className="grid gap-0.5">
              {data.topics.map((t: ProgressTopic) => {
                const color =
                  t.average >= 6 ? "var(--success)" : t.average >= 3 ? "var(--warn)" : "var(--danger)";
                return (
                  <div
                    key={t.name}
                    className="grid grid-cols-[1.15fr_1fr_34px_30px] items-center gap-3.5 rounded-[9px] p-2 transition-colors hover:bg-[var(--surface-alt)]"
                  >
                    <span className="text-sm break-words" style={{ color: "var(--ink)" }} title={t.name}>
                      {t.name}
                    </span>
                    <span
                      className="relative block h-1.5 rounded-[3px]"
                      style={{ background: "var(--surface-2)" }}
                    >
                      <span
                        className="absolute inset-y-0 left-0 rounded-[3px]"
                        style={{ width: `${Math.min(t.average, 10) * 10}%`, background: color }}
                      />
                    </span>
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
              className="mt-[18px] px-5 py-3 rounded-full text-sm font-semibold transition-colors hover:bg-[var(--accent-dim)]"
              style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
            >
              Practise {data.topics[0]?.name ?? "your weakest topic"} →
            </button>
          </Card>
        )}

        {/* Company comparison + readiness */}
        {data.companies.length > 0 && (
          <Card>
            <h2 className="font-display text-xl font-bold tracking-[-0.025em] mb-4" style={{ color: "var(--ink)" }}>
              Performance by company
            </h2>

            {data.companies.length > 5 && (
              <input
                type="text"
                value={companySearch.query}
                onChange={(e) => companySearch.setQuery(e.target.value)}
                placeholder="Search companies…"
                className="w-full rounded-full px-4 py-2.5 text-sm mb-3.5 outline-none"
                style={{ background: "var(--surface-alt)", border: "1px solid var(--border-mid)", color: "var(--ink)" }}
              />
            )}

            {companySearch.results.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--ink-dim)" }}>
                No companies match &quot;{companySearch.query}&quot;.
              </p>
            ) : (
              <div className="grid gap-0.5">
                {companySearch.results.map((c: ProgressCompany) => {
                  const color =
                    c.average >= 6 ? "var(--success)" : c.average >= 3 ? "var(--warn)" : "var(--danger)";
                  return (
                    <div
                      key={c.company}
                      className="rounded-[9px] px-2 py-2.5 transition-colors hover:bg-[var(--surface-alt)]"
                    >
                      <div className="flex items-baseline justify-between gap-3 mb-[7px]">
                        <span className="text-sm font-semibold break-words" style={{ color: "var(--ink)" }}>
                          {c.company}
                          {c.ready && (
                            <span
                              className="ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full align-middle"
                              style={{ background: "var(--success-bg)", color: "#2F6B48" }}
                            >
                              Ready
                            </span>
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
                      <span className="relative block h-[5px] rounded-[3px]" style={{ background: "var(--surface-2)" }}>
                        <span
                          className="absolute inset-y-0 left-0 rounded-[3px]"
                          style={{ width: `${Math.min(c.average, 10) * 10}%`, background: color }}
                        />
                      </span>
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