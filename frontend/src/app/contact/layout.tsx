import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Contact",
  description:
    "Questions about plans, sponsorships or your account? Get in touch with the EvaluLabs team.",
  path: "/contact",
  keywords: ["contact EvaluLabs", "EvaluLabs support"],
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
