"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { revealUp, revealFade, revealScale, stagger, VIEWPORT, lift } from "@/lib/motion";

const VARIANTS = { up: revealUp, fade: revealFade, scale: revealScale };
type VariantName = keyof typeof VARIANTS;

export function Reveal({
  children,
  variant = "up",
  delay = 0,
  className,
  hover = false,
}: {
  children: ReactNode;
  variant?: VariantName;
  delay?: number;
  className?: string;
  hover?: boolean;
}) {
  return (
    <motion.div
      variants={VARIANTS[variant]}
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT}
      transition={{ delay }}
      whileHover={hover ? lift : undefined}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Wrap a list; direct RevealItem children stagger in together. */
export function RevealGroup({
  children,
  each = 0.08,
  delay = 0,
  className,
}: {
  children: ReactNode;
  each?: number;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      variants={stagger(each, delay)}
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Child of RevealGroup — must NOT set its own initial/whileInView, or it
 *  detaches from the parent's stagger orchestration. */
export function RevealItem({
  children,
  variant = "up",
  className,
  hover = false,
}: {
  children: ReactNode;
  variant?: VariantName;
  className?: string;
  hover?: boolean;
}) {
  return (
    <motion.div variants={VARIANTS[variant]} whileHover={hover ? lift : undefined} className={className}>
      {children}
    </motion.div>
  );
}

/** Back-compat shim for the old ScrollReveal API during migration. */
export function ScrollReveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return (
    <Reveal variant="up" delay={delay} className={className}>
      {children}
    </Reveal>
  );
}
