"use client";

import { useEffect } from "react";

const SOURCES = ["linkedin", "reddit", "instagram", "chatgpt"];

export default function ReferralTracker() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = (params.get("utm_source") || params.get("ref") || "").toLowerCase();
    const source = SOURCES.find((item) => raw.includes(item));
    if (!source || sessionStorage.getItem("ix_referral_recorded")) return;
    sessionStorage.setItem("ix_referral_recorded", "1");
    void fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/analytics/referral/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source }),
    });
  }, []);

  return null;
}