"use client";

import { motion } from "framer-motion";
import MarketingNav from "@/components/MarketingNav";
import MarketingFooter from "@/components/MarketingFooter";
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

      <section className="mx-auto max-w-[1180px] px-6 pt-32 sm:px-8 sm:pt-36">
        <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-[var(--border-mid)] bg-[var(--surface)] py-[7px] pl-[11px] pr-3.5">
              <span className="el-pulse h-[7px] w-[7px] rounded-full bg-[var(--success)]" />
              <span className="font-mono text-[11px] uppercase tracking-[0.06em]">
                Usually reply within a working day
              </span>
            </div>
            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="font-display text-[42px] font-bold leading-[0.94] tracking-[-0.035em] text-[var(--ink)] sm:text-[68px]"
            >
              We&apos;re here to help.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mt-5 max-w-[420px] text-[17px] leading-[1.55] text-[var(--ink-dim)]"
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
            className="relative block overflow-hidden rounded-[24px] p-8 transition-transform duration-300 hover:scale-[1.015]"
            style={{ background: "var(--hero-bg)" }}
          >
            <div
              className="pointer-events-none absolute -bottom-20 -right-20 h-[200px] w-[200px] rounded-full opacity-[0.12]"
              style={{ background: "var(--lime)" }}
            />
            <p className="relative mb-4 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--lime)]">
              Send an email
            </p>
            <p className="relative break-all font-mono text-[26px] font-bold leading-[1.25] tracking-[-0.02em] text-[var(--hero-text)]">
              support@
              <br />
              evalulabs.com
            </p>
            <p className="relative mt-3.5 text-sm text-[#A3A29A]">Real humans read every message.</p>
          </motion.a>
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-6 pt-20 sm:px-8">
        <ScrollReveal className="mb-7">
          <div className="font-label mb-3.5">What to reach out about</div>
          <h2 className="font-display text-[32px] font-bold leading-[1.04] tracking-[-0.032em] text-[var(--ink)] sm:text-[40px]">
            Three inboxes, one address.
          </h2>
        </ScrollReveal>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {REASONS.map((r, i) => (
            <ScrollReveal key={r.title} delay={i * 0.1}>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className={`flex h-full min-h-[230px] flex-col rounded-[20px] p-[26px] transition-colors duration-300 ${
                  REASON_STYLES[i]
                } ${i === 1 ? "hover:brightness-95" : "hover:border-[var(--border-mid)]"}`}
              >
                <h3 className="font-display text-[21px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
                  {r.title}
                </h3>
                <p className={`mt-2.5 text-sm leading-[1.6] ${i === 1 ? "text-[#3C4118]" : "text-[var(--ink-dim)]"}`}>
                  {r.body}
                </p>
                <span className="mt-auto self-start border-b border-[var(--ink)] pb-0.5 pt-6 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--ink)]">
                  {r.cta} →
                </span>
              </a>
            </ScrollReveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-6 pt-20 sm:px-8">
        <ScrollReveal>
          <div
            className="relative grid grid-cols-1 gap-10 overflow-hidden rounded-[28px] p-8 sm:p-[52px] lg:grid-cols-[0.9fr_1.1fr] lg:gap-12"
            style={{ background: "var(--hero-bg)" }}
          >
            <div
              className="el-float pointer-events-none absolute -bottom-[110px] -right-[90px] h-[280px] w-[280px] rounded-full"
              style={{ background: "var(--lime)" }}
            />
            <div className="relative">
              <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--lime)]">One address</p>
              <h2 className="font-display text-[30px] font-bold leading-[1.04] tracking-[-0.03em] text-[var(--hero-text)] sm:text-[38px]">
                Prefer email? So do we.
              </h2>
              <p className="mt-3.5 max-w-sm text-[15px] leading-[1.6] text-[#A3A29A]">
                Send us a note at the address below and we&apos;ll take it from there.
              </p>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="mt-6 inline-block rounded-full px-6 py-3.5 text-sm font-bold text-[var(--ink)] hover:brightness-95"
                style={{ background: "var(--lime)" }}
              >
                {SUPPORT_EMAIL}
              </a>
            </div>
            <div
              className="relative rounded-[18px] border p-6 font-mono text-[13px] leading-loose text-[#D6D4CC]"
              style={{ background: "#17171A", borderColor: "rgba(255,255,255,0.1)" }}
            >
              <div>
                To: <span className="text-[var(--lime)]">{SUPPORT_EMAIL}</span>
              </div>
              <div>From: you</div>
              <div>Subject: [whatever you need]</div>
              <div className="my-3.5 border-t border-white/[0.12]" />
              <div>Hey EvaluLabs —</div>
              <div className="text-[#7E7D74]">[your message here]</div>
            </div>
          </div>
        </ScrollReveal>
      </section>

      <MarketingFooter />
    </div>
  );
}
