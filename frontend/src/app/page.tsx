import type { Metadata } from "next";
import StructuredData from "@/components/StructuredData";
import HomeAeo from "@/components/HomeAeo";
import { HOME_AEO, HOME_FAQS } from "./home-faqs";
import HomeClient from "./HomeClient";
import { faqSchema, pageMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "EvaluLabs | AI Interview Platform for Practice and Hiring",
    description:
      "EvaluLabs runs AI interviews for candidates and hiring teams. Practise on verified company questions, or screen applicants with invites, rubric scores, and optional proctoring.",
    path: "/",
    keywords: [
      "EvaluLabs",
      "AI interview platform",
      "AI interviewer",
      "AI mock interview",
      "candidate assessment",
      "technical interview practice",
    ],
  }),
  // The root layout title template is not applied to this page, so the brand
  // has to be in the title itself. `absolute` also keeps a future template
  // from appending "| EvaluLabs" a second time.
  title: { absolute: "EvaluLabs | AI Interview Platform for Practice and Hiring" },
};

export default function Page() {
  return (
    <>
      <StructuredData
        schema={faqSchema(
          [
            ...HOME_AEO.map(({ question, answer, detail }) => ({
              question,
              answer: `${answer} ${detail}`,
            })),
            ...HOME_FAQS,
          ],
          { path: "/" },
        )}
      />
      <HomeClient aeo={<HomeAeo />} />
    </>
  );
}
