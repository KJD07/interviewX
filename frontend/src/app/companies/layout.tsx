import type { Metadata } from "next";
import Link from "next/link";
import PublicCatalogShell from "@/components/PublicCatalogShell";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Company Interview Questions & AI Mock Interviews",
  description:
    "Browse companies and roles, then run an AI mock interview built from the questions their candidates were actually asked. Verified by current employees and recent interviewees.",
  path: "/companies",
  keywords: [
    "company interview questions",
    "FAANG interview questions",
    "AI mock interview by company",
    "role based interview practice",
  ],
});

const COMPANIES = [
  "Google",
  "Amazon",
  "Microsoft",
  "Meta",
  "Apple",
  "Flipkart",
  "TCS",
  "Infosys",
  "Stripe",
  "NVIDIA",
];

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PublicCatalogShell>
        <article className="mx-auto max-w-[800px] px-6 pb-8 pt-32 sm:px-8">
          <h1 className="font-display text-[36px] font-bold leading-[1.02] tracking-[-0.035em] text-[var(--ink)] sm:text-[48px]">
            AI mock interviews by company
          </h1>
          <p className="mt-4 text-base leading-relaxed text-[var(--ink-dim)]">
            Pick a company and role, then sit a session with an AI interviewer that uses questions
            contributed by current employees and recent candidates. Each contributor is checked with
            a company email or an offer letter before a question enters the bank.
          </p>

          <h2 className="mt-10 text-xl font-semibold text-[var(--ink)]">Companies in the practice bank</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-[var(--ink-dim)]">
            The signed-in catalog includes roles and rounds for companies such as{" "}
            {COMPANIES.join(", ")}. Question text stays inside the interview, after you create an
            account.
          </p>

          <h2 className="mt-10 text-xl font-semibold text-[var(--ink)]">Practise, or screen candidates</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-[var(--ink-dim)]">
            Candidates use the company catalog to rehearse. Hiring teams run their own banks from
            the enterprise workspace, with invites and scored reports.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/register"
              className="rounded-full bg-[var(--ink)] px-5 py-3 text-sm font-semibold text-[var(--page)]"
            >
              Create a free account
            </Link>
            <Link
              href="/enterprise"
              className="rounded-full border border-[var(--border-mid)] px-5 py-3 text-sm font-semibold text-[var(--ink)]"
            >
              Hire with EvaluLabs
            </Link>
          </div>
        </article>
      </PublicCatalogShell>
      {children}
    </>
  );
}
