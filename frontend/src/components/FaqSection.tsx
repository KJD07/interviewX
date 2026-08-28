"use client";

import { useState } from "react";
import StructuredData from "@/components/StructuredData";
import { faqSchema } from "@/lib/seo";

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
 */
const FAQS = [
  {
    question: "What is EvaluLabs?",
    answer:
      "EvaluLabs is an AI mock interview platform. You pick a company and role, and an AI interviewer runs a full-length session using questions that real candidates were actually asked there. Afterwards you get scored on communication, technical depth and problem solving, plus written feedback on what to fix.",
  },
  {
    question: "Where do EvaluLabs interview questions come from?",
    answer:
      "Questions are contributed by people who work at the company or interviewed there recently. Every contributor is verified with a company email address or an offer letter before their questions enter the bank, so nothing in it is scraped or invented.",
  },
  {
    question: "Is EvaluLabs free?",
    answer:
      "Yes. The free plan includes a monthly allowance of AI mock interviews with scoring and feedback, and needs no card to start. Paid plans add detailed insights, topic-level breakdowns and higher monthly limits.",
  },
  {
    question: "How is EvaluLabs different from other AI interview tools?",
    answer:
      "Most tools generate plausible-sounding questions from a model. EvaluLabs runs sessions from a verified question bank tied to specific companies and roles, and the AI interviewer adopts that company's interviewing tone, so the pressure and the follow-ups match what you will actually face.",
  },
  {
    question: "Can I practise by speaking instead of typing?",
    answer:
      "Yes. Voice mode lets you answer out loud. EvaluLabs transcribes what you say in real time and the interviewer responds conversationally, which is closer to a real panel than typing answers.",
  },
  {
    question: "How does EvaluLabs score an interview?",
    answer:
      "Each session is graded against an anchored 0–10 rubric across communication, technical depth, problem solving and an overall readiness score. The rubric is deliberately strict: vague or blank answers score low, so the number is a signal you can actually track.",
  },
  {
    question: "Does EvaluLabs work for colleges and companies?",
    answer:
      "Yes. Institutional sponsorships grant a full plan to everyone on a given email domain, with a per-cycle interview limit the sponsor sets. Students sign up with their college address and the plan attaches automatically.",
  },
  {
    question: "Is EvaluLabs related to Evalulab, the cosmetics testing lab?",
    answer:
      "No. EvaluLabs (evalulabs.com) is an AI mock interview platform for job candidates. Evalulab is a separate, unrelated clinical testing company in Montreal.",
  },
];

function FaqItem({ id, question, answer }: { id: string; question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[var(--border)] py-5">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-center justify-between gap-6 text-left"
      >
        <h3 className="text-base font-semibold text-[var(--ink)] sm:text-lg">{question}</h3>
        <span
          aria-hidden="true"
          className={`shrink-0 text-xl text-[var(--ink-faint)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
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
            className={`mt-3 max-w-2xl text-sm leading-relaxed text-[var(--ink-dim)] transition-opacity duration-300 ease-out sm:text-[15px] ${
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

export default function FaqSection() {
  return (
    <section id="faq" className="mx-auto max-w-3xl px-6 pb-28">
      <StructuredData schema={faqSchema(FAQS)} />

      <h2 className="font-display text-3xl font-semibold text-[var(--ink)] sm:text-4xl">
        Frequently asked questions
      </h2>

      <div className="mt-10 border-t border-[var(--border)]">
        {FAQS.map((faq, i) => (
          <FaqItem key={faq.question} id={`faq-a-${i}`} question={faq.question} answer={faq.answer} />
        ))}
      </div>
    </section>
  );
}
