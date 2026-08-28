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
    <div
      className="card-hover flex h-full flex-col justify-between overflow-hidden rounded-[24px] p-6"
      style={{ background: "var(--hero-bg)", color: "var(--hero-text)" }}
    >
      <div>
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide" style={{ background: "rgba(232,255,61,0.15)", color: "var(--lime)" }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--lime)" }} />
          Editable demo
        </span>
        <h3 className="font-display mt-4 text-xl font-semibold leading-tight">Live coding editor</h3>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: "rgba(246,245,241,0.6)" }}>
          Real coding rounds run in a real editor, syntax highlighting, multiple languages, no context switching to a
          notepad. Try it right here.
        </p>
      </div>
      <div className="mt-6 overflow-hidden rounded-2xl border" style={{ borderColor: "rgba(246,245,241,0.08)" }}>
        <div
          className="flex items-center justify-between px-4 py-2 text-xs font-semibold"
          style={{ background: "#1E1E18", color: "rgba(246,245,241,0.5)", borderBottom: "1px solid rgba(246,245,241,0.08)" }}
        >
          <span>solution.js</span>
          <span>Edit the code, it&apos;s live</span>
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
