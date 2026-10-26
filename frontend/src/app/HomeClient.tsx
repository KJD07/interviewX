"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { FaLinkedin } from "react-icons/fa6";
import { useAuth } from "@/context/AuthContext";
import MarketingNav from "@/components/MarketingNav";
import { OPERATOR_LEGAL_NAME } from "@/lib/legal";
import { ATS_FREE_DAILY_LIMIT, PLANS } from "@/lib/plans";
import { ScrollReveal } from "@/components/ScrollReveal";
import LiveCodeFeature from "@/components/LiveCodeFeature";
import FaqSection from "@/components/FaqSection";
import icon from "@/app/icon.png";

/* The candidate portal, in the order a job search actually happens. */
const PORTAL_FEATURES = [
  {
    n: "01",
    title: "A profile from your resume",
    body: "Upload your resume once. Skills, experience, education and projects fill themselves in, ready to edit.",
  },
  {
    n: "02",
    title: "Live jobs, ranked for you",
    body: "Open roles from 1,100+ companies' own career boards, India-first, each with a match score against your profile.",
  },
  {
    n: "03",
    title: "Free ATS resume check",
    body: `Check your resume against any job. See the score breakdown, the keywords you match, the ones you're missing and what to add. ${ATS_FREE_DAILY_LIMIT} checks a day, free.`,
    highlight: true,
  },
  {
    n: "04",
    title: "A copy-ready apply kit",
    body: "Your details as copy-ready fields beside the application form, in a panel that can float on top while you fill it in.",
  },
  {
    n: "05",
    title: "Every application, tracked",
    body: "Saved jobs and applications in one place, with status and notes. Add roles you found elsewhere too.",
  },
  {
    n: "06",
    title: "Practice for each role",
    body: "Questions likely for every job you track: the company's own bank, skill tracks and HR rounds, scored instantly.",
  },
];

const INTERVIEW_FEATURES = [
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
    title: "Voice mode",
    body: "Speak your answers naturally. It listens, transcribes and responds in real time.",
    icon: "▲",
  },
  {
    title: "Honest, rubric-based scores",
    body: "Communication, technical depth and problem solving on a strict 0–10 scale, with feedback on what to fix.",
    icon: "△",
  },
];

const STEPS = [
  { n: "01", title: "Upload your resume", body: "Your candidate profile builds itself, and powers job matching." },
  { n: "02", title: "Find jobs that fit", body: "Filter live roles by skill, location, experience and best match." },
  { n: "03", title: "Check, apply, track", body: "Run the ATS check, apply with the kit, and track every application." },
  { n: "04", title: "Practice & interview", body: "Rehearse that role's questions, then a full AI mock interview." },
];

const STATS = [
  { label: "Live jobs from", value: "1,100+ career boards" },
  { label: "ATS resume checks", value: `${ATS_FREE_DAILY_LIMIT} free every day` },
  { label: "AI mock interviews", value: `${PLANS.max.monthlyLimit} a month` },
  { label: "Price for candidates", value: "₹0 — no card needed" },
];

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();
  const start = () => router.push(user ? "/dashboard" : "/register");

  return (
    <div className="relative min-h-screen bg-[var(--page)]">
      <MarketingNav />

      <section className="mx-auto max-w-[1180px] px-6 pt-32 sm:px-8 sm:pt-36">
        <div className="grid items-center gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:gap-[52px]">
          <div>
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-[var(--border-mid)] bg-[var(--surface)] py-[7px] pl-[11px] pr-3.5"
            >
              <span className="el-pulse h-[7px] w-[7px] rounded-full bg-[var(--success)]" />
              <span className="font-mono text-[11px] tracking-[0.06em] text-[var(--ink-dim)]">
                FREE CANDIDATE PORTAL · LIVE JOBS · ATS · MOCK INTERVIEWS
              </span>
            </motion.span>

            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="font-display text-[42px] font-bold leading-[0.95] tracking-[-0.035em] text-[var(--ink)] sm:text-[58px] lg:text-[68px]"
            >
              Find the job. Beat the ATS. <em className="font-accent">Ace</em> the interview.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mt-[22px] max-w-[470px] text-[17px] leading-[1.55] text-[var(--ink-dim)]"
            >
              EvaluLabs takes you from resume to offer in one free portal: live jobs ranked for
              your profile, an ATS check for every role, an apply kit and tracker, and AI mock
              interviews on verified company questions.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-8 flex flex-wrap gap-2.5"
            >
              <button
                onClick={start}
                className="rounded-full bg-[var(--ink)] px-[26px] py-[15px] text-[15px] font-semibold text-[var(--page)] hover:bg-[var(--accent-dim)]"
              >
                {user ? "Go to dashboard" : "Get started free"}
              </button>
              <Link
                href="#product"
                className="rounded-full border border-[var(--border-mid)] px-[26px] py-[15px] text-[15px] font-semibold text-[var(--ink)] hover:bg-[var(--surface)]"
              >
                See what&apos;s inside ↓
              </Link>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="relative overflow-hidden rounded-[24px] p-3 sm:p-4"
            style={{ background: "var(--hero-bg)", color: "var(--hero-text)" }}
          >
            <div
              className="pointer-events-none absolute -right-[70px] -top-[70px] h-[190px] w-[190px] rounded-full opacity-[0.13]"
              style={{ background: "var(--lime)" }}
            />
            <div className="relative mb-3 flex items-center justify-between gap-4 px-1.5 pt-1">
              <span className="font-mono text-[10px] tracking-[0.16em] text-[var(--lime)]">CANDIDATE PORTAL TOUR</span>
              <span className="font-mono text-[10px] tracking-[0.09em] text-[#7E7D74]">0:37 · SOUND ON</span>
            </div>
            <video
              className="relative block aspect-video w-full rounded-[14px] bg-black"
              controls
              playsInline
              preload="metadata"
              poster="/videos/candidate-portal-poster.jpg"
              aria-label="38-second tour of the EvaluLabs candidate portal"
            >
              <source src="/videos/candidate-portal.webm" type="video/webm" />
              <source src="/videos/candidate-portal.mp4" type="video/mp4" />
              <track kind="captions" src="/videos/candidate-portal.vtt" srcLang="en" label="English" />
            </video>
          </motion.div>
        </div>

        <div className="mt-[70px] grid grid-cols-1 border-y border-[var(--border-mid)] sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((item, i) => (
            <div
              key={item.label}
              className={`px-6 py-[22px] lg:first:pl-0 lg:last:pr-0 ${
                i > 0 ? "border-t border-[var(--border-mid)] sm:border-t-0 lg:border-l" : ""
              } ${i > 1 ? "sm:border-t lg:border-t-0" : ""} ${i % 2 === 1 ? "sm:border-l" : ""}`}
            >
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--ink-faint)]">
                {item.label}
              </div>
              <div className="font-display mt-2 text-[19px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="product" className="mx-auto max-w-[1180px] scroll-mt-24 px-6 pt-[88px] sm:px-8">
        <ScrollReveal className="flex flex-wrap items-end justify-between gap-10">
          <h2 className="font-display max-w-[640px] text-[34px] font-bold leading-[1.02] tracking-[-0.032em] text-[var(--ink)] sm:text-[46px]">
            Your whole job search, in one place.
          </h2>
          <p className="max-w-[340px] text-[15px] leading-relaxed text-[var(--ink-dim)]">
            No more ten open tabs. Every step from finding a role to rehearsing for it lives in the
            same portal, and each one feeds the next.
          </p>
        </ScrollReveal>

        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PORTAL_FEATURES.map((f, i) => (
            <ScrollReveal key={f.n} delay={(i % 3) * 0.08}>
              <div
                className={`card-hover flex h-full flex-col rounded-[20px] p-6 ${
                  f.highlight
                    ? "bg-[var(--lime)] hover:brightness-95"
                    : "border border-[var(--border)] bg-[var(--surface)]"
                }`}
              >
                <div
                  className="w-fit rounded-lg px-2 py-1 font-mono text-[11px] font-bold"
                  style={{
                    background: f.highlight ? "rgba(12,12,11,0.1)" : "var(--page)",
                    color: f.highlight ? "var(--ink)" : "var(--olive)",
                  }}
                >
                  {f.n}
                </div>
                <h3 className="font-display mt-10 text-xl font-semibold tracking-[-0.02em] text-[var(--ink)]">
                  {f.title}
                </h3>
                <p
                  className="mt-2 text-sm leading-[1.55]"
                  style={{ color: f.highlight ? "#3C4118" : "var(--ink-dim)" }}
                >
                  {f.body}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      <section id="interviews" className="mx-auto max-w-[1180px] scroll-mt-24 px-6 pt-[88px] sm:px-8">
        <ScrollReveal className="flex flex-wrap items-end justify-between gap-10">
          <div>
            <div className="font-label mb-3.5">AI mock interviews</div>
            <h2 className="font-display max-w-[640px] text-[34px] font-bold leading-[1.02] tracking-[-0.032em] text-[var(--ink)] sm:text-[46px]">
              Then rehearse the questions people were <em className="font-accent">actually</em> asked.
            </h2>
          </div>
          <p className="max-w-[340px] text-[15px] leading-relaxed text-[var(--ink-dim)]">
            Pick a company and role. An AI interviewer runs a full session from a verified question
            bank, with that company&apos;s tone and pressure.
          </p>
        </ScrollReveal>

        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1.1fr_1fr_1fr]">
          <ScrollReveal className="sm:col-span-2 lg:col-span-1 lg:row-span-2">
            <LiveCodeFeature />
          </ScrollReveal>
          {INTERVIEW_FEATURES.map((f, i) => (
            <ScrollReveal key={f.title} delay={(i % 2) * 0.08}>
              <div className="card-hover flex h-full flex-col rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-6">
                <div className="grid h-[27px] w-[27px] place-items-center rounded-lg bg-[var(--page)] text-xs">
                  {f.icon}
                </div>
                <h3 className="font-display mt-10 text-xl font-semibold tracking-[-0.02em] text-[var(--ink)]">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-[1.55] text-[var(--ink-dim)]">{f.body}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-6 pt-[88px] sm:px-8">
        <ScrollReveal>
          <div className="font-label mb-3.5">How it works</div>
          <h2 className="font-display mb-9 text-[32px] font-bold leading-[1.04] tracking-[-0.032em] text-[var(--ink)] sm:text-[42px]">
            Four steps from resume to offer.
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
                Get prepared. Get hired.
              </div>
              <h2 className="font-display text-[36px] font-bold leading-none tracking-[-0.035em] sm:text-[52px]">
                Stop job hunting by guesswork.
              </h2>
              <p className="mt-[18px] max-w-[440px] text-base leading-relaxed text-[#A3A29A]">
                Upload your resume and see jobs ranked for you in minutes. Free for candidates, no
                card needed.
              </p>
              <button
                onClick={start}
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
        <div className="grid grid-cols-2 gap-10 border-t border-[var(--border-mid)] pt-[26px] sm:grid-cols-2 lg:grid-cols-5">
          <div className="col-span-2 lg:col-span-1">
            <div className="font-display mb-4 flex items-center gap-2.5 text-lg font-bold tracking-[-0.025em] text-[var(--ink)]">
              <Image src={icon} alt="EvaluLabs" width={26} height={26} className="rounded-md" />
              EvaluLabs
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-[var(--ink-dim)]">
              Find the job, beat the ATS, ace the interview.
            </p>
          </div>
          <div>
            <p className="font-label mb-4">Product</p>
            <div className="flex flex-col gap-2.5 text-sm">
              <Link href="/#product" className="text-[var(--ink-dim)] hover:text-[var(--olive)]">Features</Link>
              <Link href="/jobs" className="text-[var(--ink-dim)] hover:text-[var(--olive)]">Live jobs</Link>
              <Link href="/pricing" className="text-[var(--ink-dim)] hover:text-[var(--olive)]">Pricing</Link>
              <Link href="/companies" className="text-[var(--ink-dim)] hover:text-[var(--olive)]">Companies</Link>
              <Link href="/skills" className="text-[var(--ink-dim)] hover:text-[var(--olive)]">Skills</Link>
              <Link href="/enterprise" className="text-[var(--ink-dim)] hover:text-[var(--olive)]">Enterprise</Link>
            </div>
          </div>
          <div>
            <p className="font-label mb-4">Blogs</p>
            <div className="flex flex-col gap-2.5 text-sm">
              <Link href="/blogs/what-is-an-ai-interview-platform" className="text-[var(--ink-dim)] hover:text-[var(--olive)]">What is an AI interview platform?</Link>
              <Link href="/blogs/ai-technical-interview" className="text-[var(--ink-dim)] hover:text-[var(--olive)]">Technical interviews</Link>
              <Link href="/blogs/ai-coding-interview" className="text-[var(--ink-dim)] hover:text-[var(--olive)]">Coding interviews</Link>
              <Link href="/blogs/interview-proctoring" className="text-[var(--ink-dim)] hover:text-[var(--olive)]">Proctoring</Link>
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
            <p className="font-label mb-4">Legal</p>
            <div className="flex flex-col gap-2.5 text-sm">
              <Link href="/terms" className="text-[var(--ink-dim)] hover:text-[var(--olive)]">Terms</Link>
              <Link href="/privacy" className="text-[var(--ink-dim)] hover:text-[var(--olive)]">Privacy</Link>
              <Link href="/refund" className="text-[var(--ink-dim)] hover:text-[var(--olive)]">Refund</Link>
              <Link href="/cancellation" className="text-[var(--ink-dim)] hover:text-[var(--olive)]">Cancellation</Link>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center justify-between gap-2 pt-6 text-[13px] text-[var(--ink-faint)] sm:flex-row">
          <span>© {new Date().getFullYear()} EvaluLabs</span>
          <span>Operated by {OPERATOR_LEGAL_NAME}</span>
        </div>
      </footer>
    </div>
  );
}
