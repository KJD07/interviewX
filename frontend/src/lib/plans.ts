// Single source of truth for InterviewX plan display/limits on the frontend.
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
    monthlyLimit: 20,
    hasInsights: true,
    features: [
      "20 AI mock interviews / month",
      "All companies, roles & rounds",
      "Full dashboard & interview history",
      "AI insights: topic-by-topic scoring",
    ],
  },
  premium: {
    id: "premium",
    label: "Premium",
    priceRupees: 299,
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
  max: {
    id: "max",
    label: "Max",
    priceRupees: 599,
    monthlyLimit: null,
    hasInsights: true,
    features: [
      "Unlimited AI mock interviews",
      "All companies, roles & rounds",
      "Full dashboard & interview history",
      "AI insights: topic-by-topic scoring",
      "Priority support",
    ],
  },
};

export const PAID_PLAN_IDS: PlanId[] = ["pro", "premium", "max"];

export function planOf(subscriptionPlan: string | undefined | null): PlanInfo {
  return PLANS[(subscriptionPlan as PlanId) || "free"] ?? PLANS.free;
}

export function isPaidPlan(subscriptionPlan: string | undefined | null): boolean {
  return PAID_PLAN_IDS.includes((subscriptionPlan as PlanId) || "free");
}
