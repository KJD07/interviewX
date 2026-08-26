"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

// How long the candidate has to stop typing before we send a lightweight
// "check-in" snapshot of their in-progress code, so the AI can start
// applying pressure before they hit Submit — mirrors a real interviewer
// glancing at the whiteboard mid-attempt.
const CHECKIN_DEBOUNCE_MS = 20000;

// @monaco-editor/react fetches its assets from a CDN at runtime with no
// built-in timeout — if that request stalls (blocked network, offline,
// slow CDN), its loading state spins forever and this panel replaces the
// whole reply box, so the candidate has no way to respond at all. Fall
// back to a plain textarea if Monaco hasn't mounted in time.
const MONACO_LOAD_TIMEOUT_MS = 8000;

const PLACEHOLDER: Record<string, string> = {
  javascript: "// Write your function here\n",
  typescript: "// Write your function here\n",
  python: "# Write your function here\n",
  java: "// Write your function here\n",
  "c++": "// Write your function here\n",
  go: "// Write your function here\n",
};

export default function CodeWorkspace({
  language,
  onSubmit,
  onCheckIn,
  submitting,
  busy,
}: {
  language: string;
  onSubmit: (code: string) => void;
  onCheckIn: (code: string) => void;
  submitting: boolean;
  // A chat message (e.g. a clarifying question) is in flight — block Submit
  // so the candidate can't stack two turns on top of each other.
  busy?: boolean;
}) {
  const [code, setCode] = useState(PLACEHOLDER[language.toLowerCase()] ?? "// Write your function here\n");
  const [monacoReady, setMonacoReady] = useState(false);
  const [monacoTimedOut, setMonacoTimedOut] = useState(false);
  const checkinTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCheckedInRef = useRef("");

  useEffect(() => {
    return () => {
      if (checkinTimerRef.current) clearTimeout(checkinTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (monacoReady) return;
    const t = setTimeout(() => setMonacoTimedOut(true), MONACO_LOAD_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [monacoReady]);

  const handleChange = (value: string | undefined) => {
    const next = value ?? "";
    setCode(next);
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
    lastCheckedInRef.current = code.trim();
    onSubmit(code);
  };

  return (
    <div
      className="rounded-xl overflow-hidden fade-up"
      style={{ border: "1px solid var(--border-mid)", background: "var(--surface)" }}
    >
      <div
        className="flex items-center justify-between px-4 py-2 text-xs font-semibold"
        style={{ borderBottom: "1px solid var(--border-mid)", color: "var(--ink-dim)" }}
      >
        <span>Code editor · {language}</span>
        <span style={{ color: "var(--ink-faint)" }}>Write just the function — no need for boilerplate</span>
      </div>
      {monacoTimedOut && !monacoReady ? (
        <div>
          <p
            className="px-4 pt-3 text-xs"
            style={{ color: "var(--ink-faint)" }}
          >
            The code editor didn't load in time, so here's a plain text box instead — you can still write and submit code.
          </p>
          <textarea
            value={code}
            onChange={(e) => handleChange(e.target.value)}
            rows={8}
            className="w-full px-4 py-3 text-sm font-mono focus:outline-none"
            style={{ background: "var(--surface)", color: "var(--ink)" }}
            spellCheck={false}
          />
        </div>
      ) : (
        <MonacoEditor
          height="280px"
          language={language.toLowerCase()}
          theme="vs-dark"
          value={code}
          onChange={handleChange}
          onMount={() => setMonacoReady(true)}
          options={{
            fontSize: 13,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
          }}
        />
      )}
      <div className="flex items-center justify-end sm:justify-between gap-3 px-4 py-2.5" style={{ borderTop: "1px solid var(--border-mid)" }}>
        <p className="hidden sm:block text-[11px] leading-snug" style={{ color: "var(--ink-faint)" }}>
          Stuck on the requirements? Ask the interviewer in the chat below.
        </p>
        <button
          onClick={handleSubmit}
          disabled={submitting || busy || !code.trim()}
          className="px-4 py-1.5 rounded-full text-sm font-semibold transition-opacity disabled:opacity-40"
          style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
        >
          {submitting ? "Submitting…" : "Submit code"}
        </button>
      </div>
    </div>
  );
}
