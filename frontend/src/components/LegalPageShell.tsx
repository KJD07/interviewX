"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import MarketingNav from "@/components/MarketingNav";
import MarketingFooter from "@/components/MarketingFooter";
import { ScrollReveal } from "@/components/ScrollReveal";
import { SUPPORT_EMAIL } from "@/lib/legal";

const POLICY_LINKS = [
  { href: "/terms", label: "Terms & Conditions" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/refund", label: "Refund Policy" },
  { href: "/cancellation", label: "Cancellation Policy" },
] as const;

export default function LegalPageShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="relative min-h-screen bg-[var(--page)]">
      <MarketingNav />

      <section className="mx-auto max-w-[1180px] px-6 pt-32 sm:px-8 sm:pt-36">
        <div className="font-label mb-4">Legal</div>
        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="font-display max-w-2xl text-[40px] font-bold leading-[0.94] tracking-[-0.035em] text-[var(--ink)] sm:text-[56px]"
        >
          {title}
        </motion.h1>
        {description && (
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mt-[18px] max-w-[520px] text-[17px] leading-[1.55] text-[var(--ink-dim)]"
          >
            {description}
          </motion.p>
        )}
      </section>

      <section className="mx-auto max-w-[1180px] px-6 pb-8 pt-12 sm:px-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_260px] lg:gap-12">
          <ScrollReveal>
            <article
              className="rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-8 sm:p-10 [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:opacity-70 [&_h2]:font-display [&_h2]:border-t [&_h2]:border-[var(--border-mid)] [&_h2]:pb-0 [&_h2]:pt-7 [&_h2]:text-[19px] [&_h2]:font-semibold [&_h2]:tracking-[-0.02em] [&_h2]:text-[var(--ink)] [&_h2:first-of-type]:border-t-0 [&_h2:first-of-type]:pt-0 [&_p]:text-[15px] [&_p]:leading-[1.65] [&_p]:text-[var(--ink-dim)] [&_strong]:font-semibold [&_strong]:text-[var(--ink)] [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_ul]:text-[15px] [&_ul]:leading-[1.65] [&_ul]:text-[var(--ink-dim)] space-y-4"
            >
              {children}
            </article>
          </ScrollReveal>

          <aside className="lg:sticky lg:top-28 lg:self-start">
            <ScrollReveal delay={0.08}>
              <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-6">
                <p className="font-label mb-4">All policies</p>
                <nav className="flex flex-col gap-1">
                  {POLICY_LINKS.map((link) => {
                    const active = pathname === link.href;
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={`rounded-[10px] px-3 py-2.5 text-sm transition-colors ${
                          active
                            ? "bg-[var(--ink)] font-semibold text-[var(--page)]"
                            : "text-[var(--ink-dim)] hover:bg-[var(--surface-alt)] hover:text-[var(--ink)]"
                        }`}
                      >
                        {link.label}
                      </Link>
                    );
                  })}
                </nav>
              </div>
            </ScrollReveal>
          </aside>
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-6 pb-16 sm:px-8">
        <ScrollReveal>
          <div
            className="relative overflow-hidden rounded-[24px] px-8 py-12 sm:px-12 sm:py-14"
            style={{ background: "var(--hero-bg)" }}
          >
            <div
              className="el-float pointer-events-none absolute -bottom-[80px] -right-[60px] h-[220px] w-[220px] rounded-full"
              style={{ background: "var(--lime)" }}
            />
            <div className="relative max-w-[480px]">
              <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--lime)]">
                Questions?
              </p>
              <h2 className="font-display text-[28px] font-bold leading-[1.04] tracking-[-0.032em] text-[var(--hero-text)] sm:text-[34px]">
                Need help with billing or your account?
              </h2>
              <p className="mt-3 text-[15px] leading-[1.6] text-[#A3A29A]">
                Email us and we&apos;ll get back to you within a working day.
              </p>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="mt-6 inline-block rounded-full px-6 py-3.5 text-sm font-bold text-[var(--ink)] hover:brightness-95"
                style={{ background: "var(--lime)" }}
              >
                {SUPPORT_EMAIL}
              </a>
            </div>
          </div>
        </ScrollReveal>
      </section>

      <MarketingFooter />
    </div>
  );
}
