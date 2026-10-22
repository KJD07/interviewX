"use client";
import { useCallback, useEffect, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppShell from "@/components/AppShell";
import { careers, ApiError } from "@/lib/api";
import type { AtsQuota, Job, ResumeCheckResult } from "@/lib/api";

function timeAgo(iso: string) {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (h < 1) return "just now";
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

function Chip({ text, tone }: { text: string; tone: "ok" | "miss" }) {
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full"
      style={{
        background: tone === "ok" ? "rgba(63,143,94,0.10)" : "rgba(200,60,60,0.10)",
        color: tone === "ok" ? "var(--success)" : "#b33a3a",
      }}
    >
      {text}
    </span>
  );
}

function CheckPanel({ job, onQuota }: { job: Job; onQuota: (q: AtsQuota) => void }) {
  const [resume, setResume] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ResumeCheckResult | null>(null);

  const run = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await careers.checkResume(job.id, resume);
      setResult(r);
      onQuota(r.ats_quota);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 space-y-3">
      <textarea
        value={resume}
        onChange={(e) => setResume(e.target.value)}
        rows={6}
        placeholder="Paste your resume text here…"
        className="w-full rounded-lg p-3 text-sm border"
        style={{ background: "var(--page)", borderColor: "var(--border, #e5e0d8)", color: "var(--ink)" }}
      />
      <button
        onClick={run}
        disabled={busy || resume.trim().length < 100}
        className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
        style={{ background: "var(--accent)", color: "#fff" }}
      >
        {busy ? "Checking…" : "Check ATS score"}
      </button>
      {error && <p className="text-sm" style={{ color: "#b33a3a" }}>{error}</p>}
      {result && (
        <div className="space-y-2">
          <p className="text-2xl font-semibold" style={{ color: "var(--ink)" }}>
            ATS score: {result.ats_score}/100
          </p>
          {result.missing_keywords.length > 0 && (
            <div>
              <p className="text-xs mb-1" style={{ color: "var(--ink-dim)" }}>Missing keywords</p>
              <div className="flex flex-wrap gap-1.5">
                {result.missing_keywords.map((k) => <Chip key={k} text={k} tone="miss" />)}
              </div>
            </div>
          )}
          {result.matched_keywords.length > 0 && (
            <div>
              <p className="text-xs mb-1" style={{ color: "var(--ink-dim)" }}>Matched keywords</p>
              <div className="flex flex-wrap gap-1.5">
                {result.matched_keywords.map((k) => <Chip key={k} text={k} tone="ok" />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [quota, setQuota] = useState<AtsQuota | null>(null);
  const [refreshed, setRefreshed] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await careers.jobs(query, page);
      setJobs(r.results);
      setCount(r.count);
      setQuota(r.ats_quota);
      setRefreshed(r.last_refreshed_at);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Could not load jobs.");
    } finally {
      setLoading(false);
    }
  }, [query, page]);

  useEffect(() => { load(); }, [load]);

  const pages = Math.max(1, Math.ceil(count / 20));

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="min-h-screen px-6 py-8 max-w-4xl mx-auto" style={{ background: "var(--page)" }}>
          <h1 className="font-display text-2xl font-semibold" style={{ color: "var(--ink)" }}>Live jobs</h1>
          <p className="text-sm mt-1" style={{ color: "var(--ink-dim)" }}>
            Recently posted roles, refreshed every 5 hours
            {refreshed && ` · last updated ${timeAgo(refreshed)}`}.
            {quota && (quota.limit === null
              ? " Unlimited ATS checks."
              : ` ${Math.max(0, quota.limit - quota.used)} of ${quota.limit} free ATS checks left today · Pro (₹199/mo) is unlimited.`)}
          </p>

          <form
            className="flex gap-2 mt-5"
            onSubmit={(e) => { e.preventDefault(); setPage(1); setQuery(q); }}
          >
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search title, company or location"
              className="flex-1 rounded-lg px-3 py-2 text-sm border"
              style={{ background: "var(--surface)", borderColor: "var(--border, #e5e0d8)", color: "var(--ink)" }}
            />
            <button className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--accent)", color: "#fff" }}>
              Search
            </button>
          </form>

          {error && <p className="mt-4 text-sm" style={{ color: "#b33a3a" }}>{error}</p>}
          {loading && <p className="mt-6 text-sm" style={{ color: "var(--ink-dim)" }}>Loading…</p>}
          {!loading && !error && jobs.length === 0 && (
            <p className="mt-6 text-sm" style={{ color: "var(--ink-dim)" }}>No jobs found.</p>
          )}

          <ul className="mt-5 space-y-3">
            {jobs.map((j) => (
              <li key={j.id} className="rounded-xl p-4" style={{ background: "var(--surface)" }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium" style={{ color: "var(--ink)" }}>{j.title}</p>
                    <p className="text-sm" style={{ color: "var(--ink-dim)" }}>
                      {j.company}{j.location && ` · ${j.location}`} · {timeAgo(j.posted_at)}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => setOpen(open === j.id ? null : j.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium border"
                      style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
                    >
                      ATS check
                    </button>
                    <a
                      href={j.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="px-3 py-1.5 rounded-lg text-xs font-medium"
                      style={{ background: "var(--accent)", color: "#fff" }}
                    >
                      Apply
                    </a>
                  </div>
                </div>
                {open === j.id && <CheckPanel job={j} onQuota={setQuota} />}
              </li>
            ))}
          </ul>

          {pages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-6 text-sm" style={{ color: "var(--ink-dim)" }}>
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="disabled:opacity-40">← Prev</button>
              <span>Page {page} of {pages}</span>
              <button disabled={page >= pages} onClick={() => setPage(page + 1)} className="disabled:opacity-40">Next →</button>
            </div>
          )}
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
