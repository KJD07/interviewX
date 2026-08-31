import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Privacy Policy",
  description: "How EvaluLabs collects, uses, and protects your personal data.",
  path: "/privacy",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
