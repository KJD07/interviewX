import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Pricing — Free for Candidates, ATS Unlimited and Enterprise Hiring",
  description:
    "EvaluLabs is free for candidates: live jobs, application tracking, role practice, AI mock interviews and daily ATS resume checks. ATS Unlimited removes the daily ATS limit. Hiring teams use EvaluLabs Enterprise for invites, custom banks, and proctoring.",
  path: "/pricing",
  keywords: ["EvaluLabs pricing", "free ATS resume checker", "free mock interview", "ATS Unlimited"],
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
