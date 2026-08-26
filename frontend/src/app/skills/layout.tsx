import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Practice Interviews by Skill",
  description:
    "Pick a skill — system design, data structures, SQL, behavioural and more — and practice it against an AI interviewer that probes and pushes back like a real panel.",
  path: "/skills",
  keywords: [
    "skill based interview practice",
    "system design interview practice",
    "behavioural interview practice",
    "technical interview questions by topic",
  ],
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
