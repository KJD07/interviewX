// Single source of truth for EvaluLabs plan display/limits on the frontend.
// Mirrors backend/apps/subscriptions/plans.py — keep in sync.

export type PlanId = "free" | "pro" | "premium" | "max";

export interface PlanInfo {
  id: PlanId;
  label: string;
  priceRupees: number; // 0 for free
  monthlyLimit: number | null; // null = unlimited
  hasInsights: boolean; // dashboard history + AI topic insights
  features: string[];
}

export const PLANS: Record<PlanId, PlanInfo> = {
  free: {
    id: "free",
    label: "Free",
    priceRupees: 0,
    monthlyLimit: 2,
    hasInsights: false,
    features: ["2 AI mock interviews / month", "Limited companies & roles"],
  },
  pro: {
    id: "pro",
    label: "Pro",
    priceRupees: 199,
    monthlyLimit: 15,
    hasInsights: true,
    features: [
      "15 AI mock interviews / month",
      "All companies, roles & rounds",
      "Full dashboard & interview history",
      "AI insights: topic-by-topic scoring",
    ],
  },
  premium: {
    id: "premium",
    label: "Premium",
    priceRupees: 299,
    monthlyLimit: 30,
    hasInsights: true,
    features: [
      "30 AI mock interviews / month",
      "All companies, roles & rounds",
      "Full dashboard & interview history",
      "AI insights: topic-by-topic scoring",
      "Priority support",
    ],
  },
  max: {
    id: "max",
    label: "Max",
    priceRupees: 599,
    monthlyLimit: 50,
    hasInsights: true,
    features: [
      "50 AI mock interviews / month",
      "All companies, roles & rounds",
      "Full dashboard & interview history",
      "AI insights: topic-by-topic scoring",
      "Priority support",
    ],
  },
};

export const PAID_PLAN_IDS: PlanId[] = ["pro", "premium", "max"];

// ── Free platform ────────────────────────────────────────────────────────────
// Mirrors backend settings.PLATFORM_FREE: every candidate gets the Max tier
// for free and the only thing sold is ₹199/mo "ATS Unlimited" (the `pro`
// plan, relabelled — see plan_label() in plans.py). Logged-in pages should
// prefer `user.platform_free` from /me; this env default covers logged-out
// pages like /pricing.
export const PLATFORM_FREE_DEFAULT = process.env.NEXT_PUBLIC_PLATFORM_FREE !== "false";

export function isPlatformFree(user?: { platform_free?: boolean } | null): boolean {
  return user?.platform_free ?? PLATFORM_FREE_DEFAULT;
}

export const ATS_UNLIMITED_LABEL = "ATS Unlimited";
export const ATS_FREE_DAILY_LIMIT = 15;

export const FREE_PLATFORM_FEATURES = [
  "All companies, roles & skills",
  `${PLANS.max.monthlyLimit} AI mock interviews / month`,
  "Full dashboard, history & AI topic insights",
  "Typed practice with instant scoring",
  "Live jobs, refreshed every 5 hours",
  `${ATS_FREE_DAILY_LIMIT} ATS resume checks / day`,
];

export const ATS_UNLIMITED_FEATURES = [
  "Everything in Free",
  "Unlimited ATS resume checks against live jobs",
];

export function planLabel(plan: PlanId, platformFree: boolean): string {
  return plan === "pro" && platformFree ? ATS_UNLIMITED_LABEL : PLANS[plan].label;
}

export function planOf(subscriptionPlan: string | undefined | null): PlanInfo {
  return PLANS[(subscriptionPlan as PlanId) || "free"] ?? PLANS.free;
}

export function isPaidPlan(subscriptionPlan: string | undefined | null): boolean {
  return PAID_PLAN_IDS.includes((subscriptionPlan as PlanId) || "free");
}

// Skills section (skill-only practice interviews) is Premium & Max only.
const SKILLS_PLAN_IDS: PlanId[] = ["premium", "max"];

export function hasSkills(subscriptionPlan: string | undefined | null): boolean {
  return SKILLS_PLAN_IDS.includes((subscriptionPlan as PlanId) || "free");
}

// ── Top-up packs ─────────────────────────────────────────────────────────────
// One-off interview credit packs, purchasable mid-cycle on top of the
// monthly plan limit. Mirrors backend TOPUP_PACKS — keep in sync.

export type TopupPackId = "spark" | "boost" | "power";

export interface TopupPackInfo {
  id: TopupPackId;
  label: string;
  priceRupees: number;
  credits: number;
  perInterview: string; // display string, e.g. "₹19.8/interview"
}

export const TOPUP_PACKS: Record<TopupPackId, TopupPackInfo> = {
  spark: { id: "spark", label: "Spark Pack", priceRupees: 99, credits: 5, perInterview: "₹19.8/interview" },
  boost: { id: "boost", label: "Boost Pack", priceRupees: 249, credits: 15, perInterview: "₹16.6/interview" },
  power: { id: "power", label: "Power Pack", priceRupees: 449, credits: 30, perInterview: "₹15.0/interview" },
};

export const TOPUP_PACK_IDS: TopupPackId[] = ["spark", "boost", "power"];
