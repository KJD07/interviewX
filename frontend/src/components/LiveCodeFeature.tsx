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
      className="card-hover flex h-full flex-col justify-between overflow-hidden rounded-[20px] p-[26px]"
      style={{ background: "var(--hero-bg)", color: "var(--hero-text)" }}
    >
      <div>
        <span
          className="inline-flex w-fit items-center rounded-[5px] px-[9px] py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em]"
          style={{ background: "var(--lime)", color: "var(--ink)" }}
        >
          Editable demo
        </span>
        <h3 className="font-display mt-[18px] text-[26px] font-bold leading-tight tracking-[-0.02em]">
          Live coding editor
        </h3>
        <p className="mt-2.5 text-sm leading-[1.55]" style={{ color: "#A3A29A" }}>
          Coding rounds run in a real editor — syntax highlighting, multiple languages, no
          switching to a notepad.
        </p>
      </div>
      <div className="mt-5 overflow-hidden rounded-[14px] border" style={{ borderColor: "rgba(255,255,255,0.09)" }}>
        <div
          className="flex items-center justify-between px-3.5 py-2.5 font-mono text-[11px]"
          style={{ background: "#17171A", color: "#7E7D74", borderBottom: "1px solid rgba(255,255,255,0.09)" }}
        >
          <span>solution.js</span>
          <span style={{ color: "var(--lime)" }}>edit me →</span>
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
