"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { subscriptions, ApiError } from "@/lib/api";

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function UpgradePage() {
  const { user, login } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleUpgrade = async () => {
    setLoading(true);
    setError("");

    try {
      // 1. Create order on backend
      const order = await subscriptions.createOrder();

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
        description: "Premium Plan — 1 Month",
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
            // Redirect to dashboard — user will see Premium badge
            router.replace("/dashboard?upgraded=1");
          } catch (err) {
            setError("Payment succeeded but verification failed. Contact support.");
          } finally {
            setLoading(false);
          }
        },
        modal: {
          ondismiss: () => setLoading(false),
        },
      });

      rzp.open();
    } catch (err) {
      if (err instanceof ApiError) setError(err.detail);
      else setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--navy)" }}>
        <div
          className="w-full max-w-md rounded-xl p-8 fade-up"
          style={{ background: "var(--navy-light)", border: "1px solid var(--navy-mid)" }}
        >
          {/* Header */}
          <div className="text-center mb-8">
            <span
              className="inline-block text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-widest mb-4"
              style={{ background: "var(--indigo-glow)", color: "var(--indigo)" }}
            >
              Premium
            </span>
            <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--white)" }}>
              Unlock unlimited interviews
            </h1>
            <p className="text-sm" style={{ color: "var(--slate)" }}>
              Free plan is limited to 2 interviews/month.
            </p>
          </div>

          {/* Price */}
          <div className="text-center mb-8">
            <span className="text-5xl font-bold" style={{ color: "var(--white)" }}>₹499</span>
            <span className="text-sm ml-2" style={{ color: "var(--slate)" }}>/month</span>
          </div>

          {/* Features */}
          <ul className="space-y-3 mb-8">
            {[
              "Unlimited AI mock interviews",
              "All companies, roles & rounds",
              "Detailed scores & feedback",
              "Cancel anytime",
            ].map((f) => (
              <li key={f} className="flex items-center gap-3 text-sm" style={{ color: "var(--slate)" }}>
                <span style={{ color: "#22c55e" }}>✓</span>
                {f}
              </li>
            ))}
          </ul>

          {/* Error */}
          {error && (
            <p className="text-sm mb-4 text-center" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          )}

          {/* CTA */}
          <button
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full py-3 rounded-lg font-semibold text-sm transition-opacity disabled:opacity-50"
            style={{ background: "var(--indigo)", color: "var(--white)" }}
          >
            {loading ? "Opening checkout…" : "Upgrade to Premium — ₹499/mo"}
          </button>

          <button
            onClick={() => router.back()}
            className="w-full mt-3 py-2 text-sm hover:underline"
            style={{ color: "var(--slate-dim)" }}
          >
            Go back
          </button>
        </div>
      </div>
    </ProtectedRoute>
  );
}