"use client";

import { motion } from "framer-motion";
import { pageTransition } from "@/lib/motion";

// Re-instantiates on every navigation (unlike layout.tsx), which is the
// mount hook App Router gives us for enter transitions — there is no
// reliable exit-animation hook without breaking scroll restoration.
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div variants={pageTransition} initial="hidden" animate="visible">
      {children}
    </motion.div>
  );
}
