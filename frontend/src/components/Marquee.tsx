"use client";

const ITEMS = [
  "Behavioral",
  "System Design",
  "Data Structures & Algorithms",
  "Product Sense",
  "Case Study",
  "SQL & Databases",
  "Leadership Principles",
  "Communication",
  "Coding Rounds",
  "Take-home Reviews",
];

export default function Marquee() {
  const track = [...ITEMS, ...ITEMS];

  return (
    <div className="relative w-full overflow-hidden py-2 [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
      <div className="marquee-track flex w-max items-center gap-4">
        {track.map((item, i) => (
          <span
            key={`${item}-${i}`}
            className="flex shrink-0 items-center gap-2 rounded-full border border-[var(--border)] bg-white/50 px-5 py-2 text-sm font-medium text-[var(--ink-dim)] backdrop-blur-sm"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-dim)]" />
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
