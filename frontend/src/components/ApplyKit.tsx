"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { careers } from "@/lib/api";
import type { CandidateProfile, Job } from "@/lib/api";

// Shown when a candidate clicks Apply: their profile as copy-ready fields, so
// they can paste them into the company's application form. Browsers don't let
// us fill another site's form, so this is the next best thing. "Float" moves
// the panel into an always-on-top Picture-in-Picture window (Chrome/Edge) or a
// small popup window elsewhere, to sit beside the form while they paste.

interface Field { label: string; value: string; multiline?: boolean }

function kitSections(p: CandidateProfile): { title: string; fields: Field[] }[] {
  const [first, ...rest] = p.full_name.trim().split(/\s+/);
  const job = p.experience[0];
  const edu = p.education[0];
  const sections = [
    {
      title: "Basics",
      fields: [
        { label: "Full name", value: p.full_name },
        { label: "First name", value: first || "" },
        { label: "Last name", value: rest.join(" ") },
        { label: "Email", value: p.email },
        { label: "Phone", value: p.phone },
        { label: "Location", value: p.location },
      ],
    },
    {
      title: "Links",
      fields: [
        { label: "LinkedIn", value: p.linkedin_url },
        { label: "GitHub", value: p.github_url },
        { label: "Portfolio / website", value: p.portfolio_url },
      ],
    },
    {
      title: "Work",
      fields: [
        { label: "Current / latest title", value: job?.title || "" },
        { label: "Current / latest company", value: job?.company || "" },
        { label: "Years of experience", value: p.total_experience_years == null ? "" : String(Number(p.total_experience_years)) },
      ],
    },
    {
      title: "Education",
      fields: [
        { label: "Degree", value: edu?.degree || "" },
        { label: "School / university", value: edu?.institution || "" },
        { label: "Graduation year", value: edu?.end || "" },
        { label: "Grade / CGPA", value: edu?.grade || "" },
      ],
    },
    {
      title: "About you",
      fields: [
        { label: "Skills", value: p.skills.join(", "), multiline: true },
        { label: "Summary", value: p.summary, multiline: true },
      ],
    },
  ];
  return sections
    .map((s) => ({ ...s, fields: s.fields.filter((f) => f.value.trim()) }))
    .filter((s) => s.fields.length);
}

// Copies via the clicked element's own window: while the panel is floating,
// the main tab isn't focused and its clipboard API would reject the write.
async function copyFrom(el: HTMLElement, text: string) {
  const doc = el.ownerDocument;
  try {
    await doc.defaultView!.navigator.clipboard.writeText(text);
  } catch {
    const ta = doc.createElement("textarea");
    ta.value = text;
    doc.body.appendChild(ta);
    ta.select();
    doc.execCommand("copy");
    ta.remove();
  }
}

function CopyRow({ field }: { field: Field }) {
  const [copied, setCopied] = useState(false);
  return (
    <li className="flex items-start justify-between gap-3 py-2" style={{ borderTop: "1px solid var(--border)" }}>
      <div className="min-w-0">
        <p className="text-[11px]" style={{ color: "var(--ink-faint)" }}>{field.label}</p>
        <p
          className={`text-sm break-words ${field.multiline ? "line-clamp-3" : ""}`}
          style={{ color: "var(--ink)" }}
          title={field.multiline ? field.value : undefined}
        >
          {field.value}
        </p>
      </div>
      <button
        type="button"
        className="btn btn-secondary btn-sm shrink-0"
        onClick={async (e) => {
          await copyFrom(e.currentTarget, field.value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
      >
        {copied ? "Copied ✓" : "Copy"}
      </button>
    </li>
  );
}

function KitBody({ job, profile, onOpenForm }: { job: Job; profile: CandidateProfile | null; onOpenForm: () => void }) {
  const sections = profile ? kitSections(profile) : [];
  return (
    <>
      <a
        href={job.url}
        target="_blank"
        rel="noopener noreferrer nofollow"
        onClick={onOpenForm}
        className="btn btn-primary w-full mb-5"
      >
        Open application form ↗
      </a>
      {sections.length ? (
        <div className="space-y-4">
          {sections.map((s) => (
            <section key={s.title}>
              <p className="font-label mb-1">{s.title}</p>
              <ul>{s.fields.map((f) => <CopyRow key={f.label} field={f} />)}</ul>
            </section>
          ))}
          {profile?.resume_filename && (
            <p className="text-xs" style={{ color: "var(--ink-dim)" }}>
              Resume: attach <strong style={{ color: "var(--ink)" }}>{profile.resume_filename}</strong> ·{" "}
              <button type="button" className="underline" onClick={() => careers.downloadResume(profile.resume_filename).catch(() => {})}>
                download it
              </button>
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm" style={{ color: "var(--ink-dim)" }}>
          Your profile is empty, so there&apos;s nothing to copy yet.{" "}
          <Link href="/profile" className="underline" style={{ color: "var(--ink)" }}>Upload your resume</Link>{" "}
          once and your details will show up here every time you apply.
        </p>
      )}
    </>
  );
}

// Picture-in-Picture stays on top of the form; a popup window is the fallback.
async function openFloatingWindow(): Promise<Window | null> {
  let win: Window | null = null;
  const pip = (window as unknown as { documentPictureInPicture?: { requestWindow: (o: object) => Promise<Window> } })
    .documentPictureInPicture;
  if (pip) {
    try {
      win = await pip.requestWindow({ width: 380, height: 640 });
    } catch {
      win = null;
    }
  }
  if (!win) {
    const left = Math.max(0, window.screen.availWidth - 420);
    win = window.open("", "evalulabs-apply-kit", `popup,width=400,height=680,left=${left},top=40`);
  }
  if (!win) return null;
  win.document.title = "EvaluLabs · Your details";
  // Carry over the app's stylesheets (Tailwind + theme tokens) and fonts.
  // Rules are copied as text (inline, so they apply immediately); a sheet we
  // can't read (cross-origin) is linked instead.
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const style = win.document.createElement("style");
      style.textContent = Array.from(sheet.cssRules).map((r) => r.cssText).join("\n");
      win.document.head.appendChild(style);
    } catch {
      if (!sheet.href) continue;
      const link = win.document.createElement("link");
      link.rel = "stylesheet";
      link.href = sheet.href;
      win.document.head.appendChild(link);
    }
  }
  win.document.documentElement.className = document.documentElement.className;
  win.document.body.className = document.body.className;
  win.document.documentElement.style.background = "var(--surface)";
  win.document.body.style.background = "var(--surface)";
  win.document.body.style.margin = "0";
  return win;
}

export default function ApplyKit({
  job,
  profile,
  onOpenForm,
  onClose,
}: {
  job: Job;
  profile: CandidateProfile | null;
  onOpenForm: () => void;
  onClose: () => void;
}) {
  const [floating, setFloating] = useState<Window | null>(null);

  useEffect(() => {
    if (!floating) return;
    const closed = () => onClose();
    floating.addEventListener("pagehide", closed);
    return () => {
      floating.removeEventListener("pagehide", closed);
      floating.close();
    };
  }, [floating, onClose]);

  const header = (
    <div className="mb-4">
      <h2 className="font-display text-lg font-semibold leading-snug" style={{ color: "var(--ink)" }}>
        Apply to {job.title}
      </h2>
      <p className="text-sm" style={{ color: "var(--ink-dim)" }}>
        {job.company} · copy your details into their form
      </p>
    </div>
  );

  if (floating) {
    return createPortal(
      <div className="p-4">
        {header}
        <KitBody job={job} profile={profile} onOpenForm={onOpenForm} />
      </div>,
      floating.document.body
    );
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8"
      style={{ background: "rgba(6, 10, 20, 0.7)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl fade-up px-5 sm:px-6 pt-6 pb-6 shadow-[0_20px_60px_rgba(15,23,42,0.35)]"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 text-lg leading-none"
          style={{ color: "var(--ink-faint)" }}
        >
          ✕
        </button>
        {header}
        <button
          type="button"
          className="btn btn-secondary btn-sm w-full mb-2"
          onClick={async () => setFloating(await openFloatingWindow())}
        >
          ⧉ Float this panel next to the form
        </button>
        <KitBody job={job} profile={profile} onOpenForm={onOpenForm} />
      </div>
    </div>,
    document.body
  );
}
