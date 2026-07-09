"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

export function ScrollReveal({
  children,
  delay = 0,
  y = 28,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

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
      className={`rounded-3xl border border-white/50 bg-white/[0.65] p-6 shadow-[0_8px_32px_rgba(28,26,22,0.06)] backdrop-blur-sm transition-colors duration-300 ${
        hover ? "hover:-translate-y-1.5 hover:border-white/80 hover:bg-white/75 hover:shadow-[0_16px_44px_rgba(28,26,22,0.10)]" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}