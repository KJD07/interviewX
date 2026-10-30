// Google Analytics 4. components/GoogleAnalytics.tsx loads gtag.js only when
// NEXT_PUBLIC_GA_MEASUREMENT_ID is set; every call here is a no-op otherwise.
// Calls are queued on window.dataLayer (the standard gtag stub), so events
// fired before the script finishes loading are still delivered, in order.

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "";

type Gtag = (...args: unknown[]) => void;
type GtagWindow = Window & { dataLayer?: unknown[]; gtag?: Gtag };

function gtag(): Gtag | null {
  if (!GA_MEASUREMENT_ID || typeof window === "undefined") return null;
  const w = window as GtagWindow;
  if (!w.gtag) {
    w.dataLayer = w.dataLayer || [];
    w.gtag = function () {
      // gtag.js expects the Arguments object itself, not an array.
      // eslint-disable-next-line prefer-rest-params
      w.dataLayer!.push(arguments);
    };
    w.gtag("js", new Date());
    // Page views are sent manually on every client-side route change.
    w.gtag("config", GA_MEASUREMENT_ID, { send_page_view: false });
  }
  return w.gtag;
}

// Our event names → GA4 recommended event names, so GA's built-in
// conversion reports (sign_up, login) work without remapping.
const GA_EVENT_NAMES: Record<string, string> = {
  signup_completed: "sign_up",
  login_completed: "login",
};

export function gaPageView(path: string) {
  gtag()?.("event", "page_view", {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
}

export function gaEvent(event: string, params?: Record<string, unknown>) {
  gtag()?.("event", GA_EVENT_NAMES[event] ?? event, params);
}

export function gaSetUser(userId: string | null) {
  gtag()?.("set", { user_id: userId ?? undefined });
}
