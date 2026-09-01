import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Refund Policy",
  description: "EvaluLabs refund eligibility, duration, and refund processing details.",
  path: "/refund",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
