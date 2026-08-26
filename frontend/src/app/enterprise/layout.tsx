import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "For Colleges & Companies — Sponsored Interview Prep",
  description:
    "Sponsor EvaluLabs for your students or candidates. Institutional campaigns grant a full plan to everyone on your email domain, with per-cycle interview limits you control.",
  path: "/enterprise",
  keywords: ["campus placement preparation", "college interview prep platform", "bulk interview practice"],
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
