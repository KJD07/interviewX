"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { FaLinkedin } from "react-icons/fa6";
import { useAuth } from "@/context/AuthContext";
import MarketingNav from "@/components/MarketingNav";
import { ScrollReveal } from "@/components/ScrollReveal";
import LiveCodeFeature from "@/components/LiveCodeFeature";
import FaqSection from "@/components/FaqSection";
import icon from "@/app/icon.png";

const FEATURES = [
  {
    title: "Questions from real insiders",
    body: "Curated by people working at that company, or candidates who interviewed there recently.",
    icon: "◆",
  },
  {
    title: "Verified contributors only",
    body: "Every contributor proves identity with a company email or offer letter. No anonymous guesswork.",
    icon: "◇",
  },
  {
    title: "Interview-grade pressure",
    body: "The AI paces, probes and pushes back the way a real panel does.",
    icon: "○",
  },
  {
    title: "Voice mode",
    body: "Speak your answers naturally. It listens, transcribes and responds in real time.",
    icon: "▲",
  },
  {
    title: "Dimension-level scoring",
    body: "See where you stand on communication, technical depth, structure and confidence.",
    icon: "△",
  },
  {
    title: "Progress you can see",
    body: "A readiness score that tracks growth across companies, session over session.",
    icon: "▢",
  },
];

const STEPS = [
  { n: "01", title: "Pick a company", body: "Real companies and roles, from entry-level to FAANG-scale." },
  { n: "02", title: "Face verified questions", body: "Sourced from insiders and recent hires, vetted with proof." },
  { n: "03", title: "Feel the pressure", body: "The session runs with the pace and scrutiny of a real panel." },
  { n: "04", title: "Get scored & improve", body: "Instant rubric feedback and a readiness score that climbs." },
];

const SOURCES = [
  { label: "Where questions come from", value: "Never scraped. Never guessed.", plain: true },
  { label: "Sourced from", value: "Current employees" },
  { label: "Sourced from", value: "Recent interviewees" },
  { label: "Verified with", value: "Work email or offer" },
];

/* Illustrative session card — a picture of the product, not live data. */
const WAVEFORM = [30, 62, 44, 88, 56, 100, 48, 72, 34, 52, 26, 40, 22, 58, 30, 44];
const LIVE_SCORES = [
  { label: "Structure", width: "74%", value: "7.4" },
  { label: "Depth", width: "59%", value: "5.9" },
  { label: "Confidence", width: "82%", value: "8.2" },
];

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();

  return (
    <div className="relative min-h-screen bg-[var(--page)]">
      <MarketingNav />

      <section className="mx-auto max-w-[1180px] px-6 pt-32 sm:px-8 sm:pt-36">
        <div className="grid items-end gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-[52px]">
          <div>
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-[var(--border-mid)] bg-[var(--surface)] py-[7px] pl-[11px] pr-3.5"
            >
              <span className="el-pulse h-[7px] w-[7px] rounded-full bg-[var(--success)]" />
              <span className="font-mono text-[11px] tracking-[0.06em] text-[var(--ink-dim)]">
                VERIFIED QUESTION BANKS · REAL INTERVIEW QUESTIONS
              </span>
            </motion.span>

            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="font-display text-[42px] font-bold leading-[0.92] tracking-[-0.035em] text-[var(--ink)] sm:text-[58px] lg:text-[72px]"
            >
              Practice the questions people were <em className="font-accent">actually</em> asked.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mt-[22px] max-w-[450px] text-[17px] leading-[1.55] text-[var(--ink-dim)]"
            >
              Our bank is curated by people who sat in that room — current employees and
              recent interviewees, each verified with a work email or an offer letter. Then
              our AI interviewer applies the same pressure.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-8 flex flex-wrap gap-2.5"
            >
              <button
                onClick={() => router.push(user ? "/dashboard" : "/register")}
                className="rounded-full bg-[var(--ink)] px-[26px] py-[15px] text-[15px] font-semibold text-[var(--page)] hover:bg-[var(--accent-dim)]"
              >
                {user ? "Go to dashboard" : "Start a mock interview"}
              </button>
              <Link
                href="/pricing"
                className="rounded-full border border-[var(--border-mid)] px-[26px] py-[15px] text-[15px] font-semibold text-[var(--ink)] hover:bg-[var(--surface)]"
              >
                See pricing →
              </Link>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="relative overflow-hidden rounded-[24px] p-[26px]"
            style={{ background: "var(--hero-bg)", color: "var(--hero-text)" }}
          >
            <div
              className="pointer-events-none absolute -right-[70px] -top-[70px] h-[190px] w-[190px] rounded-full opacity-[0.13]"
              style={{ background: "var(--lime)" }}
            />
            <div className="relative mb-5 flex items-center justify-between gap-4">
              <span className="font-mono text-[10px] tracking-[0.16em] text-[var(--lime)]">LIVE SESSION</span>
              <span className="font-mono text-[10px] tracking-[0.09em] text-[#7E7D74]">SWE · ROUND 2</span>
            </div>
            <p className="font-display relative m-0 mb-2.5 text-[22px] font-medium leading-[1.2] tracking-[-0.02em] sm:text-[25px]">
              “Walk me through how you&apos;d keep two caches consistent across regions.”
            </p>
            <div className="mb-5 font-mono text-[10px] tracking-[0.07em] text-[#7E7D74]">
              VERIFIED BY REAL CONTRIBUTORS
            </div>
            <div className="mb-5 flex h-9 items-end gap-[3px]">
              {WAVEFORM.map((height, i) => (
                <span
                  key={i}
                  className="flex-1 rounded-[2px]"
                  style={{ height: `${height}%`, background: i < 8 ? "var(--lime)" : "#4A4941" }}
                />
              ))}
            </div>
            <div className="grid gap-2.5 border-t border-white/[0.12] pt-[18px]">
              {LIVE_SCORES.map((row) => (
                <div key={row.label} className="grid grid-cols-[94px_1fr_32px] items-center gap-3">
                  <span className="text-[13px] text-[#A3A29A]">{row.label}</span>
                  <span className="relative block h-[5px] rounded-[3px] bg-white/[0.13]">
                    <span
                      className="absolute inset-y-0 left-0 rounded-[3px]"
                      style={{ width: row.width, background: "var(--lime)" }}
                    />
                  </span>
                  <span className="text-right font-mono text-[13px]">{row.value}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        <div className="mt-[70px] grid grid-cols-1 border-y border-[var(--border-mid)] lg:grid-cols-4">
          {SOURCES.map((item, i) => (
            <div
              key={item.value}
              className={`px-6 py-[22px] first:pl-0 last:pr-0 ${
                i > 0 ? "border-t border-[var(--border-mid)] lg:border-l lg:border-t-0" : ""
              }`}
            >
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--ink-faint)]">
                {item.label}
              </div>
              <div
                className={
                  item.plain
                    ? "mt-2 text-sm text-[var(--ink-dim)]"
                    : "font-display mt-2 text-[19px] font-semibold tracking-[-0.02em] text-[var(--ink)]"
                }
              >
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="product" className="mx-auto max-w-[1180px] px-6 pt-[88px] sm:px-8">
        <ScrollReveal className="flex flex-wrap items-end justify-between gap-10">
          <h2 className="font-display max-w-[600px] text-[34px] font-bold leading-[1.02] tracking-[-0.032em] text-[var(--ink)] sm:text-[46px]">
            Real questions. Real pressure. No guesswork.
          </h2>
          <p className="max-w-[320px] text-[15px] leading-relaxed text-[var(--ink-dim)]">
            Everything below exists because a generic question list can&apos;t tell you whether
            you&apos;re ready.
          </p>
        </ScrollReveal>

        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1.1fr_1fr_1fr]">
          <ScrollReveal className="lg:row-span-2">
            <LiveCodeFeature />
          </ScrollReveal>
          {FEATURES.slice(0, 4).map((f, i) => (
            <ScrollReveal key={f.title} delay={(i % 3) * 0.08}>
              <div
                className={`card-hover flex h-full flex-col rounded-[20px] p-6 ${
                  i === 1
                    ? "bg-[var(--lime)] hover:brightness-95"
                    : "border border-[var(--border)] bg-[var(--surface)]"
                }`}
              >
                <div
                  className="grid h-[27px] w-[27px] place-items-center rounded-lg text-xs"
                  style={{ background: i === 1 ? "rgba(12,12,11,0.1)" : "var(--page)" }}
                >
                  {f.icon}
                </div>
                <h3 className="font-display mt-12 text-xl font-semibold tracking-[-0.02em] text-[var(--ink)]">
                  {f.title}
                </h3>
                <p
                  className="mt-2 text-sm leading-[1.55]"
                  style={{ color: i === 1 ? "#3C4118" : "var(--ink-dim)" }}
                >
                  {f.body}
                </p>
              </div>
            </ScrollReveal>
          ))}
          <ScrollReveal className="sm:col-span-2">
            <div className="grid h-full grid-cols-1 gap-7 rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-6 sm:grid-cols-2">
              {FEATURES.slice(4).map((f) => (
                <div key={f.title}>
                  <div className="grid h-[27px] w-[27px] place-items-center rounded-lg bg-[var(--page)] text-xs">
                    {f.icon}
                  </div>
                  <h3 className="font-display mt-[18px] text-xl font-semibold tracking-[-0.02em] text-[var(--ink)]">
                    {f.title}
                  </h3>
                  <p className="mt-2 text-sm leading-[1.55] text-[var(--ink-dim)]">{f.body}</p>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-6 pt-[88px] sm:px-8">
        <ScrollReveal>
          <div className="font-label mb-3.5">How it works</div>
          <h2 className="font-display mb-9 text-[32px] font-bold leading-[1.04] tracking-[-0.032em] text-[var(--ink)] sm:text-[42px]">
            Four steps, one honest score.
          </h2>
        </ScrollReveal>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-[26px]">
          {STEPS.map((s, i) => (
            <ScrollReveal key={s.n} delay={i * 0.1}>
              <div className="h-full border-t border-[var(--border-mid)] pt-4">
                <div className="mb-[30px] font-mono text-xs text-[var(--olive)]">{s.n}</div>
                <h3 className="text-base font-semibold text-[var(--ink)]">{s.title}</h3>
                <p className="mt-2 text-sm leading-[1.55] text-[var(--ink-dim)]">{s.body}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      <FaqSection />

      <section className="mx-auto max-w-[1180px] px-6 pb-4 sm:px-8">
        <ScrollReveal>
          <div
            className="relative overflow-hidden rounded-[28px] px-8 py-14 sm:px-[54px] sm:py-[62px]"
            style={{ background: "var(--hero-bg)", color: "var(--hero-text)" }}
          >
            <div
              className="el-float pointer-events-none absolute -bottom-[100px] -right-[70px] h-[300px] w-[300px] rounded-full"
              style={{ background: "var(--lime)" }}
            />
            <div className="relative max-w-[620px]">
              <div className="mb-[18px] font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--lime)]">
                Stop guessing
              </div>
              <h2 className="font-display text-[36px] font-bold leading-none tracking-[-0.035em] sm:text-[52px]">
                Find out what they&apos;ll actually ask.
              </h2>
              <p className="mt-[18px] max-w-[440px] text-base leading-relaxed text-[#A3A29A]">
                Verified questions, real pressure, instant feedback. Your first session takes
                under a minute to start.
              </p>
              <button
                onClick={() => router.push(user ? "/dashboard" : "/register")}
                className="mt-[30px] rounded-full px-[30px] py-4 text-[15px] font-bold text-[var(--ink)] hover:brightness-95"
                style={{ background: "var(--lime)" }}
              >
                {user ? "Go to dashboard →" : "Get started free →"}
              </button>
            </div>
          </div>
        </ScrollReveal>
      </section>

      <footer className="mx-auto max-w-[1180px] px-6 pb-12 pt-16 sm:px-8">
        <div className="grid grid-cols-2 gap-10 border-t border-[var(--border-mid)] pt-[26px] sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-1">
            <div className="font-display mb-4 flex items-center gap-2.5 text-lg font-bold tracking-[-0.025em] text-[var(--ink)]">
              <Image src={icon} alt="EvaluLabs" width={26} height={26} className="rounded-md" />
              EvaluLabs
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-[var(--ink-dim)]">
              Practice with the questions people were actually asked.
            </p>
          </div>
          <div>
            <p className="font-label mb-4">Product</p>
            <div className="flex flex-col gap-2.5 text-sm">
              <Link href="/#product" className="text-[var(--ink-dim)] hover:text-[var(--olive)]">Features</Link>
              <Link href="/pricing" className="text-[var(--ink-dim)] hover:text-[var(--olive)]">Pricing</Link>
              <Link href="/companies" className="text-[var(--ink-dim)] hover:text-[var(--olive)]">Companies</Link>
            </div>
          </div>
          <div>
            <p className="font-label mb-4">Company</p>
            <div className="flex flex-col gap-2.5 text-sm">
              <Link href="/about" className="text-[var(--ink-dim)] hover:text-[var(--olive)]">About</Link>
              <Link href="/contact" className="text-[var(--ink-dim)] hover:text-[var(--olive)]">Contact</Link>
              <a
                href="https://www.linkedin.com/company/evalulabs/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-[var(--ink-dim)] hover:text-[var(--olive)]"
              >
                <FaLinkedin size={15} aria-hidden="true" /> LinkedIn
              </a>
            </div>
          </div>
          <div>
            <p className="font-label mb-4">Career</p>
            <div className="flex flex-col gap-2.5 text-sm">
              <Link href="/career" className="text-[var(--ink-dim)] hover:text-[var(--olive)]">We&apos;re hiring</Link>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center justify-between gap-2 pt-6 text-[13px] text-[var(--ink-faint)] sm:flex-row">
          <span>© {new Date().getFullYear()} EvaluLabs</span>
          <span>Made for people preparing for the room.</span>
        </div>
      </footer>
    </div>
  );
}
