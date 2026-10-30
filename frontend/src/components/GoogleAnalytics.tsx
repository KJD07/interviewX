import Script from "next/script";
import { GA_MEASUREMENT_ID } from "@/lib/gtag";

// Loads gtag.js. The dataLayer/config setup lives in lib/gtag.ts so calls
// made before this script arrives are queued rather than lost.
export default function GoogleAnalytics() {
  if (!GA_MEASUREMENT_ID) return null;
  return (
    <Script
      src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
      strategy="afterInteractive"
    />
  );
}
