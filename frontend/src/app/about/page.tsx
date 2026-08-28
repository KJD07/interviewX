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

      <section className="mx-auto max-w-[1180px] px-6 pt-32 sm:px-8 sm:pt-36">
        <div className="mb-6 inline-flex items-center rounded-full border border-[var(--border-mid)] bg-[var(--surface)] px-3.5 py-[7px] font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--ink)]">
          About EvaluLabs
        </div>
        <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-[52px]">
          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="font-display text-[42px] font-bold leading-[0.94] tracking-[-0.035em] text-[var(--ink)] sm:text-[68px]"
          >
            Interview prep built on <em className="font-accent">proof</em>, not guesswork.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mt-2 text-base leading-[1.6] text-[var(--ink-dim)]"
          >
            Most prep platforms guess at what a company might ask. We don&apos;t. Our question
            bank is curated by people who actually work there, or who were interviewed
            there recently — every one verified with a work email or an offer letter. Then
            our AI interviewer puts you through the same pressure as the real room.
          </motion.p>
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-6 pt-[52px] sm:px-8">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {STATS.map((s, i) => (
            <ScrollReveal key={s.label} delay={i * 0.08}>
              <div className={`h-full rounded-[20px] p-[26px] ${STAT_STYLES[i]}`}>
                <p className="font-display text-5xl font-bold leading-none tracking-[-0.04em]">{s.value}</p>
                <p
                  className={`mt-2 text-sm leading-relaxed ${
                    i === 2 ? "text-[#A3A29A]" : i === 1 ? "text-[#3C4118]" : "text-[var(--ink-dim)]"
                  }`}
                >
                  {s.label}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-6 pt-[88px] sm:px-8">
        <ScrollReveal className="mb-9 max-w-[620px]">
          <div className="font-label mb-3.5">What we care about</div>
          <h2 className="font-display text-[32px] font-bold leading-[1.04] tracking-[-0.032em] text-[var(--ink)] sm:text-[40px]">
            Three ideas that shape every part of the product.
          </h2>
        </ScrollReveal>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 lg:gap-[26px]">
          {VALUES.map((v, i) => (
            <ScrollReveal key={v.title} delay={i * 0.1}>
              <div className="h-full border-t border-[var(--border-mid)] pt-4">
                <div className="mb-[26px] font-mono text-xs text-[var(--olive)]">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <h3 className="text-[17px] font-semibold text-[var(--ink)]">{v.title}</h3>
                <p className="mt-2 text-sm leading-[1.6] text-[var(--ink-dim)]">{v.body}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-6 pt-[88px] sm:px-8">
        <ScrollReveal className="mb-8">
          <div className="font-label mb-3.5">How verification works</div>
          <h2 className="font-display max-w-[520px] text-[32px] font-bold leading-[1.04] tracking-[-0.032em] text-[var(--ink)] sm:text-[40px]">
            How we verify every question.
          </h2>
          <p className="mt-2.5 max-w-[420px] text-[15px] leading-[1.6] text-[var(--ink-dim)]">
            No question reaches our bank without a real person and real proof behind it.
          </p>
        </ScrollReveal>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {VERIFY_STEPS.map((s, i) => (
            <ScrollReveal key={s.n} delay={i * 0.1}>
              <div className={`flex h-full min-h-[190px] flex-col rounded-[18px] p-[22px] ${VERIFY_STYLES[i]}`}>
                <span
                  className={`font-mono text-[11px] ${
                    i === 3 ? "text-[var(--lime)]" : i === 2 ? "text-[#5E6A16]" : "text-[var(--ink-faint)]"
                  }`}
                >
                  {s.n}
                </span>
                <h3 className="mb-2 mt-auto text-base font-semibold">{s.title}</h3>
                <p
                  className={`text-[13px] leading-[1.55] ${
                    i === 3 ? "text-[#A3A29A]" : i === 2 ? "text-[#3C4118]" : "text-[var(--ink-dim)]"
                  }`}
                >
                  {s.body}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-6 pt-24 sm:px-8">
        <ScrollReveal>
          <div
            className="relative overflow-hidden rounded-[28px] px-8 py-14 sm:px-[54px] sm:py-[58px]"
            style={{ background: "var(--hero-bg)" }}
          >
            <div
              className="el-float pointer-events-none absolute -left-[60px] -top-[90px] h-[250px] w-[250px] rounded-full"
              style={{ background: "var(--lime)" }}
            />
            <div className="relative ml-auto max-w-[560px]">
              <h2 className="font-display text-[32px] font-bold leading-[1.02] tracking-[-0.032em] text-[var(--hero-text)] sm:text-[42px]">
                Our story is still being written.
              </h2>
              <p className="mt-4 text-[15px] leading-[1.6] text-[#A3A29A]">
                We&apos;re an early-stage team building EvaluLabs one interview at a time.
                If you have feedback or want to work with us, we&apos;d genuinely love to hear from you.
              </p>
              <Link
                href="/contact"
                className="mt-7 inline-block rounded-full px-7 py-[15px] text-[15px] font-bold text-[var(--ink)] hover:brightness-95"
                style={{ background: "var(--lime)" }}
              >
                Get in touch →
              </Link>
            </div>
          </div>
        </ScrollReveal>
      </section>

      <footer className="mx-auto max-w-[1180px] px-6 pb-10 pt-16 sm:px-8">
        <div className="flex items-center justify-between border-t border-[var(--border-mid)] pt-[26px] text-[13px] text-[var(--ink-faint)]">
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
