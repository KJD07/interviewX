import { cx } from "@/lib/cx";
import type { ElementType, ReactNode } from "react";

type Tone = "surface" | "muted" | "hero";
type Pad = "none" | "sm" | "md" | "lg";

const TONE: Record<Tone, string> = {
  surface: "bg-surface border border-line-mid",
  muted: "bg-surface-2 border border-line",
  hero: "bg-hero border border-white/50",
};

const PAD: Record<Pad, string> = {
  none: "",
  sm: "px-5 py-4",
  md: "px-6 py-5",
  lg: "p-8",
};

export function Card({
  as,
  tone = "surface",
  pad = "md",
  interactive = false,
  className,
  children,
}: {
  as?: ElementType;
  tone?: Tone;
  pad?: Pad;
  interactive?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const Tag = as ?? "div";
  return (
    <Tag
      className={cx(
        "rounded-card",
        TONE[tone],
        PAD[pad],
        interactive && "transition-all duration-250 ease-out hover:-translate-y-0.5 hover:shadow-card-hi",
        className
      )}
    >
      {children}
    </Tag>
  );
}
