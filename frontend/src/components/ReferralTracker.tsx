"use client";

import { useEffect } from "react";

const SOURCES = ["linkedin", "reddit", "instagram", "chatgpt", "direct", "other"];

function sourceFromUrl(value: string) {
  const raw = value.toLowerCase();
  return SOURCES.find((source) => source !== "direct" && source !== "other" && raw.includes(source));
}

export default function ReferralTracker() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const campaignSource = sourceFromUrl(params.get("utm_source") || params.get("ref") || "");
    const referrerSource = sourceFromUrl(document.referrer);
    const source = campaignSource || referrerSource || (document.referrer ? "other" : "direct");
    if (localStorage.getItem("ix_referral_source")) return;

    void fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/analytics/referral/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source }),
      keepalive: true,
    }).then((response) => {
      if (response.ok) localStorage.setItem("ix_referral_source", source);
    }).catch(() => {
      // Leave attribution unset so a transient network failure can retry.
    });
  }, []);

  return null;
}