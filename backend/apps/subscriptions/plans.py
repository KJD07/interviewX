"""
Single source of truth for InterviewX subscription plans.
Used by both the interviews app (limit checks) and subscriptions app (payments).
"""

# None = unlimited
PLANS = {
    "free": {
        "label": "Free",
        "amount_paise": 0,
        "monthly_limit": 2,
        "has_insights": False,
    },
    "pro": {
        "label": "Pro",
        "amount_paise": 19900,  # ₹199
        "monthly_limit": 20,
        "has_insights": True,
    },
    "premium": {
        "label": "Premium",
        "amount_paise": 29900,  # ₹299
        "monthly_limit": 50,
        "has_insights": True,
    },
    "max": {
        "label": "Max",
        "amount_paise": 59900,  # ₹599
        "monthly_limit": None,  # unlimited
        "has_insights": True,
    },
}

PAID_PLANS = {k: v for k, v in PLANS.items() if k != "free"}


def monthly_limit_for(plan: str):
    return PLANS.get(plan, PLANS["free"])["monthly_limit"]


def amount_for(plan: str):
    return PLANS[plan]["amount_paise"]


def has_insights(plan: str) -> bool:
    """Only paid plans (Pro/Premium/Max) get topic-level AI insights &
    a full history dashboard. Free plan gets a plain overall score."""
    return PLANS.get(plan, PLANS["free"])["has_insights"]
