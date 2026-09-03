import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Log In",
  description:
    "Log in to EvaluLabs to practise mock interviews or screen candidates with your own question bank.",
  path: "/login",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
