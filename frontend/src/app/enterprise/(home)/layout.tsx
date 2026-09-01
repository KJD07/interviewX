import type { Metadata } from "next";
import StructuredData from "@/components/StructuredData";
import { faqSchema, pageMetadata } from "@/lib/seo";
import { ENTERPRISE_FAQS } from "./faqs";

export const metadata: Metadata = pageMetadata({
  title: "Enterprise — Hire with Structured AI Interviews",
  description:
    "EvaluLabs Enterprise gives hiring teams a dashboard to invite candidates, run structured AI interviews from your own question bank, and review scored reports in one place. Colleges can sponsor prep for an entire batch the same way.",
  path: "/enterprise",
  keywords: [
    "AI hiring interviews",
    "candidate screening platform",
    "enterprise interview software",
    "campus placement preparation",
    "college interview prep platform",
  ],
});

export default function EnterpriseHomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <StructuredData schema={faqSchema(ENTERPRISE_FAQS, { path: "/enterprise" })} />
      {children}
    </>
  );
}
