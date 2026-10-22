import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Live Jobs",
  description: "Live jobs from 1000+ company career pages, with match scores and a free ATS resume check.",
  path: "/jobs",
  noIndex: true,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
