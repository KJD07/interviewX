import { cx } from "@/lib/cx";
import { scoreTone, SCORE_TEXT, SCORE_BG } from "@/lib/score";

export function TonePill({ tone, className }: { tone: string; className?: string }) {
  return (
    <span className={cx("text-xs px-2 py-0.5 rounded-full font-medium capitalize bg-line-mid text-ink-dim", className)}>
      {tone}
    </span>
  );
}

const ROUND_TYPE: Record<string, { cls: string; label: string }> = {
  technical: { cls: "bg-accent/12 text-accent", label: "Technical" },
  behavioral: { cls: "bg-success/10 text-success", label: "Behavioral" },
  system_design: { cls: "bg-warn/12 text-warn", label: "System Design" },
  hr: { cls: "bg-ink-faint/15 text-ink-dim", label: "HR" },
};

export function RoundTypeBadge({ type }: { type: string }) {
  const r = ROUND_TYPE[type] ?? { cls: "bg-ink-faint/15 text-ink-dim", label: type };
  return <span className={cx("text-xs font-medium px-2 py-0.5 rounded-full", r.cls)}>{r.label}</span>;
}

export function ScorePill({ value }: { value?: number | null }) {
  const tone = scoreTone(value);
  return (
    <span className={cx("text-xs font-semibold px-2 py-0.5 rounded-full tabular-nums", SCORE_BG[tone], SCORE_TEXT[tone])}>
      {value ?? "—"}
    </span>
  );
}

export function FreeTierBadge() {
  return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-success/10 text-success">Free tier</span>;
}
