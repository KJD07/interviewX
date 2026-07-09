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


# ---------------------------------------------------------------------------
# Mid-month top-up packs
# ---------------------------------------------------------------------------
# One-off interview credits a user can buy any time to go past their plan's
# monthly limit without waiting for the next billing cycle. Priced so that
# upgrading a tier remains the better deal per-interview (top-ups are always
# more expensive per interview than the next plan up).
TOPUP_PACKS = {
    "spark": {
        "label": "Spark Pack",
        "amount_paise": 9900,   # ₹99
        "credits": 5,           # ₹19.8 / interview
    },
    "boost": {
        "label": "Boost Pack",
        "amount_paise": 24900,  # ₹249
        "credits": 15,          # ₹16.6 / interview
    },
    "power": {
        "label": "Power Pack",
        "amount_paise": 44900,  # ₹449
        "credits": 30,          # ₹15.0 / interview
    },
}


def topup_amount_for(pack: str):
    return TOPUP_PACKS[pack]["amount_paise"]


def topup_credits_for(pack: str):
    return TOPUP_PACKS[pack]["credits"]


def monthly_limit_for(plan: str):
    return PLANS.get(plan, PLANS["free"])["monthly_limit"]


def amount_for(plan: str):
    return PLANS[plan]["amount_paise"]


def has_insights(plan: str) -> bool:
    """Only paid plans (Pro/Premium/Max) get topic-level AI insights &
    a full history dashboard. Free plan gets a plain overall score."""
    return PLANS.get(plan, PLANS["free"])["has_insights"]


# Plans that unlock the Skills section (practice interviews scoped to a
# single skill rather than a real company). Premium and Max only.
SKILLS_PLANS = {"premium", "max"}


def has_skills(plan: str) -> bool:
    return plan in SKILLS_PLANS
