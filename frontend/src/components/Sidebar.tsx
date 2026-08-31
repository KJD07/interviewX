"use client";
import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { planOf, hasSkills } from "@/lib/plans";
import icon from "@/app/icon.png";

// Nav glyphs — one 20x20 grid, solid fills with knocked-out counters, all
// inheriting currentColor so NavGlyph's active/idle colors keep driving them.
function GridIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="currentColor">
      <rect x="2.75" y="2.75" width="6" height="14.5" rx="2" />
      <rect x="11.25" y="2.75" width="6" height="5.25" rx="2" />
      <rect x="11.25" y="12" width="6" height="5.25" rx="2" />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="currentColor" fillRule="evenodd">
      <path d="M4.75 2.5h6a2 2 0 0 1 2 2v12.75h-10V4.5a2 2 0 0 1 2-2Zm.75 3.75h1.75V8H5.5V6.25Zm3.5 0h1.75V8H9V6.25Zm-3.5 3.5h1.75v1.75H5.5V9.75Zm3.5 0h1.75v1.75H9V9.75Zm-.5 3.5h-1.5v4h1.5v-4Z" />
      <path d="M12.5 8.5h3.25a1.75 1.75 0 0 1 1.75 1.75v7H12.5V8.5Zm1.25 3h1.75v1.75h-1.75V11.5Z" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="currentColor">
      <path d="M8 2.5c0 3.05 2.45 5.5 5.5 5.5-3.05 0-5.5 2.45-5.5 5.5 0-3.05-2.45-5.5-5.5-5.5 3.05 0 5.5-2.45 5.5-5.5Z" />
      <path d="M14.75 12.25c0 1.5 1.25 2.75 2.75 2.75-1.5 0-2.75 1.25-2.75 2.75 0-1.5-1.25-2.75-2.75-2.75 1.5 0 2.75-1.25 2.75-2.75Z" />
    </svg>
  );
}

function TrendIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="currentColor">
      <rect x="2.75" y="11" width="3.25" height="6.25" rx="1.4" />
      <rect x="8.375" y="8" width="3.25" height="9.25" rx="1.4" />
      <rect x="14" y="4.5" width="3.25" height="12.75" rx="1.4" />
    </svg>
  );
}

function QuestionsIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="currentColor" fillRule="evenodd">
      <path d="M4.25 2.5h11.5A2.25 2.25 0 0 1 18 4.75v7A2.25 2.25 0 0 1 15.75 14H9.75L6 17.25V14H4.25A2.25 2.25 0 0 1 2 11.75v-7A2.25 2.25 0 0 1 4.25 2.5Zm1.5 4h8.5v1.75h-8.5V6.5Zm0 3.25h5.75v1.75H5.75V9.75Z" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="currentColor">
      <circle cx="10" cy="6.25" r="3.25" />
      <path d="M10 11.25c3.4 0 5.75 1.6 6.55 4.6a1 1 0 0 1-.97 1.25H4.42a1 1 0 0 1-.97-1.25c.8-3 3.15-4.6 6.55-4.6Z" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
      <path d="M4.75 2.5H9v2H5v11h4v2H4.75A1.75 1.75 0 0 1 3 15.75V4.25A1.75 1.75 0 0 1 4.75 2.5Z" />
      <path d="M12.9 5.65 17.25 10l-4.35 4.35-1.45-1.45 1.9-1.9H7.75v-2h5.6l-1.9-1.9 1.45-1.45Z" />
    </svg>
  );
}

// The active row itself is the ink slab, so the glyph only recolors: lime on
// the dark row, faint ink on idle rows.
function NavGlyph({ Icon, active }: { Icon: () => JSX.Element; active: boolean }) {
  return (
    <span
      className="w-[22px] h-[22px] flex items-center justify-center shrink-0 transition-colors duration-200 ease-out"
      style={{ color: active ? "var(--lime)" : "var(--ink-faint)" }}
    >
      <Icon />
    </span>
  );
}

// Sidebar plan card: tier, "manage" link, and the monthly interview meter.
function PlanCard({
  planLabel,
  enterprise,
  used,
  limit,
  bonus,
}: {
  planLabel: string;
  enterprise: boolean;
  used: number;
  limit: number | null;
  bonus: number;
}) {
  const pct = limit && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div className="rounded-[14px] px-4 py-3.5" style={{ background: "var(--hero-bg)" }}>
      <div className="flex items-center justify-between mb-2.5">
        <span className="font-mono text-[9px] uppercase tracking-[0.16em]" style={{ color: "#7E7D74" }}>
          Plan
        </span>
        {!enterprise && (
          <Link
            href="/pricing"
            className="font-mono text-[10px] underline transition-opacity hover:opacity-70"
            style={{ color: "var(--lime)" }}
          >
            manage
          </Link>
        )}
      </div>
      <div
        className="font-display text-[19px] font-bold tracking-[-0.02em] mb-2.5 truncate"
        style={{ color: "var(--hero-text)" }}
      >
        {planLabel}
        {bonus > 0 && <span className="text-[13px] font-medium" style={{ color: "#7E7D74" }}> +{bonus}</span>}
      </div>
      <div className="relative h-1 rounded-sm" style={{ background: "rgba(255,255,255,0.14)" }}>
        <span
          className="absolute inset-y-0 left-0 rounded-sm"
          style={{ width: `${pct}%`, background: "var(--lime)" }}
        />
      </div>
      <div className="font-mono text-[10px] mt-2 uppercase" style={{ color: "#7E7D74" }}>
        {limit == null ? `${used} sessions used` : `${used} / ${limit} sessions used`}
      </div>
    </div>
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
        { href: "/enterprise/dashboard", label: "Dashboard", icon: GridIcon },
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
  const used = user?.interviews_this_month ?? 0;
  const limit = user?.monthly_limit ?? plan.monthlyLimit;

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex w-[250px] shrink-0 h-screen sticky top-0 flex-col px-[18px] py-6 border-r"
        style={{ background: "var(--surface-2)", borderColor: "var(--border-mid)" }}
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
                className="w-full flex items-center gap-[11px] px-3.5 py-[11px] rounded-[11px] text-[15px] transition-colors duration-200 ease-out"
                style={{
                  background: active ? "var(--ink)" : "transparent",
                  color: active ? "var(--page)" : "#3A3933",
                  fontWeight: active ? 600 : 500,
                }}
              >
                <NavGlyph Icon={Icon} active={active} />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="space-y-3 shrink-0">
        <PlanCard planLabel={planLabel} enterprise={enterprise} used={used} limit={limit} bonus={bonusInterviews} />

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
          style={{ background: 'var(--surface-2)' }}
        >
            <div className="flex flex-col h-full px-5 py-6 border-r" style={{ borderColor: 'var(--border-mid)' }}>
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
                      className="w-full flex items-center gap-[11px] px-3.5 py-[11px] rounded-[11px] text-[15px] transition-colors duration-200 ease-out"
                      style={{
                        background: active ? "var(--ink)" : "transparent",
                        color: active ? "var(--page)" : "#3A3933",
                        fontWeight: active ? 600 : 500,
                      }}
                    >
                      <NavGlyph Icon={Icon} active={active} />
                      {label}
                    </Link>
                  );
                })}
              </nav>

              <div className="mt-auto pt-4 border-t shrink-0" style={{ borderColor: 'var(--border)' }}>
                <div className="space-y-3">
                  <PlanCard planLabel={planLabel} enterprise={enterprise} used={used} limit={limit} bonus={bonusInterviews} />

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