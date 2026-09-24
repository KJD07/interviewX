import Link from "next/link";
import { HOME_AEO } from "@/app/home-faqs";

/** Server-rendered answers. Kept out of the client homepage so the copy is in the document without waiting on interaction. */
export default function HomeAeo() {
  return (
    <section className="mx-auto max-w-[800px] px-6 py-16 sm:px-8">
      <p className="font-label mb-3">What EvaluLabs is</p>
      <div className="space-y-10">
        {HOME_AEO.map((item) => (
          <div key={item.question}>
            <h2 className="font-display text-[28px] font-bold leading-[1.08] tracking-[-0.03em] text-[var(--ink)] sm:text-[32px]">
              {item.question}
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-[var(--ink-dim)]">{item.answer}</p>
            <p className="mt-3 text-[15px] leading-relaxed text-[var(--ink-dim)]">{item.detail}</p>
          </div>
        ))}
      </div>
      <p className="mt-8 text-sm text-[var(--ink-dim)]">
        Read more on{" "}
        <Link href="/solutions/ai-technical-interviews" className="underline underline-offset-4">
          AI technical interviews
        </Link>
        ,{" "}
        <Link href="/solutions/ai-coding-interviews" className="underline underline-offset-4">
          coding interviews
        </Link>
        ,{" "}
        <Link href="/solutions/interview-proctoring" className="underline underline-offset-4">
          interview proctoring
        </Link>
        , and{" "}
        <Link href="/enterprise" className="underline underline-offset-4">
          enterprise hiring
        </Link>
        .
      </p>
    </section>
  );
}
