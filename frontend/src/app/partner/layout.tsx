import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Partner dashboard",
  description: "Track referred enterprise customers and commission earnings.",
  path: "/partner",
  noIndex: true,
});

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
