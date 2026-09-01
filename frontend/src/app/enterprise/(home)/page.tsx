"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import MarketingNav from "@/components/MarketingNav";
import MarketingFooter from "@/components/MarketingFooter";
import { ScrollReveal } from "@/components/ScrollReveal";
import { FaqAccordion } from "@/components/FaqSection";
import { useCurrency, formatPrice } from "@/lib/currency";
import { ENTERPRISE_FAQS } from "./faqs";

const ENTERPRISE_PRICE_PER_SEAT_RUPEES = 99;

const PILLARS = [
  { label: "You bring", value: "Your roles and rounds" },
  { label: "Candidates face", value: "Your question bank" },
  { label: "You receive", value: "Scored reports" },
  { label: "You decide", value: "Who advances" },
];

const FEATURES = [
  {
    title: "Your question bank",
    body: "Upload .csv, .xlsx or .json. Roles, rounds, question type and ideal answers — all in one workspace.",
    icon: "▤",
  },
  {
    title: "Invite with a link",
    body: "Send an expiring invite. The candidate sits the round on their own time. You watch progress from the dashboard.",
    icon: "◎",
  },
  {
    title: "Interview-grade pressure",
    body: "The AI interviewer paces, probes and pushes back the way a real panel does — not a quiz with a timer.",
    icon: "◆",
  },
  {
    title: "Dimension-level scores",
    body: "Every finished session is graded 0–10 on communication, technical depth, problem solving and overall readiness.",
    icon: "△",
  },
  {
    title: "Live sessions",
    body: "See when a candidate is in the room. Optional camera feed for orgs that turn proctoring on.",
    icon: "▲",
  },
  {
    title: "Campus sponsorships",
    body: "Grant a full plan to everyone on a college domain, with a per-cycle interview cap you control.",
    icon: "◇",
  },
];

const STEPS = [
  { n: "01", title: "Upload the bank", body: "Map roles and rounds the way your hiring process already works." },
  { n: "02", title: "Invite candidates", body: "One email, one expiring link, one seat against your monthly quota." },
  { n: "03", title: "They sit the round", body: "Same pressure as a panel. Voice or text. You do not have to be in the room." },
  { n: "04", title: "Read the report", body: "Scores, transcript and gaps — enough to decide who to bring onsite." },
];

const ACTIVITY = [
  { t: "devsharma@gmail.com started Technical Screen", w: "12 min ago", live: true },
  { t: "priya.n@outlook.com finished HR Round — 6/10", w: "2 hours ago", live: false },
  { t: "You uploaded 4 questions to Software Engineer", w: "yesterday", live: false },
  { t: "yatinangi@gmail.com invite expires in 3 days", w: "yesterday", live: false },
];

const STATS = [
  { v: "3", l: "Roles in bank" },
  { v: "10", l: "Questions" },
  { v: "4", l: "Pending invites" },
  { v: "2", l: "Live now" },
  { v: "3", l: "Finished" },
];

const INVITE_SERIES = [1, 2, 1, 3, 2, 4, 3, 5, 4, 6, 5, 7];

function sparkPoints(values: number[], w: number, h: number) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 4;
  return values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (v - min) / range) * (h - pad * 2);
    return { x, y };
  });
}

function WorkspacePreview() {
  const pts = sparkPoints(INVITE_SERIES, 300, 64);
  const line = pts.map((p) => `${p.x},${p.y}`).join(" ");
  const last = pts[pts.length - 1];
  const area = `M${pts[0].x},${64} L${pts.map((p) => `${p.x},${p.y}`).join(" ")} L${last.x},64 Z`;

  return (
    <div className="flex flex-col gap-3.5">
      <div
        className="relative overflow-hidden rounded-[24px] p-[22px]"
        style={{ background: "var(--hero-bg)", color: "var(--hero-text)" }}
      >
        <div
          className="pointer-events-none absolute -right-[70px] -top-[70px] h-[190px] w-[190px] rounded-full opacity-[0.13]"
          style={{ background: "var(--lime)" }}
        />
        <div className="relative mb-2.5 flex items-center justify-between gap-4">
          <span className="font-mono text-[10px] tracking-[0.16em] text-[var(--lime)]">INVITES SENT</span>
          <span className="font-mono text-[11px] text-[#A3A29A]">last 12 weeks</span>
        </div>
        <svg viewBox="0 0 300 64" preserveAspectRatio="none" className="relative block h-16 w-full">
          <path d={area} fill="rgba(216,250,75,.14)" />
          <polyline
            points={line}
            fill="none"
            stroke="#D8FA4B"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <circle cx={last.x} cy={last.y} r="3.5" fill="#D8FA4B" />
        </svg>
      </div>

      <div
        className="overflow-hidden rounded-[16px]"
        style={{ border: "1px solid var(--border-mid)", background: "var(--surface)" }}
      >
        <div className="flex items-baseline justify-between px-[22px] pt-5">
          <span className="text-[15px] font-semibold text-[var(--ink)]">Candidate quota</span>
          <span className="font-mono text-[13px] text-[var(--ink-dim)]">8 / 10 used</span>
        </div>
        <div className="mx-[22px] mb-4 mt-3.5 h-[9px] overflow-hidden rounded-[5px]" style={{ background: "var(--surface-2)" }}>
          <div className="h-full rounded-[5px] bg-[var(--ink)]" style={{ width: "80%" }} />
        </div>
        <div
          className="grid grid-cols-2 sm:grid-cols-5 gap-px"
          style={{ background: "var(--border-mid)", borderTop: "1px solid var(--border-mid)" }}
        >
          {STATS.map((k) => (
            <div key={k.l} className="bg-[var(--surface)] px-4 py-4 sm:px-[18px]">
              <div className="font-display text-[28px] font-bold leading-none tracking-[-0.035em] text-[var(--ink)]">
                {k.v}
              </div>
              <div className="mt-2 text-[12px] text-[var(--ink-dim)]">{k.l}</div>
            </div>
          ))}
        </div>
      </div>

      <div
        className="rounded-[16px] px-[22px] py-5"
        style={{ border: "1px solid var(--border-mid)", background: "var(--surface)" }}
      >
        <h3 className="font-display mb-3 text-lg font-bold tracking-[-0.025em] text-[var(--ink)]">
          Recent activity
        </h3>
        <div className="grid">
          {ACTIVITY.map((a) => (
            <div
              key={a.t}
              className="grid grid-cols-[14px_1fr_auto] items-center gap-3 border-b border-[var(--border)] py-3 last:border-b-0 last:pb-0"
            >
              <span
                className={`h-2 w-2 rounded-full ${a.live ? "el-pulse" : ""}`}
                style={{ background: a.live ? "var(--warn)" : "rgba(12,12,11,.18)" }}
              />
              <span className="truncate text-sm text-[var(--ink)]">{a.t}</span>
              <span className="font-mono text-[11px] text-[var(--ink-faint)]">{a.w}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function EnterpriseHomePage() {
  const currency = useCurrency();
  const price = formatPrice(ENTERPRISE_PRICE_PER_SEAT_RUPEES, currency);

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
                FOR HIRING TEAMS · COLLEGES
              </span>
            </motion.span>

            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="font-display text-[42px] font-bold leading-[0.92] tracking-[-0.035em] text-[var(--ink)] sm:text-[58px] lg:text-[68px]"
            >
              Screen candidates with the same <em className="font-accent">pressure</em> as a real panel.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mt-[22px] max-w-[450px] text-[17px] leading-[1.55] text-[var(--ink-dim)]"
            >
              Upload your question bank, invite candidates, and get scored reports
              back — without booking a room for every first round.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-8 flex flex-wrap gap-2.5"
            >
              <Link
                href="/contact"
                className="rounded-full bg-[var(--ink)] px-[26px] py-[15px] text-[15px] font-semibold text-[var(--page)] hover:bg-[var(--accent-dim)]"
              >
                Talk to sales
              </Link>
              <Link
                href="#product"
                className="rounded-full border border-[var(--border-mid)] px-[26px] py-[15px] text-[15px] font-semibold text-[var(--ink)] hover:bg-[var(--surface)]"
              >
                See the workspace →
              </Link>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
          >
            <WorkspacePreview />
          </motion.div>
        </div>

        <div className="mt-[70px] grid grid-cols-1 border-y border-[var(--border-mid)] lg:grid-cols-4">
          {PILLARS.map((item, i) => (
            <div
              key={item.value}
              className={`px-6 py-[22px] first:pl-0 last:pr-0 ${
                i > 0 ? "border-t border-[var(--border-mid)] lg:border-l lg:border-t-0" : ""
              }`}
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

      <section id="product" className="mx-auto max-w-[1180px] px-6 pt-[88px] sm:px-8">
        <ScrollReveal className="flex flex-wrap items-end justify-between gap-10">
          <h2 className="font-display max-w-[600px] text-[34px] font-bold leading-[1.02] tracking-[-0.032em] text-[var(--ink)] sm:text-[46px]">
            One workspace. Bank, invites, scores.
          </h2>
          <p className="max-w-[320px] text-[15px] leading-relaxed text-[var(--ink-dim)]">
            Built for hiring teams that already know the rounds — and need a
            consistent first screen, not another calendar.
          </p>
        </ScrollReveal>

        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <ScrollReveal key={f.title} delay={(i % 3) * 0.08}>
              <div
                className={`card-hover flex h-full flex-col rounded-[20px] p-6 ${
                  i === 1
                    ? "bg-[var(--lime)] hover:brightness-95"
                    : i === 0
                      ? "bg-[var(--ink)] text-[var(--page)]"
                      : "border border-[var(--border)] bg-[var(--surface)]"
                }`}
              >
                <div
                  className="grid h-[27px] w-[27px] place-items-center rounded-lg text-xs"
                  style={{
                    background:
                      i === 0 ? "rgba(255,255,255,0.1)" : i === 1 ? "rgba(12,12,11,0.1)" : "var(--page)",
                    color: i === 0 ? "var(--lime)" : "var(--ink)",
                  }}
                >
                  {f.icon}
                </div>
                <h3
                  className={`font-display mt-12 text-xl font-semibold tracking-[-0.02em] ${
                    i === 0 ? "text-[var(--page)]" : "text-[var(--ink)]"
                  }`}
                >
                  {f.title}
                </h3>
                <p
                  className="mt-2 text-sm leading-[1.55]"
                  style={{
                    color: i === 0 ? "#A3A29A" : i === 1 ? "#3C4118" : "var(--ink-dim)",
                  }}
                >
                  {f.body}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-6 pt-[88px] sm:px-8">
        <ScrollReveal>
          <div className="font-label mb-3.5">How it works</div>
          <h2 className="font-display mb-9 text-[32px] font-bold leading-[1.04] tracking-[-0.032em] text-[var(--ink)] sm:text-[42px]">
            Four steps, one decision.
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

      <section className="mx-auto max-w-[1180px] px-6 pt-[88px] sm:px-8">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <ScrollReveal>
            <div className="flex h-full flex-col rounded-[24px] bg-[var(--ink)] p-8 text-[var(--page)] sm:p-10">
              <div className="mb-12 font-mono text-[10px] tracking-[0.16em] text-[var(--lime)]">COMPANIES</div>
              <h3 className="font-display text-[32px] font-bold leading-[1.04] tracking-[-0.03em] sm:text-[36px]">
                Run first rounds without the calendar tax.
              </h3>
              <p className="mt-4 max-w-[420px] text-[15px] leading-relaxed text-[#A3A29A]">
                Seat-based quota, bulk invites, live status and scored transcripts.
                {price} per seat per month.
              </p>
              <Link
                href="/contact"
                className="mt-8 self-start rounded-full px-6 py-3.5 text-sm font-bold text-[var(--ink)] hover:brightness-95"
                style={{ background: "var(--lime)" }}
              >
                Set up an org →
              </Link>
            </div>
          </ScrollReveal>
          <ScrollReveal delay={0.08}>
            <div className="flex h-full flex-col rounded-[24px] bg-[var(--lime)] p-8 sm:p-10">
              <div className="mb-12 font-mono text-[10px] tracking-[0.16em] text-[var(--ink)]">COLLEGES</div>
              <h3 className="font-display text-[32px] font-bold leading-[1.04] tracking-[-0.03em] text-[var(--ink)] sm:text-[36px]">
                Sponsor a whole batch in one campaign.
              </h3>
              <p className="mt-4 max-w-[420px] text-[15px] leading-relaxed text-[#3C4118]">
                Everyone on your email domain gets a full plan, capped at the
                interview limit you set. Students sign up with their college address.
              </p>
              <Link
                href="/contact"
                className="mt-8 self-start rounded-full bg-[var(--ink)] px-6 py-3.5 text-sm font-bold text-[var(--page)] hover:bg-[var(--accent-dim)]"
              >
                Talk about campus →
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <FaqAccordion items={ENTERPRISE_FAQS} heading="Hiring questions, answered." />

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
                Hire with us
              </div>
              <h2 className="font-display text-[36px] font-bold leading-none tracking-[-0.035em] sm:text-[52px]">
                Ready when your next batch is.
              </h2>
              <p className="mt-[18px] max-w-[440px] text-base leading-relaxed text-[#A3A29A]">
                Tell us the roles, the volume, and whether you&apos;re a company or a campus.
                We&apos;ll stand up the workspace.
              </p>
              <Link
                href="/contact"
                className="mt-[30px] inline-block rounded-full px-[30px] py-4 text-[15px] font-bold text-[var(--ink)] hover:brightness-95"
                style={{ background: "var(--lime)" }}
              >
                Talk to sales →
              </Link>
            </div>
          </div>
        </ScrollReveal>
      </section>

      <MarketingFooter />
    </div>
  );
}
