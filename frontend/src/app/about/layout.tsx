import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "About — How AI Mock Interviews Work",
  description:
    "EvaluLabs sources interview questions from verified employees and recent candidates, then runs them through an AI interviewer that matches each company tone. Here is how the whole loop works.",
  path: "/about",
  keywords: ["about EvaluLabs", "how AI mock interviews work", "verified interview questions"],
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
