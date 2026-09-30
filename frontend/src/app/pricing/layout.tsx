import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Pricing — Practice Plans and Enterprise Hiring",
  description:
    "Start free with monthly AI mock interviews. Paid plans add detailed insights and higher limits. Hiring teams use EvaluLabs Enterprise for invites, custom banks, and proctoring.",
  path: "/pricing",
  keywords: ["AI mock interview pricing", "free mock interview", "interview prep plans"],
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
