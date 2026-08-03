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
}: {
  onSubmit: (design: string) => void;
  onCheckIn: (design: string) => void;
  submitting: boolean;
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
      <textarea
        value={text}
        onChange={handleChange}
        placeholder={PLACEHOLDER}
        rows={12}
        className="w-full px-4 py-3 text-sm font-mono leading-relaxed outline-none resize-y"
        style={{ background: "transparent", color: "var(--ink)" }}
      />
      <div className="flex justify-end px-4 py-2.5" style={{ borderTop: "1px solid var(--border-mid)" }}>
        <button
          onClick={handleSubmit}
          disabled={submitting || !text.trim()}
          className="px-4 py-1.5 rounded-full text-sm font-semibold transition-opacity disabled:opacity-40"
          style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
        >
          {submitting ? "Submitting…" : "Submit design"}
        </button>
      </div>
    </div>
  );
}
