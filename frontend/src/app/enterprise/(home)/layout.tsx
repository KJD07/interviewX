import type { Metadata } from "next";
import StructuredData from "@/components/StructuredData";
import { enterpriseSoftwareSchema, faqSchema, pageMetadata, webPageSchema } from "@/lib/seo";
import { ENTERPRISE_FAQS } from "./faqs";

const DESCRIPTION =
  "Screen candidates with structured AI interviews: upload your question bank, invite applicants, review rubric scores, and optionally proctor the camera. Colleges can sponsor prep for an email domain the same way.";

export const metadata: Metadata = pageMetadata({
  title: "AI Candidate Screening and Enterprise Interviews",
  description: DESCRIPTION,
  path: "/enterprise",
  keywords: [
    "AI hiring interviews",
    "AI candidate screening",
    "enterprise interview software",
    "interview proctoring",
    "campus placement preparation",
  ],
});

export default function EnterpriseHomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <StructuredData
        schema={[
          webPageSchema({
            name: "EvaluLabs Enterprise",
            description: DESCRIPTION,
            path: "/enterprise",
          }),
          enterpriseSoftwareSchema(),
          faqSchema(ENTERPRISE_FAQS, { path: "/enterprise" }),
        ]}
      />
      {children}
    </>
  );
}
