import { cx } from "@/lib/cx";
import type { ReactNode } from "react";

type Tone = "danger" | "warn" | "success" | "info";

const TONE: Record<Tone, string> = {
  danger: "bg-danger/10 border-danger/30 text-danger",
  warn: "bg-warn/12 border-warn/30 text-warn",
  success: "bg-success/10 border-success/30 text-success",
  info: "bg-accent/8 border-accent/25 text-accent",
};

export function Alert({
  tone,
  children,
  onDismiss,
  className,
}: {
  tone: Tone;
  children: ReactNode;
  onDismiss?: () => void;
  className?: string;
}) {
  return (
    <div className={cx("flex items-start justify-between gap-3 rounded-field border px-3 py-2 text-sm", TONE[tone], className)}>
      <span>{children}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="shrink-0 opacity-60 hover:opacity-100" aria-label="Dismiss">
          ✕
        </button>
      )}
    </div>
  );
}
