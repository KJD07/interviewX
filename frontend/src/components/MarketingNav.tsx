"use client";

import { useEffect, useRef, useState } from "react";
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
const PARTNER_HREF = "/enterprise/partner";
const ENTERPRISE_DASHBOARD_HREF = "/enterprise/dashboard";

const HIRE_SECTIONS = [
  { href: "/enterprise#product", title: "Features", sub: "Bank, invites, scores" },
  { href: "/enterprise#how-it-works", title: "How it works", sub: "Four steps, one decision" },
  { href: "/enterprise#pricing", title: "Pricing", sub: "Per-seat and unlimited" },
  { href: "/enterprise#faq", title: "FAQ", sub: "Hiring questions, answered" },
];

const HIRE_ACTIONS = [
  {
    href: PARTNER_HREF,
    title: "Partnership Program",
    sub: "Refer orgs, earn 20% commission",
  },
  {
    href: ENTERPRISE_DASHBOARD_HREF,
    title: "Enterprise Dashboard",
    sub: "Manage your hiring workspace",
  },
];

export default function MarketingNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [hireOpen, setHireOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileHireOpen, setMobileHireOpen] = useState(false);
  const [hash, setHash] = useState("");
  const hireRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setHireOpen(false);
    setMobileOpen(false);
    setMobileHireOpen(false);
    const syncHash = () => setHash(window.location.hash);
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, [pathname]);

  useEffect(() => {
    const onPointer = (event: MouseEvent) => {
      if (!hireRef.current?.contains(event.target as Node)) {
        setHireOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setHireOpen(false);
        setMobileOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    const previous = document.body.style.overflow;
    if (mobileOpen) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  const isEnterpriseSection =
    pathname === ENTERPRISE_HREF || Boolean(pathname?.startsWith(`${ENTERPRISE_HREF}/`));
  const afterAuth = isEnterpriseSection ? ENTERPRISE_DASHBOARD_HREF : "/dashboard";
  const hireActive = isEnterpriseSection;

  const isItemActive = (href: string) => {
    const [path, itemHash] = href.split("#");
    if (itemHash) return pathname === path && hash === `#${itemHash}`;
    return pathname === href || Boolean(pathname?.startsWith(`${href}/`));
  };

  const renderHireLink = (item: { href: string; title: string; sub: string }) => {
    const itemActive = isItemActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        role="menuitem"
        className={`flex flex-col gap-0.5 rounded-2xl px-3.5 py-2.5 transition-colors ${
          itemActive
            ? "bg-[var(--lime)] text-[var(--ink)]"
            : "text-[var(--ink)] hover:bg-[var(--lime)]/15"
        }`}
        onClick={() => {
          setHireOpen(false);
          if (item.href.includes("#")) {
            setHash(`#${item.href.split("#")[1]}`);
          } else {
            setHash("");
          }
        }}
      >
        <span className="text-[13.5px] font-semibold">{item.title}</span>
        <span className={`text-[11.5px] font-medium ${itemActive ? "text-[var(--ink)]/70" : "text-[var(--olive)]"}`}>
          {item.sub}
        </span>
      </Link>
    );
  };

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={`fixed top-0 left-0 right-0 z-50 border-b transition-colors duration-300 backdrop-blur-xl ${
        scrolled ? "border-[var(--border)] bg-[var(--page)]/[0.86]" : "border-transparent bg-[var(--page)]/60"
      }`}
    >
      <nav className="mx-auto flex max-w-[1180px] items-center justify-between gap-3 px-4 py-[13px] sm:gap-8 sm:px-8">
        <Link href="/" className="font-display flex min-w-0 items-center gap-2 text-[17px] font-bold tracking-[-0.025em] text-[var(--ink)] sm:gap-2.5 sm:text-[19px]">
          <Image src={icon} alt="EvaluLabs" width={26} height={26} className="rounded-md" priority />
          <span className="truncate">EvaluLabs</span>
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

          <div
            ref={hireRef}
            className="group relative"
            onMouseEnter={() => setHireOpen(true)}
            onMouseLeave={() => setHireOpen(false)}
          >
            <Link
              href={ENTERPRISE_HREF}
              aria-haspopup="menu"
              aria-expanded={hireOpen}
              className={`inline-flex items-center gap-1.5 rounded-full px-[17px] py-[9px] text-sm font-semibold ${
                hireActive
                  ? "bg-[var(--lime)] text-[var(--ink)]"
                  : "text-[var(--olive)] hover:bg-[var(--lime)]/10"
              }`}
            >
              Hire with Us
              <span
                className={`text-[10px] leading-none transition-transform duration-150 ${hireOpen ? "rotate-180" : "group-hover:rotate-180"}`}
                aria-hidden
              >
                ▾
              </span>
            </Link>

            <div
              role="menu"
              className={`invisible absolute left-1/2 top-full z-50 w-[268px] -translate-x-1/2 pt-2.5 opacity-0 transition-[opacity,visibility,transform] duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 ${
                hireOpen ? "!visible translate-y-0 opacity-100" : "translate-y-1.5"
              }`}
            >
              <div
                className="overflow-hidden rounded-[18px] border p-1.5 shadow-[0_12px_28px_rgba(12,12,11,0.10)]"
                style={{ background: "var(--page)", borderColor: "var(--border-mid)" }}
              >
                {HIRE_SECTIONS.map(renderHireLink)}
                <div className="mx-2 my-1.5 h-px" style={{ background: "var(--border-mid)" }} />
                {HIRE_ACTIONS.map(renderHireLink)}
              </div>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2.5">
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-full text-[var(--ink)] hover:bg-black/[0.06] sm:hidden"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open: boolean) => !open)}
          >
            <span className="sr-only">{mobileOpen ? "Close menu" : "Open menu"}</span>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
              {mobileOpen ? (
                <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              ) : (
                <path d="M3 5h12M3 9h12M3 13h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              )}
            </svg>
          </button>
          {!loading && !user && pathname !== "/login" && (
            <button
              onClick={() => router.push(`/login?next=${encodeURIComponent(afterAuth)}`)}
              className="rounded-full px-2.5 py-2 text-sm font-medium text-[var(--ink)] transition-opacity hover:opacity-70 sm:px-3.5 sm:py-2.5 sm:text-[14.5px]"
            >
              Sign in
            </button>
          )}
          {loading ? (
            <button
              disabled
              className="flex items-center gap-1.5 rounded-full bg-[var(--ink)] px-3.5 py-2 text-[13px] font-semibold text-[var(--page)] opacity-70 sm:gap-2 sm:px-5 sm:py-[11px] sm:text-sm"
            >
              Loading…
            </button>
          ) : user ? (
            <button
              onClick={() => router.push(afterAuth)}
              className="flex items-center gap-1.5 rounded-full bg-[var(--ink)] px-3.5 py-2 text-[13px] font-semibold text-[var(--page)] hover:bg-[var(--accent-dim)] sm:gap-2 sm:px-5 sm:py-[11px] sm:text-sm"
            >
              Dashboard
              <span className="hidden sm:inline" style={{ color: "var(--lime)" }}>→</span>
            </button>
          ) : isEnterpriseSection ? (
            <button
              onClick={() => router.push("/contact")}
              className="flex items-center gap-1.5 rounded-full bg-[var(--ink)] px-3.5 py-2 text-[13px] font-semibold text-[var(--page)] hover:bg-[var(--accent-dim)] sm:gap-2 sm:px-5 sm:py-[11px] sm:text-sm"
            >
              Talk to sales
              <span className="hidden sm:inline" style={{ color: "var(--lime)" }}>→</span>
            </button>
          ) : (
            <button
              onClick={() => router.push("/register")}
              className="flex items-center gap-1.5 rounded-full bg-[var(--ink)] px-3.5 py-2 text-[13px] font-semibold text-[var(--page)] hover:bg-[var(--accent-dim)] sm:gap-2 sm:px-5 sm:py-[11px] sm:text-sm"
            >
              Start free
              <span className="hidden sm:inline" style={{ color: "var(--lime)" }}>→</span>
            </button>
          )}
        </div>
      </nav>

      {mobileOpen && (
        <div
          className="border-t px-4 py-3 sm:hidden"
          style={{ background: "var(--page)", borderColor: "var(--border)" }}
        >
          <div className="flex flex-col gap-1 pb-2">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-xl px-3 py-2.5 text-sm font-medium ${
                  pathname === link.href ? "bg-[var(--ink)] text-[var(--page)]" : "text-[var(--ink-dim)]"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <button
              type="button"
              aria-expanded={mobileHireOpen}
              onClick={() => setMobileHireOpen((open: boolean) => !open)}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-semibold ${
                hireActive ? "bg-[var(--lime)] text-[var(--ink)]" : "text-[var(--olive)]"
              }`}
            >
              Hire with Us
              <span className={`text-[10px] transition-transform ${mobileHireOpen ? "rotate-180" : ""}`} aria-hidden>
                ▾
              </span>
            </button>
            {mobileHireOpen && (
              <div className="ml-2 flex flex-col gap-1 border-l pl-3" style={{ borderColor: "var(--border-mid)" }}>
                {[...HIRE_SECTIONS, ...HIRE_ACTIONS].map((item) => {
                  const itemActive = isItemActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`rounded-xl px-3 py-2.5 ${itemActive ? "bg-[var(--lime)]/40" : ""}`}
                    >
                      <span className="block text-sm font-semibold text-[var(--ink)]">{item.title}</span>
                      <span className="mt-0.5 block text-xs text-[var(--olive)]">{item.sub}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </motion.header>
  );
}
