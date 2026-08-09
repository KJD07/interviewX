"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

const DEFAULT_CODE = `function twoSum(nums, target) {
  const seen = new Map();
  for (let i = 0; i < nums.length; i++) {
    const need = target - nums[i];
    if (seen.has(need)) return [seen.get(need), i];
    seen.set(nums[i], i);
  }
  return [];
}

twoSum([2, 7, 11, 15], 9);
`;

export default function LiveCodeFeature() {
  const [code, setCode] = useState(DEFAULT_CODE);

  return (
    <div className="col-span-1 sm:col-span-2 lg:col-span-3 overflow-hidden rounded-3xl border border-white/50 bg-white/[0.65] shadow-[0_8px_32px_rgba(28,26,22,0.06)] backdrop-blur-sm">
      <div className="flex flex-col gap-1 p-6 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-display text-lg font-semibold text-[var(--ink)]">Live coding editor</h3>
          <p className="mt-1 text-sm leading-relaxed text-[var(--ink-dim)]">
            Real coding rounds run in a real editor, syntax highlighting, multiple languages, no context switching to a
            notepad. Try it right here.
          </p>
        </div>
        <span className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-full border border-[var(--border)] bg-white/60 px-3 py-1 text-xs font-medium text-[var(--ink-faint)] sm:mt-0">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Editable demo
        </span>
      </div>
      <div className="overflow-hidden rounded-b-3xl border-t border-[var(--border)]">
        <div className="flex items-center justify-between px-4 py-2 text-xs font-semibold text-[var(--ink-dim)]" style={{ background: "var(--surface)" }}>
          <span>solution.js</span>
          <span className="text-[var(--ink-faint)]">Edit the code, it's live</span>
        </div>
        <MonacoEditor
          height="220px"
          defaultLanguage="javascript"
          theme="vs-dark"
          value={code}
          onChange={(v) => setCode(v ?? "")}
          loading={<div className="flex h-[220px] items-center justify-center text-xs text-[var(--ink-faint)]" style={{ background: "#1e1e1e" }}>Loading editor…</div>}
          options={{
            fontSize: 13,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            padding: { top: 12 },
          }}
        />
      </div>
    </div>
  );
}
