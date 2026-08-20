"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { isPaidPlan, planOf } from "@/lib/plans";
import Sidebar from "./Sidebar";

/**
 * Wraps a page with the paid-plan sidebar (Dashboard / Companies).
 * Free-plan users fall through to `children` unwrapped — they keep the
 * simpler top-nav-only layout already built into each page.
 *
 * Also sets data-plan on <body> so the tier accent (see globals.css:
 * [data-plan="pro|premium|max"]) cascades through every component that
 * reads var(--accent) / var(--hero-bg) — one neutral shell, four accents.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const plan = planOf(user?.subscription_plan);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    document.body.setAttribute("data-plan", plan.id);
    return () => { document.body.removeAttribute("data-plan"); };
  }, [plan.id]);

  if (!isPaidPlan(user?.subscription_plan)) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen" style={{ background: "var(--page)" }}>
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="flex-1 min-w-0">
        {/* Mobile top bar: visible only on small screens */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)', background: 'var(--page)' }}>
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded hover:opacity-80"
            aria-label="Open menu"
            style={{ color: 'var(--ink-dim)' }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <a href="/dashboard" className="font-display text-[18px] font-semibold" style={{ color: 'var(--ink)' }}>
            EvaluLabs
          </a>
          <div style={{ width: 36 }} />
        </div>

        {children}
      </div>
    </div>
  );
}
