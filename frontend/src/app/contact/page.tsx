"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import MarketingNav from "@/components/MarketingNav";
import { ScrollReveal } from "@/components/ScrollReveal";

const SUPPORT_EMAIL = "support@evalulabs.com";

const REASONS = [
  { title: "Technical issue", body: "Interview sessions not loading, voice mode misbehaving, or anything else that looks like a bug.", cta: "Report a bug" },
  { title: "Billing & plans", body: "Questions about your subscription, top-up packs, or a payment that didn't go through.", cta: "Ask about billing" },
  { title: "Everything else", body: "Feedback, partnership ideas, or anything you'd like us to know.", cta: "Say hello" },
];

const REASON_STYLES = [
  "border border-[var(--border)] bg-[var(--surface)]",
  "bg-[var(--lime)]",
  "border border-[var(--border)] bg-[var(--surface)]",
];

export default function Contact() {
  return (
    <div className="relative min-h-screen bg-[var(--page)]">
      <MarketingNav />

      <section className="mx-auto max-w-6xl px-6 pb-10 pt-40 sm:pt-48">
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-2 lg:items-end">
          <div>
            <div className="mb-7 inline-flex items-center gap-2.5 rounded-full border border-[var(--border-mid)] px-3.5 py-1.5 text-[13px] font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Usually reply within a working day
            </div>
            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="font-display text-5xl font-semibold leading-[0.95] tracking-tight text-[var(--ink)] sm:text-7xl"
            >
              We&apos;re here
              <br />
              to help.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mt-6 max-w-md text-lg leading-relaxed text-[var(--ink-dim)]"
            >
              Hit a technical issue, have a billing question, or just want to reach out?
              Email us and we&apos;ll get back to you as soon as we can.
            </motion.p>
          </div>
          <motion.a
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            href={`mailto:${SUPPORT_EMAIL}`}
            className="block rounded-3xl p-9 transition-transform duration-300 hover:scale-[1.015]"
            style={{ background: "var(--hero-bg)" }}
          >
            <p className="mb-5 text-xs font-semibold uppercase tracking-wider text-[var(--lime)]">Send an email</p>
            <p className="font-mono text-3xl font-semibold leading-tight text-[var(--hero-text)] sm:text-4xl">
              support@
              <br />
              evalulabs.com
            </p>
            <p className="mt-6 text-sm text-[var(--hero-text)] opacity-60">Real humans read every message.</p>
          </motion.a>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <ScrollReveal className="mb-12 max-w-2xl">
          <p className="mb-5 text-xs font-semibold uppercase tracking-wider text-[var(--ink-faint)]">What to reach out about</p>
          <h2 className="font-display text-4xl font-semibold leading-tight tracking-tight text-[var(--ink)] sm:text-5xl">
            Three inboxes, one address.
          </h2>
        </ScrollReveal>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {REASONS.map((r, i) => (
            <ScrollReveal key={r.title} delay={i * 0.1}>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className={`flex h-full min-h-[240px] flex-col justify-between rounded-3xl p-7 transition-colors duration-300 ${
                  REASON_STYLES[i]
                } ${i === 1 ? "hover:brightness-95" : "hover:border-[var(--border-mid)]"}`}
              >
                <div>
                  <h3 className="font-display text-lg font-semibold text-[var(--ink)]">{r.title}</h3>
                  <p className={`mt-2 text-sm leading-relaxed ${i === 1 ? "text-[var(--ink)]/80" : "text-[var(--ink-dim)]"}`}>
                    {r.body}
                  </p>
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--ink)] underline underline-offset-4">
                  {r.cta} →
                </span>
              </a>
            </ScrollReveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-28">
        <ScrollReveal>
          <div className="relative grid grid-cols-1 items-center gap-10 overflow-hidden rounded-[32px] px-8 py-16 sm:grid-cols-2 sm:px-16" style={{ background: "var(--hero-bg)" }}>
            <div className="pointer-events-none absolute -right-16 bottom-16 h-40 w-40 rounded-full opacity-90" style={{ background: "var(--lime)" }} />
            <div className="relative">
              <p className="mb-5 text-xs font-semibold uppercase tracking-wider text-[var(--lime)]">One address</p>
              <h2 className="font-display text-3xl font-semibold text-[var(--hero-text)] sm:text-4xl">
                Prefer email?
                <br />
                So do we.
              </h2>
              <p className="mt-4 max-w-sm text-[var(--hero-text)] opacity-70">
                Send us a note at the address below and we&apos;ll take it from there.
              </p>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="mt-8 inline-block rounded-full px-7 py-3.5 text-sm font-semibold text-[var(--ink)] transition-transform duration-300 hover:scale-[1.03] active:scale-[0.98]"
                style={{ background: "var(--lime)" }}
              >
                {SUPPORT_EMAIL}
              </a>
            </div>
            <div className="relative font-mono text-[13px] leading-loose text-[var(--ink-faint)]">
              <div>
                To: <span className="text-[var(--lime)]">{SUPPORT_EMAIL}</span>
              </div>
              <div className="text-[var(--hero-text)] opacity-70">From: you</div>
              <div className="text-[var(--hero-text)] opacity-70">Subject: [whatever you need]</div>
              <div className="mt-4 border-t border-[var(--hero-text)]/10 pt-4 text-[var(--hero-text)] opacity-70">
                Hey EvaluLabs —
              </div>
              <div className="mt-2 text-[var(--ink-faint)]">[your message here]</div>
            </div>
          </div>
        </ScrollReveal>
      </section>

      <footer className="mx-auto max-w-6xl px-6 pb-12 pt-4">
        <div className="flex items-center justify-between border-t border-[var(--border)] pt-6 text-xs text-[var(--ink-faint)]">
          <span>© {new Date().getFullYear()} EvaluLabs</span>
          <div className="flex gap-6">
            <Link href="/pricing" className="hover:opacity-70">Pricing</Link>
            <Link href="/about" className="hover:opacity-70">About</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
