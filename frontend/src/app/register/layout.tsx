import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Sign Up Free",
  description:
    "Create a free EvaluLabs account and run your first AI mock interview in under a minute. No card required.",
  path: "/register",
  keywords: ["EvaluLabs sign up", "free AI interview practice account"],
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
