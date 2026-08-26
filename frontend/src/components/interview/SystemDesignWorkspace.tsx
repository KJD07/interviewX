"use client";
import { useEffect, useRef, useState } from "react";

// Mirrors CodeWorkspace's debounced check-in behavior — see that file.
const CHECKIN_DEBOUNCE_MS = 20000;

const PLACEHOLDER = `Components:
- ...

APIs:
- ...

Data flow:
- ...

Tradeoffs:
- ...`;

export default function SystemDesignWorkspace({
  onSubmit,
  onCheckIn,
  submitting,
  busy,
}: {
  onSubmit: (design: string) => void;
  onCheckIn: (design: string) => void;
  submitting: boolean;
  // A chat message (e.g. a clarifying question) is in flight — block Submit
  // so the candidate can't stack two turns on top of each other.
  busy?: boolean;
}) {
  const [text, setText] = useState("");
  const checkinTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCheckedInRef = useRef("");

  useEffect(() => {
    return () => {
      if (checkinTimerRef.current) clearTimeout(checkinTimerRef.current);
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    setText(next);
    if (checkinTimerRef.current) clearTimeout(checkinTimerRef.current);
    checkinTimerRef.current = setTimeout(() => {
      const trimmed = next.trim();
      if (trimmed && trimmed !== lastCheckedInRef.current) {
        lastCheckedInRef.current = trimmed;
        onCheckIn(next);
      }
    }, CHECKIN_DEBOUNCE_MS);
  };

  const handleSubmit = () => {
    if (checkinTimerRef.current) clearTimeout(checkinTimerRef.current);
    lastCheckedInRef.current = text.trim();
    onSubmit(text);
  };

  return (
    <div
      className="rounded-xl overflow-hidden fade-up"
      style={{ border: "1px solid var(--border-mid)", background: "var(--surface)" }}
    >
      <div
        className="px-4 py-2 text-xs font-semibold"
        style={{ borderBottom: "1px solid var(--border-mid)", color: "var(--ink-dim)" }}
      >
        System design write-up
      </div>
      {/* Shorter than it used to be: the reply box now sits underneath this
          panel (so clarifying questions are possible mid-problem), and a
          12-row write-up plus that box left almost no room for the transcript
          on a laptop, let alone a phone. Still drag-resizable. */}
      <textarea
        value={text}
        onChange={handleChange}
        placeholder={PLACEHOLDER}
        rows={6}
        className="w-full px-4 py-3 text-sm font-mono leading-relaxed outline-none resize-y min-h-[132px] sm:min-h-[220px]"
        style={{ background: "transparent", color: "var(--ink)" }}
      />
      <div className="flex items-center justify-end sm:justify-between gap-3 px-4 py-2.5" style={{ borderTop: "1px solid var(--border-mid)" }}>
        <p className="hidden sm:block text-[11px] leading-snug" style={{ color: "var(--ink-faint)" }}>
          Scope it first — ask the interviewer about scale, traffic and constraints in the chat below.
        </p>
        <button
          onClick={handleSubmit}
          disabled={submitting || busy || !text.trim()}
          className="px-4 py-1.5 rounded-full text-sm font-semibold transition-opacity disabled:opacity-40"
          style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
        >
          {submitting ? "Submitting…" : "Submit design"}
        </button>
      </div>
    </div>
  );
}
