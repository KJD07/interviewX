# Frontend design refresh — remaining work (Phases 3–8)

This is a handoff for a fresh Claude Code chat continuing an in-progress design-system
refresh of the EvaluLabs Next.js frontend (`frontend/`). Phases 0–2 are done and
verified. Paste this whole file as your first message in the new chat.

## Project context
EvaluLabs — AI mock-interview platform. Next.js 14 App Router frontend, Django backend.
Runs via `docker compose up` (container `aiis_frontend`, hot-reloads `./frontend` via a
bind mount, port 3000). **Do not try to run `npm run dev` on the host** — host Node is
18.16.1, which is below Next 14.2.35's `>=18.17.0` requirement and its CLI hard-exits.
The Docker container has Node 20 and is the only way to preview/verify locally.

⚠️ **Known quirk:** Turbopack's file watcher on this Windows bind mount does not reliably
detect *newly created* files (matches `Watchpack Error (initial scan): EIO scandir`
warnings already in the container logs). If a fresh import throws "module not found" for
a file you just created, run `docker restart aiis_frontend` and retry — that forces a
fresh scan that will see it.

The full original plan (with all reasoning/tradeoffs) is at
`C:\Users\kjdxy\.claude\plans\buzzing-wondering-eclipse.md` — read it for background if
anything below is ambiguous. This file is the actionable remainder only.

## Confirmed design decisions (already applied, keep following these)
- **Scope**: full system unification — real tokens + shared components + inline-style conversion, not just a paint job.
- **Fonts**: Fraunces (display) + Inter (body), via `next/font` — already wired.
- **Palette**: keep the warm neutral (`#FAFAF8` page / `#1C1A16` ink), light-only, no dark mode. Consolidate stray duplicate colors into the new tokens (done in `globals.css`/`tailwind.config.ts`).
- **Motion**: expressive — scroll reveal + stagger + hover lift + page transitions, PLUS hero parallax, count-up on stat numbers/scores, animated score bars, a sticky-scroll section on the landing page. Must respect `prefers-reduced-motion` (already wired via `MotionProvider`).

## Architecture already in place — use these, don't rebuild them

**Design tokens** (`frontend/src/app/globals.css` + `frontend/tailwind.config.ts`):
CSS vars stay the source of truth (`--page`, `--ink`, `--accent`, etc. — all existing
inline `style={{ color: "var(--ink)" }}` usages still work). Tailwind exposes the *same*
values as semantic classes: `bg-page`, `bg-surface`/`bg-surface-2`, `border-line`/`border-line-mid`,
`text-ink`/`text-ink-dim`/`text-ink-faint`, `bg-accent`/`text-accent-ink`, `text-success`/`text-warn`/`text-danger`,
`bg-scrim`, `bg-hero`/`text-hero-ink`. Radii: `rounded-field` (10px, inputs), `rounded-card` (16px, the one card radius),
`rounded-panel` (24px, modals/big containers), `rounded-hero` (32px, marketing only). Shadows: `shadow-card`,
`shadow-card-hi`, `shadow-pop` (modals), `shadow-cta`, `shadow-hero`. Fonts: `font-sans` (Inter), `font-display`
(Fraunces, unchanged class name). New file sizes: `text-display-xs` → `text-display-xl`, `text-eyebrow`.

**Motion** (`frontend/src/lib/motion.ts` + `frontend/src/components/motion/`):
- `EASE`, `DUR`, `revealUp`/`revealFade`/`revealScale` variants, `stagger()`, `VIEWPORT`, `lift`, `press`, `pageTransition` — all in `lib/motion.ts`.
- `<MotionProvider>` mounted in `layout.tsx` — reduced-motion is handled automatically, don't re-implement it per-component.
- `<Reveal variant="up|fade|scale" delay={n} hover>` — single scroll-reveal wrapper.
- `<RevealGroup each={0.08}><RevealItem>…</RevealItem></RevealGroup>` — stagger a list. **`RevealItem` must never set its own `initial`/`whileInView`** or it detaches from the parent's orchestration.
- `app/template.tsx` gives every route a page-enter transition automatically — don't add `.fade-up` or manual mount animations to new `<main>` wrappers.
- `app/interview/[sessionId]/template.tsx` opts that route out (fullscreen overlay needs no transform ancestor) — replicate this pattern if any other route gets `position: fixed` full-screen UI.
- Old `components/ScrollReveal.tsx` still exports `ScrollReveal`/`GlassCard` as a compat shim — fine to keep importing from there in marketing pages for now, or switch imports to `@/components/motion/Reveal` when you touch those files anyway.

**UI primitives** (`frontend/src/components/ui/`): `Button` (variants: primary/secondary/ghost/danger/outline-accent；sizes sm/md/lg), `Card` (tone surface/muted/hero; pad none/sm/md/lg; `interactive` for hover-lift), `Field` (`Input`, `SearchInput`), `Badge` (`TonePill`, `RoundTypeBadge`, `ScorePill`, `FreeTierBadge`), `Alert` (tone danger/warn/success/info), `EmptyState`, `Skeleton`/`SkeletonCard`/`SkeletonList`, `ListCard`, `Breadcrumbs`, `Icon` (`ChevronRight`, `ArrowLeft`). **Use these instead of hand-rolling — check this folder before writing a new button/card/badge.**

**Score coloring** (`frontend/src/lib/score.ts`): `scoreTone(v)` returns `"good"|"mid"|"low"|"none"`; `SCORE_TEXT`/`SCORE_BG`/`SCORE_BAR` are the Tailwind-class maps. This replaces every hand-rolled `>=7/>=5` ternary — there were 8 of them with 2 different greens and 2 different ambers before this existed. Always use this, never re-implement the ternary.

**Reference implementations**: `frontend/src/app/companies/page.tsx` and `frontend/src/app/skills/page.tsx` are the two fully-migrated pages — read them as the template for how a page should look after migration (imports, token classes, `RevealGroup`/`RevealItem` usage, no inline `style={{}}`).

## Verification workflow (repeat every phase)
1. `cd frontend && npx tsc --noEmit` — must be clean. Works fine on host Node 18.
2. Hit the touched routes: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/<route>` — expect 200 (or a 3xx redirect to `/login` for protected routes when unauthenticated, which is correct behavior, not an error).
3. `docker logs aiis_frontend --tail 40` — check for `Module not found`, compile errors, or thrown exceptions. If a freshly-created file shows "module not found", see the Turbopack quirk note above.
4. For anything behind auth (dashboard, companies, skills, progress, results, interview, enterprise), you'll need a real login to visually check in a browser — the curl checks above only prove it compiles and doesn't crash, not that it looks right. Ask the user to spot-check in-browser at key points, especially Phase 3 (shell) and Phase 7 (interview page).
5. `rg -c 'style=\{\{' frontend/src` — track this count going down as pages get migrated (baseline before this refresh was ~330).

## Remaining phases

### Phase 3 — Shell & responsive fixes (do this before Phase 5)
This is the structural phase; later page migrations should land into the *final* shell, not get redone twice.

- **`AppShell.tsx`** currently returns `children` unwrapped for free-plan users (each page hand-rolls its own `{!isPro && <nav>}`, all slightly different, and `/skills` has none at all — free users get zero navigation there). Fix: `AppShell` should render a shared `<TopBar>` for free plans (extract the best version from the three existing hand-rolled navs in `dashboard/page.tsx`, `companies/page.tsx` — already removed, check git history/plan for the pre-migration version — and `progress/page.tsx`) and `<Sidebar>` for paid plans, for *every* authenticated page. Delete the per-page conditional navs once `AppShell` covers it.
- **Bug**: `frontend/src/app/interview/[sessionId]/results/page.tsx` (~line 209-223) always renders its own nav instead of ever using `AppShell`/`Sidebar` — paid users lose their sidebar on the results page specifically. Fix by routing it through `AppShell` like the other pages.
- **One container width**: pages currently split between `max-w-4xl` (dashboard, progress) and `max-w-2xl` (companies, skills, results) — content visibly jumps width when navigating between them. Pick one (`max-w-4xl` recommended, matches the data-heavier pages) and apply everywhere, ideally via a `<PageContainer>` component.
- **Mobile**: `Sidebar.tsx` is unconditional `w-56` with no responsive handling at all. Make it `hidden md:flex`, add a `md:hidden` hamburger button in the new `<TopBar>` that opens the same nav as a slide-over sheet (reuse the `Modal`-style overlay pattern once Phase 6 builds `Modal`, or a simple fixed-position panel for now) with focus trap and body scroll-lock.
- **Dashboard table overflow**: `dashboard/page.tsx` has a hand-built CSS-grid table with fixed px columns (`gridTemplateColumns: "1fr 80px 60px 60px 60px 100px"`, duplicated twice in the file) that will overflow at mobile widths. Replace with a single Tailwind grid-cols constant, hide the score columns below `md`, and render a stacked-card layout on mobile instead.
- **Loading state**: `ProtectedRoute.tsx` renders `null` while `loading` is true — causes a blank flash on every authenticated page load. Add a lightweight `<AppSkeleton />` (reuse `components/ui/Skeleton`) instead.

### Phase 4 — Marketing extraction + expressive motion
- Extract into `components/marketing/`: `MarketingFooter` (there are 4 near-identical footers today, and `/career` is **missing one entirely** — fix that gap here), `BackdropOrbs` (the blur-orb decorative layer, currently copy-pasted with slightly different orb counts/positions across `/`, `/pricing`, `/about`, `/contact`, `/career`), `PageHero`, `SectionHeading`, `PricingCard` (currently the Free-tier card and paid cards are ~40 lines of duplicated markup in `pricing/page.tsx`), `NumberedStepCard`, `TitleBodyCard`.
- Convert the marketing pages' `text-[var(--ink)]`-style Tailwind arbitrary values to the new semantic classes (`text-ink`, etc.) — mechanical find/replace, low risk.
- Add `components/motion/Parallax.tsx` (`useScroll`+`useTransform`+`useSpring`, reduced-motion short-circuits to static) and apply it to the landing page's 3 blur orbs at staggered speeds (e.g. 0.15/0.35/0.5) plus a subtle hero-copy fade-on-scroll.
- Add `components/motion/StickySequence.tsx` and use it to replace the 4-card "How EvaluLabs works" `STEPS` grid on `app/page.tsx` with a sticky-scroll sequence (one viewport-height of scroll per step, absolute-positioned steps cross-fading via `useTransform` on scroll progress). **Must** have a reduced-motion fallback that renders a plain stacked list — a tall sticky track with no animation is a usability trap, don't skip this branch.
- Add hover-lift (`<Reveal hover>`) to the feature/value cards on the marketing pages.

### Phase 5 — Data-heavy authenticated pages
Targets: `dashboard/page.tsx`, `progress/page.tsx`, `interview/[sessionId]/results/page.tsx`, `enterprise/page.tsx` (the latter is a B2B org dashboard, not a marketing page — treat it like the others, ~45 inline styles).
- Convert inline styles to token classes (same mechanical pattern as Phase 2's companies/skills migration).
- Add `components/motion/CountUp.tsx` (animates via framer's `animate()` + a ref `textContent` write — no 60fps re-renders; gated on `useInView`+`useReducedMotion`; SSR must render the real final number, never 0) and apply it to dashboard stat tiles, the results page score, and progress-page averages.
- Add `components/motion/ScoreBar.tsx` (replaces raw `style={{ width: '…%' }}` bars in `progress/page.tsx`, uses `lib/score.ts` for coloring, animates via `whileInView`) and use it for the progress page's per-topic bars and for the results page's `ScoreRing` (animate `strokeDashoffset` via `whileInView` — the current CSS `transition: stroke-dasharray` never actually fires because the value is set on first paint, so this is also a bug fix).
- Wrap stat tiles / session rows in `RevealGroup`/`RevealItem` for stagger-in.
- Empty states: there are 3 different hand-rolled treatments for "no interviews yet" today (dashboard has two different ones, progress has a third) — consolidate onto `components/ui/EmptyState`.

### Phase 6 — Modals + remaining components
- Build `components/ui/Modal.tsx` (always portalled via `createPortal`, scrim using `bg-scrim/70`, focus trap, Esc-to-close, body scroll-lock, `dismissOnBackdrop` prop defaulting true but set `false` for anything like an end-of-interview confirmation).
- Adopt it in `TopupModal.tsx`, `RealInterviewReportModal.tsx`, and the modals inline in `interview/[sessionId]/page.tsx` (there are several — end-session confirm, proctoring warnings, etc.).
- Then sweep the smaller remaining files: `ReviewCard.tsx` (has a stray `0.5px` border that's a non-retina rendering bug — just delete it, use `border-line-mid`), `RealInterviewReportsCard.tsx`, `PaginationControls.tsx`, and the 5 remaining auth pages (`login`, `register`, `forgot-password`, `reset-password`, `verify-email`) — swapping in `Field`/`Alert`/`Button` should remove nearly all of their inline styles in one pass.

### Phase 7 — `interview/[sessionId]/page.tsx` — the risky one
1597 lines, ~65 inline styles, owns the highest-stakes flow in the product (webcam proctoring, fullscreen-exit-ends-session enforcement, speech recognition, timers, live Monaco code editor). **Do not attempt a rewrite.**
- **Mechanical style swap only**, one visual region per commit (header bar → chat bubbles → composer → modals). Never change a `useEffect`, ref, or event handler in the same edit as a style change — if you notice a bug while doing this, note it for the user rather than fixing it inline, so style changes stay reviewable in isolation.
- Extract pure presentational leaves into `components/interview/`: `TypingDots`, `SpeakingWave`, `Bubble`, `TimerBadge`, `EndModal` — these are already visually self-contained near the top of the file and safe to pull out.
- The file injects 3 `<style>` blocks mid-render with raw `@keyframes` (`bounce`, `wave`, `pulse`) — these are **already available** as Tailwind utilities from Phase 0 (`animate-bounce-dot`, `animate-wave`, `animate-pulse-soft` in `tailwind.config.ts`). Delete the injected `<style>` tags and swap in the utility classes. This also fixes a real bug: `pulse` is currently *used* around line 259 before it's *defined* around line 1337, which only worked by accident of CSS's global cascade.
- Sanity-check the fullscreen/proctoring overlay still works correctly against `app/interview/[sessionId]/template.tsx` (already in place, opts this route out of the page-transition transform) — don't remove that file.

### Phase 8 — Sweep
- Delete the `ScrollReveal.tsx` compat shim once no marketing page imports from it anymore (grep first).
- Grep for stragglers and fix: `rg 'style=\{\{' frontend/src` (should be near 0, excluding genuinely dynamic values like computed widths), `rg '#[0-9a-fA-F]{6}|rgba?\(' frontend/src -g '!globals.css'` (raw color literals, should be 0), `rg 'rounded-(lg|xl|2xl|3xl)' frontend/src` (should only be `rounded-field|card|panel|hero|full` left).
- Remove `.dash-row` from `globals.css` once `dashboard/page.tsx` uses `hover:bg-surface-2` directly (Phase 5 should have already done the rest of that file's conversion).

## Manual QA matrix (do this after Phase 3, and again after Phase 7)
Two test accounts needed: one free-plan, one paid (premium — to also exercise `/skills`). `npm run dev`/Docker + DevTools *Rendering → Emulate `prefers-reduced-motion: reduce`*, widths 375/768/1440.

| Route | Check |
|---|---|
| `/`, `/pricing`, `/about`, `/contact`, `/career` | footer present on all five (career currently has none), orbs don't cause horizontal scroll, sticky section releases cleanly, reduced-motion shows the static step list |
| `/login`, `/register` | focus ring visible on inputs (Phase 0 bug fix), error banner styling |
| `/dashboard`, `/companies`, `/skills`, `/progress` | shell identical across all four, container width doesn't jump when navigating, sidebar present for paid users on every one, mobile hamburger drawer works at 375px, dashboard table readable at 375px |
| `/interview/[id]` | fullscreen proctoring still works, timer, typing dots + speaking wave animate, end-modal, no transform on the page wrapper |
| `/interview/[id]/results` | paid users still have the sidebar (this is a regression fix — currently broken), score ring animates then holds the correct final value |
| `/enterprise` | gets the app shell (it's an authenticated org dashboard, not a marketing page) |
