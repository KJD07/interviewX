"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import {
  ApiError,
  productAnalyticsApi,
  type AnalyticsPeriod,
  type AnalyticsProduct,
  type ProductAnalytics,
} from "@/lib/api";

const PERIODS: { id: AnalyticsPeriod; label: string }[] = [
  { id: "day", label: "1 day" },
  { id: "week", label: "1 week" },
  { id: "month", label: "1 month" },
  { id: "quarter", label: "Quarter" },
];

const PRODUCTS: { id: AnalyticsProduct; label: string }[] = [
  { id: "all", label: "All products" },
  { id: "practice", label: "Practice interviews" },
  { id: "enterprise", label: "Enterprise" },
];

function displayName(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function MetricCard({ title, value, detail }: { title: string; value: string | number; detail?: string }) {
  return (
    <div className="rounded-2xl p-4 sm:p-5 min-w-0" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <p className="text-xs uppercase tracking-wider truncate" style={{ color: "var(--ink-faint)" }}>{title}</p>
      <p className="mt-2 font-display text-xl sm:text-3xl font-semibold tabular-nums break-words" style={{ color: "var(--ink)" }}>{value}</p>
      {detail && <p className="mt-1 text-xs" style={{ color: "var(--ink-dim)" }}>{detail}</p>}
    </div>
  );
}

function Bars({ data, color = "#e8ff3d" }: { data: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(...data.map((item) => item.value), 1);
  return (
    <div className="overflow-x-auto">
      <div className="flex items-end gap-2 h-40" style={{ minWidth: data.length * 34 }}>
        {data.map((item) => (
          <div key={item.label} className="flex-1 h-full flex flex-col justify-end items-center gap-2" style={{ minWidth: 28 }}>
            <span className="text-[10px] tabular-nums whitespace-nowrap" style={{ color: "var(--ink-dim)" }}>{item.value}</span>
            <div className="w-full max-w-8 rounded-t" style={{ height: `${Math.max(4, (item.value / max) * 100)}%`, background: color }} />
            <span className="text-[9px] whitespace-nowrap" style={{ color: "var(--ink-faint)" }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Donut({ data }: { data: Record<string, number> }) {
  const total = Object.values(data).reduce((sum, value) => sum + value, 0) || 1;
  const colors = ["#e8ff3d", "#22c55e", "#f59e0b", "#ef4444", "#8a8a7e", "#6366f1"];
  let offset = 0;
  const gradient = Object.values(data)
    .map((value, index) => {
      const start = offset;
      offset += (value / total) * 360;
      return `${colors[index % colors.length]} ${start}deg ${offset}deg`;
    })
    .join(", ");
  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="h-32 w-32 rounded-full shrink-0" style={{ background: `conic-gradient(${gradient})` }}>
        <div className="m-5 h-22 w-22 rounded-full flex items-center justify-center" style={{ background: "var(--surface)" }}>
          <span className="font-display font-semibold">{total}</span>
        </div>
      </div>
      <div className="space-y-2 min-w-0">
        {Object.entries(data).map(([name, value], index) => (
          <div key={name} className="flex items-center gap-2 text-xs">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: colors[index % colors.length] }} />
            <span className="break-words" style={{ color: "var(--ink-dim)" }}>{displayName(name)}</span>
            <strong className="shrink-0" style={{ color: "var(--ink)" }}>{value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalyticsDashboard() {
  const [period, setPeriod] = useState<AnalyticsPeriod>("week");
  const [product, setProduct] = useState<AnalyticsProduct>("all");
  const [data, setData] = useState<ProductAnalytics | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    productAnalyticsApi
      .dashboard(period, product)
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.detail : "Unable to load analytics."))
      .finally(() => setLoading(false));
  }, [period, product]);

  useEffect(() => {
    load();
  }, [load]);

  const money = (amount: number) =>
    `₹${(amount / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

  if (error) {
    return (
      <main className="min-h-screen p-6 sm:p-10" style={{ background: "var(--page)" }}>
        <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>
      </main>
    );
  }

  if (loading || !data) {
    return (
      <main className="min-h-screen p-6 sm:p-10" style={{ background: "var(--page)" }}>
        <p className="text-sm" style={{ color: "var(--ink-faint)" }}>Loading analytics…</p>
      </main>
    );
  }

  const featureBars = Object.entries(data.features)
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label: displayName(label), value }));

  return (
    <main className="min-h-screen p-4 sm:p-8 max-w-[1400px] mx-auto fade-up" style={{ background: "var(--page)" }}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-8">
        <div>
          <Link href="/dashboard" className="text-xs hover:underline" style={{ color: "var(--ink-dim)" }}>← Back</Link>
          <h1 className="font-display text-3xl font-semibold mt-2" style={{ color: "var(--ink)" }}>Product analytics</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--ink-dim)" }}>
            PostHog-backed usage with revenue and plans from your database. Cached ~60s — no impact on interview traffic.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {PERIODS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPeriod(item.id)}
              className="rounded-full px-3 py-1.5 text-xs font-medium"
              style={{
                background: period === item.id ? "var(--accent)" : "var(--surface)",
                color: period === item.id ? "var(--ink)" : "var(--ink-dim)",
                border: "1px solid var(--border)",
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {PRODUCTS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setProduct(item.id)}
            className="rounded-lg px-3 py-1.5 text-xs"
            style={{
              background: product === item.id ? "var(--surface)" : "transparent",
              color: "var(--ink)",
              border: product === item.id ? "1px solid var(--border-mid)" : "1px solid transparent",
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <MetricCard title="Revenue" value={money(data.revenue.total_paise)} detail={`Last ${data.window_days} days`} />
        <MetricCard title="New users" value={data.users.new} detail={`Source: ${data.sources.users}`} />
        <MetricCard title="Active users" value={data.users.active} />
        <MetricCard title="Retained users" value={data.users.retained} detail="Active in prior window too" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <h2 className="font-display font-semibold" style={{ color: "var(--ink)" }}>Acquisition sources</h2>
          <p className="text-xs mt-1 mb-5" style={{ color: "var(--ink-faint)" }}>Source: {data.sources.acquisition}</p>
          <Bars data={Object.entries(data.acquisition).map(([label, value]) => ({ label, value }))} />
        </div>
        <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <h2 className="font-display font-semibold mb-5" style={{ color: "var(--ink)" }}>Plan distribution</h2>
          <Donut data={data.plans} />
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <h2 className="font-display font-semibold" style={{ color: "var(--ink)" }}>Practice interviews</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <MetricCard title="Started" value={data.practice.interviews_started} />
            <MetricCard title="Completed" value={data.practice.interviews_completed} />
          </div>
        </div>
        <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <h2 className="font-display font-semibold" style={{ color: "var(--ink)" }}>Enterprise</h2>
          <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
            <MetricCard title="Invites" value={data.enterprise.invites_sent} />
            <MetricCard title="Started" value={data.enterprise.interviews_started} />
            <MetricCard title="Completed" value={data.enterprise.interviews_completed} />
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <h2 className="font-display font-semibold" style={{ color: "var(--ink)" }}>Feature usage</h2>
          <p className="text-xs mt-1 mb-5" style={{ color: "var(--ink-faint)" }}>Source: {data.sources.features}</p>
          {featureBars.length ? (
            <Bars data={featureBars} color="var(--accent)" />
          ) : (
            <p className="text-sm" style={{ color: "var(--ink-dim)" }}>No tracked events in this window yet.</p>
          )}
        </div>
        <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <h2 className="font-display font-semibold mb-5" style={{ color: "var(--ink)" }}>Revenue trend</h2>
          <Bars
            data={data.revenue.daily.map((item) => ({
              label: item.day.slice(5),
              value: item.amount,
            }))}
            color="#f59e0b"
          />
        </div>
      </div>
    </main>
  );
}

function AnalyticsGate() {
  const { user, loading, refreshUser } = useAuth();
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    void refreshUser().finally(() => setSynced(true));
  }, [refreshUser]);

  if (loading || !synced) {
    return (
      <main className="min-h-screen p-6 sm:p-10" style={{ background: "var(--page)" }}>
        <p className="text-sm" style={{ color: "var(--ink-faint)" }}>Loading…</p>
      </main>
    );
  }
  if (!user?.can_view_analytics) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--page)" }}>
        <div className="text-center max-w-md">
          <h1 className="text-xl font-semibold" style={{ color: "var(--ink)" }}>Analytics access required</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--ink-dim)" }}>
            Ask an admin to enable &quot;Can view analytics&quot; on your account in Django admin.
          </p>
          <Link href="/dashboard" className="inline-block mt-6 text-sm underline" style={{ color: "var(--accent)" }}>
            Back to dashboard
          </Link>
        </div>
      </main>
    );
  }

  return <AnalyticsDashboard />;
}

export default function AnalyticsPage() {
  return (
    <ProtectedRoute>
      <AnalyticsGate />
    </ProtectedRoute>
  );
}
