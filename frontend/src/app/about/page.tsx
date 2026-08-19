"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import MarketingNav from "@/components/MarketingNav";
import { ScrollReveal } from "@/components/ScrollReveal";

const VALUES = [
  { title: "Sourced, not scraped", body: "Every question comes from someone who actually sat in that interview - a current employee or a recently interviewed candidate. Nothing is pulled off generic forums." },
  { title: "Verified, not anonymous", body: "Contributors prove who they are with a company work email or offer letter before a single question of theirs goes live." },
  { title: "Pressure, not a quiz", body: "Our AI interviewer doesn't wait patiently for you to finish thinking. It paces, follows up, and pushes back - the way a real panel does." },
];

const VERIFY_STEPS = [
  { n: "01", title: "Contributor applies", body: "A current employee or a candidate who recently interviewed submits their questions." },
  { n: "02", title: "Proof is checked", body: "We verify identity with a company work email or a valid offer letter - no exceptions." },
  { n: "03", title: "Questions are reviewed", body: "Verified submissions are checked for accuracy before they enter the live question bank." },
  { n: "04", title: "You get the real thing", body: "You practice with what was actually asked, not a generic guess at it." },
];

const STATS = [
  { value: "100%", label: "Questions from verified contributors" },
  { value: "2", label: "Accepted proofs - work email or offer letter" },
  { value: "24/7", label: "AI interviewer available whenever you're ready" },
];

const STAT_STYLES = [
  "border border-[var(--border)] bg-[var(--surface)]",
  "bg-[var(--lime)]",
  "bg-[var(--ink)] text-[var(--page)]",
];

const VERIFY_STYLES = [
  "border border-[var(--border)] bg-[var(--surface)]",
  "border border-[var(--border)] bg-[var(--surface)]",
  "bg-[var(--lime)]",
  "bg-[var(--ink)] text-[var(--page)]",
];

export default function About() {
  return (
    <div className="relative min-h-screen bg-[var(--page)]">
      <MarketingNav />

      <section className="mx-auto max-w-4xl px-6 pb-14 pt-40 sm:pt-48">
        <div className="mb-7 inline-flex items-center rounded-full border border-[var(--border-mid)] px-3.5 py-1.5 text-[13px] font-medium">
          About EvaluLabs
        </div>
        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="font-display max-w-3xl text-5xl font-semibold tracking-tight text-[var(--ink)] sm:text-7xl"
        >
          Interview prep built on <em className="font-accent">proof</em>, not guesswork.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mt-6 max-w-2xl text-lg leading-relaxed text-[var(--ink-dim)]"
        >
          Most prep platforms guess at what a company might ask. We don&apos;t. Our question
          bank is curated by people who actually work there, or who were interviewed
          there recently — every one of them verified with a work email or an offer
          letter. Then our AI interviewer puts you through the same pressure as the real room.
        </motion.p>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {STATS.map((s, i) => (
            <ScrollReveal key={s.label} delay={i * 0.08}>
              <div className={`h-full rounded-3xl p-8 ${STAT_STYLES[i]}`}>
                <p className="font-display mb-4 text-6xl font-semibold leading-none tracking-tight">{s.value}</p>
                <p
                  className={`text-sm leading-relaxed ${
                    i === 2 ? "text-[var(--page)]/70" : "text-[var(--ink-dim)]"
                  }`}
                >
                  {s.label}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <ScrollReveal className="mb-14 max-w-2xl">
          <p className="mb-5 text-xs font-semibold uppercase tracking-wider text-[var(--ink-faint)]">What we care about</p>
          <h2 className="font-display text-4xl font-semibold leading-tight tracking-tight text-[var(--ink)] sm:text-5xl">
            Three ideas that shape every part of the product.
          </h2>
        </ScrollReveal>
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          {VALUES.map((v, i) => (
            <ScrollReveal key={v.title} delay={i * 0.1}>
              <div className="h-full border-t border-[var(--ink)] pt-6">
                <div className="mb-14 text-sm font-semibold text-[var(--ink)]">{String(i + 1).padStart(2, "0")}</div>
                <h3 className="font-display text-lg font-semibold text-[var(--ink)]">{v.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-[var(--ink-dim)]">{v.body}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-12 flex flex-wrap items-end justify-between gap-10">
          <ScrollReveal className="max-w-2xl">
            <p className="mb-5 text-xs font-semibold uppercase tracking-wider text-[var(--ink-faint)]">How verification works</p>
            <h2 className="font-display text-4xl font-semibold leading-tight tracking-tight text-[var(--ink)] sm:text-5xl">
              How we verify every question.
            </h2>
          </ScrollReveal>
          <p className="max-w-sm text-base leading-relaxed text-[var(--ink-dim)]">
            No question reaches our bank without a real person and real proof behind it.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {VERIFY_STEPS.map((s, i) => (
            <ScrollReveal key={s.n} delay={i * 0.1}>
              <div className={`flex h-full min-h-[220px] flex-col justify-between rounded-3xl p-7 ${VERIFY_STYLES[i]}`}>
                <span
                  className={`text-sm font-semibold ${
                    i === 3 ? "text-[var(--lime)]" : "text-[var(--ink)]"
                  }`}
                >
                  {s.n}
                </span>
                <div>
                  <h3 className="mt-4 font-display text-lg font-semibold">{s.title}</h3>
                  <p
                    className={`mt-2 text-sm leading-relaxed ${
                      i === 3 ? "text-[var(--page)]/70" : "text-[var(--ink-dim)]"
                    }`}
                  >
                    {s.body}
                  </p>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-28">
        <ScrollReveal>
          <div className="relative overflow-hidden rounded-[32px] px-8 py-16 sm:px-16" style={{ background: "var(--hero-bg)" }}>
            <div className="pointer-events-none absolute -top-16 -left-16 h-56 w-56 rounded-full opacity-90" style={{ background: "var(--lime)" }} />
            <div className="relative ml-auto max-w-xl">
              <h2 className="font-display text-3xl font-semibold text-[var(--hero-text)] sm:text-4xl">
                Our story is still being written.
              </h2>
              <p className="mt-4 text-[var(--hero-text)] opacity-70">
                We&apos;re an early-stage team building EvaluLabs one interview at a time.
                If you have feedback or want to work with us, we&apos;d genuinely love to hear from you.
              </p>
              <Link
                href="/contact"
                className="mt-8 inline-block rounded-full px-7 py-3.5 text-sm font-semibold text-[var(--ink)] transition-transform duration-300 hover:scale-[1.03] active:scale-[0.98]"
                style={{ background: "var(--lime)" }}
              >
                Get in touch →
              </Link>
            </div>
          </div>
        </ScrollReveal>
      </section>

      <footer className="mx-auto max-w-6xl px-6 pb-12 pt-4">
        <div className="flex items-center justify-between border-t border-[var(--border)] pt-6 text-xs text-[var(--ink-faint)]">
          <span>© {new Date().getFullYear()} EvaluLabs</span>
          <div className="flex gap-6">
            <Link href="/pricing" className="hover:opacity-70">Pricing</Link>
            <Link href="/contact" className="hover:opacity-70">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
