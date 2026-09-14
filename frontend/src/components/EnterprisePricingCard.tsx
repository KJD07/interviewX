"use client";

import { useCurrency, formatPrice } from "@/lib/currency";

export const ENTERPRISE_PRICE_PER_SEAT_RUPEES = 199;
export const ENTERPRISE_UNLIMITED_MONTHLY_RUPEES = 19999;

const ENTERPRISE_SEAT_FEATURES = [
  "Bulk candidate invites with expiring links",
  "Custom question bank upload (.csv, .xlsx, .json)",
  "Org-wide candidate quota & progress tracking",
  "Priority support",
];

const ENTERPRISE_UNLIMITED_FEATURES = [
  "Unlimited seats",
  ...ENTERPRISE_SEAT_FEATURES,
];

export default function EnterprisePricingCard({ className = "" }: { className?: string }) {
  const currency = useCurrency();
  return (
    <div className={`grid grid-cols-1 gap-3 lg:grid-cols-2 text-left min-w-0 ${className}`}>
      <div
        className="flex min-w-0 flex-col rounded-[20px] sm:rounded-3xl p-5 sm:p-8"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] mb-3" style={{ color: "var(--ink-faint)" }}>
          Per seat
        </p>
        <div className="mb-4 flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
          <span className="font-display text-[32px] sm:text-4xl font-bold leading-none tracking-[-0.03em]" style={{ color: "var(--ink)" }}>
            {formatPrice(ENTERPRISE_PRICE_PER_SEAT_RUPEES, currency)}
          </span>
          <span className="text-sm" style={{ color: "var(--ink-faint)" }}>/ seat / month</span>
        </div>
        <ul className="mb-6 flex-1 space-y-2">
          {ENTERPRISE_SEAT_FEATURES.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-sm leading-snug min-w-0" style={{ color: "var(--ink)" }}>
              <span className="shrink-0" style={{ color: "var(--accent)" }}>✓</span>
              <span className="min-w-0 break-words">{f}</span>
            </li>
          ))}
        </ul>
        <a
          href="/contact"
          className="inline-flex w-full justify-center px-5 py-3 rounded-full text-sm font-semibold"
          style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
        >
          Talk to sales →
        </a>
      </div>

      <div
        className="flex min-w-0 flex-col rounded-[20px] sm:rounded-3xl p-5 sm:p-8"
        style={{ background: "var(--hero-bg)", color: "var(--hero-text)" }}
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--lime)" }}>
            Unlimited
          </p>
          <span
            className="rounded-[5px] px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.12em] shrink-0"
            style={{ background: "var(--lime)", color: "var(--ink)" }}
          >
            Best for teams
          </span>
        </div>
        <div className="mb-4 flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
          <span className="font-display text-[32px] sm:text-4xl font-bold leading-none tracking-[-0.03em]">
            {formatPrice(ENTERPRISE_UNLIMITED_MONTHLY_RUPEES, currency)}
          </span>
          <span className="text-sm" style={{ color: "#A3A29A" }}>/ month</span>
        </div>
        <ul className="mb-6 flex-1 space-y-2">
          {ENTERPRISE_UNLIMITED_FEATURES.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-sm leading-snug min-w-0" style={{ color: "#D6D4CC" }}>
              <span className="shrink-0" style={{ color: "var(--lime)" }}>✓</span>
              <span className="min-w-0 break-words">{f}</span>
            </li>
          ))}
        </ul>
        <a
          href="/contact"
          className="inline-flex w-full justify-center px-5 py-3 rounded-full text-sm font-bold"
          style={{ background: "var(--lime)", color: "var(--ink)" }}
        >
          Talk to sales →
        </a>
      </div>
    </div>
  );
}
