"use client";

import { motion } from "framer-motion";
import MarketingNav from "@/components/MarketingNav";
import { ScrollReveal, GlassCard } from "@/components/ScrollReveal";

const SUPPORT_EMAIL = "support@evalulabs.com";

const REASONS = [
  { title: "Technical issue", body: "Interview sessions not loading, voice mode misbehaving, or anything else that looks like a bug." },
  { title: "Billing & plans", body: "Questions about your subscription, top-up packs, or a payment that didn't go through." },
  { title: "Everything else", body: "Feedback, partnership ideas, or anything you'd like us to know." },
];

export default function Contact() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--page)]">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 right-1/4 h-[480px] w-[480px] rounded-full bg-[var(--accent-glow)] blur-[120px]" />
        <div className="absolute bottom-0 -left-32 h-[400px] w-[400px] rounded-full bg-[var(--surface-2)] blur-[100px]" />
      </div>

      <MarketingNav />

      <section className="mx-auto max-w-4xl px-6 pb-16 pt-40 text-center sm:pt-48">
        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="font-display text-4xl font-semibold tracking-tight text-[var(--ink)] sm:text-5xl"
        >
          We're here to help.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mx-auto mt-6 max-w-2xl text-lg text-[var(--ink-dim)]"
        >
          Hit a technical issue, have a billing question, or just want to reach out?
          Email us and we'll get back to you as soon as we can.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-8"
        >
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--ink)] px-6 py-3 text-sm font-semibold text-[var(--page)] transition-transform duration-300 hover:scale-[1.03] active:scale-[0.98]"
          >
            {SUPPORT_EMAIL}
          </a>
        </motion.div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <ScrollReveal className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="font-display text-3xl font-semibold text-[var(--ink)]">What to reach out about</h2>
        </ScrollReveal>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {REASONS.map((r, i) => (
            <ScrollReveal key={r.title} delay={i * 0.1}>
              <GlassCard className="h-full">
                <h3 className="font-display text-lg font-semibold text-[var(--ink)]">{r.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--ink-dim)]">{r.body}</p>
              </GlassCard>
            </ScrollReveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 pb-28">
        <ScrollReveal>
          <div className="rounded-[28px] border border-[var(--border)] bg-[var(--surface-2)] p-10 text-center sm:p-14">
            <h2 className="font-display text-2xl font-semibold text-[var(--ink)] sm:text-3xl">
              Prefer email? So do we.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[var(--ink-dim)]">
              Send us a note at{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-[var(--ink)] underline underline-offset-4">
                {SUPPORT_EMAIL}
              </a>{" "}
              and we'll take it from there.
            </p>
          </div>
        </ScrollReveal>
      </section>

      <footer className="border-t border-[var(--border)] px-6 py-10 text-center text-xs text-[var(--ink-faint)]">
        © {new Date().getFullYear()} EvaluLabs
      </footer>
    </div>
  );
}
