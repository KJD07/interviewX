"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/career", label: "Career" },
];

export default function MarketingNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4 pt-4"
    >
      <nav
        className={`flex w-full max-w-5xl items-center justify-between rounded-2xl border px-5 py-3 transition-all duration-300 ${
          scrolled
            ? "border-[var(--border)] bg-white/70 shadow-[0_8px_30px_rgba(28,26,22,0.08)] backdrop-blur-xl"
            : "border-transparent bg-white/30 backdrop-blur-md"
        }`}
      >
        <Link href="/" className="font-display text-lg font-semibold tracking-tight text-[var(--ink)]">
          Interview<span className="text-[var(--accent-dim)]">X</span>
        </Link>

        <div className="hidden items-center gap-1 sm:flex">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  active ? "text-[var(--ink)]" : "text-[var(--ink-dim)] hover:text-[var(--ink)]"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-full bg-[var(--surface-2)]"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative">{link.label}</span>
              </Link>
            );
          })}
        </div>

        <button
          onClick={() => router.push(user ? "/dashboard" : "/login")}
          className="group relative overflow-hidden rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm font-semibold text-[var(--page)] transition-transform duration-300 hover:scale-[1.03] active:scale-[0.98]"
        >
          <span className="relative z-10">
            {loading ? "Loading…" : user ? "Go to Dashboard" : "Sign in"}
          </span>
          <span className="absolute inset-0 -translate-x-full bg-[var(--accent-dim)] transition-transform duration-500 group-hover:translate-x-0" />
        </button>
      </nav>
    </motion.header>
  );
}
