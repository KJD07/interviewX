import SolutionArticle from "@/components/SolutionArticle";
import { DESCRIPTION, FAQS, SECTIONS, TITLE } from "./content";

export default function Page() {
  return (
    <SolutionArticle
      kicker="Blogs"
      title={TITLE}
      lead="EvaluLabs is an AI interview and candidate assessment platform. Candidates pick a company or skill and sit a session with an AI interviewer that uses a verified question bank. Hiring teams use the enterprise workspace to invite candidates, run interviews from their own bank, and review rubric scores. A practice session starts when you choose a company, role, and round. The interviewer chats with you — by text or by voice — and the session ends with scores for communication, technical depth, problem solving, and overall."
      sections={SECTIONS}
      faqs={FAQS}
      related={[
        { href: "/blogs/ai-technical-interview", label: "How AI technical interviews work" },
        { href: "/blogs/ai-coding-interview", label: "How AI coding interviews work" },
        { href: "/blogs/interview-proctoring", label: "How interview proctoring works" },
        { href: "/enterprise", label: "Enterprise hiring" },
        { href: "/about", label: "How EvaluLabs evaluates candidates" },
      ]}
    />
  );
}
