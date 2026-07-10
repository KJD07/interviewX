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

// ── Small SVG line chart (no chart library — keeps bundle light) ───────────────

function LineChart({
  data,
  color = "var(--accent)",
  height = 72,
  max = 10,
}: {
  data: (number | null | undefined)[];
  color?: string;
  height?: number;
  max?: number;
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

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height }}
    >
      {/* baseline grid at 5/10 */}
      <line
        x1={0}
        y1={yFor(5)}
        x2={width}
        y2={yFor(5)}
        stroke="var(--border-mid)"
        strokeWidth={0.5}
        strokeDasharray="2,2"
      />
      <path d={pathD} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      {points.map((p) => (
        <circle key={p.i} cx={xFor(p.i)} cy={yFor(p.v)} r={1.6} fill={color} />
      ))}
    </svg>
  );
}

function MomentumBadge({ momentum }: { momentum: number | null }) {
  if (momentum === null || momentum === undefined) return null;
  const up = momentum > 0.05;
  const down = momentum < -0.05;
  const color = up ? "#22c55e" : down ? "var(--danger)" : "var(--ink-dim)";
  const arrow = up ? "↑" : down ? "↓" : "→";
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ background: "rgba(255,255,255,0.05)", color }}
    >
      {arrow} {momentum > 0 ? "+" : ""}
      {momentum}/session
    </span>
  );
}

function ConsistencyBadge({ consistency }: { consistency: "high" | "medium" | "low" | null }) {
  if (!consistency) return null;
  const map = {
    high: { label: "Consistent", color: "#22c55e" },
    medium: { label: "Somewhat consistent", color: "#f59e0b" },
    low: { label: "Inconsistent", color: "var(--danger)" },
  };
  const c = map[consistency];
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ background: "rgba(255,255,255,0.05)", color: c.color }}
    >
      {c.label}
    </span>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl px-5 py-5 ${className}`}
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
                InterviewX
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

          <main className="max-w-4xl mx-auto px-6 py-10 fade-up">
            <div className="mb-8">
              <h1 className="font-display text-2xl font-bold" style={{ color: "var(--ink)" }}>
                Your progress
              </h1>
              <p className="mt-1 text-sm" style={{ color: "var(--ink-dim)" }}>
                How you're trending across every mock interview you've completed.
              </p>
            </div>

            {loading ? (
              <p className="text-sm" style={{ color: "var(--ink-dim)" }}>
                Loading…
              </p>
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
                <Card className="mb-6">
                  <div className="flex items-start justify-between flex-wrap gap-4">
                    <div>
                      <p
                        className="text-xs font-semibold uppercase tracking-wider mb-2"
                        style={{ color: "var(--ink-dim)" }}
                      >
                        Overall readiness (last 3 avg)
                      </p>
                      <div className="flex items-baseline gap-3">
                        <span className="text-5xl font-black tabular-nums" style={{ color: "var(--ink)" }}>
                          {heroScore ?? "—"}
                          <span className="text-xl font-normal" style={{ color: "var(--ink-faint)" }}>
                            /10
                          </span>
                        </span>
                        <div className="flex gap-2">
                          <MomentumBadge momentum={data.momentum} />
                          <ConsistencyBadge consistency={data.consistency} />
                        </div>
                      </div>
                      <p className="text-xs mt-2" style={{ color: "var(--ink-dim)" }}>
                        Based on {data.total_completed} completed interview
                        {data.total_completed === 1 ? "" : "s"}
                        {data.momentum !== null &&
                          ` · trending ${data.momentum > 0 ? "up" : data.momentum < 0 ? "down" : "flat"} recently`}
                      </p>
                    </div>
                    <div className="w-full sm:w-64">
                      <LineChart data={data.overall_trend} color="var(--accent)" />
                    </div>
                  </div>
                </Card>

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
          onClick={() => router.push("/upgrade")}
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
  const dims: { key: keyof ProgressResponseDetailed["dimension_trends"]; label: string; color: string }[] = [
    { key: "communication", label: "Communication", color: "#22c55e" },
    { key: "technical", label: "Technical", color: "var(--accent)" },
    { key: "problem_solving", label: "Problem Solving", color: "#f59e0b" },
  ];

  return (
    <div className="space-y-6">
      {/* Per-dimension trendlines */}
      <Card>
        <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--ink-dim)" }}>
          Score breakdown over time
        </p>
        <div className="grid sm:grid-cols-3 gap-6">
          {dims.map((d) => {
            const series = data.dimension_trends[d.key];
            const withValues = series.filter((v): v is number => typeof v === "number");
            const latest = withValues[withValues.length - 1];
            return (
              <div key={d.key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium" style={{ color: "var(--ink)" }}>
                    {d.label}
                  </span>
                  <span className="text-sm font-semibold tabular-nums" style={{ color: d.color }}>
                    {latest ?? "—"}
                  </span>
                </div>
                <LineChart data={series} color={d.color} height={56} />
              </div>
            );
          })}
        </div>
      </Card>

      {/* Topic breakdown — weakest first, doubles as "what to practice" */}
      {data.topics.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--ink-dim)" }}>
              What to practice next
            </p>
            <span className="text-xs" style={{ color: "var(--ink-faint)" }}>
              Weakest first
            </span>
          </div>
          <div className="space-y-3">
            {data.topics.map((t: ProgressTopic) => (
              <div key={t.name} className="flex items-center gap-3">
                <span className="text-sm w-40 shrink-0 truncate" style={{ color: "var(--ink)" }} title={t.name}>
                  {t.name}
                </span>
                <div className="flex-1 h-2 rounded-full" style={{ background: "var(--border-mid)" }}>
                  <div
                    className="h-2 rounded-full"
                    style={{
                      width: `${Math.min(t.average, 10) * 10}%`,
                      background: t.average >= 7 ? "#22c55e" : t.average >= 5 ? "#f59e0b" : "var(--danger)",
                    }}
                  />
                </div>
                <span
                  className="text-sm font-semibold tabular-nums w-10 text-right"
                  style={{ color: "var(--ink)" }}
                >
                  {t.average}
                </span>
                <span className="text-xs w-16 text-right" style={{ color: "var(--ink-faint)" }}>
                  {t.attempts}x
                </span>
              </div>
            ))}
          </div>
          <button
            onClick={() => router.push("/companies")}
            className="mt-4 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-opacity hover:opacity-80"
            style={{ background: "var(--accent-glow)", color: "var(--accent)", border: "1px solid var(--accent)" }}
          >
            Practice your weakest topic →
          </button>
        </Card>
      )}

      {/* Company comparison + readiness */}
      {data.companies.length > 0 && (
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--ink-dim)" }}>
            Performance by company
          </p>
          <div className="space-y-2">
            {data.companies.map((c: ProgressCompany) => (
              <div
                key={c.company}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg"
                style={{ background: "var(--page)" }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium truncate" style={{ color: "var(--ink)" }}>
                    {c.company}
                  </span>
                  {c.ready && (
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                      style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e" }}
                    >
                      Interview ready
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <span className="text-xs" style={{ color: "var(--ink-faint)" }}>
                    {c.attempts} attempt{c.attempts === 1 ? "" : "s"}
                  </span>
                  <span
                    className="text-sm font-semibold tabular-nums"
                    style={{ color: c.average >= 7 ? "#22c55e" : c.average >= 5 ? "#f59e0b" : "var(--danger)" }}
                  >
                    {c.average}/10
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}