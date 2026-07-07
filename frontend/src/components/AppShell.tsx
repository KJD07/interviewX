"use client";
import { useAuth } from "@/context/AuthContext";
import { isPaidPlan } from "@/lib/plans";
import Sidebar from "./Sidebar";

/**
 * Wraps a page with the paid-plan sidebar (Dashboard / Companies).
 * Free-plan users fall through to `children` unwrapped — they keep the
 * simpler top-nav-only layout already built into each page.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  if (!isPaidPlan(user?.subscription_plan)) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen" style={{ background: "var(--navy)" }}>
      <Sidebar />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
