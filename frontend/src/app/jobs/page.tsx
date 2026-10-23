"use client";
import { useCallback, useEffect, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppShell from "@/components/AppShell";
import CompanyLogo from "@/components/CompanyLogo";
import JobDescription from "@/components/JobDescription";
import PaginationControls from "@/components/PaginationControls";
import { Skeleton } from "@/components/Skeleton";
import { PageContainer, PageHeader, Card, EmptyState, Notice, SearchField, ScoreBar, IconBriefcase } from "@/components/ui";
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
  return <span className={`tag ${tone === "ok" ? "tag-success" : "tag-danger"}`}>{text}</span>;
}

function Badge({ children, strong = false }: { children: React.ReactNode; strong?: boolean }) {
  return <span className={`tag ${strong ? "tag-success" : ""}`}>{children}</span>;
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className="chip">
      {children}
    </button>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
      <span className="font-label sm:w-24 shrink-0">{label}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
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
    <div className="rounded-[14px] p-4 sm:p-5 space-y-3.5" style={{ background: "var(--surface-alt)", border: "1px solid var(--border)" }}>
      <div className="font-label">ATS resume check</div>
      {hasProfileResume && !useOther ? (
        <p className="text-[13px]" style={{ color: "var(--ink-dim)" }}>
          Using your profile resume <strong style={{ color: "var(--ink)" }}>{profile?.resume_filename}</strong> ·{" "}
          <button className="underline" onClick={() => setUseOther(true)}>use a different one</button>
        </p>
      ) : (
        <>
          <div>
            <label className="text-xs block mb-1.5" style={{ color: "var(--ink-dim)" }}>
              Upload resume (PDF, DOCX or text, max 5 MB) — or paste it below
              {hasProfileResume && (
                <> · <button className="underline" onClick={() => setUseOther(false)}>use my profile resume</button></>
              )}
            </label>
            <input
              type="file"
              accept=".pdf,.docx,.txt,.md,.rtf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm w-full file:mr-3 file:h-8 file:px-3.5 file:rounded-full file:border file:border-solid file:border-[color:var(--border-mid)] file:bg-[var(--surface)] file:text-[color:var(--ink)] file:text-[13px] file:font-semibold file:cursor-pointer"
              style={{ color: "var(--ink)" }}
            />
          </div>
          <textarea
            disabled={!!file}
            value={resume}
            onChange={(e) => setResume(e.target.value)}
            rows={5}
            placeholder="Paste your resume text here…"
            className="ui-input"
          />
        </>
      )}
      <button
        onClick={run}
        disabled={busy || (useOther && !file && resume.trim().length < 100)}
        className="btn btn-primary btn-sm w-full sm:w-auto"
      >
        {busy ? "Checking…" : "Check ATS score"}
      </button>
      {error && (
        <p className="text-sm" style={{ color: "var(--danger)" }}>
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
        <div className="space-y-3 pt-1">
          <div className="ui-card p-4">
            <div className="flex items-baseline justify-between gap-3 mb-2.5">
              <span className="font-display text-[34px] font-bold leading-none tracking-[-0.035em] tabular-nums" style={{ color: "var(--ink)" }}>
                {result.ats_score}
                <span className="text-[16px] font-medium" style={{ color: "var(--ink-faint)" }}>/100</span>
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--ink-faint)" }}>ATS score</span>
            </div>
            <ScoreBar value={result.ats_score} outOf={100} />
            {result.ai_fit !== undefined && (
              <p className="text-xs mt-2.5" style={{ color: "var(--ink-dim)" }}>
                AI fit assessment: <strong style={{ color: "var(--ink)" }}>{result.ai_fit}/100</strong>
              </p>
            )}
          </div>
          {result.missing_keywords.length > 0 && (
            <div>
              <p className="text-xs mb-1.5" style={{ color: "var(--ink-dim)" }}>Missing keywords</p>
              <div className="flex flex-wrap gap-1.5">
                {result.missing_keywords.map((k) => <Chip key={k} text={k} tone="miss" />)}
              </div>
            </div>
          )}
          {result.matched_keywords.length > 0 && (
            <div>
              <p className="text-xs mb-1.5" style={{ color: "var(--ink-dim)" }}>Matched keywords</p>
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
    <div className="mt-5 pt-5 border-t grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-5 lg:items-start" style={{ borderColor: "var(--border)" }}>
      <div className="min-w-0">
        <div className="font-label mb-2.5">About the role</div>
        {description === null ? (
          <div className="space-y-2">
            <Skeleton className="h-3 w-full rounded" />
            <Skeleton className="h-3 w-11/12 rounded" />
            <Skeleton className="h-3 w-4/5 rounded" />
          </div>
        ) : description ? (
          <JobDescription text={description} />
        ) : (
          <p className="text-sm" style={{ color: "var(--ink-faint)" }}>
            Full description is on the company&apos;s site.
          </p>
        )}
      </div>
      <div className="lg:sticky lg:top-6">
        <CheckPanel job={job} profile={profile} onQuota={onQuota} />
      </div>
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
    <li className="ui-card p-4 sm:p-5" style={open ? { borderColor: "var(--ink-faint)" } : undefined}>
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="flex gap-3.5 min-w-0">
          <CompanyLogo company={job.company} url={job.url} size={44} />
          <div className="min-w-0">
            <button
              onClick={onToggle}
              className="text-left font-display text-[17px] font-bold leading-snug tracking-[-0.015em] hover:underline"
              style={{ color: "var(--ink)" }}
            >
              {job.title}
            </button>
            <p className="text-[13px] mt-0.5" style={{ color: "var(--ink-dim)" }}>
              <span className="font-medium" style={{ color: "var(--ink)" }}>{job.company}</span>
              {job.location && ` · ${job.location}`} · {timeAgo(job.posted_at)}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {job.match !== null && <Badge strong={job.match >= 60}>{job.match}% match</Badge>}
              {job.work_mode && <Badge>{MODE_LABEL[job.work_mode]}</Badge>}
              {job.level && <Badge>{LEVEL_LABEL[job.level]}</Badge>}
              {job.application_status && <Badge strong>Applied ✓</Badge>}
              {job.skills.slice(0, 5).map((s) => (
                <span key={s} className="tag tag-outline">{s}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap lg:justify-end">
          <button
            onClick={toggleSave}
            className="btn btn-secondary btn-sm"
            title={job.saved ? "Remove from saved jobs" : "Save this job"}
            aria-pressed={!!job.saved}
          >
            {job.saved ? "★ Saved" : "☆ Save"}
          </button>
          <button onClick={share} className="btn btn-secondary btn-sm">
            {copied ? "Link copied" : "Share"}
          </button>
          <button onClick={onToggle} className="btn btn-secondary btn-sm" aria-expanded={open}>
            {open ? "Hide details" : "Details & ATS"}
          </button>
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            onClick={apply}
            className="btn btn-primary btn-sm"
          >
            {job.application_status ? "Open posting ↗" : "Apply ↗"}
          </a>
        </div>
      </div>
      {open && <JobDetails job={job} profile={profile} onQuota={onQuota} />}
    </li>
  );
}

function JobCardSkeleton() {
  return (
    <li className="ui-card p-4 sm:p-5 flex gap-3.5">
      <Skeleton className="w-11 h-11 !rounded-[12px] shrink-0" />
      <div className="flex-1">
        <Skeleton className="h-4 w-2/3 sm:w-80 rounded mb-2" />
        <Skeleton className="h-3 w-1/2 sm:w-56 rounded mb-3" />
        <div className="flex gap-1.5">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
      </div>
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
        <div className="min-h-screen" style={{ background: "var(--page)" }}>
          <PageContainer>
            <PageHeader
              eyebrow="Careers"
              title="Live jobs"
              subtitle={
                <>
                  {meta.jobs > 0 && `${meta.jobs.toLocaleString()} open roles from ${meta.companies.toLocaleString()} companies · `}
                  Pulled straight from company career pages every 5 hours
                  {meta.refreshing ? " · refreshing now…" : meta.refreshed ? ` · updated ${timeAgo(meta.refreshed)}` : ""}.
                </>
              }
              actions={
                <>
                  {quota && (
                    quota.limit === null ? (
                      <span className="tag tag-success">Unlimited ATS checks</span>
                    ) : (
                      <Link href="/pricing" className="tag hover:underline" title="ATS Unlimited (₹199/mo) removes the cap">
                        {Math.max(0, quota.limit - quota.used)} of {quota.limit} ATS checks left today
                      </Link>
                    )
                  )}
                  <Link href="/profile?tab=applications" className="btn btn-secondary">
                    My jobs →
                  </Link>
                </>
              }
            />

            {quota && quota.limit !== null && quota.used >= quota.limit && (
              <Notice
                tone="warn"
                title="You've used today's free ATS checks"
                className="mb-4"
                action={<Link href="/pricing" className="btn btn-primary btn-sm">ATS Unlimited · ₹199/mo</Link>}
              >
                They reset tomorrow, or remove the cap with ATS Unlimited.
              </Notice>
            )}

            {!meta.hasProfile && (
              <div
                className="mb-4 rounded-[18px] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                style={{ background: "var(--hero-bg)", color: "var(--hero-text)" }}
              >
                <div>
                  <p className="font-display text-[17px] font-bold tracking-[-0.02em]">Get jobs ranked for you</p>
                  <p className="text-sm mt-0.5" style={{ color: "#A3A29A" }}>
                    Upload your resume once and we&apos;ll rank every job by how well it matches you.
                  </p>
                </div>
                <Link href="/profile" className="btn btn-lime btn-sm shrink-0">
                  Set up profile →
                </Link>
              </div>
            )}

            <Card className="mb-5">
              <form
                className="flex flex-col sm:flex-row gap-2.5"
                onSubmit={(e) => { e.preventDefault(); set({ q: q.trim(), location: loc.trim() }); }}
              >
                <SearchField value={q} onChange={setQ} placeholder="Job title, skill or company" className="w-full sm:flex-1" />
                <SearchField value={loc} onChange={setLoc} placeholder="Location (e.g. Bengaluru)" className="sm:w-64" />
                <button className="btn btn-primary !h-11">Search</button>
              </form>

              <div className="mt-5 pt-5 border-t space-y-3.5" style={{ borderColor: "var(--border)" }}>
                <FilterRow label="Region">
                  {REGIONS.map((r) => (
                    <Toggle key={r.id || "all"} on={(filters.region ?? "") === r.id} onClick={() => set({ region: r.id })}>
                      {r.label}
                    </Toggle>
                  ))}
                </FilterRow>
                <FilterRow label="Work mode">
                  {WORK_MODES.map((m) => (
                    <Toggle key={m.id} on={!!filters.work_mode?.includes(m.id)} onClick={() => set({ work_mode: toggleIn(filters.work_mode, m.id) })}>
                      {m.label}
                    </Toggle>
                  ))}
                </FilterRow>
                <FilterRow label="Experience">
                  {LEVELS.map((l) => (
                    <Toggle key={l.id} on={!!filters.level?.includes(l.id)} onClick={() => set({ level: toggleIn(filters.level, l.id) })}>
                      {l.label}
                    </Toggle>
                  ))}
                </FilterRow>
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <label className="flex items-center gap-2">
                    <span className="font-label sm:w-24">Posted</span>
                    <select
                      value={filters.posted ?? ""}
                      onChange={(e) => set({ posted: e.target.value as JobFilters["posted"] })}
                      className="ui-input !h-8 !w-auto !rounded-full !px-3 !text-[13px]"
                    >
                      {POSTED.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                    </select>
                  </label>
                  <label className="flex items-center gap-2">
                    <span className="font-label">Sort</span>
                    <select
                      value={meta.sort}
                      onChange={(e) => set({ sort: e.target.value as JobFilters["sort"] })}
                      className="ui-input !h-8 !w-auto !rounded-full !px-3 !text-[13px]"
                    >
                      <option value="match" disabled={!meta.hasProfile}>Best match{meta.hasProfile ? "" : " (needs profile)"}</option>
                      <option value="recent">Most recent</option>
                    </select>
                  </label>
                  {anyFilter && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => { setQ(""); setLoc(""); setFilters({ page: 1, sort: filters.sort, region: filters.region }); }}
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              </div>
            </Card>

            <div className="flex items-baseline justify-between gap-3 mb-3">
              <h2 className="font-display text-[19px] font-bold tracking-[-0.02em]" style={{ color: "var(--ink)" }}>
                {meta.sort === "match" ? "Top matches" : "Latest openings"}
              </h2>
              {!loading && (
                <span className="font-mono text-[11px]" style={{ color: "var(--ink-faint)" }}>
                  {count.toLocaleString()} {meta.sort === "match" ? "top matches" : "jobs"}
                </span>
              )}
            </div>

            {error && <Notice tone="error" className="mb-4">{error}</Notice>}
            {!loading && !error && jobs.length === 0 && !shared && (
              <EmptyState
                icon={<IconBriefcase />}
                title={meta.refreshing && !anyFilter ? "Fetching jobs…" : "No jobs match these filters"}
                body={
                  meta.refreshing && !anyFilter
                    ? "Pulling openings from 1000+ company career pages — this first load takes a couple of minutes."
                    : "Try a broader search, another region, or clear the filters."
                }
                action={
                  anyFilter ? (
                    <button
                      className="btn btn-secondary"
                      onClick={() => { setQ(""); setLoc(""); setFilters({ page: 1, sort: filters.sort, region: filters.region }); }}
                    >
                      Clear filters
                    </button>
                  ) : undefined
                }
              />
            )}

            <ul className={`space-y-3 transition-opacity ${loading && jobs.length ? "opacity-60" : ""}`} aria-busy={loading}>
              {loading && !jobs.length && [1, 2, 3, 4].map((n) => <JobCardSkeleton key={n} />)}
              {shared && (
                <JobCard job={shared} open={open === shared.id} onToggle={() => setOpen(open === shared.id ? null : shared.id)}
                  onChange={replace} profile={profile} onQuota={setQuota} />
              )}
              {listed.map((j) => (
                <JobCard key={j.id} job={j} open={open === j.id} onToggle={() => setOpen(open === j.id ? null : j.id)}
                  onChange={replace} profile={profile} onQuota={setQuota} />
              ))}
            </ul>

            <PaginationControls page={page} totalPages={pages} onChange={(p) => set({ page: p })} />
          </PageContainer>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
