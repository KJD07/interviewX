import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Terms & Conditions",
  description: "Terms and conditions for using EvaluLabs, the AI mock interview platform.",
  path: "/terms",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
