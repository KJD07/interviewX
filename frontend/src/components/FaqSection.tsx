"use client";

import { useState } from "react";
import { HOME_FAQS } from "@/app/home-faqs";

/**
 * Answer-engine (AEO) surface: question-shaped headings with short,
 * self-contained answers that an assistant can quote without needing the rest
 * of the page, mirrored into FAQPage JSON-LD.
 *
 * Every answer is rendered unconditionally and collapsed with CSS, so it is
 * present in the server-rendered HTML for crawlers that don't run JavaScript
 * (the reason this used to be a native <details>). The open/close is animated
 * instead, which <details> cannot do: the browser un-hides its content in one
 * frame, so the panel snapped open and everything below it jumped.
 *
 * FAQPage JSON-LD is emitted by the server homepage, not from this client file.
 */

function FaqItem({ id, question, answer }: { id: string; question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[var(--border-mid)]">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="group flex w-full cursor-pointer items-center justify-between gap-5 px-0.5 py-[19px] text-left"
      >
        <h3 className="text-base font-semibold text-[var(--ink)] transition-colors group-hover:text-[var(--olive)]">
          {question}
        </h3>
        <span
          aria-hidden="true"
          className={`shrink-0 font-mono text-base text-[var(--ink-faint)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            open ? "rotate-45" : ""
          }`}
        >
          +
        </span>
      </button>
      {/* Collapsed with grid-template-rows rather than max-height: the answer
          stays in the DOM at its natural height, so there is no guessed cap to
          clip long answers and no snap at the end of the transition. */}
      <div
        id={id}
        className="grid transition-[grid-template-rows] duration-[340ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <p
            className={`mb-[22px] max-w-[560px] text-[15px] leading-relaxed text-[var(--ink-dim)] transition-opacity duration-300 ease-out ${
              open ? "opacity-100" : "opacity-0"
            }`}
          >
            {answer}
          </p>
        </div>
      </div>
    </div>
  );
}

export function FaqAccordion({
  items,
  heading,
  idPrefix = "faq-a",
}: {
  items: { question: string; answer: string }[];
  heading: string;
  idPrefix?: string;
}) {
  return (
    <section
      id="faq"
      className="scroll-mt-24 mx-auto grid max-w-[1180px] grid-cols-1 gap-10 px-6 py-[88px] sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-[52px]"
    >
      <div>
        <div className="font-label mb-3.5">FAQ</div>
        <h2 className="font-display text-[30px] font-bold leading-[1.04] tracking-[-0.032em] text-[var(--ink)] sm:text-[38px]">
          {heading}
        </h2>
      </div>

      <div>
        {items.map((faq, i) => (
          <FaqItem key={faq.question} id={`${idPrefix}-${i}`} question={faq.question} answer={faq.answer} />
        ))}
      </div>
    </section>
  );
}

export default function FaqSection() {
  return <FaqAccordion items={HOME_FAQS} heading="Questions we get a lot." />;
}
