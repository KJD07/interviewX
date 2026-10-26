"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

// Same fallback as the interview CodeWorkspace: Monaco loads from a CDN with
// no timeout, so swap in a plain textarea if it hasn't mounted in time.
const MONACO_LOAD_TIMEOUT_MS = 8000;

export const LANGUAGES = ["python", "javascript", "typescript", "java", "cpp", "go", "sql"] as const;
const LABELS: Record<string, string> = {
  python: "Python", javascript: "JavaScript", typescript: "TypeScript", java: "Java", cpp: "C++", go: "Go", sql: "SQL",
};

export function normaliseLanguage(lang: string): string {
  const l = (lang || "").toLowerCase();
  if (l === "c++") return "cpp";
  return (LANGUAGES as readonly string[]).includes(l) ? l : "python";
}

export default function PracticeCodeEditor({
  code,
  language,
  onCode,
  onLanguage,
  readOnly,
}: {
  code: string;
  language: string;
  onCode: (code: string) => void;
  onLanguage: (lang: string) => void;
  readOnly?: boolean;
}) {
  const [ready, setReady] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (ready) return;
    const t = setTimeout(() => setTimedOut(true), MONACO_LOAD_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [ready]);

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-mid)", background: "var(--surface)" }}>
      <div
        className="flex items-center justify-between gap-3 px-4 py-2 text-xs font-semibold"
        style={{ borderBottom: "1px solid var(--border-mid)", color: "var(--ink-dim)" }}
      >
        <span>Code editor</span>
        <select
          value={language}
          onChange={(e) => onLanguage(e.target.value)}
          disabled={readOnly}
          aria-label="Language"
          className="bg-transparent text-xs font-semibold focus:outline-none cursor-pointer"
          style={{ color: "var(--ink)" }}
        >
          {LANGUAGES.map((l) => <option key={l} value={l}>{LABELS[l]}</option>)}
        </select>
      </div>
      {timedOut && !ready ? (
        <div>
          <p className="px-4 pt-3 text-xs" style={{ color: "var(--ink-faint)" }}>
            The code editor didn&apos;t load in time, so here&apos;s a plain text box instead.
          </p>
          <textarea
            value={code}
            onChange={(e) => onCode(e.target.value)}
            readOnly={readOnly}
            rows={14}
            className="w-full px-4 py-3 text-sm font-mono focus:outline-none"
            style={{ background: "var(--surface)", color: "var(--ink)" }}
            spellCheck={false}
          />
        </div>
      ) : (
        <MonacoEditor
          height="340px"
          language={language}
          theme="vs-dark"
          value={code}
          onChange={(v) => onCode(v ?? "")}
          onMount={() => setReady(true)}
          options={{
            fontSize: 13,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            readOnly,
            tabSize: 4,
          }}
        />
      )}
    </div>
  );
}
