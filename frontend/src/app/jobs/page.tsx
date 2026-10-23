"use client";
import { useCallback, useEffect, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppShell from "@/components/AppShell";
import CompanyLogo from "@/components/CompanyLogo";
import JobDescription from "@/components/JobDescription";
import Link from "next/link";
import { careers, ApiError } from "@/lib/api";
import type { AtsQuota, CandidateProfile, Job, JobFilters, JobLevel, ResumeCheckResult, WorkMode } from "@/lib/api";

const WORK_MODES: { id: WorkMode; label: string }[] = [
  { id: "remote", label: "Remote" },
  { id: "hybrid", label: "Hybrid" },
  { id: "onsite", label: "On-site" },
];
const LEVELS: { id: JobLevel; label: string }[] = [
  { id: "entry", label: "Fresher / Entry (0–1 yr)" },
  { id: "mid", label: "Mid (1–5 yrs)" },
  { id: "senior", label: "Senior (5+ yrs)" },
];
const REGIONS: { id: NonNullable<JobFilters["region"]>; label: string }[] = [
  { id: "india", label: "India & remote-friendly" },
  { id: "", label: "Worldwide" },
];
const POSTED: { id: NonNullable<JobFilters["posted"]>; label: string }[] = [
  { id: "", label: "Any time" },
  { id: "1", label: "Past 24 hours" },
  { id: "3", label: "Past 3 days" },
  { id: "7", label: "Past week" },
  { id: "30", label: "Past month" },
];
const MODE_LABEL: Record<string, string> = { remote: "Remote", hybrid: "Hybrid", onsite: "On-site" };
const LEVEL_LABEL: Record<string, string> = { entry: "Entry level", mid: "Mid level", senior: "Senior" };

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

function Badge({ children, strong = false }: { children: React.ReactNode; strong?: boolean }) {
  return (
    <span
      className="text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
      style={{
        background: strong ? "var(--success-bg)" : "var(--surface-2)",
        color: strong ? "var(--success)" : "var(--ink-dim)",
      }}
    >
      {children}
    </span>
  );
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs px-3 py-1.5 rounded-full border transition-colors"
      style={{
        background: on ? "var(--ink)" : "var(--surface)",
        color: on ? "var(--page)" : "var(--ink-dim)",
        borderColor: on ? "var(--ink)" : "var(--border-mid)",
      }}
    >
      {children}
    </button>
  );
}

function CheckPanel({ job, profile, onQuota }: { job: Job; profile: CandidateProfile | null; onQuota: (q: AtsQuota) => void }) {
  const hasProfileResume = !!profile?.has_resume;
  // null = follow the profile, which may still be loading when a shared job
  // link opens this panel; only an explicit click pins the choice.
  const [choice, setUseOther] = useState<boolean | null>(null);
  const useOther = choice ?? !hasProfileResume;
  const [resume, setResume] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [limitHit, setLimitHit] = useState(false);
  const [result, setResult] = useState<ResumeCheckResult | null>(null);

  const run = async () => {
    setBusy(true);
    setError("");
    setLimitHit(false);
    try {
      const r = await careers.checkResume(job.id, useOther ? { file, text: resume } : {});
      setResult(r);
      onQuota(r.ats_quota);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Something went wrong.");
      setLimitHit(e instanceof ApiError && e.code === "ats_daily_limit");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>ATS resume check</p>
      {hasProfileResume && !useOther ? (
        <p className="text-xs" style={{ color: "var(--ink-dim)" }}>
          Using your profile resume <strong>{profile?.resume_filename}</strong> ·{" "}
          <button className="underline" onClick={() => setUseOther(true)}>use a different one</button>
        </p>
      ) : (
        <>
          <div>
            <label className="text-xs block mb-1" style={{ color: "var(--ink-dim)" }}>
              Upload resume (PDF, DOCX or text, max 5 MB) — or paste it below
              {hasProfileResume && (
                <> · <button className="underline" onClick={() => setUseOther(false)}>use my profile resume</button></>
              )}
            </label>
            <input
              type="file"
              accept=".pdf,.docx,.txt,.md,.rtf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm"
              style={{ color: "var(--ink)" }}
            />
          </div>
          <textarea
            disabled={!!file}
            value={resume}
            onChange={(e) => setResume(e.target.value)}
            rows={5}
            placeholder="Paste your resume text here…"
            className="w-full rounded-lg p-3 text-sm border"
            style={{ background: "var(--page)", borderColor: "var(--border-mid)", color: "var(--ink)" }}
          />
        </>
      )}
      <button
        onClick={run}
        disabled={busy || (useOther && !file && resume.trim().length < 100)}
        className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
        style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
      >
        {busy ? "Checking…" : "Check ATS score"}
      </button>
      {error && (
        <p className="text-sm" style={{ color: "#b33a3a" }}>
          {error}
          {limitHit && (
            <>
              {" "}
              <Link href="/pricing" className="underline font-medium">See ATS Unlimited →</Link>
            </>
          )}
        </p>
      )}
      {result && (
        <div className="space-y-2">
          <p className="text-2xl font-semibold" style={{ color: "var(--ink)" }}>
            ATS score: {result.ats_score}/100
          </p>
          {result.ai_fit !== undefined && (
            <p className="text-sm" style={{ color: "var(--ink-dim)" }}>
              AI fit assessment: {result.ai_fit}/100
            </p>
          )}
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

function JobDetails({ job, profile, onQuota }: { job: Job; profile: CandidateProfile | null; onQuota: (q: AtsQuota) => void }) {
  const [description, setDescription] = useState<string | null>(job.description ?? null);

  useEffect(() => {
    if (description !== null) return;
    careers.job(job.id).then((j) => setDescription(j.description ?? "")).catch(() => setDescription(""));
  }, [job.id, description]);

  return (
    <div className="mt-4 pt-4 border-t space-y-4" style={{ borderColor: "var(--border)" }}>
      <div>
        <p className="text-sm font-medium mb-2" style={{ color: "var(--ink)" }}>About the role</p>
        {description === null ? (
          <p className="text-sm" style={{ color: "var(--ink-faint)" }}>Loading description…</p>
        ) : description ? (
          <JobDescription text={description} />
        ) : (
          <p className="text-sm" style={{ color: "var(--ink-faint)" }}>
            Full description is on the company&apos;s site.
          </p>
        )}
      </div>
      <CheckPanel job={job} profile={profile} onQuota={onQuota} />
    </div>
  );
}

function JobCard({
  job,
  open,
  onToggle,
  onChange,
  profile,
  onQuota,
}: {
  job: Job;
  open: boolean;
  onToggle: () => void;
  onChange: (j: Job) => void;
  profile: CandidateProfile | null;
  onQuota: (q: AtsQuota) => void;
}) {
  const [copied, setCopied] = useState(false);

  const toggleSave = async () => {
    onChange({ ...job, saved: !job.saved });
    try {
      if (job.saved) await careers.unsaveJob(job.id);
      else await careers.saveJob(job.id);
    } catch {
      onChange(job);
    }
  };

  const apply = () => {
    if (!job.application_status) {
      onChange({ ...job, application_status: "applied" });
      careers.markApplied(job.id).catch(() => onChange(job));
    }
  };

  const share = async () => {
    const link = `${window.location.origin}/jobs?job=${job.id}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Copy this link", link);
    }
  };

  return (
    <li className="rounded-xl p-4" style={{ background: "var(--surface)" }}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex gap-3 min-w-0">
        <CompanyLogo company={job.company} url={job.url} />
          <div className="min-w-0">
            <button onClick={onToggle} className="text-left font-medium hover:underline" style={{ color: "var(--ink)" }}>
              {job.title}
            </button>
            <p className="text-sm" style={{ color: "var(--ink-dim)" }}>
              {job.company}{job.location && ` · ${job.location}`} · {timeAgo(job.posted_at)}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {job.match !== null && <Badge strong={job.match >= 60}>{job.match}% match</Badge>}
              {job.work_mode && <Badge>{MODE_LABEL[job.work_mode]}</Badge>}
              {job.level && <Badge>{LEVEL_LABEL[job.level]}</Badge>}
              {job.application_status && <Badge strong>Applied ✓</Badge>}
              {job.skills.slice(0, 5).map((s) => (
                <span key={s} className="text-[11px] px-2 py-0.5 rounded-full border" style={{ borderColor: "var(--border-mid)", color: "var(--ink-faint)" }}>
                  {s}
                </span>
              ))}
            </div>
        </div>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap">
          <button
            onClick={toggleSave}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border"
            style={{ borderColor: "var(--border-mid)", color: "var(--ink)" }}
            title={job.saved ? "Remove from saved jobs" : "Save this job"}
          >
            {job.saved ? "★ Saved" : "☆ Save"}
          </button>
          <button
            onClick={share}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border"
            style={{ borderColor: "var(--border-mid)", color: "var(--ink)" }}
          >
            {copied ? "Link copied" : "Share"}
          </button>
          <button
            onClick={onToggle}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border"
            style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
          >
            {open ? "Hide" : "Details & ATS"}
          </button>
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            onClick={apply}
            className="px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
          >
            {job.application_status ? "Open posting ↗" : "Apply ↗"}
          </a>
        </div>
      </div>
      {open && <JobDetails job={job} profile={profile} onQuota={onQuota} />}
    </li>
  );
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [shared, setShared] = useState<Job | null>(null);
  const [count, setCount] = useState(0);
  const [q, setQ] = useState("");
  const [loc, setLoc] = useState("");
  const [filters, setFilters] = useState<JobFilters>({ page: 1, sort: "match", region: "india" });
  const [quota, setQuota] = useState<AtsQuota | null>(null);
  const [meta, setMeta] = useState<{ refreshed: string | null; refreshing: boolean; jobs: number; companies: number; hasProfile: boolean; sort: string }>(
    { refreshed: null, refreshing: false, jobs: 0, companies: 0, hasProfile: true, sort: "match" }
  );
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await careers.jobs(filters);
      setJobs(r.results);
      setCount(r.count);
      setQuota(r.ats_quota);
      const india = filters.region === "india";
      setMeta({
        refreshed: r.last_refreshed_at, refreshing: r.refreshing,
        jobs: india ? r.stats.india_jobs : r.stats.jobs,
        companies: india ? r.stats.india_companies : r.stats.companies,
        hasProfile: r.has_profile, sort: r.sort,
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Could not load jobs.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    careers.profile().then(setProfile).catch(() => setProfile(null));
    // Shared links: /jobs?job=<id> pins that job, opened, above the list.
    const id = Number(new URLSearchParams(window.location.search).get("job"));
    if (id) {
      careers.job(id).then((j) => { setShared(j); setOpen(j.id); }).catch(() => {});
    }
  }, []);

  // A first-ever sweep (empty DB) runs in the background — poll until it lands.
  useEffect(() => {
    if (!meta.refreshing || count > 0) return;
    const t = setTimeout(load, 15_000);
    return () => clearTimeout(t);
  }, [meta.refreshing, count, load]);

  const set = (patch: Partial<JobFilters>) => setFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));
  const toggleIn = <T,>(list: T[] | undefined, v: T) => (list?.includes(v) ? list.filter((x) => x !== v) : [...(list ?? []), v]);
  const replace = (j: Job) => {
    setJobs((js) => js.map((x) => (x.id === j.id ? j : x)));
    setShared((s) => (s && s.id === j.id ? j : s));
  };

  const page = filters.page ?? 1;
  const pages = Math.max(1, Math.ceil(count / 20));
  const listed = shared ? jobs.filter((j) => j.id !== shared.id) : jobs;
  const anyFilter = !!(filters.q || filters.location || filters.work_mode?.length || filters.level?.length || filters.posted);

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="min-h-screen px-4 sm:px-6 py-8 max-w-4xl mx-auto" style={{ background: "var(--page)" }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl font-semibold" style={{ color: "var(--ink)" }}>Live jobs</h1>
              <p className="text-sm mt-1" style={{ color: "var(--ink-dim)" }}>
                {meta.jobs > 0 && `${meta.jobs.toLocaleString()} open roles from ${meta.companies.toLocaleString()} companies · `}
                Pulled straight from company career pages every 5 hours
                {meta.refreshing ? " · refreshing now…" : meta.refreshed ? ` · updated ${timeAgo(meta.refreshed)}` : ""}.
              </p>
              {quota && (
                <p className="text-xs mt-1" style={{ color: "var(--ink-faint)" }}>
                  {quota.limit === null ? (
                    "Unlimited ATS checks."
                  ) : (
                    <>
                      {`${Math.max(0, quota.limit - quota.used)} of ${quota.limit} free ATS checks left today · `}
                      <Link href="/pricing" className="underline">ATS Unlimited (₹199/mo)</Link> removes the cap.
                    </>
                  )}
                </p>
              )}
            </div>
            <Link
              href="/profile?tab=applications"
              className="shrink-0 text-xs px-3 py-1.5 rounded-lg border"
              style={{ borderColor: "var(--border-mid)", color: "var(--ink)" }}
            >
              My jobs →
            </Link>
          </div>

          {!meta.hasProfile && (
            <div className="mt-4 rounded-xl p-4 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ background: "var(--hero-bg)", color: "var(--hero-text)" }}>
              <span>Upload your resume once and we&apos;ll rank every job by how well it matches you.</span>
              <Link href="/profile" className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: "var(--lime)", color: "var(--ink)" }}>
                Set up profile →
              </Link>
            </div>
          )}

          <form
            className="flex flex-col sm:flex-row gap-2 mt-5"
            onSubmit={(e) => { e.preventDefault(); set({ q: q.trim(), location: loc.trim() }); }}
          >
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Job title, skill or company"
              className="flex-1 rounded-lg px-3 py-2 text-sm border"
              style={{ background: "var(--surface)", borderColor: "var(--border-mid)", color: "var(--ink)" }}
            />
            <input
              value={loc}
              onChange={(e) => setLoc(e.target.value)}
              placeholder="Location (e.g. Bengaluru, India)"
              className="sm:w-56 rounded-lg px-3 py-2 text-sm border"
              style={{ background: "var(--surface)", borderColor: "var(--border-mid)", color: "var(--ink)" }}
            />
            <button className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--accent)", color: "var(--accent-ink)" }}>
              Search
            </button>
          </form>

          <div className="mt-4 space-y-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs w-20" style={{ color: "var(--ink-faint)" }}>Region</span>
              {REGIONS.map((r) => (
                <Toggle key={r.id || "all"} on={(filters.region ?? "") === r.id} onClick={() => set({ region: r.id })}>
                  {r.label}
                </Toggle>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs w-20" style={{ color: "var(--ink-faint)" }}>Work mode</span>
              {WORK_MODES.map((m) => (
                <Toggle key={m.id} on={!!filters.work_mode?.includes(m.id)} onClick={() => set({ work_mode: toggleIn(filters.work_mode, m.id) })}>
                  {m.label}
                </Toggle>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs w-20" style={{ color: "var(--ink-faint)" }}>Experience</span>
              {LEVELS.map((l) => (
                <Toggle key={l.id} on={!!filters.level?.includes(l.id)} onClick={() => set({ level: toggleIn(filters.level, l.id) })}>
                  {l.label}
                </Toggle>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-xs flex items-center gap-2" style={{ color: "var(--ink-faint)" }}>
                Posted
                <select
                  value={filters.posted ?? ""}
                  onChange={(e) => set({ posted: e.target.value as JobFilters["posted"] })}
                  className="rounded-lg px-2 py-1.5 text-xs border"
                  style={{ background: "var(--surface)", borderColor: "var(--border-mid)", color: "var(--ink)" }}
                >
                  {POSTED.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </label>
              <label className="text-xs flex items-center gap-2" style={{ color: "var(--ink-faint)" }}>
                Sort
                <select
                  value={meta.sort}
                  onChange={(e) => set({ sort: e.target.value as JobFilters["sort"] })}
                  className="rounded-lg px-2 py-1.5 text-xs border"
                  style={{ background: "var(--surface)", borderColor: "var(--border-mid)", color: "var(--ink)" }}
                >
                  <option value="match" disabled={!meta.hasProfile}>Best match{meta.hasProfile ? "" : " (needs profile)"}</option>
                  <option value="recent">Most recent</option>
                </select>
              </label>
              {anyFilter && (
                <button
                  className="text-xs underline"
                  style={{ color: "var(--ink-dim)" }}
                  onClick={() => { setQ(""); setLoc(""); setFilters({ page: 1, sort: filters.sort, region: filters.region }); }}
                >
                  Clear filters
                </button>
              )}
              {!loading && (
                <span className="text-xs ml-auto" style={{ color: "var(--ink-faint)" }}>
                  {count.toLocaleString()} {meta.sort === "match" ? "top matches" : "jobs"}
                </span>
              )}
            </div>
          </div>

          {error && <p className="mt-4 text-sm" style={{ color: "#b33a3a" }}>{error}</p>}
          {loading && <p className="mt-6 text-sm" style={{ color: "var(--ink-dim)" }}>Loading…</p>}
          {!loading && !error && jobs.length === 0 && (
            <p className="mt-6 text-sm" style={{ color: "var(--ink-dim)" }}>
              {meta.refreshing && !anyFilter
                ? "Fetching jobs from 1000+ company career pages — this first load takes a couple of minutes…"
                : "No jobs match these filters."}
            </p>
          )}

          <ul className="mt-5 space-y-3">
            {shared && (
              <JobCard job={shared} open={open === shared.id} onToggle={() => setOpen(open === shared.id ? null : shared.id)}
                onChange={replace} profile={profile} onQuota={setQuota} />
            )}
            {listed.map((j) => (
              <JobCard key={j.id} job={j} open={open === j.id} onToggle={() => setOpen(open === j.id ? null : j.id)}
                onChange={replace} profile={profile} onQuota={setQuota} />
            ))}
          </ul>

          {pages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-6 text-sm" style={{ color: "var(--ink-dim)" }}>
              <button disabled={page <= 1} onClick={() => set({ page: page - 1 })} className="disabled:opacity-40">← Prev</button>
              <span>Page {page} of {pages}</span>
              <button disabled={page >= pages} onClick={() => set({ page: page + 1 })} className="disabled:opacity-40">Next →</button>
            </div>
          )}
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
