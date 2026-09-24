import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Enterprise dashboard",
  description: "Manage your EvaluLabs hiring workspace.",
  path: "/enterprise/dashboard",
  noIndex: true,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
