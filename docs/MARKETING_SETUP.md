# Marketing setup: analytics, attribution, outreach

What's built in code, what still needs a human to click through an external
console, and the conventions every campaign link must follow so signups can
be credited to the channel that brought them.

## Status

| Piece | State | Owner action |
|---|---|---|
| UTM / referrer capture (first + last touch) | Built (`lib/attribution.ts`) | None |
| Signup attribution stored on `User` | Built (`signup_source`, `signup_attribution`; Django admin filter) | Deploy (migration `accounts.0010` runs on start) |
| PostHog product analytics | Built earlier; gets attribution super-properties now | Set `NEXT_PUBLIC_POSTHOG_KEY` if not already set in prod |
| GA4 | Built (`lib/gtag.ts`), off until configured | Create property, set `NEXT_PUBLIC_GA_MEASUREMENT_ID` |
| Search Console / Bing verification | Built (meta tags from env) | Get tokens, set env, submit sitemap |
| Outreach sending domain | `outreach.evalulabs.com` created in Resend | Add the DNS records below, then verify |
| Apollo ICP (Context Center) | Draft below, not saved | Review and approve the text |
| LinkedIn via PostNitro | PostNitro API returned 403 from this session | Reconnect PostNitro, link LinkedIn page + profile |

## 1. Google Analytics 4

1. analytics.google.com → Admin → Create property "EvaluLabs".
   Time zone India, currency INR.
2. Data streams → Web → `https://www.evalulabs.com`. Copy the Measurement ID (`G-XXXXXXX`).
3. Set `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXX` in the production `.env` and redeploy.
4. Admin → Data retention → 14 months.
5. Admin → Events → mark `sign_up` as a **key event** (conversion). Do the same for
   `ats_check_completed` and `interview_started` if you want activation reported in GA.
6. Admin → Product links → Search Console links → link the property from step 2 below.

Page views are sent on every client-side route change (the automatic one is off).
Every `trackEvent()` call goes to both PostHog and GA4. `signup_completed` is
renamed to GA's `sign_up`, and `login_completed` to `login`.

## 2. Google Search Console + Bing

1. search.google.com/search-console → Add property → **URL prefix**
   `https://www.evalulabs.com/` → method "HTML tag". Copy only the `content="…"` value.
2. Set `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=<value>`, redeploy, click Verify.
   (A **Domain** property via DNS TXT also works and covers apex + www; the
   meta tag isn't needed then.)
3. Sitemaps → submit `https://www.evalulabs.com/sitemap.xml`.
4. bing.com/webmasters → Import from Google Search Console. This is the quickest way, and it
   also feeds Copilot/ChatGPT search. Alternatively, use the HTML tag with
   `NEXT_PUBLIC_BING_SITE_VERIFICATION`.

## 3. Outreach sending domain (Resend)

Cold and marketing email goes out from `outreach.evalulabs.com`, never from
`evalulabs.com`. Spam complaints from outreach then can't hurt OTP and
password-reset delivery. Add these records at the DNS provider for
`evalulabs.com`. The names are relative to `evalulabs.com`:

| Type | Name | Value | Priority |
|---|---|---|---|
| TXT | `resend._domainkey.outreach` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC4cCILpV+4bJ7ZKKvUqnxlSzmtSWf71b6PSwNJjj77BrO4TIlwF0QlUfDppMJSyVtvyIoHoXdQp4xXD629wVtRRXjWY8CWvaWw/o++qzBMJgJooOOwrwxicNa1I+uukTXWtl2UhpWSoclchrVfHmKRy7yZ1UVxG6IJcx5a7rC5FwIDAQAB` | |
| MX | `send.outreach` | `feedback-smtp.ap-northeast-1.amazonses.com` | 10 |
| TXT | `send.outreach` | `v=spf1 include:amazonses.com ~all` | |
| CNAME | `rsend.outreach` | `send.forge.rmta.net` | |
| TXT | `_dmarc.outreach` | `v=DMARC1; p=none; rua=mailto:<your inbox>` | |

The DMARC record isn't from Resend. Add it anyway, since Gmail and Yahoo require one for bulk senders.
Once the records resolve, verify the domain in Resend.

Sending rules:
- Send from a real person, e.g. `kanan@outreach.evalulabs.com`, with reply-to set to an
  inbox you actually read (the `evalulabs-outreach` skill sets this).
- Warm up the domain: about 20 emails a day in week 1, then roughly double each week. Personalize every
  email. Stop sending to anyone who bounces or asks to stop.
- Every email needs who you are, why you're writing, and a one-line opt-out.
  Don't email personal addresses you scraped. Work emails of people in a
  relevant role are fine (DPDP Act / CAN-SPAM).

## 4. UTM convention

All lowercase, words joined with `_`. Every link you post anywhere outside the site gets
`utm_source`, `utm_medium` and `utm_campaign`.

| Param | Allowed values |
|---|---|
| `utm_source` | `linkedin`, `instagram`, `reddit`, `youtube`, `whatsapp`, `twitter`, `newsletter`, `apollo`, `college_<short>` (e.g. `college_thapar`), `partner_<code>` |
| `utm_medium` | `social` (organic post), `paid_social`, `cpc`, `email`, `dm`, `referral`, `video` |
| `utm_campaign` | `<yyyy_mm>_<theme>`, e.g. `2026_11_ats_check`, `2026_11_college_pilot` |
| `utm_content` | optional, to tell variants apart: `carousel_a`, `reel_1`, `cta_footer` |

Ready-made links:

```
https://www.evalulabs.com/?utm_source=linkedin&utm_medium=social&utm_campaign=2026_11_ats_check
https://www.evalulabs.com/jobs?utm_source=instagram&utm_medium=social&utm_campaign=2026_11_live_jobs
https://www.evalulabs.com/?utm_source=apollo&utm_medium=email&utm_campaign=2026_11_college_pilot
https://www.evalulabs.com/enterprise?utm_source=apollo&utm_medium=email&utm_campaign=2026_11_recruiter_outreach
https://www.evalulabs.com/?utm_source=whatsapp&utm_medium=dm&utm_campaign=2026_11_college_thapar
```

Partner referral codes keep using `?ref=<CODE>` (handled by `ReferralTracker`).
`ref` is also stored in the attribution snapshot.

How it's recorded:
- **First touch** is the first visit ever on that browser and is never overwritten.
  `User.signup_source` is its `utm_source`. With no UTM it falls back to the referrer host,
  else `direct`.
- **Last touch** is the most recent visit that had UTM/click-id params or came from another site.
- Both are sent at signup and kept in `User.signup_attribution`. They're also registered on
  PostHog events as `ft_*` / `lt_*` properties.

Where to read it: Django admin → Users → filter by **signup source**. PostHog
→ breakdown any event by `ft_utm_source`. GA4 → Reports → Acquisition.

## 5. Event dictionary

| Event | Fired when | GA4 name |
|---|---|---|
| `$pageview` | every route change | `page_view` |
| `signup_started` | register form accepted, OTP emailed | same |
| `signup_completed` | OTP verified, or first Google sign-in (`method`) | `sign_up` |
| `login_completed` | password or Google login of an existing account | `login` |
| `resume_uploaded` | profile filled from a resume | same |
| `ats_check_completed` | ATS check result returned (`job_id`, `own_resume`) | same |
| `job_saved` | job bookmarked | same |
| `application_tracked` | application added to the tracker | same |
| `interview_started` / `interview_completed` | AI mock interview | same |
| `pricing_viewed` | pricing page | same |
| `enterprise_*` | enterprise dashboard / invites | same |

Funnel to build in PostHog: `$pageview` (marketing) → `signup_completed` →
`resume_uploaded` → `ats_check_completed` → `interview_started`, broken down
by `ft_utm_source`.

## 6. Apollo ICP draft (not saved; review first)

The connected Apollo account has 75 lead credits and no Context Center. It
also isn't under an EvaluLabs name or email. Outreach and mailbox linking should
run from an account in your real name, so check that first.

Two segments, one ICP each:

**A. Colleges (sponsorship campaigns)**
- Customer profile: Training & Placement Officers, placement heads and career-services
  directors at Indian engineering/MBA colleges with 1,000+ students.
- Pain points: students arrive at campus drives unprepared. Placement cells
  can't run 1:1 mock interviews at scale. There's no data on student readiness.
- Value proposition: every student on the college email domain gets
  AI mock interviews (company-specific rounds, strict 0–10 scoring with
  feedback), an ATS resume check and a live India job feed. It's switched on
  by email domain, with no installs.
- CTA: a free 30-day pilot for one batch.

**B. Recruiters / startup TA (EvaluLabs Enterprise)**
- Customer profile: founders, TA leads and HR heads at Indian startups with 20–500
  employees that hire engineers.
- Pain points: engineering hours spent on first-round screens, inconsistent
  interviewers, and cheating in take-home tests.
- Value proposition: AI-run first-round technical and coding interviews from
  your own question bank, with scored reports and proctoring.
- CTA: a 20-minute demo, or a free screen of 10 candidates.

Positioning, competitors and social proof are left blank on purpose. Fill those in
yourself; they shouldn't be guessed.

## 7. Daily outreach autopilot

The `outreach-autopilot` skill (`.claude/skills/outreach-autopilot/SKILL.md`)
holds the daily loop: triage replies, send follow-ups, email new Apollo
prospects within the warm-up cap, then email a report. Positive replies get an
automatic answer with the booking link. Objections, referrals and anything odd
are left as drafts labelled `needs-kanan` in the Resend inbox.

Before it can run end to end:
1. Enable **receiving** on `outreach.evalulabs.com` in Resend and add the MX
   record it shows (name `outreach`). Then create the inbox
   `kanan@outreach.evalulabs.com`. Replies go there.
2. Put a real booking link (Cal.com or Calendly) in the skill's Config table.
   Until then every positive reply is drafted, not sent.
3. Apollo enrichment needs credits. The free 75 last about 4 days at 20 a day.
