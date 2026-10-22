"""
Single source of truth for EvaluLabs subscription plans.
Used by both the interviews app (limit checks) and subscriptions app (payments).
"""

from django.conf import settings

# Tier every candidate gets while PLATFORM_FREE is on.
FREE_PLATFORM_TIER = "max"

# None = unlimited
PLANS = {
    "free": {
        "label": "Free",
        "amount_paise": 0,
        "monthly_limit": 2,
        "has_insights": False,
    },
    "pro": {
        # While PLATFORM_FREE is on this ₹199 tier is sold only as unlimited
        # ATS resume checks — see plan_label().
        "label": "Pro",
        "amount_paise": 19900,  # ₹199
        "monthly_limit": 15,
        "has_insights": True,
    },
    "premium": {
        "label": "Premium",
        "amount_paise": 29900,  # ₹299
        "monthly_limit": 30,
        "has_insights": True,
    },
    "max": {
        "label": "Max",
        "amount_paise": 59900,  # ₹599
        "monthly_limit": 50,
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


def plan_label(plan: str) -> str:
    if plan == "pro" and settings.PLATFORM_FREE:
        return "ATS Unlimited"
    return PLANS.get(plan, PLANS["free"])["label"]


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


# ---------------------------------------------------------------------------
# Sponsorship campaigns (college/institution partnerships)
# ---------------------------------------------------------------------------
# A sponsored user's real `subscription_plan` field is left untouched — these
# derive the *effective* tier/limit for the duration of an active sponsorship
# (see SponsorshipCampaign + User.sync_subscription_state()), so callers that
# gate features/limits should use these instead of the raw field wherever a
# sponsored user needs to see the campaign's grant rather than their own plan.


def effective_plan(user) -> str:
    if user.sponsorship_campaign_id:
        return user.sponsorship_campaign.granted_plan
    # Candidate portal is free: with PLATFORM_FREE every candidate gets the
    # Max tier's features and limits, whatever their stored plan.
    if settings.PLATFORM_FREE:
        return FREE_PLATFORM_TIER
    return user.subscription_plan


def effective_monthly_limit(user):
    if user.sponsorship_campaign_id:
        return user.sponsorship_campaign.interview_limit
    if settings.PLATFORM_FREE:
        return monthly_limit_for(FREE_PLATFORM_TIER)
    return monthly_limit_for(user.subscription_plan)


def plan_limit_message(user, limit) -> str:
    """403 detail when a non-sponsored user hits their monthly interview cap."""
    label = plan_label(effective_plan(user))
    if settings.PLATFORM_FREE:
        return (f"You've used all {limit} free interviews this month. "
                f"Your limit resets 30 days after your cycle started.")
    return (f"You've reached your {label} plan limit ({limit} interviews/month). "
            f"Upgrade your plan or buy a top-up pack to keep going.")


# ---------------------------------------------------------------------------
# Resume-vs-job ATS checks (Live Jobs)
# ---------------------------------------------------------------------------
# Checks are local keyword matching (zero marginal cost), so the cap exists
# for fairness / abuse control and as the upsell: Pro (₹199/mo) and above
# are unlimited, everyone else gets ATS_FREE_DAILY_LIMIT per day.
ATS_FREE_DAILY_LIMIT = 15


def has_unlimited_ats(user) -> bool:
    # Deliberately the *stored* plan: PLATFORM_FREE lifts everyone's effective
    # plan to Max, but unlimited ATS is the one thing still sold (₹199 "pro").
    return user.subscription_plan in PAID_PLANS or bool(user.sponsorship_campaign_id)


def ats_daily_limit(user):
    """None = unlimited."""
    return None if has_unlimited_ats(user) else ATS_FREE_DAILY_LIMIT


def purchasable_plans() -> set:
    """Plans that can be bought right now. With PLATFORM_FREE only the ₹199
    ATS Unlimited ("pro") tier is sold, and top-up packs are not sold."""
    return {"pro"} if settings.PLATFORM_FREE else set(PAID_PLANS)


def topups_purchasable() -> bool:
    return not settings.PLATFORM_FREE
