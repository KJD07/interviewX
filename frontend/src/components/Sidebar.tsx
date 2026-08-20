"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { planOf, hasSkills } from "@/lib/plans";
import TopupModal from "@/components/TopupModal";
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

function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M6 2H3.5a1 1 0 00-1 1v10a1 1 0 001 1H6M10.5 11.5L14 8l-3.5-3.5M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Sidebar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const plan = planOf(user?.subscription_plan);
  const [showTopup, setShowTopup] = useState(false);
  const bonusInterviews = user?.bonus_interviews ?? 0;

  const NAV_ITEMS = [
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

  return (
    <aside
      className="w-[260px] shrink-0 h-screen sticky top-0 flex flex-col px-5 py-7 border-r"
      style={{ background: "var(--page)", borderColor: "var(--border)" }}
    >
      <div className="flex flex-col min-h-0 flex-1">
        <Link
          href="/dashboard"
          className="font-display flex items-center gap-2.5 text-[19px] font-semibold tracking-tight px-1.5 mb-9 shrink-0"
          style={{ color: "var(--ink)" }}
        >
          <Image src={icon} alt="EvaluLabs" width={28} height={28} className="rounded-md" priority />
          EvaluLabs
        </Link>

        <nav className="space-y-1 overflow-y-auto min-h-0 flex-1 pr-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname?.startsWith(href + "/");
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
          className="rounded-2xl p-[18px]"
          style={{ background: "var(--hero-bg)" }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--ink-faint)" }}>
            Plan
          </p>
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <span className="font-display text-[19px] font-semibold tracking-tight" style={{ color: "var(--hero-text)" }}>
              {plan.label}
            </span>
            <Link
              href="/pricing"
              className="text-xs pb-px transition-opacity hover:opacity-70"
              style={{ color: "var(--lime)", borderBottom: "1px solid var(--lime)" }}
            >
              Manage
            </Link>
          </div>

          {bonusInterviews > 0 && (
            <p className="text-xs mt-1" style={{ color: "var(--ink-faint)" }}>
              +{bonusInterviews} bonus {bonusInterviews === 1 ? "interview" : "interviews"}
            </p>
          )}

          <button
            onClick={() => setShowTopup(true)}
            className="text-[12.5px] mt-1 pb-px block transition-opacity hover:opacity-70"
            style={{ color: "var(--ink-faint)", borderBottom: "1px dashed rgba(184,184,174,0.4)" }}
          >
            + Buy more interviews
          </button>
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

      {showTopup && <TopupModal onClose={() => setShowTopup(false)} />}
    </aside>
  );
}