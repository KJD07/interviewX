"use client";

import { motion } from "framer-motion";
import MarketingNav from "@/components/MarketingNav";
import MarketingFooter from "@/components/MarketingFooter";

type Point = { label: string; value: string };

export default function AuthPageShell({
  eyebrow,
  title,
  subtitle,
  points,
  extra,
  children,
}: {
  eyebrow: string;
  title: React.ReactNode;
  subtitle: React.ReactNode;
  points: Point[];
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-x-clip bg-[var(--page)]">
      <MarketingNav />

      <section className="mx-auto max-w-[1180px] px-4 pt-24 sm:px-8 sm:pt-36">
        <div className="grid min-w-0 items-start gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-[52px]">
          <div className="order-2 min-w-0 lg:order-1">
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-5 inline-flex max-w-full items-center gap-2.5 rounded-full border border-[var(--border-mid)] bg-[var(--surface)] py-[7px] pl-[11px] pr-3.5 sm:mb-6"
            >
              <span className="el-pulse h-[7px] w-[7px] shrink-0 rounded-full bg-[var(--success)]" />
              <span className="font-mono text-[10px] tracking-[0.06em] text-[var(--ink-dim)] sm:text-[11px]">
                {eyebrow}
              </span>
            </motion.span>

            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="font-display text-[32px] font-bold leading-[1.02] tracking-[-0.035em] text-[var(--ink)] sm:text-[58px] sm:leading-[0.92] lg:text-[64px]"
            >
              {title}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mt-4 max-w-[440px] text-[15px] leading-[1.55] text-[var(--ink-dim)] sm:mt-[22px] sm:text-[17px]"
            >
              {subtitle}
            </motion.p>

            <div className="mt-8 grid grid-cols-1 border-y border-[var(--border-mid)] sm:mt-10 sm:grid-cols-3">
              {points.map((item, i) => (
                <div
                  key={item.value}
                  className={`px-0 py-3.5 sm:px-5 sm:py-[18px] sm:first:pl-0 sm:last:pr-0 ${
                    i > 0 ? "border-t border-[var(--border-mid)] sm:border-l sm:border-t-0" : ""
                  }`}
                >
                  <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--ink-faint)]">
                    {item.label}
                  </div>
                  <div className="font-display mt-1.5 text-[15px] font-semibold tracking-[-0.02em] text-[var(--ink)] sm:text-[16px]">
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            {extra}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="order-1 min-w-0 lg:order-2"
          >
            <div className="rounded-[20px] border border-[var(--border-mid)] bg-[var(--surface)] p-5 sm:rounded-[24px] sm:p-8">
              {children}
            </div>
          </motion.div>
        </div>
      </section>

      <div className="mt-16">
        <MarketingFooter />
      </div>
    </div>
  );
}

export const authInputClass =
  "w-full rounded-[12px] bg-[var(--surface-alt)] px-4 py-3 text-base text-[var(--ink)] placeholder:text-[var(--ink-faint)] sm:text-[15px]";

export const authInputStyle = {
  border: "1px solid var(--border-mid)",
} as const;

export const authLabelClass = "font-label mb-2 block";
