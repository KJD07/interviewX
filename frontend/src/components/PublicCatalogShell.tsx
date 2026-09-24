"use client";

import { useAuth } from "@/context/AuthContext";
import MarketingNav from "@/components/MarketingNav";
import MarketingFooter from "@/components/MarketingFooter";

/**
 * Crawlable intro for catalog routes that are otherwise behind login.
 * Auth starts null on the server, so this HTML is in the first response.
 * After mount, signed-in users drop the intro and keep the app underneath.
 */
export default function PublicCatalogShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (!loading && user) return null;

  return (
    <div className="min-h-screen bg-[var(--page)]">
      <MarketingNav />
      {children}
      <MarketingFooter />
    </div>
  );
}
