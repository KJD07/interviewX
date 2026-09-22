"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { identifyUser, trackPageView } from "@/lib/posthog";

export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();

  useEffect(() => {
    identifyUser(user);
  }, [user]);

  useEffect(() => {
    if (!pathname || pathname.startsWith("/analytics")) return;
    trackPageView(pathname);
  }, [pathname]);

  return <>{children}</>;
}
