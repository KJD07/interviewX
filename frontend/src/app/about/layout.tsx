import type { Metadata } from "next";
import StructuredData from "@/components/StructuredData";
import { breadcrumbSchema, faqSchema, pageMetadata, webPageSchema } from "@/lib/seo";
import { EVALUATION_FAQ } from "./evaluation";

const DESCRIPTION =
  "How EvaluLabs evaluates candidates: verified question banks, an AI interviewer, and an anchored 0–10 rubric for communication, technical depth, problem solving, and overall.";

export const metadata: Metadata = pageMetadata({
  title: "How EvaluLabs Evaluates Candidates",
  description: DESCRIPTION,
  path: "/about",
  keywords: [
    "about EvaluLabs",
    "how AI interviews are scored",
    "verified interview questions",
    "interview rubric",
  ],
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <StructuredData
        schema={[
          webPageSchema({ name: "About EvaluLabs", description: DESCRIPTION, path: "/about" }),
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "About", path: "/about" },
          ]),
          faqSchema([EVALUATION_FAQ], { path: "/about" }),
        ]}
      />
      {children}
    </>
  );
}
