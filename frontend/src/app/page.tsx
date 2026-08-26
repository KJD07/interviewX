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
    body: "Every question is curated from professionals actually working at that company, or candidates recently interviewed there, not scraped or guessed.",
    icon: "◆",
  },
  {
    title: "Verified contributors only",
    body: "Every contributor is verified with a company email ID or offer letter before their questions enter our bank. No anonymous guesswork.",
    icon: "◇",
  },
  {
    title: "Interview-grade pressure",
    body: "Our AI interviewer paces, probes, and pushes back the way a real panel does, so the pressure you feel here is the pressure you'll feel there.",
    icon: "○",
  },
  {
    title: "Voice mode",
    body: "Speak your answers naturally. EvaluLabs listens, transcribes, and responds in real time.",
    icon: "▲",
  },
  {
    title: "Dimension-level scoring",
    body: "See exactly where you stand on communication, technical depth, structure, and confidence after every session.",
    icon: "△",
  },
  {
    title: "Progress you can see",
    body: "A readiness dashboard tracks your growth across companies and roles, session over session.",
    icon: "▢",
  },
];

const STEPS = [
  { n: "01", title: "Pick a company", body: "Choose from real companies and roles, from entry-level to FAANG-scale." },
  { n: "02", title: "Face verified questions", body: "Answer questions sourced from insiders and recent hires, vetted with proof, not guesswork." },
  { n: "03", title: "Feel the pressure", body: "Our AI interviewer runs the session with the pace and scrutiny of a real panel." },
  { n: "04", title: "Get scored & improve", body: "Instant, rubric-based feedback. A readiness score that climbs with every session." },
];

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();

  return (
    <div className="relative min-h-screen bg-[var(--page)]">
      <MarketingNav />

      <section className="mx-auto max-w-6xl px-6 pb-16 pt-40 sm:pt-48">
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-9 inline-flex items-center gap-2.5 rounded-full border border-[var(--border-mid)] px-3.5 py-1.5 text-[13px] font-medium"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Questions verified by real employees, not scraped
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="font-display max-w-4xl text-5xl font-semibold leading-[0.98] tracking-tight text-[var(--ink)] sm:text-7xl"
        >
          Practice with questions people were <em className="font-accent">actually</em> asked.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-8 max-w-xl text-lg leading-relaxed text-[var(--ink-dim)]"
        >
          Our question bank is curated by professionals at the companies you&apos;re
          targeting. Every contributor verified. Then our AI interviewer puts you
          through the same pressure as the real room.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-10 flex flex-col items-start gap-3.5 sm:flex-row sm:items-center"
        >
          <button
            onClick={() => router.push(user ? "/dashboard" : "/register")}
            className="rounded-full bg-[var(--ink)] px-7 py-4 text-[15.5px] font-semibold text-[var(--page)] transition-transform duration-300 hover:scale-[1.03] active:scale-[0.98]"
          >
            {user ? "Go to Dashboard" : "Start practicing free"}
          </button>
          <Link
            href="/about"
            className="rounded-full border border-[var(--border-mid)] px-6 py-4 text-[15.5px] font-medium text-[var(--ink)] transition-colors hover:bg-[var(--surface-2)]"
          >
            Learn how it works →
          </Link>
        </motion.div>

        <div className="mt-20 grid grid-cols-2 gap-10 border-t border-[var(--border)] pt-8 sm:grid-cols-4 sm:items-end">
          <div className="col-span-2 text-xs font-semibold uppercase tracking-wider text-[var(--ink-faint)] sm:col-span-1">
            Where our
            <br className="hidden sm:block" /> questions come from
          </div>
          {[
            { label: "Sourced from", value: "Current employees" },
            { label: "Sourced from", value: "Recent interviewees" },
            { label: "Verified with", value: "Work email or offer" },
          ].map((item) => (
            <div key={item.value}>
              <p className="mb-1.5 text-[11px] uppercase tracking-wider text-[var(--ink-faint)]">{item.label}</p>
              <p className="font-display text-xl font-semibold tracking-tight text-[var(--ink)]">{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="product" className="mx-auto max-w-6xl px-6 py-24">
        <ScrollReveal className="mx-auto mb-14 max-w-2xl text-center">
          <h2 className="font-display text-3xl font-semibold text-[var(--ink)] sm:text-4xl">
            Real questions. Real pressure. No guesswork.
          </h2>
          <p className="mt-4 text-[var(--ink-dim)]">
            Most prep platforms recycle the same recycled question lists. Ours are curated
            and verified by the people who actually sat in that interview room.
          </p>
        </ScrollReveal>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:auto-rows-[1fr]">
          <ScrollReveal className="lg:col-start-1 lg:row-span-2">
            <LiveCodeFeature />
          </ScrollReveal>
          {FEATURES.slice(0, 4).map((f, i) => (
            <ScrollReveal key={f.title} delay={(i % 3) * 0.08}>
              <div
                className={`flex h-full flex-col justify-between rounded-3xl p-7 transition-colors duration-300 ${
                  i === 1
                    ? "bg-[var(--lime)] hover:brightness-95"
                    : "border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-mid)]"
                }`}
              >
                <span className={`text-2xl ${i === 1 ? "text-[var(--ink)]" : "text-[var(--accent-dim)]"}`}>{f.icon}</span>
                <div>
                  <h3 className="mt-4 font-display text-lg font-semibold text-[var(--ink)]">{f.title}</h3>
                  <p className={`mt-2 text-sm leading-relaxed ${i === 1 ? "text-[var(--ink)]/80" : "text-[var(--ink-dim)]"}`}>{f.body}</p>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {FEATURES.slice(4).map((f, i) => (
            <ScrollReveal key={f.title} delay={i * 0.08}>
              <div className="flex h-full items-center gap-5 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-7 transition-colors duration-300 hover:border-[var(--border-mid)]">
                <span className="flex-shrink-0 text-3xl text-[var(--accent-dim)]">{f.icon}</span>
                <div>
                  <h3 className="font-display text-lg font-semibold text-[var(--ink)]">{f.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--ink-dim)]">{f.body}</p>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-24">
        <ScrollReveal className="mx-auto mb-14 max-w-2xl text-center">
          <h2 className="font-display text-3xl font-semibold text-[var(--ink)] sm:text-4xl">
            How EvaluLabs works
          </h2>
        </ScrollReveal>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <ScrollReveal key={s.n} delay={i * 0.1}>
              <div className="h-full border-t pt-6" style={{ borderColor: "var(--ink)" }}>
                <span className="font-display text-3xl font-semibold text-[var(--ink-faint)]">{s.n}</span>
                <h3 className="mt-4 font-display text-lg font-semibold text-[var(--ink)]">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--ink-dim)]">{s.body}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      <FaqSection />

      <section className="mx-auto max-w-5xl px-6 pb-28">
        <ScrollReveal>
          <div className="relative overflow-hidden rounded-[32px] px-8 py-16 text-center sm:px-16" style={{ background: "var(--hero-bg)" }}>
            <div className="pointer-events-none absolute -top-10 -right-10 h-64 w-64 rounded-full opacity-90" style={{ background: "var(--lime)" }} />
            <div className="pointer-events-none absolute -bottom-20 right-40 h-40 w-40 rounded-full border" style={{ borderColor: "rgba(246,245,241,0.15)" }} />
            <div className="relative">
              <h2 className="font-display text-3xl font-semibold text-[var(--hero-text)] sm:text-4xl">
                Stop guessing what they'll ask. Find out.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-[var(--hero-text)] opacity-80">
                Verified questions, real pressure, instant feedback. Start your first session in under a minute.
              </p>
              <button
                onClick={() => router.push(user ? "/dashboard" : "/register")}
                className="mt-8 rounded-full px-8 py-3.5 text-sm font-semibold text-[var(--ink)] transition-transform duration-300 hover:scale-[1.04] active:scale-[0.98]"
                style={{ background: "var(--lime)" }}
              >
                {user ? "Go to Dashboard" : "Get started free"}
              </button>
            </div>
          </div>
        </ScrollReveal>
      </section>

      <footer className="mx-auto max-w-6xl px-6 pb-12 pt-4">
        <div className="grid grid-cols-2 gap-10 border-b border-[var(--border)] pb-10 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-1">
            <div className="mb-4 flex items-center gap-2.5 text-lg font-semibold tracking-tight text-[var(--ink)]">
              <Image src={icon} alt="EvaluLabs" width={26} height={26} className="rounded-md" />
              EvaluLabs
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-[var(--ink-dim)]">
              Practice with the questions people were actually asked.
            </p>
          </div>
          <div>
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-faint)]">Product</p>
            <div className="flex flex-col gap-2.5 text-sm">
              <Link href="/#product" className="text-[var(--ink-dim)] transition-opacity hover:opacity-70">Features</Link>
              <Link href="/pricing" className="text-[var(--ink-dim)] transition-opacity hover:opacity-70">Pricing</Link>
              <Link href="/companies" className="text-[var(--ink-dim)] transition-opacity hover:opacity-70">Companies</Link>
            </div>
          </div>
          <div>
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-faint)]">Company</p>
            <div className="flex flex-col gap-2.5 text-sm">
              <Link href="/about" className="text-[var(--ink-dim)] transition-opacity hover:opacity-70">About</Link>
              <Link href="/contact" className="text-[var(--ink-dim)] transition-opacity hover:opacity-70">Contact</Link>
              <a
                href="https://www.linkedin.com/company/evalulabs/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-[var(--ink-dim)] transition-opacity hover:opacity-70"
              >
                <FaLinkedin size={15} aria-hidden="true" /> LinkedIn
              </a>
            </div>
          </div>
          <div>
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-faint)]">Career</p>
            <div className="flex flex-col gap-2.5 text-sm">
              <Link href="/career" className="text-[var(--ink-dim)] transition-opacity hover:opacity-70">We&apos;re hiring</Link>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center justify-between gap-2 pt-6 text-xs text-[var(--ink-faint)] sm:flex-row">
          <span>© {new Date().getFullYear()} EvaluLabs</span>
          <span>Made for people preparing for the room.</span>
        </div>
      </footer>
    </div>
  );
}
