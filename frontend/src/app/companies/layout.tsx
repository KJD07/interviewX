import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Company Interview Questions & AI Mock Interviews",
  description:
    "Browse companies and roles, then run an AI mock interview built from the questions their candidates were actually asked. Verified by current employees and recent interviewees.",
  path: "/companies",
  keywords: [
    "company interview questions",
    "FAANG interview questions",
    "AI mock interview by company",
    "role based interview practice",
  ],
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
