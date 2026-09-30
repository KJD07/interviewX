"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function ProtectedRoute({
  children,
  redirect = true,
}: {
  children: React.ReactNode;
  /** When false, logged-out visitors stay on the page and see nothing from this gate. */
  redirect?: boolean;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (redirect && !loading && !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname || "/dashboard")}`);
    }
  }, [redirect, loading, user, router, pathname]);

  // While we're still checking localStorage for a session, render nothing
  // rather than redirecting prematurely.
  if (loading || !user) return null;
  return <>{children}</>;
}