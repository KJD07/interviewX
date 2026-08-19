import { cx } from "@/lib/cx";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline-accent";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink shadow-cta hover:scale-[1.03] active:scale-[0.98]",
  secondary: "bg-surface text-ink border border-line-mid hover:bg-surface-2",
  ghost: "text-ink-dim hover:text-ink",
  danger: "bg-danger text-accent-ink hover:opacity-90",
  "outline-accent": "bg-accent/8 text-accent border border-accent hover:bg-accent/12",
};

const SIZE: Record<Size, string> = {
  sm: "px-3.5 py-1.5 text-xs",
  md: "px-5 py-2.5 text-sm",
  lg: "px-8 py-3.5 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  full = false,
  disabled,
  className,
  children,
  ...rest
}: {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  full?: boolean;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      disabled={disabled || loading}
      className={cx(
        "rounded-full font-semibold transition-transform duration-250 ease-out disabled:opacity-40 disabled:pointer-events-none",
        VARIANT[variant],
        SIZE[size],
        full && "w-full",
        className
      )}
      {...rest}
    >
      {loading ? "…" : children}
    </button>
  );
}
