import type { Variants, Transition } from "framer-motion";

export const EASE = [0.22, 1, 0.36, 1] as const;
export const EASE_SOFT = [0.4, 0, 0.2, 1] as const;

export const DUR = { fast: 0.25, base: 0.4, slow: 0.6, hero: 0.8 } as const;

export const spring: Transition = { type: "spring", stiffness: 260, damping: 30, mass: 0.9 };

export const revealUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: DUR.slow, ease: EASE } },
};
export const revealFade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: DUR.base, ease: EASE } },
};
export const revealScale: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: 16 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: DUR.slow, ease: EASE } },
};

export const stagger = (each = 0.08, delay = 0): Variants => ({
  hidden: {},
  visible: { transition: { staggerChildren: each, delayChildren: delay } },
});

export const VIEWPORT = { once: true, margin: "-80px" } as const;

export const lift = { y: -4, transition: { duration: DUR.fast, ease: EASE } };
export const press = { scale: 0.98 };

export const pageTransition: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: DUR.base, ease: EASE } },
};
