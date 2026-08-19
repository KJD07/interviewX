"use client";

import { MotionConfig } from "framer-motion";

/**
 * "user" makes Framer read prefers-reduced-motion and strip transform/layout
 * animations while keeping opacity — the accessible default. Without this,
 * every framer-motion animation in the app ignores the OS setting entirely.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
