"use client";
import { createPortal } from "react-dom";

export const INTERVIEW_INSTRUCTIONS: string[] = [
  "Find a quiet, well-lit space free of distractions — treat this like the real thing.",
  "Once started, the interview can't be paused. Set aside the full session length before you begin.",
  "Answer as you naturally would — no notes, no searching, no outside help.",
  "You can type or speak your answers; the interviewer adapts follow-up questions based on what you say.",
  "At the end you'll get scored feedback (communication, technical, problem-solving, overall) with specific areas to improve.",
];

interface Props {
  companyName: string;
  roleTitle: string;
  roundTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirming?: boolean;
  error?: string;
}

export default function InterviewInstructionsModal({
  companyName,
  roleTitle,
  roundTitle,
  onConfirm,
  onCancel,
  confirming = false,
  error,
}: Props) {
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8"
      style={{ background: "rgba(6, 10, 20, 0.7)" }}
    >
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl fade-up shadow-[0_20px_60px_rgba(15,23,42,0.35)]"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div
          className="pointer-events-none absolute -top-24 -right-16 h-56 w-56 rounded-full blur-[90px]"
          style={{ background: "var(--accent-glow)" }}
        />

        <div className="relative px-5 sm:px-6 pt-6 pb-6">
          <h2 className="font-display text-xl sm:text-2xl font-semibold mb-1" style={{ color: "var(--ink)" }}>
            Before you begin
          </h2>
          <p className="text-sm mb-5" style={{ color: "var(--ink-dim)" }}>
            {companyName} · {roleTitle} · {roundTitle}
          </p>

          <ul className="space-y-3 mb-6">
            {INTERVIEW_INSTRUCTIONS.map((line, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm" style={{ color: "var(--ink)" }}>
                <span
                  className="mt-0.5 shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-semibold"
                  style={{ background: "var(--accent-glow)", color: "var(--accent)" }}
                >
                  {i + 1}
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>

          {error && (
            <p className="text-sm mb-4" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-3">
            <button
              onClick={onCancel}
              disabled={confirming}
              className="flex-1 py-3 rounded-full text-sm font-semibold transition-colors disabled:opacity-40"
              style={{ background: "var(--page)", color: "var(--ink)", border: "1px solid var(--border-mid)" }}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={confirming}
              className="flex-1 py-3 rounded-full text-sm font-semibold transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
              style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
            >
              {confirming ? "Starting…" : "I'm ready — start interview"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
