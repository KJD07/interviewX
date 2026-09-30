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
        { href: "/enterprise", label: "Enterprise hiring" },
        { href: "/blogs/ai-technical-interview", label: "AI technical interviews" },
        { href: "/blogs/ai-coding-interview", label: "AI coding interviews" },
        { href: "/pricing", label: "Pricing" },
        { href: "/contact", label: "Talk to sales" },
      ]}
    />
  );
}
