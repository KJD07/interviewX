// First-touch / last-touch marketing attribution (UTM params, ad click ids,
// external referrer, landing page). Captured once per page load by
// ReferralTracker, sent with register + Google sign-in (stored on the User by
// backend accounts/attribution.py), and registered on PostHog/GA4 events.

const FIRST_TOUCH_KEY = "ix_first_touch";
const LAST_TOUCH_KEY = "ix_last_touch";

const URL_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "li_fat_id",
  "ref",
] as const;

export type Touch = Partial<Record<(typeof URL_PARAMS)[number], string>> & {
  referrer?: string;
  landing_page?: string;
  captured_at?: string;
};

export interface Attribution {
  first_touch?: Touch;
  last_touch?: Touch;
}

function read(key: string): Touch | undefined {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Touch) : undefined;
  } catch {
    return undefined;
  }
}

function write(key: string, touch: Touch) {
  try {
    localStorage.setItem(key, JSON.stringify(touch));
  } catch {
    // Storage blocked (private mode) — attribution is best-effort.
  }
}

function externalReferrer(): string | undefined {
  if (!document.referrer) return undefined;
  try {
    const host = new URL(document.referrer).hostname;
    return host === window.location.hostname ? undefined : document.referrer;
  } catch {
    return undefined;
  }
}

/** Record this page load as a touch. The first touch is never overwritten;
 * the last touch is replaced whenever the visit carries campaign params or
 * comes from another site. Returns the stored attribution. */
export function captureAttribution(): Attribution {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const touch: Touch = {};
  for (const key of URL_PARAMS) {
    const value = params.get(key)?.trim();
    if (value) touch[key] = value.slice(0, 300);
  }
  const referrer = externalReferrer();
  if (referrer) touch.referrer = referrer.slice(0, 300);

  const isNewTouch = Object.keys(touch).length > 0;
  touch.landing_page = window.location.pathname;
  touch.captured_at = new Date().toISOString();

  if (!read(FIRST_TOUCH_KEY)) write(FIRST_TOUCH_KEY, touch);
  if (isNewTouch || !read(LAST_TOUCH_KEY)) write(LAST_TOUCH_KEY, touch);
  return getAttribution();
}

export function getAttribution(): Attribution {
  if (typeof window === "undefined") return {};
  return { first_touch: read(FIRST_TOUCH_KEY), last_touch: read(LAST_TOUCH_KEY) };
}

/** Flat `ft_*` / `lt_*` properties for analytics super-properties. */
export function attributionProperties(): Record<string, string> {
  const { first_touch, last_touch } = getAttribution();
  const props: Record<string, string> = {};
  for (const [prefix, touch] of [["ft", first_touch], ["lt", last_touch]] as const) {
    if (!touch) continue;
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "referrer", "landing_page"] as const) {
      if (touch[key]) props[`${prefix}_${key}`] = touch[key] as string;
    }
  }
  return props;
}
