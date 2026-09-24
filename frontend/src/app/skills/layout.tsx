import type { Metadata } from "next";
import Link from "next/link";
import PublicCatalogShell from "@/components/PublicCatalogShell";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Practice Interviews by Skill",
  description:
    "Pick a skill — system design, data structures, SQL, behavioural and more — and practice it against an AI interviewer that probes and pushes back like a real panel.",
  path: "/skills",
  keywords: [
    "skill based interview practice",
    "system design interview practice",
    "behavioural interview practice",
    "technical interview questions by topic",
  ],
});

const SKILLS = ["Python", "JavaScript", "React", "SQL", "System Design", "Django", "Node.js", "Docker"];

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PublicCatalogShell>
        <article className="mx-auto max-w-[800px] px-6 pb-8 pt-32 sm:px-8">
          <h1 className="font-display text-[36px] font-bold leading-[1.02] tracking-[-0.035em] text-[var(--ink)] sm:text-[48px]">
            AI interview practice by skill
          </h1>
          <p className="mt-4 text-base leading-relaxed text-[var(--ink-dim)]">
            Skill sessions use the same interview loop as company rounds: you answer an AI
            interviewer, including coding and system-design prompts where the round calls for them,
            and finish with rubric scores.
          </p>

          <h2 className="mt-10 text-xl font-semibold text-[var(--ink)]">Skills you can practise</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-[var(--ink-dim)]">
            The signed-in catalog includes topics such as {SKILLS.join(", ")}. The full picker,
            including rounds, opens after you sign in.
          </p>

          <h2 className="mt-10 text-xl font-semibold text-[var(--ink)]">Start a skill session</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-[var(--ink-dim)]">
            Create an account to open the skill list. Hiring teams that want candidates assessed on
            a private bank should use enterprise invites instead of this practice catalog.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/register"
              className="rounded-full bg-[var(--ink)] px-5 py-3 text-sm font-semibold text-[var(--page)]"
            >
              Create a free account
            </Link>
            <Link
              href="/solutions/ai-coding-interviews"
              className="rounded-full border border-[var(--border-mid)] px-5 py-3 text-sm font-semibold text-[var(--ink)]"
            >
              How coding interviews work
            </Link>
          </div>
        </article>
      </PublicCatalogShell>
      {children}
    </>
  );
}
