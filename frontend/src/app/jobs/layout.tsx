import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Live Jobs",
  description: "Live jobs from 1,100+ company career boards, with match scores and a free ATS resume check.",
  path: "/jobs",
  noIndex: true,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
