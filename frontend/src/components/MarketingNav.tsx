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
      className={`fixed top-0 left-0 right-0 z-50 border-b transition-colors duration-300 backdrop-blur-xl ${
        scrolled ? "border-[var(--border)] bg-white/85" : "border-transparent bg-white/60"
      }`}
    >
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-[var(--ink)]">
          <Image src={icon} alt="EvaluLabs" width={26} height={26} className="rounded-md" priority />
          EvaluLabs
        </Link>

        <div className="hidden items-center gap-1 text-[14.5px] font-medium sm:flex">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative rounded-full px-4 py-2 transition-colors ${
                  active ? "font-semibold text-[var(--ink)]" : "text-[var(--ink)] hover:opacity-70"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-full border border-[var(--border-mid)]"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <span className="relative">{link.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2.5">
          {!loading && !user && (
            <button
              onClick={() => router.push("/login")}
              className="rounded-full px-3.5 py-2.5 text-[14.5px] font-medium text-[var(--ink)] transition-opacity hover:opacity-70"
            >
              Sign in
            </button>
          )}
          <button
            onClick={() => router.push(user ? "/dashboard" : "/register")}
            className="rounded-full bg-[var(--ink)] px-5 py-2.5 text-[14.5px] font-semibold text-[var(--page)] transition-transform duration-300 hover:scale-[1.03] active:scale-[0.98]"
          >
            {loading ? "Loading…" : user ? "Go to Dashboard" : "Start free"}
          </button>
        </div>
      </nav>
    </motion.header>
  );
}
