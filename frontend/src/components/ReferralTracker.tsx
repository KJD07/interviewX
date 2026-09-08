"use client";

import { useEffect } from "react";

const MARKETING_SOURCES = ["linkedin", "reddit", "instagram", "chatgpt", "direct", "other"];
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const PARTNER_REF_KEY = "ix_partner_ref";

function marketingSourceFromUrl(value: string) {
  const raw = value.toLowerCase();
  return MARKETING_SOURCES.find(
    (source) => source !== "direct" && source !== "other" && raw.includes(source),
  );
}

async function capturePartnerCode(code: string) {
  const response = await fetch(`${API_URL}/api/enterprise/referrals/capture/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
    keepalive: true,
  });
  if (!response.ok) return null;
  const body = await response.json().catch(() => null);
  return typeof body?.code === "string" ? body.code : code.trim().toUpperCase();
}

export default function ReferralTracker() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const refParam = (params.get("ref") || "").trim();

    if (refParam && !localStorage.getItem(PARTNER_REF_KEY)) {
      const marketingFromRef = marketingSourceFromUrl(refParam);
      if (!marketingFromRef) {
        void capturePartnerCode(refParam).then((code) => {
          if (code) localStorage.setItem(PARTNER_REF_KEY, code);
        });
      }
    }

    if (localStorage.getItem("ix_referral_source")) return;

    const campaignSource = marketingSourceFromUrl(
      params.get("utm_source") || params.get("ref") || "",
    );
    const referrerSource = marketingSourceFromUrl(document.referrer);
    const source = campaignSource || referrerSource || (document.referrer ? "other" : "direct");

    void fetch(`${API_URL}/api/analytics/referral/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source }),
      keepalive: true,
    })
      .then((response) => {
        if (response.ok) localStorage.setItem("ix_referral_source", source);
      })
      .catch(() => {
        // Leave attribution unset so a transient network failure can retry.
      });
  }, []);

  return null;
}

export { PARTNER_REF_KEY };