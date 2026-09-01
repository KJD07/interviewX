"use client";

// Display currency: India sees INR, everyone else sees USD.
// Display only — Razorpay checkout always charges INR (see pricing page);
// this just converts the INR amount for a friendlier read elsewhere.
//
// Detection is the browser's IANA timezone, not IP geolocation — India has
// exactly one timezone (Asia/Kolkata), so it's a reliable, synchronous,
// zero-network signal for this binary split.
//
// Timezone is a client-only signal. Node during SSR uses the server TZ
// (UTC in Docker), so we must not detect during render — server HTML and
// the first client pass stay on the INR default, then we update after mount.

import { useEffect, useState } from "react";

export type DisplayCurrency = "INR" | "USD";

const INR_PER_USD = 83;

const INDIA_TIMEZONES = new Set(["Asia/Kolkata", "Asia/Calcutta"]);

/** Home-market default used for SSR and the first client render. */
const SSR_CURRENCY: DisplayCurrency = "INR";

export function detectCurrency(): DisplayCurrency {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return INDIA_TIMEZONES.has(tz) ? "INR" : "USD";
  } catch {
    return SSR_CURRENCY;
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

/** Viewer's display currency. Stable across SSR/hydration; timezone applied after mount. */
export function useCurrency(): DisplayCurrency {
  const [currency, setCurrency] = useState<DisplayCurrency>(SSR_CURRENCY);

  useEffect(() => {
    setCurrency(detectCurrency());
  }, []);

  return currency;
}
