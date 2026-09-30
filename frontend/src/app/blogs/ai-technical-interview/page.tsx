import SolutionArticle from "@/components/SolutionArticle";
import { DESCRIPTION, FAQS, SECTIONS, TITLE } from "./content";

export default function Page() {
  return (
    <SolutionArticle
      kicker="Blogs"
      title={TITLE}
      lead={DESCRIPTION}
      sections={SECTIONS}
      faqs={FAQS}
      related={[
        { href: "/blogs/ai-coding-interview", label: "AI coding interviews" },
        { href: "/blogs/interview-proctoring", label: "Interview proctoring" },
        { href: "/enterprise", label: "Enterprise hiring" },
        { href: "/register", label: "Create a practice account" },
        { href: "/pricing", label: "Practice plan pricing" },
        { href: "/about", label: "How questions are verified" },
      ]}
    />
  );
}
