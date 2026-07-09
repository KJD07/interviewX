"use client";

import { motion } from "framer-motion";
import MarketingNav from "@/components/MarketingNav";

export default function Career() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--page)]">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-1/3 left-1/2 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-[var(--accent-glow)] blur-[130px]" />
      </div>

      <MarketingNav />

      <section className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="rounded-[28px] border border-white/50 bg-white/40 px-10 py-16 shadow-[0_16px_50px_rgba(28,26,22,0.08)] backdrop-blur-2xl sm:px-16"
        >
          <span className="text-3xl">✦</span>
          <h1 className="mt-5 font-display text-3xl font-semibold text-[var(--ink)] sm:text-4xl">
            Careers at InterviewX
          </h1>
          <p className="mx-auto mt-4 max-w-md text-[var(--ink-dim)]">
            We're not hiring publicly just yet — but we're growing fast.
            Check back soon for open roles.
          </p>
        </motion.div>
      </section>
    </div>
  );
}
