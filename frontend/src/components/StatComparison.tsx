"use client";

import { motion } from "framer-motion";

const ROWS = [
  { label: "Recycled question banks", value: 30 },
  { label: "Practicing alone", value: 45 },
  { label: "InterviewX", value: 92, highlight: true },
];

export default function StatComparison() {
  return (
    <div className="mx-auto max-w-2xl rounded-[28px] border border-white/50 bg-white/35 p-8 shadow-[0_20px_60px_rgba(28,26,22,0.1)] backdrop-blur-2xl sm:p-10">
      <p className="mb-8 text-center text-xs font-medium uppercase tracking-wide text-[var(--ink-faint)]">
        How close it feels to the real thing*
      </p>

      <div className="flex flex-col gap-6">
        {ROWS.map((row, i) => (
          <div key={row.label}>
            <div className="mb-2 flex items-baseline justify-between">
              <span
                className={`text-sm font-medium ${
                  row.highlight ? "text-[var(--ink)]" : "text-[var(--ink-dim)]"
                }`}
              >
                {row.label}
              </span>
              <motion.span
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.3 + i * 0.15 }}
                className={`font-display text-sm font-semibold ${
                  row.highlight ? "text-[var(--ink)]" : "text-[var(--ink-faint)]"
                }`}
              >
                {row.value}%
              </motion.span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
              <motion.div
                initial={{ width: "0%" }}
                whileInView={{ width: `${row.value}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.9, delay: i * 0.15, ease: [0.22, 1, 0.36, 1] }}
                className={`h-full rounded-full ${
                  row.highlight ? "bg-[var(--ink)]" : "bg-[var(--border-mid)]"
                }`}
              />
            </div>
          </div>
        ))}
      </div>

      <p className="mt-8 text-center text-xs text-[var(--ink-faint)]">
        *Illustrative comparison based on question relevance and interview-style pacing.
      </p>
    </div>
  );
}
