"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppShell from "@/components/AppShell";
import { Skeleton } from "@/components/Skeleton";
import { PageContainer, PageHeader, EmptyState, Notice, Segmented, StatTile, IconBriefcase, IconDoc } from "@/components/ui";
import { careers, ApiError } from "@/lib/api";
import type {
  ApplicationStatus, CandidateProfile, EducationEntry, ExperienceEntry, JobApplication, JobLevel, ProjectEntry,
  SavedJob, WorkMode,
} from "@/lib/api";

type Tab = "profile" | "applications" | "saved" | "preferences";
const TABS: { id: Tab; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "applications", label: "Applications" },
  { id: "saved", label: "Saved jobs" },
  { id: "preferences", label: "Job preferences" },
];
const STATUSES: { id: ApplicationStatus; label: string }[] = [
  { id: "applied", label: "Applied" },
  { id: "interviewing", label: "Interviewing" },
  { id: "offer", label: "Offer" },
  { id: "rejected", label: "Rejected" },
  { id: "withdrawn", label: "Withdrawn" },
];

const inputCls = "ui-input";
const card = "ui-card p-5 sm:p-6";

function fmtDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "";
}

function errText(e: unknown, fallback: string) {
  return e instanceof ApiError ? e.detail : fallback;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium block mb-1.5" style={{ color: "var(--ink-dim)" }}>{label}</span>
      {children}
    </label>
  );
}

function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-4">
      <h2 className="font-display text-[19px] font-bold tracking-[-0.02em]" style={{ color: "var(--ink)" }}>{children}</h2>
      {action}
    </div>
  );
}

function TagInput({ value, onChange, placeholder, max }: { value: string[]; onChange: (v: string[]) => void; placeholder: string; max?: number }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const parts = draft.split(",").map((s) => s.trim()).filter(Boolean);
    const next = [...value];
    for (const p of parts) if (!next.some((v) => v.toLowerCase() === p.toLowerCase())) next.push(p);
    onChange(max ? next.slice(0, max) : next);
    setDraft("");
  };
  return (
    <div className="ui-input !h-auto min-h-[40px] !p-1.5 flex flex-wrap items-center gap-1.5">
      {value.map((v) => (
        <span key={v} className="tag" style={{ color: "var(--ink)" }}>
          {v}
          <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(value.filter((x) => x !== v))} style={{ color: "var(--ink-faint)" }}>×</button>
        </span>
      ))}
      {(!max || value.length < max) && (
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); }
            if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={add}
          placeholder={placeholder}
          className="flex-1 min-w-[140px] h-7 text-sm outline-none bg-transparent px-1.5 border-0"
          style={{ color: "var(--ink)" }}
        />
      )}
    </div>
  );
}

function EntryList<T extends { [K in keyof T]: string }>({
  items, onChange, blank, fields, title, addLabel,
}: {
  items: T[];
  onChange: (v: T[]) => void;
  blank: T;
  fields: { key: keyof T & string; label: string; wide?: boolean; multiline?: boolean }[];
  title: (item: T) => string;
  addLabel: string;
}) {
  const update = (i: number, key: keyof T, v: string) => onChange(items.map((it, j) => (j === i ? { ...it, [key]: v } : it)));
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="rounded-[14px] p-4" style={{ background: "var(--surface-alt)", border: "1px solid var(--border)" }}>
          <div className="flex justify-between items-center gap-3 mb-3">
            <span className="text-sm font-semibold truncate" style={{ color: "var(--ink)" }}>{title(item) || "New entry"}</span>
            <button type="button" className="btn btn-danger btn-sm" onClick={() => onChange(items.filter((_, j) => j !== i))}>
              Remove
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {fields.map((f) => (
              <div key={f.key} className={f.wide || f.multiline ? "sm:col-span-2" : ""}>
                <Field label={f.label}>
                  {f.multiline ? (
                    <textarea rows={3} value={item[f.key] ?? ""} onChange={(e) => update(i, f.key, e.target.value)} className={inputCls} />
                  ) : (
                    <input value={item[f.key] ?? ""} onChange={(e) => update(i, f.key, e.target.value)} className={inputCls} />
                  )}
                </Field>
              </div>
            ))}
          </div>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, { ...blank }])} className="btn btn-secondary btn-sm">
        + {addLabel}
      </button>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((n) => (
        <div key={n} className="ui-card p-5 sm:p-6">
          <Skeleton className="h-4 w-48 rounded mb-2.5" />
          <Skeleton className="h-3 w-72 max-w-full rounded" />
        </div>
      ))}
    </div>
  );
}

const BLANK_EXP: ExperienceEntry = { title: "", company: "", location: "", start: "", end: "", description: "" };
const BLANK_EDU: EducationEntry = { degree: "", institution: "", start: "", end: "", grade: "" };
const BLANK_PROJ: ProjectEntry = { name: "", description: "", link: "" };

function completeness(p: CandidateProfile) {
  const checks = [
    p.has_resume, !!p.full_name, !!p.headline, !!p.email, !!p.location, !!p.summary,
    p.skills.length >= 3, p.experience.length > 0 || p.projects.length > 0, p.education.length > 0,
    p.target_roles.length > 0,
  ];
  return Math.round((100 * checks.filter(Boolean).length) / checks.length);
}

function ResumeCard({ profile, onProfile }: { profile: CandidateProfile; onProfile: (p: CandidateProfile) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (profile.has_resume && !window.confirm("Re-fill your profile from this resume? Details it finds will replace what's there now.")) return;
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const p = await careers.uploadResume(file);
      onProfile(p);
      setMsg("Profile filled in from your resume — review each section below and save any edits.");
    } catch (e) {
      setErr(errText(e, "Could not read that resume."));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const remove = async () => {
    if (!window.confirm("Remove your resume file? Your profile details stay as they are.")) return;
    await careers.deleteResume();
    onProfile({ ...profile, has_resume: false, resume_filename: "", resume_uploaded_at: null, resume_parsed_by: "" });
  };

  return (
    <div className={card}>
      <SectionTitle>Resume</SectionTitle>
      <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md,.rtf" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
      {profile.has_resume ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <span className="w-11 h-11 rounded-[12px] flex items-center justify-center shrink-0" style={{ background: "var(--surface-2)", color: "var(--ink)" }}>
              <IconDoc />
            </span>
            <div className="text-[13px] min-w-0" style={{ color: "var(--ink-dim)" }}>
              <p className="text-sm font-semibold truncate" style={{ color: "var(--ink)" }}>{profile.resume_filename}</p>
              Uploaded {fmtDate(profile.resume_uploaded_at)}
              {profile.resume_parsed_by && ` · read by ${profile.resume_parsed_by === "ai" ? "AI" : "keyword rules"}`}
              . Used automatically for ATS checks on Live jobs.
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <button className="btn btn-secondary btn-sm"
              onClick={() => careers.downloadResume(profile.resume_filename).catch((e) => setErr(errText(e, "Download failed.")))}>
              Download
            </button>
            <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => fileRef.current?.click()}>
              {busy ? "Reading…" : "Replace"}
            </button>
            <button className="btn btn-danger btn-sm" onClick={remove}>Remove</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files?.[0]); }}
          className="w-full rounded-[14px] border-2 border-dashed px-6 py-10 flex flex-col items-center text-center transition-colors hover:bg-[var(--surface-alt)]"
          style={{ borderColor: "var(--border-mid)", color: "var(--ink-dim)" }}
        >
          <span className="w-11 h-11 rounded-[12px] flex items-center justify-center mb-3" style={{ background: "var(--surface-2)", color: "var(--ink)" }}>
            <IconDoc />
          </span>
          <p className="font-display text-[17px] font-bold tracking-[-0.02em]" style={{ color: "var(--ink)" }}>{busy ? "Reading your resume…" : "Upload your resume"}</p>
          <p className="text-[13px] mt-1 max-w-sm">PDF, DOCX or text · max 5 MB. We fill in your whole profile from it — you can edit anything after.</p>
        </button>
      )}
      {msg && <p className="text-sm mt-3" style={{ color: "var(--success)" }}>{msg}</p>}
      {err && <p className="text-sm mt-3" style={{ color: "var(--danger)" }}>{err}</p>}
    </div>
  );
}

function ProfileTab({ profile, onProfile }: { profile: CandidateProfile; onProfile: (p: CandidateProfile) => void }) {
  const [draft, setDraft] = useState(profile);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  useEffect(() => setDraft(profile), [profile]);

  const set = <K extends keyof CandidateProfile>(k: K, v: CandidateProfile[K]) => { setDraft((d) => ({ ...d, [k]: v })); setStatus(""); };
  const dirty = JSON.stringify(draft) !== JSON.stringify(profile);

  const save = async () => {
    setSaving(true);
    setStatus("");
    try {
      const { has_resume, resume_filename, resume_uploaded_at, resume_parsed_by, updated_at, ...editable } = draft;
      const years = editable.total_experience_years;
      onProfile(await careers.updateProfile({ ...editable, total_experience_years: years === "" ? null : years }));
      setStatus("Saved.");
    } catch (e) {
      const body = e instanceof ApiError ? (e.body as Record<string, unknown> | undefined) : undefined;
      setStatus(body && typeof body === "object" && !("detail" in body)
        ? `Check: ${Object.keys(body).join(", ")}`
        : errText(e, "Could not save."));
    } finally {
      setSaving(false);
    }
  };

  const text = (k: keyof CandidateProfile, label: string, type = "text") => (
    <Field label={label}>
      <input type={type} value={(draft[k] as string | number | null) ?? ""} onChange={(e) => set(k, e.target.value as never)} className={inputCls} />
    </Field>
  );

  return (
    <div className="space-y-4 pb-20">
      <ResumeCard profile={profile} onProfile={onProfile} />

      <div className={card}>
        <SectionTitle>Basic details</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {text("full_name", "Full name")}
          {text("headline", "Headline (e.g. Backend Engineer)")}
          {text("email", "Email", "email")}
          {text("phone", "Phone")}
          {text("location", "Current location")}
          {text("total_experience_years", "Total experience (years)", "number")}
          {text("linkedin_url", "LinkedIn URL")}
          {text("github_url", "GitHub URL")}
          <div className="sm:col-span-2">{text("portfolio_url", "Portfolio / website")}</div>
          <div className="sm:col-span-2">
            <Field label="Summary">
              <textarea rows={4} value={draft.summary} onChange={(e) => set("summary", e.target.value)} className={inputCls} />
            </Field>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={card}>
          <SectionTitle>Skills</SectionTitle>
          <TagInput value={draft.skills} onChange={(v) => set("skills", v)} placeholder="Add a skill and press Enter" />
        </div>
        <div className={card}>
          <SectionTitle>Certifications</SectionTitle>
          <TagInput value={draft.certifications} onChange={(v) => set("certifications", v)} placeholder="Add a certification and press Enter" />
        </div>
      </div>

      <div className={card}>
        <SectionTitle>Experience</SectionTitle>
        <EntryList items={draft.experience} onChange={(v) => set("experience", v)} blank={BLANK_EXP} addLabel="Add experience"
          title={(e) => [e.title, e.company].filter(Boolean).join(" · ")}
          fields={[
            { key: "title", label: "Title" }, { key: "company", label: "Company" },
            { key: "start", label: "Start" }, { key: "end", label: "End (or Present)" },
            { key: "location", label: "Location", wide: true }, { key: "description", label: "What you did", multiline: true },
          ]} />
      </div>

      <div className={card}>
        <SectionTitle>Education</SectionTitle>
        <EntryList items={draft.education} onChange={(v) => set("education", v)} blank={BLANK_EDU} addLabel="Add education"
          title={(e) => [e.degree, e.institution].filter(Boolean).join(" · ")}
          fields={[
            { key: "degree", label: "Degree" }, { key: "institution", label: "Institution" },
            { key: "start", label: "Start" }, { key: "end", label: "End" }, { key: "grade", label: "Grade / CGPA", wide: true },
          ]} />
      </div>

      <div className={card}>
        <SectionTitle>Projects</SectionTitle>
        <EntryList items={draft.projects} onChange={(v) => set("projects", v)} blank={BLANK_PROJ} addLabel="Add project"
          title={(p) => p.name}
          fields={[{ key: "name", label: "Name" }, { key: "link", label: "Link" }, { key: "description", label: "Description", multiline: true }]} />
      </div>


      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 md:left-[calc(50%+120px)] z-30 flex items-center gap-3 rounded-full pl-5 pr-1.5 py-1.5 shadow-[0_12px_32px_rgba(12,12,11,0.22)]"
        style={{ background: "var(--hero-bg)", color: "var(--hero-text)", visibility: dirty || status ? "visible" : "hidden" }}>
        <span className="text-[13px] py-1.5">{status || "Unsaved changes"}</span>
        {dirty && (
          <button onClick={save} disabled={saving} className="btn btn-lime btn-sm">
            {saving ? "Saving…" : "Save profile"}
          </button>
        )}
      </div>
    </div>
  );
}

function PreferencesTab({ profile, onProfile }: { profile: CandidateProfile; onProfile: (p: CandidateProfile) => void }) {
  const [roles, setRoles] = useState(profile.target_roles);
  const [locs, setLocs] = useState(profile.preferred_locations);
  const [modes, setModes] = useState<WorkMode[]>(profile.work_modes);
  const [level, setLevel] = useState<JobLevel | "">(profile.experience_level);
  const [status, setStatus] = useState("");

  const save = async () => {
    try {
      onProfile(await careers.updateProfile({ target_roles: roles, preferred_locations: locs, work_modes: modes, experience_level: level }));
      setStatus("Preferences saved — Live jobs now ranks by them.");
    } catch (e) {
      setStatus(errText(e, "Could not save."));
    }
  };

  return (
    <div className={`${card} space-y-5`}>
      <p className="text-sm" style={{ color: "var(--ink-dim)" }}>
        These drive the <strong>Best match</strong> ranking on Live jobs, together with the skills on your profile.
      </p>
      <Field label="Target roles (up to 5)">
        <TagInput value={roles} onChange={setRoles} placeholder="e.g. Backend Engineer" max={5} />
      </Field>
      <Field label="Preferred locations (up to 5)">
        <TagInput value={locs} onChange={setLocs} placeholder="e.g. Bengaluru" max={5} />
      </Field>
      <div>
        <span className="text-xs font-medium block mb-1.5" style={{ color: "var(--ink-dim)" }}>Work mode</span>
        <div className="flex gap-1.5 flex-wrap">
          {(["remote", "hybrid", "onsite"] as WorkMode[]).map((m) => {
            const on = modes.includes(m);
            return (
              <button key={m} type="button" onClick={() => setModes(on ? modes.filter((x) => x !== m) : [...modes, m])}
                aria-pressed={on} className="chip">
                {m === "onsite" ? "On-site" : m[0].toUpperCase() + m.slice(1)}
              </button>
            );
          })}
        </div>
      </div>
      <Field label="Experience level">
        <select value={level} onChange={(e) => setLevel(e.target.value as JobLevel | "")} className={inputCls}>
          <option value="">Work it out from my experience</option>
          <option value="entry">Fresher / Entry (0–1 yr)</option>
          <option value="mid">Mid (1–5 yrs)</option>
          <option value="senior">Senior (5+ yrs)</option>
        </select>
      </Field>
      <div className="flex items-center gap-3">
        <button onClick={save} className="btn btn-primary">
          Save preferences
        </button>
        {status && <span className="text-sm" style={{ color: "var(--ink-dim)" }}>{status}</span>}
      </div>
    </div>
  );
}

function ApplicationsTab() {
  const [apps, setApps] = useState<JobApplication[] | null>(null);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: "", company: "", url: "" });

  useEffect(() => { careers.applications().then(setApps).catch((e) => setErr(errText(e, "Could not load applications."))); }, []);

  const patch = async (a: JobApplication, p: { status?: ApplicationStatus; notes?: string }) => {
    setApps((xs) => xs?.map((x) => (x.id === a.id ? { ...x, ...p } : x)) ?? null);
    try { await careers.updateApplication(a.id, p); } catch (e) { setErr(errText(e, "Could not update.")); }
  };
  const remove = async (a: JobApplication) => {
    if (!window.confirm(`Remove ${a.title} from your applications?`)) return;
    await careers.deleteApplication(a.id);
    setApps((xs) => xs?.filter((x) => x.id !== a.id) ?? null);
  };
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const a = await careers.addApplication({ title: form.title, company: form.company, url: form.url || undefined });
      setApps((xs) => [a, ...(xs ?? [])]);
      setForm({ title: "", company: "", url: "" });
      setAdding(false);
    } catch (e2) {
      setErr(errText(e2, "Could not add."));
    }
  };

  if (!apps) return err ? <Notice tone="error">{err}</Notice> : <ListSkeleton />;
  const counts = STATUSES.map((s) => ({ ...s, n: apps.filter((a) => a.status === s.id).length }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {counts.map((c) => (
          <StatTile key={c.id} label={c.label} value={c.n} tone={c.id === "offer" && c.n > 0 ? "lime" : "default"} />
        ))}
      </div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <p className="text-sm" style={{ color: "var(--ink-dim)" }}>Jobs you apply to from Live jobs are tracked here automatically.</p>
        <button onClick={() => setAdding(!adding)} className={`btn btn-sm shrink-0 ${adding ? "btn-ghost" : "btn-secondary"}`}>
          {adding ? "Cancel" : "+ Track another"}
        </button>
      </div>
      {adding && (
        <form onSubmit={add} className={`${card} grid grid-cols-1 sm:grid-cols-3 gap-2.5`}>
          <input required placeholder="Job title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} />
          <input required placeholder="Company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className={inputCls} />
          <input type="url" placeholder="Posting link (optional)" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} className={inputCls} />
          <button className="btn btn-primary sm:col-span-3 sm:justify-self-start">Add application</button>
        </form>
      )}
      {err && <Notice tone="error">{err}</Notice>}
      {apps.length === 0 ? (
        <EmptyState
          icon={<IconBriefcase />}
          title="No applications yet"
          body="Hit Apply on any live job and it lands here, ready to track through interviews and offers."
          action={<Link href="/jobs" className="btn btn-primary">Browse live jobs</Link>}
        />
      ) : (
        <ul className="space-y-3">
          {apps.map((a) => (
            <li key={a.id} className={card}>
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-[17px] font-bold tracking-[-0.015em]" style={{ color: "var(--ink)" }}>
                    {a.url ? <a href={a.url} target="_blank" rel="noopener noreferrer nofollow" className="hover:underline">{a.title}</a> : a.title}
                  </p>
                  <p className="text-[13px] mt-0.5" style={{ color: "var(--ink-dim)" }}>
                    {a.company}{a.location && ` · ${a.location}`} · applied {fmtDate(a.applied_at)}
                    {a.job_id !== null && !a.is_live && " · posting closed"}
                  </p>
                </div>
                <div className="flex gap-2 items-center shrink-0">
                  <select value={a.status} onChange={(e) => patch(a, { status: e.target.value as ApplicationStatus })}
                    className="ui-input !h-8 !w-auto !rounded-full !px-3 !text-[13px]">
                    {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                  <button onClick={() => remove(a)} className="btn btn-danger btn-sm">Remove</button>
                </div>
              </div>
              <textarea
                defaultValue={a.notes}
                onBlur={(e) => e.target.value !== a.notes && patch(a, { notes: e.target.value })}
                rows={1}
                placeholder="Notes (interview dates, contacts…)"
                className="ui-input mt-3.5 !text-[13px]"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SavedTab() {
  const [saved, setSaved] = useState<SavedJob[] | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { careers.savedJobs().then(setSaved).catch((e) => setErr(errText(e, "Could not load saved jobs."))); }, []);

  const remove = async (s: SavedJob) => {
    setSaved((xs) => xs?.filter((x) => x.id !== s.id) ?? null);
    await careers.removeSaved(s.id).catch(() => {});
  };

  if (!saved) return err ? <Notice tone="error">{err}</Notice> : <ListSkeleton />;
  if (saved.length === 0) {
    return (
      <EmptyState
        icon={<IconBriefcase />}
        title="No saved jobs yet"
        body="Tap ☆ Save on any job to bookmark it here."
        action={<Link href="/jobs" className="btn btn-primary">Browse live jobs</Link>}
      />
    );
  }
  return (
    <ul className="space-y-3">
      {saved.map((s) => (
        <li key={s.id} className={card}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-display text-[17px] font-bold tracking-[-0.015em]" style={{ color: "var(--ink)" }}>{s.title}</p>
              <p className="text-[13px] mt-0.5" style={{ color: "var(--ink-dim)" }}>
                {s.company}{s.location && ` · ${s.location}`} · saved {fmtDate(s.saved_at)}
                {!s.is_live && " · no longer open"}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => remove(s)} className="btn btn-secondary btn-sm">
                Remove
              </button>
              {s.is_live && s.job_id !== null && (
                <a href={s.url} target="_blank" rel="noopener noreferrer nofollow"
                  onClick={() => careers.markApplied(s.job_id as number).catch(() => {})}
                  className="btn btn-primary btn-sm">
                  Apply ↗
                </a>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function ProfilePage() {
  const [tab, setTab] = useState<Tab>("profile");
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab") as Tab | null;
    if (t && TABS.some((x) => x.id === t)) setTab(t);
    careers.profile().then(setProfile).catch((e) => setErr(errText(e, "Could not load your profile.")));
  }, []);

  const go = useCallback((t: Tab) => {
    setTab(t);
    window.history.replaceState(null, "", t === "profile" ? "/profile" : `/profile?tab=${t}`);
  }, []);

  const pct = profile ? completeness(profile) : 0;

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="min-h-screen" style={{ background: "var(--page)" }}>
          <PageContainer>
            <PageHeader
              eyebrow="Profile"
              title={profile?.full_name || "My profile"}
              subtitle={profile?.headline || "Your resume, applications and saved jobs in one place."}
              actions={
                profile && (
                  <div className="ui-card px-4 py-3 w-full sm:w-56">
                    <div className="flex items-baseline justify-between mb-2">
                      <span className="font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--ink-faint)" }}>
                        Profile
                      </span>
                      <span className="font-display text-[15px] font-bold tabular-nums" style={{ color: "var(--ink)" }}>
                        {pct}% complete
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--success)" }} />
                    </div>
                  </div>
                )
              }
            />

            <Segmented options={TABS} value={tab} onChange={go} className="mb-5" />

            {err && <Notice tone="error" className="mb-4">{err}</Notice>}
            {!profile && !err && (tab === "profile" || tab === "preferences") && <ListSkeleton />}
            {profile && tab === "profile" && <ProfileTab profile={profile} onProfile={setProfile} />}
            {profile && tab === "preferences" && <PreferencesTab profile={profile} onProfile={setProfile} />}
            {tab === "applications" && <ApplicationsTab />}
            {tab === "saved" && <SavedTab />}
          </PageContainer>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
