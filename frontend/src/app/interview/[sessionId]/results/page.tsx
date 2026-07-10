"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { interviews, ApiError } from "@/lib/api";
import type { InterviewSession } from "@/lib/api";
import { planOf } from "@/lib/plans";
import RealInterviewReportModal from "@/components/RealInterviewReportModal";

// ── Score ring ────────────────────────────────────────────────────────────────

function ScoreRing({ value, label }: { value: number | undefined; label: string }) {
  const score = value ?? 0;
  const radius = 28;
  const circ = 2 * Math.PI * radius;
  const filled = (score / 10) * circ;
  const color = score >= 7 ? "#22c55e" : score >= 5 ? "#f59e0b" : "var(--danger)";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: 72, height: 72 }}>
        <svg width="72" height="72" style={{ transform: "rotate(-90deg)" }}>
          <circle
            cx="36" cy="36" r={radius}
            fill="none"
            stroke="var(--border-mid)"
            strokeWidth="6"
          />
          <circle
            cx="36" cy="36" r={radius}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circ}`}
            style={{ transition: "stroke-dasharray 0.8s ease" }}
          />
        </svg>
        <div
          className="absolute inset-0 flex items-center justify-center text-lg font-bold"
          style={{ color: value !== undefined ? color : "var(--ink-faint)" }}
        >
          {value !== undefined ? value : "—"}
        </div>
      </div>
      <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--ink-dim)" }}>
        {label}
      </span>
    </div>
  );
}

// ── Transcript message ────────────────────────────────────────────────────────

function TranscriptBubble({ msg }: { msg: { role: "user" | "ai"; text: string; ts: string } }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-1"
        style={
          isUser
            ? { background: "var(--border-mid)", color: "var(--ink-dim)" }
            : { background: "var(--accent-glow)", color: "var(--accent)" }
        }
      >
        {isUser ? "Y" : "AI"}
      </div>
      <div
        className="max-w-[78%] rounded-xl px-4 py-2.5 text-sm leading-relaxed"
        style={
          isUser
            ? { background: "rgba(99,102,241,0.1)", color: "var(--ink)", border: "1px solid rgba(99,102,241,0.2)" }
            : { background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--border-mid)" }
        }
      >
        {msg.text}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ResultsPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const sessionId = Number(params.sessionId);
  const plan = planOf(user?.subscription_plan);

  const [session, setSession] = useState<InterviewSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showTranscript, setShowTranscript] = useState(false);
  const [showRealReportModal, setShowRealReportModal] = useState(false);

  useEffect(() => {
    interviews.detail(sessionId)
      .then((s) => {
        setSession(s);
        // If still in progress, redirect to chat
        if (s.status === "in_progress") {
          router.replace(`/interview/${sessionId}`);
          return;
        }
        // Paid-plan users get a one-time, skippable form asking about any
        // real interview they recently gave — feeds real interview data
        // back into InterviewX. Only shown once per session.
        if (s.status === "completed" && plan.hasInsights) {
          const seenKey = `ix_rr_seen_${sessionId}`;
          if (!localStorage.getItem(seenKey)) {
            setShowRealReportModal(true);
          }
        }
      })
      .catch((err) => {
        if (err instanceof ApiError) setError(err.detail);
        else setError("Could not load results.");
      })
      .finally(() => setLoading(false));
  }, [sessionId, router, plan.hasInsights]);

  const dismissRealReportModal = () => {
    localStorage.setItem(`ix_rr_seen_${sessionId}`, "1");
    setShowRealReportModal(false);
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ background: "var(--page)" }}
        >
          <p className="text-sm" style={{ color: "var(--ink-dim)" }}>
            Loading results…
          </p>
        </div>
      </ProtectedRoute>
    );
  }

  if (error || !session) {
    return (
      <ProtectedRoute>
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ background: "var(--page)" }}
        >
          <div className="text-center">
            <p className="text-sm mb-4" style={{ color: "var(--danger)" }}>
              {error || "Session not found."}
            </p>
            <button
              onClick={() => router.push("/dashboard")}
              className="text-sm hover:underline"
              style={{ color: "var(--accent)" }}
            >
              ← Dashboard
            </button>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  const s = session;
  const scores = s.scores ?? {};
  const overall = scores.overall;
  const overallColor =
    overall !== undefined
      ? overall >= 7
        ? "#22c55e"
        : overall >= 5
        ? "#f59e0b"
        : "var(--danger)"
      : "var(--ink-dim)";

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <ProtectedRoute>
      <div className="min-h-screen" style={{ background: "var(--page)" }}>

        {/* Nav */}
        <nav
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: "var(--surface)" }}
        >
          <span className="text-base font-bold tracking-tight" style={{ color: "var(--ink)" }}>
            InterviewX
          </span>
          <button
            onClick={() => router.push(plan.hasInsights ? "/dashboard" : "/companies")}
            className="text-sm hover:underline"
            style={{ color: "var(--ink-dim)" }}
          >
            {plan.hasInsights ? "← Dashboard" : "← Companies"}
          </button>
        </nav>

        <main className="max-w-2xl mx-auto px-6 py-10 fade-up space-y-8">

          {/* Header */}
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="font-display text-2xl font-bold" style={{ color: "var(--ink)" }}>
                Interview Results
              </h1>
              <span
                className="text-xs font-medium px-2.5 py-1 rounded-full"
                style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e" }}
              >
                Completed
              </span>
            </div>
            <p className="text-sm" style={{ color: "var(--ink-dim)" }}>
              Session #{s.id} · {formatDate(s.started_at)}
              {s.ended_at && ` → ${formatDate(s.ended_at)}`}
            </p>
          </div>

          {/* Overall score banner */}
          <div
            className="rounded-xl px-6 py-5 flex items-center gap-5"
            style={{
              background: "var(--surface)",
              border: `1px solid ${overall !== undefined ? overallColor + "40" : "var(--border-mid)"}`,
            }}
          >
            <div
              className="text-5xl font-black tabular-nums"
              style={{ color: overall !== undefined ? overallColor : "var(--ink-faint)" }}
            >
              {overall !== undefined ? overall : "—"}
              <span className="text-xl font-normal" style={{ color: "var(--ink-faint)" }}>
                /10
              </span>
            </div>
            <div>
              <p className="text-base font-semibold" style={{ color: "var(--ink)" }}>
                Overall Score
              </p>
              <p className="text-sm mt-0.5" style={{ color: "var(--ink-dim)" }}>
                {overall === undefined
                  ? "Scoring unavailable"
                  : overall >= 7
                  ? "Strong performance — you're well prepared."
                  : overall >= 5
                  ? "Good effort. A few areas to sharpen up."
                  : "Needs work. Review the feedback below carefully."}
              </p>
            </div>
          </div>

          {s.time_expired && (
            <div
              className="rounded-lg px-4 py-3 text-xs font-medium"
              style={{
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.25)",
                color: "var(--danger)",
              }}
            >
              This interview was automatically ended after reaching its {s.duration_minutes}-minute time limit.
            </div>
          )}

          {/* Score breakdown — paid plans only */}
          {plan.hasInsights ? (
            <div
              className="rounded-xl px-6 py-6"
              style={{ background: "var(--surface)", border: "1px solid var(--border-mid)" }}
            >
              <h2 className="text-sm font-semibold uppercase tracking-wider mb-6" style={{ color: "var(--ink-dim)" }}>
                Score breakdown
              </h2>
              <div className="flex justify-around">
                <ScoreRing value={scores.communication} label="Communication" />
                <ScoreRing value={scores.technical} label="Technical" />
                <ScoreRing value={scores.problem_solving} label="Problem solving" />
              </div>
            </div>
          ) : (
            <div
              className="rounded-xl px-6 py-5 text-center"
              style={{ background: "var(--surface)", border: "1px dashed var(--border-mid)" }}
            >
              <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
                Want the full breakdown?
              </p>
              <p className="text-sm mt-1" style={{ color: "var(--ink-dim)" }}>
                Upgrade to see your Communication, Technical, and Problem-solving scores plus AI insights on exactly what to improve.
              </p>
              <button
                onClick={() => router.push("/upgrade")}
                className="mt-4 px-5 py-2 rounded-full text-sm font-semibold"
                style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
              >
                See upgrade options →
              </button>
            </div>
          )}

          {/* Feedback */}
          {s.feedback && (
            <div
              className="rounded-xl px-6 py-5"
              style={{ background: "var(--surface)", border: "1px solid var(--border-mid)" }}
            >
              <h2 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--ink-dim)" }}>
                AI feedback
              </h2>
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--ink)" }}>
                {s.feedback}
              </p>
            </div>
          )}

          {/* AI Insights — topic breakdown + improvement areas, paid plans only */}
          {plan.hasInsights && s.insights && (s.insights.topics?.length || s.insights.improvement_areas?.length) ? (
            <div
              className="rounded-xl px-6 py-6"
              style={{ background: "var(--surface)", border: "1px solid var(--border-mid)" }}
            >
              <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--ink-dim)" }}>
                AI insights
              </h2>

              {s.insights.topics && s.insights.topics.length > 0 && (
                <div className="mb-6">
                  <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: "var(--ink-faint)" }}>
                    Topic-by-topic
                  </p>
                  <div className="space-y-3">
                    {s.insights.topics.map((t, i) => {
                      const color = t.score >= 7 ? "#22c55e" : t.score >= 5 ? "#f59e0b" : "var(--danger)";
                      return (
                        <div key={i} className="flex items-start gap-3">
                          <span
                            className="shrink-0 text-xs font-bold tabular-nums rounded-full w-8 h-8 flex items-center justify-center"
                            style={{ background: "var(--border-mid)", color }}
                          >
                            {t.score}
                          </span>
                          <div>
                            <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
                              {t.name}
                            </p>
                            <p className="text-xs mt-0.5" style={{ color: "var(--ink-dim)" }}>
                              {t.note}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {s.insights.improvement_areas && s.insights.improvement_areas.length > 0 && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: "var(--ink-faint)" }}>
                    Focus on next
                  </p>
                  <div className="space-y-3">
                    {s.insights.improvement_areas.map((a, i) => (
                      <div
                        key={i}
                        className="rounded-lg px-4 py-3"
                        style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)" }}
                      >
                        <p className="text-sm font-semibold" style={{ color: "var(--accent)" }}>
                          {a.area}
                        </p>
                        <p className="text-xs mt-1" style={{ color: "var(--ink-dim)" }}>
                          {a.suggestion}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {/* Transcript toggle */}
          {s.transcript && s.transcript.length > 0 && (
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: "1px solid var(--border-mid)" }}
            >
              <button
                onClick={() => setShowTranscript((v) => !v)}
                className="w-full flex items-center justify-between px-6 py-4"
                style={{ background: "var(--surface)" }}
              >
                <h2
                  className="text-sm font-semibold uppercase tracking-wider"
                  style={{ color: "var(--ink-dim)" }}
                >
                  Transcript ({s.transcript.length} messages)
                </h2>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  style={{
                    color: "var(--ink-faint)",
                    transform: showTranscript ? "rotate(180deg)" : "none",
                    transition: "transform 0.2s",
                  }}
                >
                  <path
                    d="M4 6l4 4 4-4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              {showTranscript && (
                <div
                  className="px-5 py-5 space-y-4 max-h-96 overflow-y-auto"
                  style={{ background: "var(--page)" }}
                >
                  {(s.transcript as { role: "user" | "ai"; text: string; ts: string }[]).map(
                    (msg, i) => (
                      <TranscriptBubble key={i} msg={msg} />
                    )
                  )}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pb-6">
            <button
              onClick={() => router.push("/companies")}
              className="flex-1 py-3 rounded-full text-sm font-semibold"
              style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
            >
              Practice again
            </button>
            {plan.hasInsights && (
              <button
                onClick={() => router.push("/dashboard")}
                className="flex-1 py-3 rounded-full text-sm font-semibold"
                style={{
                  background: "var(--surface)",
                  color: "var(--ink)",
                  border: "1px solid var(--border-mid)",
                }}
              >
                Dashboard
              </button>
            )}
          </div>

        </main>

        {showRealReportModal && (
          <RealInterviewReportModal
            sessionId={sessionId}
            onClose={dismissRealReportModal}
            onSubmitted={dismissRealReportModal}
          />
        )}
      </div>
    </ProtectedRoute>
  );
}