import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Pricing — Free AI Mock Interviews & Paid Plans",
  description:
    "Start free with monthly AI mock interviews. Paid plans add detailed insights, topic-level breakdowns and higher interview limits. Top-up packs roll over and never expire.",
  path: "/pricing",
  keywords: ["AI mock interview pricing", "free mock interview", "interview prep plans"],
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
