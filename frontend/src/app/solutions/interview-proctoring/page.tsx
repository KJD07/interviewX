import SolutionArticle from "@/components/SolutionArticle";
import { DESCRIPTION, FAQS, SECTIONS, TITLE } from "./content";

export default function Page() {
  return (
    <SolutionArticle
      kicker="Solutions"
      title={TITLE}
      lead={DESCRIPTION}
      sections={SECTIONS}
      faqs={FAQS}
      related={[
        { href: "/enterprise", label: "Enterprise hiring" },
        { href: "/solutions/ai-technical-interviews", label: "AI technical interviews" },
        { href: "/solutions/ai-coding-interviews", label: "AI coding interviews" },
        { href: "/pricing", label: "Pricing" },
        { href: "/contact", label: "Talk to sales" },
      ]}
    />
  );
}
