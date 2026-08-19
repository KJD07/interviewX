import { ChevronRight } from "./Icon";
import type { ReactNode } from "react";

export function ListCard({
  title,
  subtitle,
  onClick,
  right,
  disabled,
}: {
  title: string;
  subtitle?: string;
  onClick: () => void;
  right?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full text-left rounded-card px-5 py-4 flex items-center justify-between gap-4 bg-surface border border-line-mid transition-colors hover:bg-surface-2 disabled:opacity-40 disabled:hover:bg-surface"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium truncate text-ink">{title}</p>
        {subtitle && <p className="text-xs mt-0.5 truncate text-ink-dim">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {right}
        <span className="text-ink-faint">
          <ChevronRight />
        </span>
      </div>
    </button>
  );
}
