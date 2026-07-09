"use client";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { subscriptions, ApiError } from "@/lib/api";
import { TOPUP_PACKS, TOPUP_PACK_IDS, type TopupPackId } from "@/lib/plans";

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function TopupModal({ onClose }: { onClose: () => void }) {
  const { user, refreshUser } = useAuth();
  const [loadingPack, setLoadingPack] = useState<TopupPackId | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<string | null>(null);

  const isMax = user?.subscription_plan === "max";

  const handleBuy = async (pack: TopupPackId) => {
    setLoadingPack(pack);
    setError("");

    try {
      const order = await subscriptions.createTopupOrder(pack);

      if (!window.Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Failed to load Razorpay"));
          document.body.appendChild(script);
        });
      }

      const rzp = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: "InterviewX",
        description: `${TOPUP_PACKS[pack].label} — ${order.credits} interviews`,
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
            const result = await subscriptions.verifyTopupPayment(
              response.razorpay_order_id,
              response.razorpay_payment_id,
              response.razorpay_signature
            );
            await refreshUser();
            setSuccess(`${result.credits_added} interviews added. You now have ${result.bonus_interviews} bonus credits.`);
          } catch (err) {
            setError("Payment succeeded but verification failed. Contact support.");
          } finally {
            setLoadingPack(null);
          }
        },
        modal: {
          ondismiss: () => setLoadingPack(null),
        },
      });

      rzp.open();
    } catch (err) {
      if (err instanceof ApiError) setError(err.detail);
      else setError("Something went wrong. Please try again.");
      setLoadingPack(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(6, 10, 20, 0.7)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl p-6"
        style={{ background: "var(--navy-light)", border: "1px solid var(--navy-mid)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-lg font-bold" style={{ color: "var(--white)" }}>
            Buy more interviews
          </h2>
          <button onClick={onClose} className="text-sm" style={{ color: "var(--slate-dim)" }}>
            ✕
          </button>
        </div>
        <p className="text-sm mb-5" style={{ color: "var(--slate)" }}>
          Top up any time this month. Credits roll over and never expire.
        </p>

        {isMax ? (
          <p className="text-sm py-4 text-center" style={{ color: "var(--slate)" }}>
            You're on Max — interviews are already unlimited.
          </p>
        ) : success ? (
          <div className="py-4 text-center">
            <p className="text-sm mb-4" style={{ color: "var(--white)" }}>{success}</p>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-lg font-semibold text-sm"
              style={{ background: "var(--indigo)", color: "var(--white)" }}
            >
              Done
            </button>
          </div>
        ) : (
          <>
            {error && (
              <p className="text-sm mb-4" style={{ color: "var(--danger)" }}>
                {error}
              </p>
            )}

            <div className="space-y-3">
              {TOPUP_PACK_IDS.map((packId) => {
                const pack = TOPUP_PACKS[packId];
                return (
                  <button
                    key={packId}
                    onClick={() => handleBuy(packId)}
                    disabled={loadingPack !== null}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-left transition-opacity disabled:opacity-50"
                    style={{ background: "var(--navy-mid)", border: "1px solid var(--navy-mid)" }}
                  >
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "var(--white)" }}>
                        {pack.label} — {pack.credits} interviews
                      </p>
                      <p className="text-xs" style={{ color: "var(--slate-dim)" }}>
                        {pack.perInterview}
                      </p>
                    </div>
                    <span className="text-sm font-bold shrink-0 ml-3" style={{ color: "var(--indigo)" }}>
                      {loadingPack === packId ? "Opening…" : `₹${pack.priceRupees}`}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
