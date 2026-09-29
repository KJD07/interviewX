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
        { href: "/blogs/ai-technical-interview", label: "AI technical interviews" },
        { href: "/skills", label: "Practise by skill" },
        { href: "/enterprise", label: "Enterprise hiring" },
        { href: "/register", label: "Create a practice account" },
        { href: "/about", label: "How EvaluLabs evaluates candidates" },
      ]}
    />
  );
}
