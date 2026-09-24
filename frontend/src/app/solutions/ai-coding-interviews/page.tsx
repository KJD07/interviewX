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
        { href: "/solutions/ai-technical-interviews", label: "AI technical interviews" },
        { href: "/skills", label: "Practise by skill" },
        { href: "/enterprise", label: "Enterprise hiring" },
        { href: "/register", label: "Create a practice account" },
        { href: "/about", label: "How EvaluLabs evaluates candidates" },
      ]}
    />
  );
}
