import type { Metadata } from "next";
import StructuredData from "@/components/StructuredData";
import { breadcrumbSchema, faqSchema, pageMetadata, webPageSchema } from "@/lib/seo";
import { DESCRIPTION, FAQS, PATH, SECTIONS, TITLE } from "./content";

export const metadata: Metadata = pageMetadata({
  title: "Interview Proctoring for Enterprise Invites",
  description: DESCRIPTION,
  path: PATH,
  keywords: [
    "interview proctoring",
    "AI interview proctoring",
    "candidate screening camera",
    "enterprise interview integrity",
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
            [
              ...SECTIONS.filter((section) => section.heading.endsWith("?")).map((section) => ({
                question: section.heading,
                answer: [...section.paragraphs, ...(section.steps ?? [])].join(" "),
              })),
              ...FAQS,
            ],
            { path: PATH },
          ),
        ]}
      />
      {children}
    </>
  );
}
