"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { subscriptions, ApiError } from "@/lib/api";
import { PLANS, PAID_PLAN_IDS, type PlanId } from "@/lib/plans";

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function UpgradePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);
  const [error, setError] = useState("");

  const currentPlan = (user?.subscription_plan as PlanId) || "free";

  const handleUpgrade = async (plan: PlanId) => {
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
        name: "InterviewX",
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
    <ProtectedRoute>
      <div className="min-h-screen px-6 py-12" style={{ background: "var(--page)" }}>
        <div className="max-w-5xl mx-auto fade-up">
          {/* Header */}
          <div className="text-center mb-10">
            <span
              className="inline-block text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-widest mb-4"
              style={{ background: "var(--accent-glow)", color: "var(--accent)" }}
            >
              Plans
            </span>
            <h1 className="font-display text-2xl font-bold mb-2" style={{ color: "var(--ink)" }}>
              Choose the plan that fits your prep
            </h1>
            <p className="text-sm" style={{ color: "var(--ink-dim)" }}>
              Free plan is limited to {PLANS.free.monthlyLimit} interviews/month.
            </p>
          </div>

          {error && (
            <p className="text-sm mb-6 text-center" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          )}

          {/* Plan cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PAID_PLAN_IDS.map((planId) => {
              const plan = PLANS[planId];
              const isCurrent = currentPlan === planId;
              const isMax = planId === "max";

              return (
                <div
                  key={planId}
                  className="rounded-xl p-8 flex flex-col"
                  style={{
                    background: "var(--surface)",
                    border: isMax
                      ? "1px solid var(--accent)"
                      : "1px solid var(--border-mid)",
                  }}
                >
                  {isMax && (
                    <span
                      className="self-start text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider mb-4"
                      style={{ background: "var(--accent-glow)", color: "var(--accent)" }}
                    >
                      Best value
                    </span>
                  )}

                  <h2 className="font-display text-lg font-bold mb-1" style={{ color: "var(--ink)" }}>
                    {plan.label}
                  </h2>

                  <div className="mb-6">
                    <span className="text-4xl font-bold" style={{ color: "var(--ink)" }}>
                      ₹{plan.priceRupees}
                    </span>
                    <span className="text-sm ml-2" style={{ color: "var(--ink-dim)" }}>
                      /month
                    </span>
                  </div>

                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((f) => (
                      <li
                        key={f}
                        className="flex items-start gap-3 text-sm"
                        style={{ color: "var(--ink-dim)" }}
                      >
                        <span style={{ color: "#22c55e" }}>✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleUpgrade(planId)}
                    disabled={loadingPlan !== null || isCurrent}
                    className="w-full py-3 rounded-full font-semibold text-sm transition-opacity disabled:opacity-50"
                    style={
                      isMax
                        ? { background: "var(--accent)", color: "var(--accent-ink)" }
                        : {
                            background: "transparent",
                            color: "var(--accent)",
                            border: "1px solid var(--accent)",
                          }
                    }
                  >
                    {isCurrent
                      ? "Current plan"
                      : loadingPlan === planId
                      ? "Opening checkout…"
                      : `Choose ${plan.label} — ₹${plan.priceRupees}/mo`}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="text-center mt-8">
            <button
              onClick={() => router.back()}
              className="text-sm hover:underline"
              style={{ color: "var(--ink-faint)" }}
            >
              Go back
            </button>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
