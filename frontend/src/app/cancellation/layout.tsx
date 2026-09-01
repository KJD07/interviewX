import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Cancellation Policy",
  description: "How to cancel or stop using EvaluLabs paid plans.",
  path: "/cancellation",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
