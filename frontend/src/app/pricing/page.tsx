"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import MarketingNav from "@/components/MarketingNav";
import { ScrollReveal } from "@/components/ScrollReveal";
import { PLANS, PAID_PLAN_IDS, type PlanId } from "@/lib/plans";
import { subscriptions, ApiError } from "@/lib/api";

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
    <div className="border-t border-[var(--border-mid)] py-5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 text-left text-lg font-semibold tracking-tight text-[var(--ink)]"
      >
        {q}
        <motion.span
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="flex-shrink-0 text-2xl leading-none text-[var(--ink-faint)]"
        >
          +
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className="mt-3 text-sm leading-relaxed text-[var(--ink-dim)]">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function Pricing() {
  const { user } = useAuth();
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);
  const [error, setError] = useState("");

  const currentPlan = (user?.subscription_plan as PlanId) || "free";

  const handleUpgrade = async (plan: PlanId) => {
    if (!user) {
      router.push("/register");
      return;
    }

    setLoadingPlan(plan);
    setError("");

    try {
      // 1. Create order on backend for the chosen plan
      const order = await subscriptions.createOrder(plan as "pro" | "premium" | "max");

      // 2. Load Razorpay script if not already loaded
      if (!window.Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Failed to load Razorpay"));
          document.body.appendChild(script);
        });
      }

      // 3. Open Razorpay checkout
      const rzp = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: "EvaluLabs",
        description: `${PLANS[plan].label} Plan — 1 Month`,
        order_id: order.order_id,
        prefill: {
          email: order.user_email,
          name: order.user_name,
        },
        theme: { color: "#6366f1" },
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            await subscriptions.verifyPayment(
              response.razorpay_order_id,
              response.razorpay_payment_id,
              response.razorpay_signature
            );
            // Redirect to dashboard — user will see their new plan badge
            router.replace("/dashboard?upgraded=1");
          } catch (err) {
            setError("Payment succeeded but verification failed. Contact support.");
          } finally {
            setLoadingPlan(null);
          }
        },
        modal: {
          ondismiss: () => setLoadingPlan(null),
        },
      });

      rzp.open();
    } catch (err) {
      if (err instanceof ApiError) setError(err.detail);
      else setError("Something went wrong. Please try again.");
      setLoadingPlan(null);
    }
  };

  return (
    <div className="relative min-h-screen bg-[var(--page)]">
      <MarketingNav />

      <section className="mx-auto max-w-4xl px-6 pb-10 pt-40 sm:pt-48">
        <div className="mb-7 inline-flex items-center gap-2.5 rounded-full border border-[var(--border-mid)] px-3.5 py-1.5 text-[13px] font-medium">
          Simple, transparent pricing
        </div>
        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="font-display max-w-2xl text-5xl font-semibold tracking-tight text-[var(--ink)] sm:text-7xl"
        >
          Simple, transparent pricing.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--ink-dim)]"
        >
          Start free with {PLANS.free.monthlyLimit} interviews a month. Upgrade any time for more
          sessions, full history, and AI-powered insights.
        </motion.p>
      </section>

      {error && (
        <p className="mx-auto mb-6 max-w-2xl px-6 text-center text-sm" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}

      <section className="mx-auto max-w-6xl px-6 pb-16 pt-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-stretch">
          <ScrollReveal>
            <div className="flex h-full flex-col rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8">
              <p className="mb-5 text-[13px] font-semibold uppercase tracking-wider text-[var(--ink-faint)]">{PLANS.free.label}</p>
              <div className="mb-6 flex items-baseline gap-1.5">
                <span className="font-display text-4xl font-semibold tracking-tight text-[var(--ink)]">₹0</span>
                <span className="text-sm text-[var(--ink-faint)]">/ month</span>
              </div>
              <ul className="mb-7 flex-1 space-y-3">
                {PLANS.free.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-[var(--ink)]">
                    <span>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => router.push(user ? "/dashboard" : "/register")}
                disabled={loadingPlan !== null}
                className="w-full rounded-full border border-[var(--border-mid)] py-3.5 text-sm font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--surface-2)] disabled:opacity-50"
              >
                {user ? "Go to Dashboard" : "Start free"}
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
                  className={`relative flex h-full flex-col rounded-3xl p-8 ${
                    isBestValue
                      ? "bg-[var(--ink)] text-[var(--page)]"
                      : "border border-[var(--border)] bg-[var(--surface)]"
                  }`}
                >
                  {isBestValue && (
                    <span className="absolute right-6 top-6 rounded-full bg-[var(--lime)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink)]">
                      Best value
                    </span>
                  )}
                  <p
                    className={`mb-5 text-[13px] font-semibold uppercase tracking-wider ${
                      isBestValue ? "text-[var(--lime)]" : "text-[var(--ink-faint)]"
                    }`}
                  >
                    {plan.label}
                  </p>
                  <div className="mb-6 flex items-baseline gap-1.5">
                    <span className="font-display text-4xl font-semibold tracking-tight">₹{plan.priceRupees}</span>
                    <span className={`text-sm ${isBestValue ? "text-[var(--ink-faint)]" : "text-[var(--ink-faint)]"}`}>
                      / month
                    </span>
                  </div>
                  <ul className="mb-7 flex-1 space-y-3">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm">
                        <span className={isBestValue ? "text-[var(--lime)]" : undefined}>✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => handleUpgrade(planId)}
                    disabled={loadingPlan !== null || isCurrent}
                    className={`w-full rounded-full py-3.5 text-sm font-semibold transition-transform duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 ${
                      isBestValue
                        ? "bg-[var(--lime)] text-[var(--ink)]"
                        : "border border-[var(--border-mid)] text-[var(--ink)] hover:bg-[var(--surface-2)]"
                    }`}
                  >
                    {isCurrent
                      ? "Current plan"
                      : loadingPlan === planId
                      ? "Opening checkout…"
                      : `Choose ${plan.label}`}
                  </button>
                </div>
              </ScrollReveal>
            );
          })}
        </div>

        <div className="mt-24">
          <p className="mb-5 text-xs font-semibold uppercase tracking-wider text-[var(--ink-faint)]">Compare</p>
          <h2 className="font-display mb-8 text-3xl font-semibold tracking-tight text-[var(--ink)] sm:text-4xl">
            Everything in every plan.
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
            <div className="min-w-[640px]">
              <div className="grid grid-cols-5 gap-4 border-b border-[var(--border)] px-7 py-5 text-xs font-semibold uppercase tracking-wider text-[var(--ink-faint)]">
                <div className="col-span-1">Feature</div>
                <div>Free</div>
                <div>Pro</div>
                <div>Premium</div>
                <div>Max</div>
              </div>
              <div className="grid grid-cols-5 gap-4 border-b border-[var(--border)] px-7 py-4 text-sm">
                <div className="col-span-1">Mock interviews / month</div>
                <div>{PLANS.free.monthlyLimit}</div>
                {PAID_PLAN_IDS.map((id) => (
                  <div key={id}>{PLANS[id].monthlyLimit ?? "Unlimited"}</div>
                ))}
              </div>
              <div className="grid grid-cols-5 gap-4 border-b border-[var(--border)] px-7 py-4 text-sm">
                <div className="col-span-1">Companies, roles &amp; rounds</div>
                <div className="text-[var(--ink-dim)]">Limited</div>
                {PAID_PLAN_IDS.map((id) => (
                  <div key={id}>All</div>
                ))}
              </div>
              <div className="grid grid-cols-5 gap-4 border-b border-[var(--border)] px-7 py-4 text-sm">
                <div className="col-span-1">Full dashboard &amp; history</div>
                <div className="text-[var(--ink-faint)]">{PLANS.free.hasInsights ? "✓" : "—"}</div>
                {PAID_PLAN_IDS.map((id) => (
                  <div key={id}>{PLANS[id].hasInsights ? "✓" : "—"}</div>
                ))}
              </div>
              <div className="grid grid-cols-5 gap-4 border-b border-[var(--border)] px-7 py-4 text-sm">
                <div className="col-span-1">AI insights &amp; topic scoring</div>
                <div className="text-[var(--ink-faint)]">{PLANS.free.hasInsights ? "✓" : "—"}</div>
                {PAID_PLAN_IDS.map((id) => (
                  <div key={id}>{PLANS[id].hasInsights ? "✓" : "—"}</div>
                ))}
              </div>
              <div className="grid grid-cols-5 gap-4 px-7 py-4 text-sm">
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

        <div className="mt-24 grid grid-cols-1 gap-12 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-[var(--ink-faint)]">FAQ</p>
            <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight text-[var(--ink)]">
              Fair questions, short answers.
            </h2>
          </div>
          <div className="border-b border-[var(--border-mid)]">
            {FAQS.map((faq, i) => (
              <FaqItem key={faq.q} q={faq.q} a={faq.a} defaultOpen={i === 0} />
            ))}
          </div>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-6 pb-12 pt-4">
        <div className="flex items-center justify-between border-t border-[var(--border)] pt-6 text-xs text-[var(--ink-faint)]">
          <span>© {new Date().getFullYear()} EvaluLabs</span>
          <div className="flex gap-6">
            <Link href="/about" className="hover:opacity-70">About</Link>
            <Link href="/contact" className="hover:opacity-70">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
