# EvaluLabs SEO, GEO & AEO Plan

Living playbook for search engine optimization (SEO), generative engine optimization (GEO), and answer engine optimization (AEO) on [evalulabs.com](https://www.evalulabs.com).

**Use this document** when scoping or executing SEO work: audit against Phase 0 constraints, implement phases in order, and run Phase 10 before shipping.

**Related code:** `frontend/src/lib/seo.ts`, `frontend/src/app/sitemap.ts`, `frontend/src/app/robots.ts`, `frontend/src/components/StructuredData.tsx`, `frontend/public/llms.txt`.

**Progress log:** Update `STATE.md` when a phase ships; link GitHub issues/PRs there.

---

## Phase 0 — Principles and constraints

Do not rewrite architecture or break existing product behavior.

| Rule | Detail |
|------|--------|
| Reuse existing SEO stack | `pageMetadata()`, thin server `layout.tsx` per route, `StructuredData` for JSON-LD. |
| Client pages | Most UI is `"use client"`; metadata must stay in server layouts (see `STATE.md`). |
| Plan limits | Gate features with `effective_plan()` / helpers in `apps/subscriptions/plans.py` — not duplicated in marketing copy as guarantees. |
| Factual copy only | Describe capabilities that exist in code. No fake stats, no candidate/private data in public content. |
| Dedicated pages | Add URLs only when they add non-duplicative value; prefer improving `/`, `/about`, `/enterprise` first. |
| Thin content | No mass-produced AI articles; no FAQ blocks created only for schema. |
| Proctoring accuracy | Document only what `frontend/src/hooks/useProctoring.ts` and enterprise session flags actually do. |
| Coding accuracy | Monaco editor, multi-language workspaces, AI-graded submissions and check-ins — **not** a separate code-judge/sandbox unless one is built. |

### Proctoring features (enterprise invites, `is_proctored`)

**Document these:**

- Camera required; interview blocked if access denied or camera disconnects beyond grace period
- No-face and multiple-face detection (face-api, streak confirmation)
- Phone in frame (COCO-SSD)
- Tab / window visibility change
- Paste detection, devtools-dock size heuristic (logged as suspicious activity)
- Short violation clips (~15s), violation cap with auto-end, org live camera viewing

**Do not claim (types exist but are not reported in `useProctoring.ts`):**

- Gaze-away detection
- Low-light detection as an active violation

### Coding assessment (practice + enterprise)

**Document these:**

- Coding and system-design question types in the interview loop
- In-session Monaco editor (or textarea fallback), multiple languages
- Submit and in-progress check-ins sent to the AI interviewer for pressure and grading
- End-of-session rubric scores (communication, technical depth, problem solving, overall)

**Do not claim:**

- Automated unit-test execution against a hidden test suite (unless implemented in backend)

---

## Phase 1 — Technical SEO and crawl hygiene

**Goal:** Correct indexing rules, aligned sitemap, consistent metadata patterns.

### 1.1 `frontend/src/app/robots.ts`

- **Disallow** authenticated / low-value crawl paths:
  - Existing: `/dashboard`, `/progress`, `/interview/`, `/malik/`, `/verify-email`, `/reset-password`, `/forgot-password`, `/enterprise/invite/`, `/partner`, `/api/`
  - Add: `/enterprise/dashboard`, `/enterprise/candidate`, `/enterprise/live/`, `/enterprise/questions`, `/analytics`
  - Align: `/partner` (already `noIndex` in layout)
- **Allow** `/` for `*` — do not block legitimate AI/search crawlers unnecessarily.
- Optional explicit `allow: /` rules for `OAI-SearchBot`, `ChatGPT-User`, `PerplexityBot` (same effective policy as `*`).

### 1.2 `frontend/src/app/sitemap.ts`

- Keep in sync with `robots.ts` disallow list and `noIndex` layouts.
- **Remove `/companies` and `/skills`** until Phase 2 delivers crawlable public content — or re-add after Phase 2.
- Consider removing `/login` (low SEO value); keep `/register` if sign-up discovery matters.
- Add URLs for any new public pages from Phase 3.

### 1.3 Private route metadata

Add thin server `layout.tsx` with `pageMetadata({ …, noIndex: true })` for any authenticated enterprise segments missing it:

- `/enterprise/dashboard`
- `/enterprise/candidate`
- `/enterprise/live/[sessionId]`
- `/enterprise/questions`

(Invite, partner, dashboard consumer routes already covered — verify on each change.)

### 1.4 Homepage metadata

- Split `app/page.tsx` into server `page.tsx` (exports `metadata` + optional JSON-LD) and `HomeClient.tsx` (current UI), **or** equivalent minimal refactor.
- Gives `/` a tunable title/description without changing root layout defaults only.

### 1.5 FAQ JSON-LD on homepage

- Move homepage `FAQPage` schema to a **server layout** (mirror `enterprise/(home)/layout.tsx`).
- Keep visible FAQ in client component; answers must remain in SSR HTML.

### 1.6 Phase 1 verification

- `npm run lint` and `npm run build` from `frontend/`
- Fetch `/robots.txt`, `/sitemap.xml`
- Spot-check canonicals and `robots` meta on public vs private URLs

---

## Phase 2 — `/companies` and `/skills` indexability

**Problem:** Both are in sitemap with indexable metadata but wrapped in `ProtectedRoute` — crawlers see empty content; logged-out users redirect to login.

**Pick one approach (record choice in `STATE.md`):**

### Option A — SEO shell in server layout (recommended)

In `companies/layout.tsx` and `skills/layout.tsx`:

- Render a **visible static server block** above `{children}`: unique **H1**, **H2** sections, CTAs to `/register` and `/enterprise`.
- Example company/skill names from seed data as marketing copy only — no question text, no user data.
- Logged-in users keep the interactive app below `ProtectedRoute`.

### Option B — Read-only public API

- `GET` list endpoint (names/slugs only, `AllowAny`) + public list UI.
- More dynamic SEO; more backend surface area.

### Option C — Sitemap-only fix

- Remove from sitemap until a future public experience exists.
- Fastest; weakest for “company interview questions” queries.

**Do not** remove auth from the full picker without product approval.

### Phase 2 verification

- Logged-out: view-source shows meaningful HTML in layout shell.
- Logged-in: companies/skills flow unchanged.
- Sitemap reflects chosen option.

---

## Phase 3 — Public pages and in-place improvements

**Goal:** Target AI interview, screening, coding, proctoring, and enterprise hiring without duplicate thin pages.

### New solution pages (server-heavy HTML)

| Route | Purpose |
|-------|---------|
| `/solutions/ai-technical-interviews` | Practice + enterprise screening; session loop (start → chat → end). |
| `/solutions/ai-coding-interviews` | Editor, languages, AI grading; honest scope (no test runner unless built). |
| `/solutions/interview-proctoring` | Enterprise proctoring only; feature list from Phase 0. |

Each page:

- Unique `pageMetadata()` in `layout.tsx`
- H1 + H2/H3 hierarchy
- Internal links to `/enterprise`, `/register`, `/pricing`, `/about`
- Optional route-local `faqs.ts` + visible FAQ section

**Optional fourth URL** — only if copy stays distinct from `/enterprise`:

- `/solutions/ai-candidate-screening` — otherwise merge into enterprise + technical interviews page.

### Improve in place

| Page | Work |
|------|------|
| `/` | AEO block: “What is EvaluLabs?”; extend shared FAQs (Phase 4 questions). |
| `/enterprise` | Titles/descriptions for screening/hiring; AEO for screening, proctoring, custom banks. |
| `/about` | “How EvaluLabs evaluates candidates” (rubric, insights on paid plans). |
| `/pricing` | Enterprise pointer + internal links; no invented metrics. |

### Blog / resources

- **v1 default:** No blog CMS.
- Optional later: 1–2 hand-written server-rendered guides — not mass-generated posts.

### Phase 3 verification

- All new routes build as static/server pages where possible.
- No broken internal links from nav/footer.

---

## Phase 4 — AEO content pattern

Apply on homepage, enterprise, about, and each solution page.

**Structure per topic:**

1. **Question** as **H2** (natural phrasing).
2. **Direct answer** — 2–4 sentences in the next `<p>`.
3. **Detail** — steps or bullets tied to product behavior.
4. **Example** — labeled illustrative scenario (no fake statistics).

### Required question coverage

Ensure visible answers exist (FAQ or body sections):

| Question |
|----------|
| What is an AI interview platform? |
| What is an AI interviewer? |
| How does AI technical interviewing work? |
| How does AI candidate screening work? |
| How does AI coding assessment work? |
| How does interview proctoring work? |
| How does EvaluLabs evaluate candidates? |
| Who is EvaluLabs for? |

**JSON-LD:** Emit `FAQPage` only for Q&A that appears on **that URL**. Do not duplicate the same `@id` across routes (`faqSchema(..., { path })`).

---

## Phase 5 — GEO (generative / AI search)

**Goal:** Clear entity and capability signals for ChatGPT Search, Google AI Overviews, Perplexity, etc.

### 5.1 `frontend/src/lib/seo.ts`

- Expand `BRAND_DESCRIPTION` and root keywords:
  - **Brand:** EvaluLabs
  - **Category:** AI interview and candidate assessment platform
  - **Audiences:** Candidates (mock practice) and hiring teams (enterprise)
  - **Capabilities:** Verified banks, voice, coding/system design, rubric scoring, invites, proctoring

### 5.2 `frontend/public/llms.txt`

- Update page list (including `/solutions/*` when live).
- Enterprise hiring, proctoring, coding — factual bullets.
- Retain **Evalulab.com (cosmetics lab) disambiguation**.

### 5.3 Optional `llms-full.txt`

- Longer structured capability text; same facts as `llms.txt`.

### 5.4 Crawlable HTML

- Prefer server components for new marketing/solution pages.
- Critical facts must not live only inside client-only animations or images.

### Phase 5 verification

- Read `llms.txt` after deploy; confirm links match production routes.

---

## Phase 6 — Structured data (JSON-LD)

Use `StructuredData` in server layouts. Schema must match **visible** page content.

| Type | Where |
|------|--------|
| Organization | Root layout — update description, `sameAs`, `alternateName` (evalulabs vs evalulab.com). |
| WebSite | Root layout. |
| SoftwareApplication | Root — extend `featureList` (voice, coding, enterprise, proctoring). |
| Product / second SoftwareApplication | `/enterprise` or proctoring page — only if offers/pricing are visible on page. |
| FAQPage | `/`, `/enterprise`, solution pages with FAQs. |
| BreadcrumbList | Solution pages; optionally `/about`. |
| WebPage | Optional per major URL (`@id` = canonical). |

**Avoid:** Article schema without real articles; invented ratings/reviews; FAQ-only pages with no visible answers.

### Phase 6 verification

- Validate JSON-LD (Rich Results Test / schema linter) on built HTML.

---

## Phase 7 — On-page SEO and internal linking

- Unique **title** and **meta description** per public route via `pageMetadata()`.
- One **H1** per page; logical **H2/H3** on solution pages.
- **Open Graph / Twitter** — inherited from `pageMetadata()`; update `/og.png` copy only if brand message shifts materially.
- **Images:** Meaningful `alt` on content images; decorative icons `aria-hidden`.
- **Internal links:**
  - Footer: Skills, Solutions (when live), Enterprise, Pricing, About
  - Cross-link enterprise ↔ proctoring ↔ coding ↔ technical interviews
  - Nav: optional “Solutions” or expand “Hire with Us” dropdown

---

## Phase 8 — Performance (practical)

- New marketing pages mostly static (Next default).
- Do not load Monaco on solution pages except existing demos (`LiveCodeFeature`).
- Avoid heavy client-only wrappers for primary textual content.
- No new SEO-specific dependencies.

---

## Phase 9 — Content and authority

- Never manufacture statistics or expose candidate/transcript data.
- Original “insights” reports only from **real aggregate, non-PII** data — not in baseline plan.
- Partner/enterprise claims must match `ENTERPRISE_FAQS` and backend behavior.

---

## Phase 10 — Pre-ship checklist

Run before merging SEO work:

| Check | Pass? |
|-------|-------|
| `/sitemap.xml` returns expected URLs only | |
| `/robots.txt` disallow matches private routes | |
| Canonical URLs correct on sample public pages | |
| Important public pages indexable (`index, follow`) | |
| Private pages `noIndex` + disallowed where applicable | |
| JSON-LD valid and matches visible content | |
| Metadata unique per major URL | |
| Internal links work (manual or script) | |
| No sensitive data in public HTML | |
| `npm run build` | |
| `npm run lint` | |
| Backend tests if API touched (`python manage.py test …`) | |

**Deliverable template for PR / issue:**

- Files changed
- SEO / GEO / AEO improvements
- Pages created or improved
- Schema changes
- Sitemap / robots changes
- Performance notes
- Build / test results
- Remaining issues

---

## Decision log (fill in when executing)

| Decision | Choice | Date | PR |
|----------|--------|------|-----|
| Companies/skills indexability | A / B / C | | |
| Solution URL prefix | `/solutions/…` or other | | |
| Homepage split (`HomeClient`) | Yes / No | | |
| Blog in v1 | Skip / N guides | | |
| Sitemap: `/login` | Keep / Remove | | |

---

## Audit snapshot (baseline — refresh when major routes change)

**Already in place:**

- `lib/seo.ts`, `sitemap.ts`, `robots.ts`, generated `/og.png`
- Root Organization / WebSite / SoftwareApplication JSON-LD
- Enterprise FAQPage + metadata
- Homepage FAQ (visible + JSON-LD in client — move to server in Phase 1.5)
- `public/llms.txt`
- `noIndex` on dashboard, progress, interview, malik, auth flows, enterprise invite, partner

**Known gaps (address via phases above):**

- `/companies`, `/skills` sitemap vs auth mismatch
- Marketing skew toward “mock interview” vs full platform + enterprise
- Missing solution landing pages
- Enterprise app routes need robots + `noIndex` layouts
- `/analytics` disallow alignment
- Homepage route-specific metadata refactor
- `llms.txt` under-describes enterprise, proctoring, coding

---

## Execution order

1. Phase 0 — read constraints  
2. Phase 1 — robots, sitemap, noindex layouts, homepage/FAQ JSON-LD  
3. Phase 2 — companies/skills (after decision)  
4. Phase 3 — solution pages + in-place copy  
5. Phase 4 — AEO patterns and FAQ coverage  
6. Phase 5 — GEO (`seo.ts`, `llms.txt`)  
7. Phase 6 — structured data updates  
8. Phase 7 — linking and on-page polish  
9. Phase 8 — perf pass if needed  
10. Phase 10 — checklist and PR notes  

Phases 4–7 can overlap within a single PR if scope is small; never skip Phase 10.
