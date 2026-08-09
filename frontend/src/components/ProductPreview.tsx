"use client";

import { motion } from "framer-motion";

const CYCLE = 6.4;

const BARS = [0.35, 0.7, 0.45, 0.9, 0.5, 0.8, 0.4, 0.65, 0.3, 0.75];

export default function ProductPreview() {
  return (
    <div className="relative mx-auto max-w-3xl rounded-[28px] border border-white/50 bg-white/35 p-3 shadow-[0_20px_60px_rgba(28,26,22,0.12)] backdrop-blur-2xl">
      <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)]">
        {/* Fake window chrome */}
        <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--surface-2)] px-5 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[#E5A2A2]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#E8CE9B]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#A9CDB1]" />
          <span className="ml-3 rounded-full bg-white/70 px-3 py-1 text-[11px] font-medium text-[var(--ink-faint)]">
            interviewx.app/interview/live
          </span>
        </div>

        {/* Simulated session */}
        <div className="relative flex min-h-[260px] flex-col justify-center gap-5 px-6 py-10 sm:px-10">
          <motion.div
            animate={{
              opacity: [0, 1, 1, 1, 0, 0],
              y: [10, 0, 0, 0, -6, 10],
            }}
            transition={{ duration: CYCLE, times: [0, 0.05, 0.5, 0.85, 0.92, 1], repeat: Infinity }}
            className="max-w-md rounded-2xl rounded-tl-sm bg-[var(--surface-2)] px-5 py-4 text-left"
          >
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[var(--ink-faint)]">
              AI Interviewer
            </p>
            <p className="font-display text-base font-medium leading-snug text-[var(--ink)] sm:text-lg">
              &ldquo;Walk me through a time you disagreed with a decision — what did you do?&rdquo;
            </p>
          </motion.div>

          <motion.div
            animate={{ opacity: [0, 0, 1, 1, 0, 0] }}
            transition={{ duration: CYCLE, times: [0, 0.15, 0.22, 0.55, 0.62, 1], repeat: Infinity }}
            className="ml-auto flex max-w-md items-center gap-3 rounded-2xl rounded-tr-sm bg-[var(--ink)] px-5 py-4"
          >
            <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--accent-ink)] opacity-70">
              You
            </span>
            <div className="flex items-end gap-[3px]" aria-hidden>
              {BARS.map((h, i) => (
                <motion.span
                  key={i}
                  className="w-[3px] rounded-full bg-[var(--accent-ink)]"
                  style={{ height: 22 }}
                  animate={{ scaleY: [h * 0.4, h, h * 0.5, h * 0.9, h * 0.4] }}
                  transition={{
                    duration: 0.9,
                    repeat: Infinity,
                    delay: i * 0.07,
                    ease: "easeInOut",
                  }}
                />
              ))}
            </div>
          </motion.div>

          <motion.div
            animate={{ opacity: [0, 0, 0, 1, 1, 0], scale: [0.94, 0.94, 0.94, 1, 1, 0.96] }}
            transition={{ duration: CYCLE, times: [0, 0.6, 0.65, 0.7, 0.9, 1], repeat: Infinity }}
            className="mx-auto flex w-full max-w-md flex-col gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/70 px-5 py-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--ink-faint)]">
                Structure &amp; clarity
              </span>
              <span className="font-display text-sm font-semibold text-[var(--ink)]">8.6 / 10</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--border)]">
              <motion.div
                className="h-full rounded-full bg-[var(--ink)]"
                animate={{ width: ["0%", "0%", "0%", "86%", "86%", "0%"] }}
                transition={{ duration: CYCLE, times: [0, 0.6, 0.66, 0.78, 0.9, 1], repeat: Infinity }}
              />
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
