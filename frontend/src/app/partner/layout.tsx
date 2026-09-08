import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Partner program",
  description: "Register as an EvaluLabs partner, share your referral link, and track enterprise commissions.",
  path: "/partner",
  noIndex: true,
});

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
