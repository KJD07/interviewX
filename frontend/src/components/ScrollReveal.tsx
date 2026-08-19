"use client";

import type { ReactNode } from "react";

// Superseded by @/components/motion/Reveal — kept as a re-export shim so
// existing marketing-page imports don't all need to change at once.
export { ScrollReveal } from "@/components/motion/Reveal";

export function GlassCard({
  children,
  className = "",
  hover = true,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl border border-white/50 bg-white/[0.65] p-6 shadow-[0_8px_32px_rgba(28,26,22,0.06)] backdrop-blur-sm transition-all duration-300 ease-out will-change-transform ${
        hover ? "hover:-translate-y-1.5 hover:border-white/80 hover:bg-white/75 hover:shadow-[0_16px_44px_rgba(28,26,22,0.10)]" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}