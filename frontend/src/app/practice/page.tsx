"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppShell from "@/components/AppShell";
import { careers, ApiError } from "@/lib/api";
import type { JobApplication, PracticeQuestion, RolePracticeSet } from "@/lib/api";
import { Skeleton } from "@/components/Skeleton";
import { PageContainer, PageHeader, Card, EmptyState, Notice, IconBriefcase, IconArrowRight } from "@/components/ui";
import PracticeRunner from "@/components/practice/PracticeRunner";

// The picker lists every tracked application; "general" is the old mixed bank.
type Selection = { kind: "pick" } | { kind: "role"; id: number } | { kind: "general" };

const STATUS_LABEL: Record<string, string> = {
  applied: "Applied",
  interviewing: "Interviewing",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

function readSelection(): Selection {
  const p = new URLSearchParams(window.location.search);
  const app = Number(p.get("app"));
  if (app > 0) return { kind: "role", id: app };
  if (p.get("mode") === "general") return { kind: "general" };
  return { kind: "pick" };
}

function LoadingCard() {
  return (
    <Card>
      <Skeleton className="h-3 w-48 rounded mb-5" />
      <Skeleton className="h-5 w-full rounded mb-2" />
      <Skeleton className="h-5 w-3/4 rounded mb-6" />
      <Skeleton className="h-48 w-full !rounded-[12px]" />
    </Card>
  );
}

function RolePicker({ onPick }: { onPick: (s: Selection) => void }) {
  const [apps, setApps] = useState<JobApplication[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    careers
      .applications()
      .then(setApps)
      .catch((e) => setError(e instanceof ApiError ? e.detail : "Could not load your applications."));
  }, []);

  if (error) return <Notice tone="error">{error}</Notice>;
  if (!apps) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[92px] w-full !rounded-[16px]" />)}
      </div>
    );
  }

  const general = (
    <button onClick={() => onPick({ kind: "general" })} className="btn btn-secondary">
      Practise general questions
    </button>
  );

  if (!apps.length) {
    return (
      <EmptyState
        icon={<IconBriefcase />}
        title="No applications yet"
        body="Apply to a role from Jobs (or add one you applied to elsewhere in your profile) and its interview questions show up here — coding, technical and behavioral."
        action={
          <>
            <Link href="/jobs" className="btn btn-primary">Browse jobs</Link>
            {general}
          </>
        }
      />
    );
  }

  return (
    <>
      <div className="font-label mb-3">Roles you&apos;ve applied for</div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {apps.map((a) => (
          <li key={a.id}>
            <button
              onClick={() => onPick({ kind: "role", id: a.id })}
              className="ui-card w-full text-left p-4 sm:p-5 flex items-center gap-4 transition-transform hover:-translate-y-0.5"
            >
              <div className="min-w-0 flex-1">
                <p className="font-display text-[16px] font-semibold leading-snug truncate" style={{ color: "var(--ink)" }}>
                  {a.title}
                </p>
                <p className="text-[13px] mt-0.5 truncate" style={{ color: "var(--ink-dim)" }}>
                  {a.company}{a.location ? ` · ${a.location}` : ""}
                </p>
                <span className="tag tag-outline mt-2.5 inline-block">{STATUS_LABEL[a.status] ?? a.status}</span>
              </div>
              <span className="shrink-0" style={{ color: "var(--ink-faint)" }}><IconArrowRight /></span>
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <span className="text-sm" style={{ color: "var(--ink-dim)" }}>Not preparing for a specific role?</span>
        {general}
      </div>
    </>
  );
}

function RolePractice({ id, onBack }: { id: number; onBack: () => void }) {
  const [set, setSet] = useState<RolePracticeSet | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setSet(null);
    setError("");
    careers
      .rolePractice(id)
      .then(setSet)
      .catch((e) => setError(e instanceof ApiError ? e.detail : "Could not load questions for this role."));
  }, [id]);

  const back = <button onClick={onBack} className="btn btn-ghost">← All roles</button>;

  return (
    <>
      <PageHeader
        eyebrow="Practice"
        title={set ? set.application.title : "Role practice"}
        subtitle={
          set ? (
            <>
              {set.application.company} — every kind of question this role is likely to ask.{" "}
              {set.company_bank
                ? `Includes questions reported for ${set.application.company}.`
                : "Built from the role's skills and common questions for this kind of role."}
            </>
          ) : undefined
        }
        actions={back}
      />
      {error ? (
        <Notice tone="error">{error}</Notice>
      ) : !set ? (
        <LoadingCard />
      ) : (
        <>
          {set.sources.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mb-4">
              <span className="text-xs mr-1" style={{ color: "var(--ink-faint)" }}>Covers</span>
              {set.sources.map((s) => <span key={s} className="tag">{s}</span>)}
            </div>
          )}
          <PracticeRunner key={id} questions={set.questions} />
        </>
      )}
    </>
  );
}

function GeneralPractice({ onBack }: { onBack: () => void }) {
  const [questions, setQuestions] = useState<PracticeQuestion[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    careers
      .practiceQuestions()
      .then(setQuestions)
      .catch((e) => setError(e instanceof ApiError ? e.detail : "Could not load questions."));
  }, []);

  return (
    <>
      <PageHeader
        eyebrow="Practice"
        title="General practice"
        subtitle="A random mix from the question bank. Type your answer, then validate it to get a score."
        actions={<button onClick={onBack} className="btn btn-ghost">← Your roles</button>}
      />
      {error ? <Notice tone="error">{error}</Notice> : !questions ? <LoadingCard /> : <PracticeRunner questions={questions} />}
    </>
  );
}

export default function PracticePage() {
  const router = useRouter();
  const [sel, setSel] = useState<Selection | null>(null);

  useEffect(() => { setSel(readSelection()); }, []);

  const pick = (s: Selection) => {
    setSel(s);
    const qs = s.kind === "role" ? `?app=${s.id}` : s.kind === "general" ? "?mode=general" : "";
    router.replace(`/practice${qs}`, { scroll: false });
    window.scrollTo({ top: 0 });
  };

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="min-h-screen" style={{ background: "var(--page)" }}>
          <PageContainer>
            {sel?.kind === "role" ? (
              <RolePractice id={sel.id} onBack={() => pick({ kind: "pick" })} />
            ) : sel?.kind === "general" ? (
              <GeneralPractice onBack={() => pick({ kind: "pick" })} />
            ) : (
              <>
                <PageHeader
                  eyebrow="Practice"
                  title="Practice for your roles"
                  subtitle="Pick a role you've applied for to practise the questions that company and role are likely to ask — coding (in a code editor), technical, system design and behavioral. Free and unlimited."
                />
                {sel && <RolePicker onPick={pick} />}
              </>
            )}
          </PageContainer>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
