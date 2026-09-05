"use client";
import { useState } from "react";
import { createPortal } from "react-dom";
import { subscriptions, ApiError } from "@/lib/api";
import { submitPayUCheckout } from "@/lib/payuCheckout";
import { TOPUP_PACKS, TOPUP_PACK_IDS, type TopupPackId } from "@/lib/plans";
import { useCurrency, formatPrice } from "@/lib/currency";

export default function TopupModal({ onClose }: { onClose: () => void }) {
  const [loadingPack, setLoadingPack] = useState<TopupPackId | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const currency = useCurrency();

  const handleBuy = async (pack: TopupPackId) => {
    setLoadingPack(pack);
    setError("");

    try {
      const order = await subscriptions.createTopupOrder(pack);
      submitPayUCheckout(order);
    } catch (err) {
      if (err instanceof ApiError) setError(err.detail);
      else setError("Something went wrong. Please try again.");
      setLoadingPack(null);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(6, 10, 20, 0.7)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl p-6"
        style={{ background: "var(--surface)", border: "1px solid var(--border-mid)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-lg font-bold" style={{ color: "var(--ink)" }}>
            Buy more interviews
          </h2>
          <button onClick={onClose} className="text-sm" style={{ color: "var(--ink-faint)" }}>
            ✕
          </button>
        </div>
        <p className="text-sm mb-5" style={{ color: "var(--ink-dim)" }}>
          Top up any time this month. Credits roll over and never expire.
        </p>

        {success ? (
          <div className="py-4 text-center">
            <p className="text-sm mb-4" style={{ color: "var(--ink)" }}>{success}</p>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-lg font-semibold text-sm"
              style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
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
                    style={{ background: "var(--border-mid)", border: "1px solid var(--border-mid)" }}
                  >
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                        {pack.label} — {pack.credits} interviews
                      </p>
                      <p className="text-xs" style={{ color: "var(--ink-faint)" }}>
                        {currency === "INR" ? pack.perInterview : `${formatPrice(pack.priceRupees / pack.credits, currency)}/interview`}
                      </p>
                    </div>
                    <span className="text-sm font-bold shrink-0 ml-3" style={{ color: "var(--accent)" }}>
                      {loadingPack === packId ? "Redirecting…" : formatPrice(pack.priceRupees, currency)}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
