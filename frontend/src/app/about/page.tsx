"use client";

import { motion } from "framer-motion";
import MarketingNav from "@/components/MarketingNav";
import { ScrollReveal, GlassCard } from "@/components/ScrollReveal";

const VALUES = [
  { title: "Sourced, not scraped", body: "Every question comes from someone who actually sat in that interview — a current employee or a recently interviewed candidate. Nothing is pulled off generic forums." },
  { title: "Verified, not anonymous", body: "Contributors prove who they are with a company work email or offer letter before a single question of theirs goes live." },
  { title: "Pressure, not a quiz", body: "Our AI interviewer doesn't wait patiently for you to finish thinking. It paces, follows up, and pushes back — the way a real panel does." },
];

const VERIFY_STEPS = [
  { n: "01", title: "Contributor applies", body: "A current employee or a candidate who recently interviewed submits their questions." },
  { n: "02", title: "Proof is checked", body: "We verify identity with a company work email or a valid offer letter — no exceptions." },
  { n: "03", title: "Questions are reviewed", body: "Verified submissions are checked for accuracy before they enter the live question bank." },
  { n: "04", title: "You get the real thing", body: "You practice with what was actually asked, not a generic guess at it." },
];

const STATS = [
  { value: "100%", label: "Questions from verified contributors" },
  { value: "2", label: "Accepted proofs — work email or offer letter" },
  { value: "24/7", label: "AI interviewer available whenever you're ready" },
];

export default function About() {
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
          Interview prep built on proof, not guesswork.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mx-auto mt-6 max-w-2xl text-lg text-[var(--ink-dim)]"
        >
          Most prep platforms guess at what a company might ask. We don't. Our question
          bank is curated by people who actually work there, or who were interviewed
          there recently — every one of them verified with a work email or an offer
          letter. Then our AI interviewer puts you through the same pressure as the
          real room, so nothing on interview day feels unfamiliar.
        </motion.p>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-10">
        <ScrollReveal>
          <div className="rounded-[28px] border border-white/50 bg-white/35 p-8 shadow-[0_16px_50px_rgba(28,26,22,0.08)] backdrop-blur-2xl sm:p-12">
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
              {STATS.map((s) => (
                <div key={s.label} className="text-center">
                  <p className="font-display text-4xl font-semibold text-[var(--ink)]">{s.value}</p>
                  <p className="mt-2 text-sm text-[var(--ink-dim)]">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </ScrollReveal>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <ScrollReveal className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="font-display text-3xl font-semibold text-[var(--ink)]">What we care about</h2>
        </ScrollReveal>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {VALUES.map((v, i) => (
            <ScrollReveal key={v.title} delay={i * 0.1}>
              <GlassCard className="h-full">
                <h3 className="font-display text-lg font-semibold text-[var(--ink)]">{v.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--ink-dim)]">{v.body}</p>
              </GlassCard>
            </ScrollReveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <ScrollReveal className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="font-display text-3xl font-semibold text-[var(--ink)]">How we verify every question</h2>
          <p className="mt-4 text-[var(--ink-dim)]">
            No question reaches our bank without a real person and real proof behind it.
          </p>
        </ScrollReveal>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {VERIFY_STEPS.map((s, i) => (
            <ScrollReveal key={s.n} delay={i * 0.1}>
              <GlassCard hover={false} className="h-full bg-white/30">
                <span className="font-display text-3xl font-semibold text-[var(--ink-faint)]">{s.n}</span>
                <h3 className="mt-4 font-display text-lg font-semibold text-[var(--ink)]">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--ink-dim)]">{s.body}</p>
              </GlassCard>
            </ScrollReveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 pb-28">
        <ScrollReveal>
          <div className="rounded-[28px] border border-[var(--border)] bg-[var(--surface-2)] p-10 text-center sm:p-14">
            <h2 className="font-display text-2xl font-semibold text-[var(--ink)] sm:text-3xl">
              Our story is still being written.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[var(--ink-dim)]">
              We're an early-stage team building InterviewX one interview at a time.
              If you have feedback or want to work with us, we'd genuinely love to hear from you.
            </p>
          </div>
        </ScrollReveal>
      </section>

      <footer className="border-t border-[var(--border)] px-6 py-10 text-center text-xs text-[var(--ink-faint)]">
        © {new Date().getFullYear()} InterviewX
      </footer>
    </div>
  );
}
