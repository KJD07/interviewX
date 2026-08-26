import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Log In",
  description: "Log in to EvaluLabs to continue your AI mock interview practice.",
  path: "/login",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
