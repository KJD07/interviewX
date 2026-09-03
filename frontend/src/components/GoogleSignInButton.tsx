"use client";
// src/components/GoogleSignInButton.tsx
// Renders Google's official "Sign in with Google" button via Google
// Identity Services (loaded from Google's CDN — no extra npm package).
// On success, hands the ID token to AuthContext.loginWithGoogle.

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
// GIS `renderButton` width is clamped to 200–400px. We render inside that
// range, then scale so the pill always matches the parent — including phones
// narrower than 200px and cards wider than 400px.
const GSI_MAX_WIDTH = 400;
const GSI_MIN_WIDTH = 200;
const GSI_LARGE_HEIGHT = 40;

declare global {
  interface Window {
    google?: any;
  }
}

interface Props {
  redirectPath?: string;
  onError?: (message: string) => void;
  onStart?: () => void;
  adminOnly?: boolean;
}

export default function GoogleSignInButton({ redirectPath = "/dashboard", onError, onStart, adminOnly = false }: Props) {
  const { loginWithGoogle, loginWithGoogleAdmin } = useAuth();
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);

  // next/script's onLoad only fires the FIRST time a given src is ever
  // loaded on the page. On client-side navigation (e.g. /login -> /register,
  // or after logout back to /login), a fresh GoogleSignInButton mounts with
  // scriptLoaded=false, but the <script> tag is already cached by Next and
  // onLoad won't fire again — so we also check for window.google directly.
  useEffect(() => {
    if (window.google?.accounts?.id) {
      setScriptLoaded(true);
    }
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      const w = Math.round(el.getBoundingClientRect().width);
      setContainerWidth((prev) => (Math.abs(prev - w) < 2 ? prev : w));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("orientationchange", update);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const gsiWidth = Math.max(GSI_MIN_WIDTH, Math.min(GSI_MAX_WIDTH, containerWidth || GSI_MAX_WIDTH));
  const scale = containerWidth > 0 ? containerWidth / gsiWidth : 1;

  useEffect(() => {
    if (!scriptLoaded || !GOOGLE_CLIENT_ID || !window.google || !buttonRef.current) return;
    if (containerWidth <= 0) return;

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async (response: { credential: string }) => {
        onStart?.();
        try {
          const signIn = adminOnly ? loginWithGoogleAdmin : loginWithGoogle;
          await signIn(response.credential);
          // Full reload keeps this simple and matches the rest of the app's
          // "redirect after auth" pattern used on the login/register pages.
          window.location.href = redirectPath;
        } catch (err) {
          onError?.(
            err instanceof ApiError ? err.detail : "Google sign-in failed. Please try again."
          );
        }
      },
    });

    buttonRef.current.innerHTML = "";
    window.google.accounts.id.renderButton(buttonRef.current, {
      theme: "filled_black",
      size: "large",
      width: gsiWidth,
      shape: "pill",
      text: "continue_with",
    });
  }, [
    scriptLoaded,
    containerWidth,
    gsiWidth,
    loginWithGoogle,
    loginWithGoogleAdmin,
    adminOnly,
    redirectPath,
    onError,
    onStart,
  ]);

  if (!GOOGLE_CLIENT_ID) return null;

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setScriptLoaded(true)}
      />
      <div
        ref={wrapRef}
        className="relative w-full max-w-full overflow-hidden"
        style={{ height: GSI_LARGE_HEIGHT * scale }}
      >
        <div
          ref={buttonRef}
          className="origin-top-left"
          style={{
            width: gsiWidth,
            transform: `scale(${scale})`,
          }}
        />
      </div>
    </>
  );
}
