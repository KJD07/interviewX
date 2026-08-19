"use client";
import { useEffect } from "react";
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

  useEffect(() => {
    document.body.setAttribute("data-plan", plan.id);
    return () => { document.body.removeAttribute("data-plan"); };
  }, [plan.id]);

  if (!isPaidPlan(user?.subscription_plan)) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen" style={{ background: "var(--page)" }}>
      <Sidebar />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
