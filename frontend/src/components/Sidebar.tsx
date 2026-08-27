"use client";
import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { planOf, hasSkills } from "@/lib/plans";
import icon from "@/app/icon.png";

function GridIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="2" y="2" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="10" y="2" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="2" y="10" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="10" y="10" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="3" y="2" width="9" height="14" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 5.5h1M11 5.5h1M6 8.5h1M11 8.5h1M6 11.5h1M11 11.5h1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 16v-3.5h3V16" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M9 2l1.4 4.6L15 8l-4.6 1.4L9 14l-1.4-4.6L3 8l4.6-1.4L9 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function TrendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M2 13l4.5-5 3 3L16 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 4h4v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function QuestionsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M3 4.5A1.5 1.5 0 014.5 3h9A1.5 1.5 0 0115 4.5v6a1.5 1.5 0 01-1.5 1.5H9l-3.5 3v-3H4.5A1.5 1.5 0 013 10.5v-6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M6 6.5h6M6 9h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 15c.6-2.3 2.2-3.5 5-3.5s4.4 1.2 5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M6 2H3.5a1 1 0 00-1 1v10a1 1 0 001 1H6M10.5 11.5L14 8l-3.5-3.5M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type SidebarProps = {
  enterprise?: boolean;
  mobileOpen?: boolean;
  onClose?: () => void;
};

export default function Sidebar({ enterprise = false, mobileOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const plan = planOf(user?.subscription_plan);
  const bonusInterviews = user?.bonus_interviews ?? 0;

  useEffect(() => {
    const previous = document.body.style.overflow;
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  const NAV_ITEMS = enterprise
    ? [
        { href: "/enterprise", label: "Dashboard", icon: GridIcon },
        { href: "/enterprise/candidate", label: "Candidate", icon: UserIcon },
        { href: "/enterprise/questions", label: "Question bank", icon: QuestionsIcon },
      ]
    : [
        { href: "/dashboard", label: "Dashboard", icon: GridIcon },
        { href: "/companies", label: "Companies", icon: BuildingIcon },
        ...(hasSkills(user?.subscription_plan)
          ? [{ href: "/skills", label: "Skills", icon: SparkleIcon }]
          : []),
        { href: "/progress", label: "Progress", icon: TrendIcon },
      ];

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  const initial = (user?.username || "?").charAt(0).toUpperCase();
  const planLabel = enterprise ? "Enterprise" : plan.label;

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex w-[260px] shrink-0 h-screen sticky top-0 flex-col px-5 py-7 border-r"
        style={{ background: "var(--page)", borderColor: "var(--border)" }}
      >
        <div className="flex flex-col min-h-0 flex-1">
        <Link
          href="/"
          className="font-display flex items-center gap-2.5 text-[19px] font-semibold tracking-tight px-1.5 mb-9 shrink-0"
          style={{ color: "var(--ink)" }}
        >
          <Image src={icon} alt="EvaluLabs" width={28} height={28} className="rounded-md" priority />
          EvaluLabs
        </Link>

        <nav className="space-y-1 overflow-y-auto min-h-0 flex-1 pr-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = enterprise ? pathname === href : pathname === href || pathname?.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-[15px] transition-all duration-200 ease-out hover:opacity-80"
                style={{
                  background: active ? "var(--surface-2)" : "transparent",
                  color: active ? "var(--ink)" : "var(--ink-dim)",
                  fontWeight: active ? 600 : 500,
                }}
              >
                <Icon />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="space-y-3 shrink-0">
        <div
          className="rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2"
          style={{ background: "var(--hero-bg)" }}
        >
          <span className="flex items-baseline gap-1.5 min-w-0">
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--ink-faint)" }}>
              Plan
            </span>
            <span className="font-display text-[14px] font-semibold tracking-tight truncate" style={{ color: "var(--hero-text)" }}>
              {planLabel}
            </span>
            {bonusInterviews > 0 && (
              <span className="text-[11px] shrink-0" style={{ color: "var(--ink-faint)" }}>
                +{bonusInterviews}
              </span>
            )}
          </span>
          {!enterprise && (
            <Link
              href="/pricing"
              className="text-[11.5px] shrink-0 pb-px transition-opacity hover:opacity-70"
              style={{ color: "var(--lime)", borderBottom: "1px solid var(--lime)" }}
            >
              Manage
            </Link>
          )}
        </div>

        <div className="flex items-center justify-between px-1 py-1">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
              style={{ background: "var(--ink)", color: "var(--page)" }}
            >
              {initial}
            </span>
            <span className="text-[13.5px] truncate" style={{ color: "var(--ink-dim)" }}>
              {user?.username}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="shrink-0 hover:opacity-80"
            style={{ color: "var(--ink-faint)" }}
            title="Sign out"
          >
            <LogoutIcon />
          </button>
        </div>
      </div>

      </aside>

      {/* Mobile drawer */}
      <div
        className={`md:hidden fixed inset-0 z-50 flex transition-opacity duration-300 ease-out ${
          mobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden={!mobileOpen}
      >
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={onClose} />
        <div
          className={`relative w-[18rem] max-w-[85vw] h-[100dvh] max-h-[100dvh] overflow-hidden shadow-[8px_0_28px_rgba(28,26,22,0.12)] transition-transform duration-300 ease-out ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          style={{ background: 'var(--page)' }}
        >
            <div className="flex flex-col h-full px-5 py-6 border-r" style={{ borderColor: 'var(--border)' }}>
              <div className="mb-6 shrink-0">
                <Link href="/" className="font-display flex items-center gap-2.5 text-[18px] font-semibold tracking-tight px-1.5 mb-4 shrink-0" style={{ color: 'var(--ink)' }}>
                  <Image src={icon} alt="EvaluLabs" width={24} height={24} className="rounded-md" priority />
                  EvaluLabs
                </Link>
              </div>

              <nav className="space-y-1 overflow-y-auto flex-1 min-h-0 pr-1 pb-2">
                {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                  const active = enterprise ? pathname === href : pathname === href || pathname?.startsWith(href + "/");
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={onClose}
                      className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-[15px] transition-all duration-200 ease-out hover:opacity-80"
                      style={{
                        background: active ? "var(--surface-2)" : "transparent",
                        color: active ? "var(--ink)" : "var(--ink-dim)",
                        fontWeight: active ? 600 : 500,
                      }}
                    >
                      <Icon />
                      {label}
                    </Link>
                  );
                })}
              </nav>

              <div className="mt-auto pt-4 border-t shrink-0" style={{ borderColor: 'var(--border)' }}>
                <div className="space-y-3">
                  <div className="rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2" style={{ background: "var(--hero-bg)" }}>
                    <span className="flex items-baseline gap-1.5 min-w-0">
                      <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--ink-faint)" }}>
                        Plan
                      </span>
                      <span className="font-display text-[14px] font-semibold tracking-tight truncate" style={{ color: "var(--hero-text)" }}>
                        {planLabel}
                      </span>
                      {bonusInterviews > 0 && (
                        <span className="text-[11px] shrink-0" style={{ color: "var(--ink-faint)" }}>
                          +{bonusInterviews}
                        </span>
                      )}
                    </span>
                    {!enterprise && (
                      <Link href="/pricing" className="text-[11.5px] shrink-0 pb-px transition-opacity hover:opacity-70" style={{ color: "var(--lime)", borderBottom: "1px solid var(--lime)" }}>
                        Manage
                      </Link>
                    )}
                  </div>

                  <div className="flex items-center justify-between px-1 py-1">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0" style={{ background: "var(--ink)", color: "var(--page)" }}>
                        {initial}
                      </span>
                      <span className="text-[13.5px] truncate" style={{ color: "var(--ink-dim)" }}>
                        {user?.username}
                      </span>
                    </div>
                    <button onClick={handleLogout} className="shrink-0 hover:opacity-80" style={{ color: "var(--ink-faint)" }} title="Sign out">
                      <LogoutIcon />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
    </>
  );
}