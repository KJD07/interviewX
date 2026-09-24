import Link from "next/link";
import MarketingNav from "@/components/MarketingNav";
import MarketingFooter from "@/components/MarketingFooter";
import { FaqAccordion } from "@/components/FaqSection";

export type SolutionFaq = { question: string; answer: string };

export default function SolutionArticle({
  kicker,
  title,
  lead,
  sections,
  faqs,
  related,
}: {
  kicker: string;
  title: string;
  lead: string;
  sections: { heading: string; paragraphs: string[]; steps?: string[] }[];
  faqs: SolutionFaq[];
  related: { href: string; label: string }[];
}) {
  return (
    <div className="min-h-screen bg-[var(--page)]">
      <MarketingNav />
      <article className="mx-auto max-w-[800px] px-6 pb-8 pt-32 sm:px-8">
        <p className="mb-3 text-sm text-[var(--ink-faint)]">
          <Link href="/" className="hover:text-[var(--olive)]">
            Home
          </Link>
          <span aria-hidden> / </span>
          <span>Solutions</span>
          <span aria-hidden> / </span>
          <span className="text-[var(--ink-dim)]">{title}</span>
        </p>
        <p className="font-label mb-3">{kicker}</p>
        <h1 className="font-display text-[36px] font-bold leading-[1.02] tracking-[-0.035em] text-[var(--ink)] sm:text-[48px]">
          {title}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-[var(--ink-dim)]">{lead}</p>

        {sections.map((section) => (
          <section key={section.heading} className="mt-12">
            <h2 className="font-display text-[26px] font-bold leading-[1.1] tracking-[-0.03em] text-[var(--ink)] sm:text-[30px]">
              {section.heading}
            </h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph} className="mt-3 text-[15px] leading-relaxed text-[var(--ink-dim)]">
                {paragraph}
              </p>
            ))}
            {section.steps && (
              <ol className="mt-4 list-decimal space-y-2 pl-5 text-[15px] leading-relaxed text-[var(--ink-dim)]">
                {section.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            )}
          </section>
        ))}

        <section className="mt-12">
          <h2 className="text-xl font-semibold text-[var(--ink)]">Related</h2>
          <ul className="mt-3 space-y-2 text-[15px]">
            {related.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-[var(--olive)] underline underline-offset-4">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </article>
      <FaqAccordion items={faqs} heading="Questions about this page." idPrefix="solution-faq" />
      <MarketingFooter />
    </div>
  );
}
