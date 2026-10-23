"use client";
import { useEffect, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppShell from "@/components/AppShell";
import { careers, ApiError } from "@/lib/api";
import type { PracticeQuestion, PracticeResult } from "@/lib/api";
import { Skeleton } from "@/components/Skeleton";
import {
  PageContainer, PageHeader, Card, StatTile, EmptyState, Notice, Segmented, ScoreBar, IconChat, scoreColor,
} from "@/components/ui";

const TYPES = [
  { id: "", label: "All" },
  { id: "behavioral", label: "Behavioral" },
  { id: "coding", label: "Coding" },
  { id: "system_design", label: "System design" },
];

const TIPS = [
  "Answer the way you would out loud — structure first, then detail.",
  "Behavioral: situation, task, action, result.",
  "Technical: name the approach, its trade-offs and its complexity.",
  "Compare with the ideal answer to spot the ideas you missed.",
];

export default function PracticePage() {
  const [type, setType] = useState("");
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<PracticeResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Scores from this visit only — a running tally, not persisted.
  const [scores, setScores] = useState<number[]>([]);

  useEffect(() => {
    setLoading(true);
    setError("");
    careers
      .practiceQuestions(type)
      .then((qs) => { setQuestions(qs); setIdx(0); setAnswer(""); setResult(null); })
      .catch((e) => setError(e instanceof ApiError ? e.detail : "Could not load questions."))
      .finally(() => setLoading(false));
  }, [type]);

  const q = questions[idx];

  const validate = async () => {
    if (!q) return;
    setBusy(true);
    setError("");
    try {
      const r = await careers.validateAnswer(q.id, answer);
      setResult(r);
      setScores((s) => [...s, r.score]);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const next = () => { setIdx((i) => (i + 1) % questions.length); setAnswer(""); setResult(null); };

  const words = answer.trim() ? answer.trim().split(/\s+/).length : 0;
  const sessionAvg = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : undefined;

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="min-h-screen" style={{ background: "var(--page)" }}>
          <PageContainer>
            <PageHeader
              eyebrow="Practice"
              title="Typed practice"
              subtitle="Type your answer, then validate it to get a score. Free and unlimited."
              actions={<Segmented options={TYPES} value={type} onChange={setType} />}
            />

            {error && <Notice tone="error" className="mb-4">{error}</Notice>}

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 lg:items-start">
              <div className="min-w-0">
                {loading ? (
                  <Card>
                    <Skeleton className="h-3 w-48 rounded mb-5" />
                    <Skeleton className="h-5 w-full rounded mb-2" />
                    <Skeleton className="h-5 w-3/4 rounded mb-6" />
                    <Skeleton className="h-48 w-full !rounded-[12px]" />
                  </Card>
                ) : !q ? (
                  !error && (
                    <EmptyState
                      icon={<IconChat />}
                      title="No practice questions yet"
                      body="Questions for this category haven't been added yet — try another type."
                    />
                  )
                ) : (
                  <Card>
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                      <div className="flex flex-wrap gap-1.5">
                        {q.company && <span className="tag">{q.company}</span>}
                        {q.role && <span className="tag">{q.role}</span>}
                        <span className="tag tag-outline capitalize">{q.question_type.replace("_", " ")}</span>
                      </div>
                      <span className="font-mono text-[11px]" style={{ color: "var(--ink-faint)" }}>
                        Question {idx + 1} of {questions.length}
                      </span>
                    </div>
                    <span className="block h-1 rounded-full overflow-hidden mb-5" style={{ background: "var(--surface-2)" }}>
                      <span
                        className="block h-full rounded-full transition-[width] duration-300"
                        style={{ width: `${((idx + 1) / questions.length) * 100}%`, background: "var(--ink)" }}
                      />
                    </span>

                    <p className="font-display text-[19px] sm:text-[21px] font-semibold leading-snug tracking-[-0.015em]" style={{ color: "var(--ink)" }}>
                      {q.question_text}
                    </p>

                    <textarea
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      disabled={!!result}
                      rows={9}
                      placeholder="Type your answer…"
                      className="ui-input mt-5"
                    />

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <span className="font-mono text-[11px]" style={{ color: "var(--ink-faint)" }}>
                        {words} word{words === 1 ? "" : "s"}
                      </span>
                      <div className="flex gap-2">
                        {!result ? (
                          <>
                            {questions.length > 1 && (
                              <button onClick={next} disabled={busy} className="btn btn-ghost">
                                Skip
                              </button>
                            )}
                            <button onClick={validate} disabled={busy || !answer.trim()} className="btn btn-primary">
                              {busy ? "Validating…" : "Validate answer"}
                            </button>
                          </>
                        ) : (
                          <button onClick={next} className="btn btn-primary">
                            Next question →
                          </button>
                        )}
                      </div>
                    </div>

                    {result && (
                      <div className="mt-5 pt-5 border-t space-y-4" style={{ borderColor: "var(--border)" }}>
                        <div className="rounded-[14px] p-4" style={{ background: "var(--surface-alt)", border: "1px solid var(--border)" }}>
                          <div className="flex items-baseline justify-between gap-3 mb-2.5">
                            <span
                              className="font-display text-[36px] font-bold leading-none tracking-[-0.035em] tabular-nums"
                              style={{ color: scoreColor(result.score) }}
                            >
                              {result.score}
                              <span className="text-[16px] font-medium" style={{ color: "var(--ink-faint)" }}>/10</span>
                            </span>
                            <span className="font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--ink-faint)" }}>
                              Your score
                            </span>
                          </div>
                          <ScoreBar value={result.score} />
                        </div>
                        {result.missing.length > 0 && (
                          <div>
                            <p className="text-xs mb-1.5" style={{ color: "var(--ink-dim)" }}>Ideas you didn&apos;t cover</p>
                            <div className="flex flex-wrap gap-1.5">
                              {result.missing.map((m) => <span key={m} className="tag tag-warn">{m}</span>)}
                            </div>
                          </div>
                        )}
                        <details className="rounded-[14px] px-4 py-3 group" style={{ border: "1px solid var(--border-mid)" }}>
                          <summary className="text-sm font-semibold cursor-pointer select-none" style={{ color: "var(--ink)" }}>
                            Show ideal answer
                          </summary>
                          <p className="text-sm mt-3 whitespace-pre-wrap leading-relaxed" style={{ color: "var(--ink-dim)" }}>
                            {result.ideal_answer}
                          </p>
                        </details>
                      </div>
                    )}
                  </Card>
                )}
              </div>

              <aside className="grid grid-cols-2 lg:grid-cols-1 gap-4">
                <StatTile label="Answered" value={scores.length} hint="This visit" />
                <StatTile
                  label="Avg. score"
                  value={sessionAvg ?? "—"}
                  suffix={sessionAvg !== undefined ? "/10" : undefined}
                  hint="This visit"
                />
                <Card className="col-span-2 lg:col-span-1 !p-5">
                  <div className="font-label mb-3">How to score well</div>
                  <ul className="space-y-2.5">
                    {TIPS.map((t) => (
                      <li key={t} className="flex gap-2.5 text-[13px] leading-relaxed" style={{ color: "var(--ink-dim)" }}>
                        <span className="mt-[7px] w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--olive)" }} />
                        {t}
                      </li>
                    ))}
                  </ul>
                </Card>
              </aside>
            </div>
          </PageContainer>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
