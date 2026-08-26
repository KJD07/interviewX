import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Careers",
  description:
    "We are building the AI interview practice platform we wish we had. See what we are hiring for at EvaluLabs.",
  path: "/career",
  keywords: ["EvaluLabs careers", "EvaluLabs jobs"],
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
