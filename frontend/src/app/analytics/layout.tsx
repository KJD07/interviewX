import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Product analytics",
  description: "Internal product analytics.",
  path: "/analytics",
  noIndex: true,
});

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
