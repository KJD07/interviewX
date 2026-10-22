"use client";
import { useEffect, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppShell from "@/components/AppShell";
import { careers, ApiError } from "@/lib/api";
import type { PracticeQuestion, PracticeResult } from "@/lib/api";

const TYPES = [
  { id: "", label: "All" },
  { id: "behavioral", label: "Behavioral" },
  { id: "coding", label: "Coding" },
  { id: "system_design", label: "System design" },
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
      setResult(await careers.validateAnswer(q.id, answer));
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const next = () => { setIdx((i) => (i + 1) % questions.length); setAnswer(""); setResult(null); };

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="min-h-screen px-6 py-8 max-w-3xl mx-auto" style={{ background: "var(--page)" }}>
          <h1 className="font-display text-2xl font-semibold" style={{ color: "var(--ink)" }}>Practice</h1>
          <p className="text-sm mt-1" style={{ color: "var(--ink-dim)" }}>
            Type your answer, then validate it to get a score. Free and unlimited.
          </p>

          <div className="flex gap-2 mt-4 flex-wrap">
            {TYPES.map((t) => (
              <button
                key={t.id}
                onClick={() => setType(t.id)}
                className="px-3 py-1.5 rounded-full text-xs font-medium"
                style={{
                  background: type === t.id ? "var(--accent)" : "var(--surface)",
                  color: type === t.id ? "#fff" : "var(--ink-dim)",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {loading && <p className="mt-6 text-sm" style={{ color: "var(--ink-dim)" }}>Loading…</p>}
          {!loading && !q && !error && (
            <p className="mt-6 text-sm" style={{ color: "var(--ink-dim)" }}>No practice questions available yet.</p>
          )}
          {error && <p className="mt-4 text-sm" style={{ color: "#b33a3a" }}>{error}</p>}

          {q && (
            <div className="mt-6 rounded-xl p-5 space-y-4" style={{ background: "var(--surface)" }}>
              <p className="text-xs" style={{ color: "var(--ink-dim)" }}>
                {q.company} · {q.role} · {q.question_type.replace("_", " ")} · {idx + 1}/{questions.length}
              </p>
              <p className="font-medium" style={{ color: "var(--ink)" }}>{q.question_text}</p>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                disabled={!!result}
                rows={8}
                placeholder="Type your answer…"
                className="w-full rounded-lg p-3 text-sm border"
                style={{ background: "var(--page)", borderColor: "var(--border, #e5e0d8)", color: "var(--ink)" }}
              />
              <div className="flex gap-2">
                {!result ? (
                  <button
                    onClick={validate}
                    disabled={busy || !answer.trim()}
                    className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                    style={{ background: "var(--accent)", color: "#fff" }}
                  >
                    {busy ? "Validating…" : "Validate"}
                  </button>
                ) : (
                  <button onClick={next} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--accent)", color: "#fff" }}>
                    Next question
                  </button>
                )}
              </div>

              {result && (
                <div className="space-y-3 pt-2">
                  <p className="text-2xl font-semibold" style={{ color: "var(--ink)" }}>Score: {result.score}/10</p>
                  {result.missing.length > 0 && (
                    <p className="text-sm" style={{ color: "var(--ink-dim)" }}>
                      Ideas you didn&apos;t cover: {result.missing.join(", ")}
                    </p>
                  )}
                  <details>
                    <summary className="text-sm cursor-pointer" style={{ color: "var(--accent)" }}>Show ideal answer</summary>
                    <p className="text-sm mt-2 whitespace-pre-wrap" style={{ color: "var(--ink)" }}>{result.ideal_answer}</p>
                  </details>
                </div>
              )}
            </div>
          )}
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
