"use client";
import { useState } from "react";

// Job boards don't give us a company domain or logo, so guess the domain —
// the posting's own host when it isn't an ATS/aggregator, then "<name>.com" —
// and pull its icon from Google's favicon service. Anything that fails falls
// back to a letter tile.
const ATS_HOSTS = [
  "greenhouse.io",
  "lever.co",
  "ashbyhq.com",
  "remotive.com",
  "arbeitnow.com",
  "workable.com",
  "myworkdayjobs.com",
  "smartrecruiters.com",
];

function guessDomains(company: string, url?: string): string[] {
  const domains: string[] = [];
  try {
    const host = new URL(url || "").hostname.replace(/^www\./, "");
    if (host && !ATS_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) {
      const parts = host.split(".");
      const keep = parts.length > 2 && ["co", "com", "ac", "org"].includes(parts[parts.length - 2]) ? 3 : 2;
      domains.push(parts.slice(-keep).join("."));
    }
  } catch {
    // no/invalid url — fall through to the name guess
  }
  const slug = company.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "");
  if (slug) domains.push(`${slug}.com`);
  return Array.from(new Set(domains));
}

export default function CompanyLogo({ company, url, size = 40 }: { company: string; url?: string; size?: number }) {
  const [domains] = useState(() => guessDomains(company, url));
  const [attempt, setAttempt] = useState(0);
  const domain = domains[attempt];

  const box = {
    width: size,
    height: size,
    background: "var(--surface)",
    borderColor: "var(--border-mid)",
  };

  if (!domain) {
    return (
      <span
        className="rounded-[12px] border flex items-center justify-center shrink-0 font-display font-semibold"
        style={{ ...box, background: "var(--surface-2)", color: "var(--ink-dim)", fontSize: size * 0.42 }}
        aria-hidden
      >
        {(company.trim()[0] || "?").toUpperCase()}
      </span>
    );
  }

  return (
    <span className="rounded-[12px] border flex items-center justify-center shrink-0 overflow-hidden" style={box}>
      {/* eslint-disable-next-line @next/next/no-img-element -- external favicon, not worth next/image config */}
      <img
        key={domain}
        src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`}
        alt={`${company} logo`}
        width={Math.round(size * 0.6)}
        height={Math.round(size * 0.6)}
        loading="lazy"
        referrerPolicy="no-referrer"
        // Unknown domains come back as Google's 16px placeholder globe.
        onLoad={(e) => e.currentTarget.naturalWidth <= 16 && setAttempt((a) => a + 1)}
        onError={() => setAttempt((a) => a + 1)}
      />
    </span>
  );
}
