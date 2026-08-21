// Client-side currency display: India sees INR, everyone else sees USD.
// Display only — actual Razorpay checkout always charges INR (see pricing
// page); this just converts the INR price for a friendlier read elsewhere.
//
// Detection is the browser's IANA timezone, not IP geolocation — India has
// exactly one timezone (Asia/Kolkata), so it's a reliable, synchronous,
// zero-network signal for this binary split. No third-party API, no rate
// limits, no per-request cost.

import { useMemo } from "react";

export type DisplayCurrency = "INR" | "USD";

// Fixed conversion rate for display purposes only — no live FX needed since
// no money actually changes hands in USD.
const INR_PER_USD = 83;

const INDIA_TIMEZONES = new Set(["Asia/Kolkata", "Asia/Calcutta"]);

export function detectCurrency(): DisplayCurrency {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return INDIA_TIMEZONES.has(tz) ? "INR" : "USD";
  } catch {
    // Intl unavailable (very old browser) — fall back to INR, the app's home market.
    return "INR";
  }
}

/** Formats an INR-denominated price for the given display currency. */
export function formatPrice(priceRupees: number, currency: DisplayCurrency): string {
  if (priceRupees === 0) return currency === "INR" ? "₹0" : "$0";
  if (currency === "INR") return `₹${priceRupees}`;
  const usd = priceRupees / INR_PER_USD;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: usd < 10 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(usd);
}

/** Returns the viewer's display currency (India → INR, else → USD). Synchronous, no network. */
export function useCurrency(): DisplayCurrency {
  // Timezone doesn't change mid-session, and detection is synchronous/free,
  // so this only needs to run once per mount rather than live in state.
  return useMemo(() => detectCurrency(), []);
}
