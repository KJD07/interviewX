import type { Metadata } from "next";
import StructuredData from "@/components/StructuredData";
import { breadcrumbSchema, faqSchema, pageMetadata, webPageSchema } from "@/lib/seo";
import { DESCRIPTION, PATH, SECTIONS, TITLE } from "./content";

export const metadata: Metadata = pageMetadata({
  title: "What Is an AI Interview Platform?",
  description: DESCRIPTION,
  path: PATH,
  keywords: [
    "AI interview platform",
    "AI interviewer",
    "what is EvaluLabs",
    "AI mock interview",
    "candidate screening",
  ],
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <StructuredData
        schema={[
          webPageSchema({ name: TITLE, description: DESCRIPTION, path: PATH }),
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: TITLE, path: PATH },
          ]),
          faqSchema(
            SECTIONS.map((section) => ({
              question: section.heading,
              answer: section.paragraphs.join(" "),
            })),
            { path: PATH },
          ),
        ]}
      />
      {children}
    </>
  );
}
