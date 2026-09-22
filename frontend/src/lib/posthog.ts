"use client";

import type { PostHogInterface } from "posthog-js";
import type { User } from "@/lib/api";

let client: PostHogInterface | null = null;
let initStarted = false;

export function productAreaFromPath(pathname: string): "practice" | "enterprise" | "marketing" {
  if (pathname.startsWith("/enterprise")) return "enterprise";
  if (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/interview") ||
    pathname.startsWith("/companies") ||
    pathname.startsWith("/skills") ||
    pathname.startsWith("/progress")
  ) {
    return "practice";
  }
  return "marketing";
}

function scheduleInit() {
  if (initStarted || typeof window === "undefined") return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  initStarted = true;

  const run = () => {
    void import("posthog-js").then(({ default: posthog }) => {
      posthog.init(key, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
        persistence: "localStorage+cookie",
        person_profiles: "identified_only",
        loaded: (ph) => {
          client = ph;
          const referral = localStorage.getItem("ix_referral_source");
          if (referral) {
            ph.register({ initial_referral_source: referral });
          }
        },
      });
      client = posthog;
    });
  };

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(run, { timeout: 4000 });
  } else {
    setTimeout(run, 1500);
  }
}

export function ensurePostHog() {
  scheduleInit();
}

export function identifyUser(user: User | null) {
  if (!user) return;
  ensurePostHog();
  const run = () => {
    client?.identify(String(user.id), {
      email: user.email,
      subscription_plan: user.subscription_plan,
      is_partner: user.is_partner ?? false,
    });
  };
  if (client) run();
  else setTimeout(run, 2500);
}

export function trackEvent(
  event: string,
  properties?: Record<string, unknown>,
) {
  ensurePostHog();
  const area =
    typeof window !== "undefined"
      ? productAreaFromPath(window.location.pathname)
      : "marketing";
  const payload = { product_area: area, ...properties };
  if (client) {
    client.capture(event, payload);
    return;
  }
  setTimeout(() => client?.capture(event, payload), 2000);
}

export function trackPageView(pathname: string) {
  ensurePostHog();
  const payload = {
    product_area: productAreaFromPath(pathname),
    path: pathname,
  };
  if (client) {
    client.capture("$pageview", payload);
    return;
  }
  setTimeout(() => client?.capture("$pageview", payload), 2000);
}
