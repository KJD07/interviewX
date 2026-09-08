"use client";

import { useEffect, useState } from "react";
import { PARTNER_REF_KEY } from "@/components/ReferralTracker";

export default function PartnerReferralBanner() {
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    setCode(localStorage.getItem(PARTNER_REF_KEY));
  }, []);

  if (!code) return null;

  return (
    <div className="mb-6 rounded-2xl border border-[var(--border-mid)] bg-[var(--surface)] px-5 py-4 text-sm text-[var(--ink-dim)]">
      Referred by partner <span className="font-mono text-[var(--ink)]">{code}</span>.
      Mention this code in the form below so your partner receives commission when you sign up.
    </div>
  );
}
