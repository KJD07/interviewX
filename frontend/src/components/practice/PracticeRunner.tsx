"use client";
import { useMemo, useState } from "react";
import { careers, ApiError } from "@/lib/api";
import type { PracticeCategory, PracticeQuestion, PracticeResult } from "@/lib/api";
import { Card, StatTile, EmptyState, Notice, Segmented, ScoreBar, IconChat, scoreColor } from "@/components/ui";
import PracticeCodeEditor, { normaliseLanguage } from "./PracticeCodeEditor";

type Filter = "all" | PracticeCategory;

const CATEGORY_LABEL: Record<PracticeCategory, string> = {
  coding: "Coding",
  technical: "Technical",
  system_design: "System design",
  behavioral: "Behavioral & HR",
};
const CATEGORY_ORDER: PracticeCategory[] = ["coding", "technical", "system_design", "behavioral"];

const TIPS = [
  "Answer the way you would out loud — structure first, then detail.",
  "Behavioral: situation, task, action, result.",
  "Coding: write the code, then explain the approach and its time/space complexity.",
  "Compare with the ideal answer to spot the ideas you missed.",
];

interface Draft {
  answer: string;
  code?: string;
  language?: string;
}

const key = (q: PracticeQuestion) => String(q.id);

export default function PracticeRunner({ questions }: { questions: PracticeQuestion[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [idx, setIdx] = useState(0);
  // Drafts and scores live for this visit only — a running tally, not persisted.
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [results, setResults] = useState<Record<string, PracticeResult>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const counts = useMemo(() => {
    const c: Partial<Record<PracticeCategory, number>> = {};
    questions.forEach((q) => { c[q.category] = (c[q.category] ?? 0) + 1; });
    return c;
  }, [questions]);

  const filterOptions = useMemo(
    () => [
      { id: "all" as Filter, label: `All ${questions.length}` },
      ...CATEGORY_ORDER.filter((c) => counts[c]).map((c) => ({ id: c as Filter, label: `${CATEGORY_LABEL[c]} ${counts[c]}` })),
    ],
    [questions.length, counts],
  );

  const shown = useMemo(
    () => (filter === "all" ? questions : questions.filter((q) => q.category === filter)),
    [questions, filter],
  );
  const q = shown[Math.min(idx, shown.length - 1)];
  const isCoding = q?.category === "coding";
  const draft: Draft = q
    ? drafts[key(q)] ?? {
        answer: "",
        ...(isCoding ? { code: q.starter_code || "", language: normaliseLanguage(q.language) } : {}),
      }
    : { answer: "" };
  const result = q ? results[key(q)] : undefined;

  const scores = Object.values(results).map((r) => r.score);
  const avg = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : undefined;

  const update = (patch: Partial<Draft>) => q && setDrafts((d) => ({ ...d, [key(q)]: { ...draft, ...patch } }));

  const changeFilter = (f: Filter) => { setFilter(f); setIdx(0); setError(""); };
  const go = (i: number) => { setIdx((i + shown.length) % shown.length); setError(""); };

  // Code is scored with the written approach, against the ideal answer's ideas.
  const submission = isCoding
    ? [draft.answer.trim(), draft.code && draft.code.trim() !== (q?.starter_code || "").trim() ? draft.code : ""]
        .filter(Boolean).join("\n\n")
    : draft.answer.trim();

  const validate = async () => {
    if (!q || !submission) return;
    setBusy(true);
    setError("");
    try {
      const r = await careers.validateAnswer(q.id, submission);
      setResults((s) => ({ ...s, [key(q)]: r }));
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const retry = () => {
    if (!q) return;
    setResults((s) => {
      const next = { ...s };
      delete next[key(q)];
      return next;
    });
  };

  const words = draft.answer.trim() ? draft.answer.trim().split(/\s+/).length : 0;

  if (!questions.length) {
    return (
      <EmptyState
        icon={<IconChat />}
        title="No practice questions yet"
        body="Questions for this role haven't been added yet."
      />
    );
  }

  return (
    <>
      <div className="mb-4 overflow-x-auto">
        <Segmented options={filterOptions} value={filter} onChange={changeFilter} />
      </div>

      {error && <Notice tone="error" className="mb-4">{error}</Notice>}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 lg:items-start">
        <div className="min-w-0">
          {q && (
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex flex-wrap gap-1.5">
                  <span className="tag">{q.source}</span>
                  <span className="tag tag-outline">{CATEGORY_LABEL[q.category]}</span>
                </div>
                <span className="font-mono text-[11px]" style={{ color: "var(--ink-faint)" }}>
                  Question {Math.min(idx, shown.length - 1) + 1} of {shown.length}
                </span>
              </div>

              <p className="font-display text-[19px] sm:text-[21px] font-semibold leading-snug tracking-[-0.015em] whitespace-pre-wrap" style={{ color: "var(--ink)" }}>
                {q.question_text}
              </p>

              {isCoding ? (
                <div className="mt-5 space-y-3">
                  <PracticeCodeEditor
                    code={draft.code ?? ""}
                    language={draft.language ?? "python"}
                    onCode={(code) => update({ code })}
                    onLanguage={(language) => update({ language })}
                    readOnly={!!result}
                  />
                  <textarea
                    value={draft.answer}
                    onChange={(e) => update({ answer: e.target.value })}
                    disabled={!!result}
                    rows={4}
                    placeholder="Explain your approach, the data structures you used, and the time/space complexity…"
                    className="ui-input"
                  />
                  <p className="text-[11px]" style={{ color: "var(--ink-faint)" }}>
                    Your code isn&apos;t executed — it&apos;s scored, together with your explanation, on how many of the
                    expected ideas it covers.
                  </p>
                </div>
              ) : (
                <textarea
                  value={draft.answer}
                  onChange={(e) => update({ answer: e.target.value })}
                  disabled={!!result}
                  rows={9}
                  placeholder="Type your answer…"
                  className="ui-input mt-5"
                />
              )}

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <span className="font-mono text-[11px]" style={{ color: "var(--ink-faint)" }}>
                  {words} word{words === 1 ? "" : "s"}
                </span>
                <div className="flex flex-wrap gap-2">
                  {shown.length > 1 && (
                    <button onClick={() => go(idx - 1)} disabled={busy} className="btn btn-ghost">
                      ← Prev
                    </button>
                  )}
                  {!result ? (
                    <>
                      {shown.length > 1 && (
                        <button onClick={() => go(idx + 1)} disabled={busy} className="btn btn-ghost">
                          Skip
                        </button>
                      )}
                      <button onClick={validate} disabled={busy || !submission} className="btn btn-primary">
                        {busy ? "Validating…" : "Validate answer"}
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={retry} className="btn btn-ghost">Try again</button>
                      {shown.length > 1 && (
                        <button onClick={() => go(idx + 1)} className="btn btn-primary">
                          Next question →
                        </button>
                      )}
                    </>
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
          <StatTile label="Answered" value={scores.length} hint={`of ${questions.length}`} />
          <StatTile label="Avg. score" value={avg ?? "—"} suffix={avg !== undefined ? "/10" : undefined} hint="This visit" />
          <Card className="col-span-2 lg:col-span-1 !p-3">
            <div className="font-label mb-2 px-2 pt-1">Questions</div>
            <ol className="max-h-[360px] overflow-y-auto space-y-0.5">
              {shown.map((item, i) => {
                const r = results[key(item)];
                const active = item === q;
                return (
                  <li key={key(item)}>
                    <button
                      onClick={() => go(i)}
                      className="w-full text-left flex items-start gap-2.5 rounded-[10px] px-2 py-1.5 text-[13px] leading-snug"
                      style={{ background: active ? "var(--surface-2)" : "transparent", color: "var(--ink-dim)" }}
                    >
                      <span className="font-mono text-[11px] mt-0.5 w-5 shrink-0" style={{ color: "var(--ink-faint)" }}>{i + 1}</span>
                      <span className="flex-1 min-w-0 line-clamp-2" style={{ color: active ? "var(--ink)" : undefined }}>
                        {item.question_text}
                      </span>
                      {r && (
                        <span className="font-mono text-[11px] font-semibold tabular-nums shrink-0" style={{ color: scoreColor(r.score) }}>
                          {r.score}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>
          </Card>
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
    </>
  );
}
