"use client";
import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { planOf, hasSkills } from "@/lib/plans";
import TopupModal from "@/components/TopupModal";

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
  const isMax = user?.subscription_plan === "max";
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

  return (
    <aside
      className="w-56 shrink-0 min-h-screen flex flex-col justify-between px-4 py-6 border-r"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div>
        <button
          onClick={() => router.push("/dashboard")}
          className="font-display text-lg font-semibold tracking-tight px-2 mb-8 block"
          style={{ color: "var(--ink)" }}
        >
          InterviewX
        </button>

        <nav className="space-y-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname?.startsWith(href + "/");
            return (
              <button
                key={href}
                onClick={() => router.push(href)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
                style={{
                  background: active ? "var(--accent-glow)" : "transparent",
                  color: active ? "var(--accent-dim)" : "var(--ink-dim)",
                }}
              >
                <Icon />
                {label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="px-2 space-y-4">
        <div
          className="rounded-lg px-3 py-2.5"
          style={{ background: "var(--hero-bg)" }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--hero-text)", opacity: 0.65 }}>
            Plan
          </p>
          <div className="flex items-center justify-between mt-1">
            <span className="font-display text-sm font-semibold" style={{ color: "var(--hero-text)" }}>
              {plan.label}
            </span>
            <button
              onClick={() => router.push("/upgrade")}
              className="text-xs underline"
              style={{ color: "var(--hero-text)", opacity: 0.75 }}
            >
              Manage
            </button>
          </div>

          {bonusInterviews > 0 && (
            <p className="text-xs mt-1.5" style={{ color: "var(--hero-text)", opacity: 0.75 }}>
              +{bonusInterviews} bonus {bonusInterviews === 1 ? "interview" : "interviews"}
            </p>
          )}

          {!isMax && (
            <button
              onClick={() => setShowTopup(true)}
              className="text-xs mt-1.5 underline block"
              style={{ color: "var(--hero-text)", opacity: 0.75 }}
            >
              + Buy more interviews
            </button>
          )}
        </div>

        <div className="flex items-center justify-between px-1">
          <span className="text-sm truncate" style={{ color: "var(--ink-dim)" }}>
            {user?.username}
          </span>
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
