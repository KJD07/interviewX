"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import MarketingNav from "@/components/MarketingNav";
import { ScrollReveal, GlassCard } from "@/components/ScrollReveal";
import { PLANS, PAID_PLAN_IDS, type PlanId } from "@/lib/plans";
import { subscriptions, ApiError } from "@/lib/api";

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
    <div className="relative min-h-screen overflow-hidden bg-[var(--page)]">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-[520px] w-[520px] rounded-full bg-[var(--accent-glow)] blur-[120px]" />
        <div className="absolute top-1/3 -right-40 h-[420px] w-[420px] rounded-full bg-[var(--surface-2)] blur-[100px]" />
      </div>

      <MarketingNav />

      <section className="mx-auto max-w-4xl px-6 pb-16 pt-40 text-center sm:pt-48">
        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="font-display text-4xl font-semibold tracking-tight text-[var(--ink)] sm:text-5xl"
        >
          Simple, transparent pricing
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mx-auto mt-6 max-w-2xl text-lg text-[var(--ink-dim)]"
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

      <section className="mx-auto max-w-6xl px-6 pb-28">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <ScrollReveal>
            <GlassCard hover={false} className="flex h-full flex-col bg-white/30">
              <h3 className="font-display text-lg font-semibold text-[var(--ink)]">{PLANS.free.label}</h3>
              <div className="mt-3 mb-6">
                <span className="font-display text-3xl font-semibold text-[var(--ink)]">₹0</span>
                <span className="ml-1 text-sm text-[var(--ink-dim)]">/month</span>
              </div>
              <ul className="mb-8 flex-1 space-y-3">
                {PLANS.free.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-[var(--ink-dim)]">
                    <span className="text-[var(--accent-dim)]">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => router.push(user ? "/dashboard" : "/register")}
                disabled={loadingPlan !== null}
                className="w-full rounded-full border border-[var(--border-mid)] py-3 text-sm font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--surface-2)] disabled:opacity-50"
              >
                {user ? "Go to Dashboard" : "Start free"}
              </button>
            </GlassCard>
          </ScrollReveal>

          {PAID_PLAN_IDS.map((planId, i) => {
            const plan = PLANS[planId];
            const isMax = planId === "max";
            const isCurrent = user != null && currentPlan === planId;
            return (
              <ScrollReveal key={planId} delay={(i + 1) * 0.08}>
                <GlassCard
                  hover={false}
                  className={`flex h-full flex-col ${isMax ? "bg-[var(--hero-bg)]" : "bg-white/30"}`}
                >
                  {isMax && (
                    <span className="mb-3 self-start rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[var(--hero-text)]">
                      Best value
                    </span>
                  )}
                  <h3
                    className={`font-display text-lg font-semibold ${
                      isMax ? "text-[var(--hero-text)]" : "text-[var(--ink)]"
                    }`}
                  >
                    {plan.label}
                  </h3>
                  <div className="mt-3 mb-6">
                    <span
                      className={`font-display text-3xl font-semibold ${
                        isMax ? "text-[var(--hero-text)]" : "text-[var(--ink)]"
                      }`}
                    >
                      ₹{plan.priceRupees}
                    </span>
                    <span
                      className={`ml-1 text-sm ${isMax ? "text-[var(--hero-text)] opacity-80" : "text-[var(--ink-dim)]"}`}
                    >
                      /month
                    </span>
                  </div>
                  <ul className="mb-8 flex-1 space-y-3">
                    {plan.features.map((f) => (
                      <li
                        key={f}
                        className={`flex items-start gap-2 text-sm ${
                          isMax ? "text-[var(--hero-text)] opacity-90" : "text-[var(--ink-dim)]"
                        }`}
                      >
                        <span className={isMax ? "opacity-90" : "text-[var(--accent-dim)]"}>✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => handleUpgrade(planId)}
                    disabled={loadingPlan !== null || isCurrent}
                    className={`w-full rounded-full py-3 text-sm font-semibold transition-transform duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 ${
                      isMax
                        ? "bg-[var(--page)] text-[var(--ink)]"
                        : "border border-[var(--border-mid)] text-[var(--ink)] hover:bg-[var(--surface-2)]"
                    }`}
                  >
                    {isCurrent
                      ? "Current plan"
                      : loadingPlan === planId
                      ? "Opening checkout…"
                      : `Choose ${plan.label}`}
                  </button>
                </GlassCard>
              </ScrollReveal>
            );
          })}
        </div>
      </section>

      <footer className="border-t border-[var(--border)] px-6 py-10 text-center text-xs text-[var(--ink-faint)]">
        © {new Date().getFullYear()} EvaluLabs
      </footer>
    </div>
  );
}
