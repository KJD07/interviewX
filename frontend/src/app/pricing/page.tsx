"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import MarketingNav from "@/components/MarketingNav";
import MarketingFooter from "@/components/MarketingFooter";
import { ScrollReveal } from "@/components/ScrollReveal";
import { PLANS, PAID_PLAN_IDS, type PlanId } from "@/lib/plans";
import { subscriptions, ApiError } from "@/lib/api";
import { submitPayUCheckout } from "@/lib/payuCheckout";
import { useCurrency, formatPrice } from "@/lib/currency";

// One-line positioning note per tier — display copy only, so it lives here
// rather than in lib/plans.ts (which mirrors the backend plan table).
const PLAN_NOTES: Record<PlanId, string> = {
  free: "Try the format",
  pro: "Steady practice",
  premium: "Interview season",
  max: "Every day until offer",
};

const FAQS: { q: string; a: ReactNode }[] = [
  {
    q: "Can I switch plans mid-cycle?",
    a: "Yes — upgrades apply immediately, downgrades take effect next billing period. No pro-rating headaches.",
  },
  {
    q: "What happens if I run out of interviews?",
    a: "You can top up with additional sessions or upgrade to the next tier — whichever's cheaper for your month.",
  },
  {
    q: "Do unused interviews roll over?",
    a: "No — sessions reset each cycle so pricing stays honest. Pick the tier that matches how many rooms you'll actually walk into.",
  },
  {
    q: "Cohort or team discounts?",
    a: (
      <>
        Yes —{" "}
        <Link href="/contact" className="underline underline-offset-4 hover:opacity-70">
          get in touch
        </Link>{" "}
        for bootcamps, universities, and career-services teams.
      </>
    ),
  },
];

function FaqItem({ q, a, defaultOpen = false }: { q: string; a: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-[var(--border-mid)]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-5 px-0.5 py-[19px] text-left text-base font-semibold text-[var(--ink)] transition-colors hover:text-[var(--olive)]"
      >
        {q}
        <motion.span
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="flex-shrink-0 font-mono text-base leading-none text-[var(--ink-faint)]"
        >
          +
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            {/* Fade/slide lives on the inner element, not the clipping one:
                animating height and opacity together made the answer read as
                half-present for the whole open, which is what felt janky. */}
            <motion.p
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.26, ease: [0.22, 1, 0.36, 1], delay: 0.06 } }}
              exit={{ opacity: 0, y: -6, transition: { duration: 0.14, ease: "easeIn" } }}
              className="mt-3 text-sm leading-relaxed text-[var(--ink-dim)]"
            >
              {a}
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Pricing() {
  const { user } = useAuth();
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);
  const [error, setError] = useState("");
  const currency = useCurrency();

  const currentPlan = (user?.subscription_plan as PlanId) || "free";

  const handleUpgrade = async (plan: PlanId) => {
    if (!user) {
      router.push("/register");
      return;
    }

    setLoadingPlan(plan);
    setError("");

    try {
      const order = await subscriptions.createOrder(plan as "pro" | "premium" | "max");
      submitPayUCheckout(order);
    } catch (err) {
      if (err instanceof ApiError) setError(err.detail);
      else setError("Something went wrong. Please try again.");
      setLoadingPlan(null);
    }
  };

  return (
    <div className="relative min-h-screen bg-[var(--page)]">
      <MarketingNav />

      <section className="mx-auto max-w-[1180px] px-6 pb-4 pt-32 sm:px-8 sm:pt-36">
        <div className="font-label mb-4">Pricing</div>
        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="font-display max-w-2xl text-[40px] font-bold leading-[0.94] tracking-[-0.035em] text-[var(--ink)] sm:text-[64px]"
        >
          Simple, transparent pricing.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mt-[18px] max-w-[470px] text-[17px] leading-[1.55] text-[var(--ink-dim)]"
        >
          Start free with {PLANS.free.monthlyLimit} interviews a month. Upgrade any time for more
          sessions, full history and topic-level insight.
        </motion.p>
      </section>

      {error && (
        <p className="mx-auto mb-6 max-w-2xl px-6 text-center text-sm" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}

      <section className="mx-auto max-w-[1180px] px-6 pb-16 pt-11 sm:px-8">
        {currency === "USD" && (
          <p className="mb-4 text-xs text-[var(--ink-faint)]">
            Prices shown in USD for reference — checkout is billed in INR at the current exchange rate.
          </p>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-stretch">
          <ScrollReveal>
            <div className="card-hover flex h-full flex-col rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-6">
              <div className="mb-4 flex items-baseline justify-between gap-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--ink-faint)]">
                  {PLANS.free.label}
                </span>
                <span className="text-xs text-[var(--ink-faint)]">{PLAN_NOTES.free}</span>
              </div>
              <div className="font-display text-[42px] font-bold leading-none tracking-[-0.04em] text-[var(--ink)]">
                {formatPrice(0, currency)}
              </div>
              <div className="mb-[22px] mt-1 text-xs text-[var(--ink-faint)]">/ month</div>
              <ul className="mb-[26px] flex-1 space-y-2.5">
                {PLANS.free.features.map((f) => (
                  <li key={f} className="grid grid-cols-[16px_1fr] gap-2 text-sm leading-[1.4] text-[var(--ink-dim)]">
                    <span className="text-[var(--olive)]">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => router.push(user ? "/dashboard" : "/register")}
                disabled={loadingPlan !== null}
                className="mt-auto w-full rounded-full border border-[var(--border-mid)] py-3.5 text-sm font-semibold text-[var(--ink)] transition-colors hover:border-[var(--ink)] hover:bg-[var(--ink)] hover:text-[var(--page)] disabled:opacity-50"
              >
                {user ? "Go to dashboard" : "Start free"}
              </button>
            </div>
          </ScrollReveal>

          {PAID_PLAN_IDS.map((planId, i) => {
            const plan = PLANS[planId];
            const isBestValue = planId === "premium";
            const isCurrent = user != null && currentPlan === planId;
            return (
              <ScrollReveal key={planId} delay={(i + 1) * 0.08}>
                <div
                  className={`card-hover relative flex h-full flex-col rounded-[20px] p-6 ${
                    isBestValue
                      ? "bg-[var(--ink)] text-[var(--page)] shadow-[0_26px_54px_-26px_rgba(12,12,11,0.55)]"
                      : "border border-[var(--border)] bg-[var(--surface)]"
                  }`}
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <span
                      className={`font-mono text-[10px] uppercase tracking-[0.16em] ${
                        isBestValue ? "text-[var(--lime)]" : "text-[var(--ink-faint)]"
                      }`}
                    >
                      {plan.label}
                    </span>
                    {isBestValue ? (
                      <span className="rounded-[5px] bg-[var(--lime)] px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--ink)]">
                        Best value
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--ink-faint)]">{PLAN_NOTES[planId]}</span>
                    )}
                  </div>
                  <div className="font-display text-[42px] font-bold leading-none tracking-[-0.04em]">
                    {formatPrice(plan.priceRupees, currency)}
                  </div>
                  <div className="mb-[22px] mt-1 text-xs text-[var(--ink-faint)]">/ month</div>
                  <ul className="mb-[26px] flex-1 space-y-2.5">
                    {plan.features.map((f) => (
                      <li
                        key={f}
                        className={`grid grid-cols-[16px_1fr] gap-2 text-sm leading-[1.4] ${
                          isBestValue ? "text-[#D6D4CC]" : "text-[var(--ink-dim)]"
                        }`}
                      >
                        <span className={isBestValue ? "text-[var(--lime)]" : "text-[var(--olive)]"}>✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => handleUpgrade(planId)}
                    disabled={loadingPlan !== null || isCurrent}
                    className={`mt-auto w-full rounded-full py-3.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
                      isBestValue
                        ? "bg-[var(--lime)] font-bold text-[var(--ink)] hover:brightness-95"
                        : "border border-[var(--border-mid)] text-[var(--ink)] hover:border-[var(--ink)] hover:bg-[var(--ink)] hover:text-[var(--page)]"
                    }`}
                  >
                    {isCurrent
                      ? "Current plan"
                      : loadingPlan === planId
                      ? "Redirecting to PayU…"
                      : `Choose ${plan.label}`}
                  </button>
                </div>
              </ScrollReveal>
            );
          })}
        </div>

        <div className="mt-[88px]">
          <div className="mb-[26px] flex flex-wrap items-end justify-between gap-6">
            <div>
              <div className="font-label mb-3">Compare</div>
              <h2 className="font-display text-[30px] font-bold leading-[1.04] tracking-[-0.032em] text-[var(--ink)] sm:text-[38px]">
                Everything in every plan.
              </h2>
            </div>
            {user && (
              <span className="text-[13px] text-[var(--ink-faint)]">
                Currently on <strong className="text-[var(--ink)]">{PLANS[currentPlan].label}</strong>
              </span>
            )}
          </div>
          <div className="overflow-x-auto rounded-[18px] border border-[var(--border)] bg-[var(--surface)]">
            <div className="min-w-[640px]">
              <div className="grid grid-cols-5 gap-4 border-b border-[var(--border)] bg-[var(--surface-alt)] px-[22px] py-3.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--ink-faint)]">
                <div className="col-span-1">Feature</div>
                <div>Free</div>
                <div>Pro</div>
                <div>Premium</div>
                <div>Max</div>
              </div>
              <div className="grid grid-cols-5 gap-4 border-b border-[var(--border)] px-[22px] py-[15px] text-sm transition-colors hover:bg-[var(--surface-alt)]">
                <div className="col-span-1">Mock interviews / month</div>
                <div>{PLANS.free.monthlyLimit}</div>
                {PAID_PLAN_IDS.map((id) => (
                  <div key={id}>{PLANS[id].monthlyLimit ?? "Unlimited"}</div>
                ))}
              </div>
              <div className="grid grid-cols-5 gap-4 border-b border-[var(--border)] px-[22px] py-[15px] text-sm transition-colors hover:bg-[var(--surface-alt)]">
                <div className="col-span-1">Companies, roles &amp; rounds</div>
                <div className="text-[var(--ink-dim)]">Limited</div>
                {PAID_PLAN_IDS.map((id) => (
                  <div key={id}>All</div>
                ))}
              </div>
              <div className="grid grid-cols-5 gap-4 border-b border-[var(--border)] px-[22px] py-[15px] text-sm transition-colors hover:bg-[var(--surface-alt)]">
                <div className="col-span-1">Full dashboard &amp; history</div>
                <div className="text-[var(--ink-faint)]">{PLANS.free.hasInsights ? "✓" : "—"}</div>
                {PAID_PLAN_IDS.map((id) => (
                  <div key={id}>{PLANS[id].hasInsights ? "✓" : "—"}</div>
                ))}
              </div>
              <div className="grid grid-cols-5 gap-4 border-b border-[var(--border)] px-[22px] py-[15px] text-sm transition-colors hover:bg-[var(--surface-alt)]">
                <div className="col-span-1">AI insights &amp; topic scoring</div>
                <div className="text-[var(--ink-faint)]">{PLANS.free.hasInsights ? "✓" : "—"}</div>
                {PAID_PLAN_IDS.map((id) => (
                  <div key={id}>{PLANS[id].hasInsights ? "✓" : "—"}</div>
                ))}
              </div>
              <div className="grid grid-cols-5 gap-4 px-[22px] py-[15px] text-sm transition-colors hover:bg-[var(--surface-alt)]">
                <div className="col-span-1">Priority support</div>
                <div className="text-[var(--ink-faint)]">
                  {PLANS.free.features.includes("Priority support") ? "✓" : "—"}
                </div>
                {PAID_PLAN_IDS.map((id) => (
                  <div key={id} className={PLANS[id].features.includes("Priority support") ? undefined : "text-[var(--ink-faint)]"}>
                    {PLANS[id].features.includes("Priority support") ? "✓" : "—"}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-20 grid grid-cols-1 gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-[52px]">
          <div>
            <div className="font-label mb-3.5">FAQ</div>
            <h2 className="font-display text-[30px] font-bold leading-[1.04] tracking-[-0.032em] text-[var(--ink)] sm:text-[36px]">
              Fair questions, short answers.
            </h2>
          </div>
          <div>
            {FAQS.map((faq, i) => (
              <FaqItem key={faq.q} q={faq.q} a={faq.a} defaultOpen={i === 0} />
            ))}
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
