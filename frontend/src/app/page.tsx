"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import MarketingNav from "@/components/MarketingNav";
import { ScrollReveal, GlassCard } from "@/components/ScrollReveal";

const FEATURES = [
  {
    title: "Questions from real insiders",
    body: "Every question is curated from professionals actually working at that company, or candidates recently interviewed there — not scraped or guessed.",
    icon: "◆",
  },
  {
    title: "Verified contributors only",
    body: "Every contributor is verified with a company email ID or offer letter before their questions enter our bank. No anonymous guesswork.",
    icon: "◇",
  },
  {
    title: "Interview-grade pressure",
    body: "Our AI interviewer paces, probes, and pushes back the way a real panel does — so the pressure you feel here is the pressure you'll feel there.",
    icon: "○",
  },
  {
    title: "Voice mode",
    body: "Speak your answers naturally. InterviewX listens, transcribes, and responds in real time.",
    icon: "▲",
  },
  {
    title: "Dimension-level scoring",
    body: "See exactly where you stand — communication, technical depth, structure, and confidence — after every session.",
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
  { n: "02", title: "Face verified questions", body: "Answer questions sourced from insiders and recent hires — vetted with proof, not guesswork." },
  { n: "03", title: "Feel the pressure", body: "Our AI interviewer runs the session with the pace and scrutiny of a real panel." },
  { n: "04", title: "Get scored & improve", body: "Instant, rubric-based feedback — and a readiness score that climbs with every session." },
];

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--page)]">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-[520px] w-[520px] rounded-full bg-[var(--accent-glow)] blur-[120px]" />
        <div className="absolute top-1/3 -right-40 h-[420px] w-[420px] rounded-full bg-[var(--surface-2)] blur-[100px]" />
        <div className="absolute bottom-0 left-0 h-[380px] w-[380px] rounded-full bg-[var(--accent-glow)] blur-[110px]" />
      </div>

      <MarketingNav />

      <section className="mx-auto flex max-w-5xl flex-col items-center px-6 pb-24 pt-40 text-center sm:pt-48">
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6 rounded-full border border-[var(--border)] bg-white/50 px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-[var(--ink-dim)] backdrop-blur-md"
        >
          Questions verified by real employees, not scraped off the internet
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="font-display text-4xl font-semibold leading-[1.1] tracking-tight text-[var(--ink)] sm:text-6xl"
        >
          Practice with questions people
          <br className="hidden sm:block" /> were actually asked.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-6 max-w-2xl text-lg text-[var(--ink-dim)]"
        >
          Our question bank is curated by professionals currently working at these
          companies and candidates recently interviewed there — every contributor
          verified with a work email or offer letter. Then our AI interviewer puts
          you through the same pressure as the real room, so nothing about interview
          day catches you off guard.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-10 flex flex-col items-center gap-4 sm:flex-row"
        >
          <button
            onClick={() => router.push(user ? "/dashboard" : "/register")}
            className="rounded-full bg-[var(--ink)] px-8 py-3.5 text-sm font-semibold text-[var(--page)] shadow-[0_10px_30px_rgba(28,26,22,0.18)] transition-transform duration-300 hover:scale-[1.04] active:scale-[0.98]"
          >
            {user ? "Go to Dashboard" : "Start practicing free"}
          </button>
          <Link
            href="/about"
            className="rounded-full border border-[var(--border-mid)] bg-white/40 px-8 py-3.5 text-sm font-semibold text-[var(--ink)] backdrop-blur-md transition-colors hover:bg-white/70"
          >
            Learn how it works
          </Link>
        </motion.div>

        <ScrollReveal delay={0.15} className="mt-20 w-full">
          <div className="relative mx-auto max-w-4xl rounded-[28px] border border-white/50 bg-white/35 p-3 shadow-[0_20px_60px_rgba(28,26,22,0.12)] backdrop-blur-2xl">
            <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8 sm:p-12">
              <p className="mb-6 text-left text-xs font-medium uppercase tracking-wide text-[var(--ink-faint)]">
                Where our questions come from
              </p>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                {[
                  { label: "Sourced from", value: "Current employees" },
                  { label: "Sourced from", value: "Recent interviewees" },
                  { label: "Verified with", value: "Work email or offer letter" },
                ].map((item, i) => (
                  <motion.div
                    key={item.value}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.1 * i }}
                    className="rounded-2xl bg-[var(--surface-2)] p-5 text-left"
                  >
                    <p className="text-xs font-medium uppercase tracking-wide text-[var(--ink-faint)]">{item.label}</p>
                    <p className="mt-2 font-display text-xl font-semibold leading-snug text-[var(--ink)]">
                      {item.value}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </ScrollReveal>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-24">
        <ScrollReveal className="mx-auto mb-14 max-w-2xl text-center">
          <h2 className="font-display text-3xl font-semibold text-[var(--ink)] sm:text-4xl">
            Real questions. Real pressure. No guesswork.
          </h2>
          <p className="mt-4 text-[var(--ink-dim)]">
            Most prep platforms recycle the same recycled question lists. Ours are curated
            and verified by the people who actually sat in that interview room.
          </p>
        </ScrollReveal>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <ScrollReveal key={f.title} delay={(i % 3) * 0.08}>
              <GlassCard className="h-full">
                <span className="text-2xl text-[var(--accent-dim)]">{f.icon}</span>
                <h3 className="mt-4 font-display text-lg font-semibold text-[var(--ink)]">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--ink-dim)]">{f.body}</p>
              </GlassCard>
            </ScrollReveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-24">
        <ScrollReveal className="mx-auto mb-14 max-w-2xl text-center">
          <h2 className="font-display text-3xl font-semibold text-[var(--ink)] sm:text-4xl">
            How InterviewX works
          </h2>
        </ScrollReveal>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
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

      <section className="mx-auto max-w-5xl px-6 pb-28">
        <ScrollReveal>
          <div className="relative overflow-hidden rounded-[32px] border border-white/50 bg-[var(--hero-bg)] px-8 py-16 text-center shadow-[0_24px_70px_rgba(28,26,22,0.18)] sm:px-16">
            <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
            <h2 className="font-display text-3xl font-semibold text-[var(--hero-text)] sm:text-4xl">
              Stop guessing what they'll ask. Find out.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[var(--hero-text)] opacity-80">
              Verified questions, real pressure, instant feedback — start your first session in under a minute.
            </p>
            <button
              onClick={() => router.push(user ? "/dashboard" : "/register")}
              className="mt-8 rounded-full bg-[var(--page)] px-8 py-3.5 text-sm font-semibold text-[var(--ink)] transition-transform duration-300 hover:scale-[1.04] active:scale-[0.98]"
            >
              {user ? "Go to Dashboard" : "Get started free"}
            </button>
          </div>
        </ScrollReveal>
      </section>

      <footer className="border-t border-[var(--border)] px-6 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <span className="font-display text-base font-semibold text-[var(--ink)]">InterviewX</span>
          <div className="flex gap-6 text-sm text-[var(--ink-dim)]">
            <Link href="/about" className="hover:text-[var(--ink)]">About</Link>
            <Link href="/career" className="hover:text-[var(--ink)]">Career</Link>
            <Link href="/login" className="hover:text-[var(--ink)]">Sign in</Link>
          </div>
          <span className="text-xs text-[var(--ink-faint)]">© {new Date().getFullYear()} InterviewX</span>
        </div>
      </footer>
    </div>
  );
}
