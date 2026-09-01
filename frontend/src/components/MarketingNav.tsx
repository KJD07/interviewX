"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import icon from "@/app/icon.png";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact Us" },
];

const ENTERPRISE_HREF = "/enterprise";

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

  const afterAuth = pathname === ENTERPRISE_HREF ? "/enterprise/dashboard" : "/dashboard";

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={`fixed top-0 left-0 right-0 z-50 border-b transition-colors duration-300 backdrop-blur-xl ${
        scrolled ? "border-[var(--border)] bg-[var(--page)]/[0.86]" : "border-transparent bg-[var(--page)]/60"
      }`}
    >
      <nav className="mx-auto flex max-w-[1180px] items-center justify-between gap-8 px-6 py-[13px] sm:px-8">
        <Link href="/" className="font-display flex items-center gap-2.5 text-[19px] font-bold tracking-[-0.025em] text-[var(--ink)]">
          <Image src={icon} alt="EvaluLabs" width={26} height={26} className="rounded-md" priority />
          EvaluLabs
        </Link>

        <div className="mx-auto hidden items-center gap-1 text-sm sm:flex">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative rounded-full px-[17px] py-[9px] transition-colors ${
                  active
                    ? "font-semibold text-[var(--page)]"
                    : "font-medium text-[var(--ink-dim)] hover:bg-black/[0.06] hover:text-[var(--ink)]"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-full bg-[var(--ink)]"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <span className="relative">{link.label}</span>
              </Link>
            );
          })}
          <Link
            href={ENTERPRISE_HREF}
            className={`rounded-full px-[17px] py-[9px] text-sm font-semibold transition-colors ${
              pathname === ENTERPRISE_HREF || pathname?.startsWith(`${ENTERPRISE_HREF}/`)
                ? "bg-[var(--lime)] text-[var(--ink)]"
                : "text-[var(--olive)] hover:bg-[var(--lime)]/10"
            }`}
          >
            Hire with Us
          </Link>
        </div>

        <div className="flex items-center gap-2.5">
          {!loading && !user && (
            <button
              onClick={() => router.push(`/login?next=${encodeURIComponent(afterAuth)}`)}
              className="rounded-full px-3.5 py-2.5 text-[14.5px] font-medium text-[var(--ink)] transition-opacity hover:opacity-70"
            >
              Sign in
            </button>
          )}
          <button
            onClick={() => router.push(user ? afterAuth : "/register")}
            className="flex items-center gap-2 rounded-full bg-[var(--ink)] px-5 py-[11px] text-sm font-semibold text-[var(--page)] hover:bg-[var(--accent-dim)]"
          >
            {loading ? "Loading…" : user ? "Go to dashboard" : "Start free"}
            <span style={{ color: "var(--lime)" }}>→</span>
          </button>
        </div>
      </nav>
    </motion.header>
  );
}
