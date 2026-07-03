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

declare global {
  interface Window {
    google?: any;
  }
}

interface Props {
  onError?: (message: string) => void;
  onStart?: () => void;
}

export default function GoogleSignInButton({ onError, onStart }: Props) {
  const { loginWithGoogle } = useAuth();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

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
    if (!scriptLoaded || !GOOGLE_CLIENT_ID || !window.google || !buttonRef.current) return;

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async (response: { credential: string }) => {
        onStart?.();
        try {
          await loginWithGoogle(response.credential);
          // Full reload keeps this simple and matches the rest of the app's
          // "redirect after auth" pattern used on the login/register pages.
          window.location.href = "/dashboard";
        } catch (err) {
          onError?.(
            err instanceof ApiError ? err.detail : "Google sign-in failed. Please try again."
          );
        }
      },
    });

    window.google.accounts.id.renderButton(buttonRef.current, {
      theme: "filled_black",
      size: "large",
      width: 320,
      shape: "rectangular",
      text: "continue_with",
    });
  }, [scriptLoaded, loginWithGoogle, onError, onStart]);

  if (!GOOGLE_CLIENT_ID) return null;

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setScriptLoaded(true)}
      />
      <div ref={buttonRef} className="flex justify-center" />
    </>
  );
}