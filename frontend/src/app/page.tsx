import type { Metadata } from "next";
import StructuredData from "@/components/StructuredData";
import { HOME_FAQS } from "./home-faqs";
import HomeClient from "./HomeClient";
import { faqSchema, pageMetadata, videoSchema } from "@/lib/seo";

const TITLE = "EvaluLabs | Free Candidate Portal: Live Jobs, ATS Check & AI Mock Interviews";

export const metadata: Metadata = {
  ...pageMetadata({
    title: TITLE,
    description:
      "Find the job, beat the ATS, ace the interview. EvaluLabs is a free candidate portal: live jobs ranked for your profile, an ATS resume check, an apply kit and tracker, and AI mock interviews.",
    path: "/",
    keywords: [
      "EvaluLabs",
      "candidate portal",
      "live jobs India",
      "ATS resume checker",
      "job application tracker",
      "AI mock interview",
      "AI interview platform",
    ],
  }),
  // The root layout title template is not applied to this page, so the brand
  // has to be in the title itself. `absolute` also keeps a future template
  // from appending "| EvaluLabs" a second time.
  title: { absolute: TITLE },
};

export default function Page() {
  return (
    <>
      <StructuredData
        schema={[
          faqSchema(HOME_FAQS, { path: "/" }),
          videoSchema({
            name: "EvaluLabs candidate portal tour",
            description:
              "A 38-second tour of the EvaluLabs candidate portal: resume-built profile, live jobs ranked by match, ATS resume check, apply kit and tracker, role practice and AI mock interviews.",
            path: "/videos/candidate-portal.mp4",
            thumbnailPath: "/videos/candidate-portal-poster.jpg",
            uploadDate: "2026-10-26",
            duration: "PT38S",
          }),
        ]}
      />
      <HomeClient />
    </>
  );
}
