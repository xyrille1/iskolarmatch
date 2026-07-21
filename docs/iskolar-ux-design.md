# IskolarMatch — UI/UX & Frontend Design Spec (Editorial / "Playfight" system)

_Rewritten to follow the exact typographic pairing and layout system of the supplied reference (letsplayfight.com — desktop + mobile). The product substance (flows, trust patterns, accessibility, security-driven UI) is unchanged from the prior spec; the **visual language, typography, layout, and imagery are re-skinned** to the reference and its content re-mapped to IskolarMatch._

**Companion to:** `PRD.md`, `ARCHITECTURE.md`, `DATABASE.md`, `DEPLOYMENT.md`, `SECURITY.md`
**Owner:** Xyrille · **Stack:** Next.js (App Router, Server Components) + TypeScript + Tailwind · **Target:** mobile-first, WCAG AA
**Reference:** Playfight studio site (editorial serif display + neutral sans, monochrome, asymmetric gallery, heavy whitespace, pill buttons)
**Status:** Draft v2 — reference-matched

---

## 0. How to read this doc

The reference's **font and layout are treated as fixed** (your instruction). Where a literal 1:1 copy would break a _scholarship utility_ (bandwidth, no hero photography, functional deadline colors), I adapt within the same visual language and mark it:

> **▸ DECIDE —** a choice to confirm. My recommendation is bold.
> **⟡ ADAPTATION —** a deliberate departure from a literal copy, with the reason. See the Appendix for the full list.

---

## 1. Design Language (matched to the reference)

### 1.1 Typography — the pairing

The reference pairs a **high-contrast editorial serif** (display: "Different is Everything.", and the stacked "Work / Originals / The Studio" nav) with a **clean neutral grotesque sans** (body, labels, buttons, captions). We reproduce that pairing exactly in role and feel.

**Exact-font note (honesty):** the specific foundry faces on the live site could not be confirmed from here, so the names below are the **closest licensable matches**, not a guaranteed identity. If a literal match matters, inspect the live site's computed styles / network tab and drop the real family names into the same slots — the roles and scale below don't change.

| Role                                                                 | Recommended (free, production)                                                  | Exact-match alternatives (paid)                                                |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Display serif** — hero thesis, section headers, big serif nav      | **Fraunces** (variable, SIL OFL; high-contrast "old-style" with optical sizing) | Canela (Commercial Type), Ogg (Sharp Type), PP Editorial New (Pangram Pangram) |
| **Body / UI sans** — paragraphs, labels, captions, buttons, wordmark | **Inter** (variable, SIL OFL; neutral grotesque, crisp on low-end Android)      | Söhne, Neue Haas Grotesk, ABC Diatype                                          |

**Usage rules (from the reference):**

- Serif is used **only** for display: the hero line, section titles, and the stacked primary nav. Never for body or UI.
- Serif display is **sentence case, often ending in a period** ("Different is Everything." → "Find what you actually qualify for."). Light/Regular weight, tight leading, generous size.
- Sans carries **everything functional**, plus the small **eyebrow labels** in UPPERCASE with wide tracking ("Recent work" → "Featured scholarships", "What we do" → "What we check").
- Wordmark "IskolarMatch" is set in the **sans at bold**, small, top-left (mirrors "Playfight").

**Type scale (mobile → desktop):**

```
Display XL  serif   40 / 44   →  72 / 76   hero thesis; stacked nav
Display L   serif   30 / 34   →  44 / 48   section titles, card titles in gallery
Eyebrow     sans    11 / 16    UPPERCASE, tracking +0.12em, --muted
Body        sans    16 / 26   →  17 / 28   readable paragraph, max ~62ch
Caption     sans    13 / 18    client/provider line, meta, marginalia
Button      sans    14 / 16    sentence case
```

### 1.2 Color — monochrome editorial

The reference is essentially **two-tone**: near-black ink on white, plus **full-black sections**, with photography supplying all color. We keep that discipline.

```
--paper       #FFFFFF    white sections
--ink         #0A0A0A    text on white
--noir        #0A0A0A    full-bleed black sections
--paper-ink   #F4F4F1    text on black (near-white)
--line        #E6E6E3    hairline borders / rules
--muted       #6B6B66    captions, eyebrows, marginalia
```

> **⟡ ADAPTATION 1 — functional status color.** A scholarship tool must signal deadline status (open / closing / closed / upcoming), which pure monochrome can't do. We add a _minimal_ functional set, used **only as a small dot + text**, never as fills or backgrounds, so the black-and-white editorial feel holds:
>
> ```
> --status-open      #1F7A46    --status-closed    #6B6B66
> --status-soon      #B45309    --status-upcoming  #1D4E89
> ```
>
> Status is always **icon/dot + word** (e.g. "● Closing soon"), never color alone (also required for accessibility, §6).

### 1.3 Layout system

Faithful to the reference:

- **Asymmetric, gallery-led composition with heavy whitespace.** Content is placed with intention across the width, not centered in a single column. The hero uses scattered placement; sections breathe with large vertical gaps.
- **Alternating white ↔ black sections.** Light editorial top (hero, intro, "what we check"), then a **black gallery section** ("Featured scholarships"), then a light functional area, closing on a black nav/footer — the reference's exact rhythm.
- **Marginalia.** Tiny rotated/pinned text at the far left/right edges (the reference's "© 2024" and code strings) → repurposed for IskolarMatch as `© 2026` and a subtle `verified-data` tag. Decorative, `--muted`, non-essential.
- **Eyebrow + content blocks.** Each block leads with a small uppercase sans eyebrow, then serif or body content (the reference's "What we do", "Recent work").
- **Pill buttons.** Fully rounded (`border-radius: 999px`), either **outlined** (secondary: "Contact Us", "Playground") or **solid ink** (primary). Sentence case. This is the reference's only button shape — we use it everywhere.
- **Stacked serif section nav.** Near the footer, large serif links stacked vertically ("Work / Originals / The Studio") → IskolarMatch primary destinations (§2).
- **Grid:** 12-col desktop with wide outer margins; single-column mobile stack. Detail/reading content constrained to ~62ch even inside the asymmetric shell.

### 1.4 Imagery strategy

The reference's images are **creative-project photography** (Frank & Morris, Parks & Beyond…). Scholarships have **no equivalent hero photography**, so:

> **⟡ ADAPTATION 2 — typographic/provider tiles instead of stock photos.** Where the reference places a project photo, IskolarMatch places a **typographic tile**: the scholarship title (serif) over the provider mark/wordmark (CHED, DOST-SEI, UniFAST) on a flat `--noir` or `--surface` field, with the deadline-status dot. This preserves the reference's _gallery layout and card rhythm exactly_, swaps the _content_ to real, honest material (no decorative stock imagery of students), and keeps the page light for 3G/4G. Optional: a single, meaningful, optimized education photo may anchor the hero if you want one warm image — see DECIDE 4a.

Image mapping:
| Reference uses | IskolarMatch uses |
|---|---|
| Scattered hero photo collage | Restrained hero: serif thesis + 2–3 **provider-mark tiles** + one live-stat tile ("N verified deadlines") placed asymmetrically |
| "Recent work" project photos | "Featured scholarships" **typographic tiles** (title / provider / status) |
| Full-bleed B&W landscape band | Full-bleed **black statement band** — the trust promise set large in serif (no photo) |
| Footer newsletter capture | **Deadline-reminder email capture** (maps to a real feature) |

### 1.5 Motion (restrained, per the reference)

Quiet and editorial: a gentle **fade/rise reveal** on section entry, subtle image/tile **scale on hover** (desktop), no pulsing, no auto-carousels. All motion respects `prefers-reduced-motion` and is purely decorative.

### 1.6 Reference → IskolarMatch content map

| Reference element                                        | IskolarMatch equivalent                                                                                                                                                                       |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wordmark "Playfight"                                     | **IskolarMatch** (sans bold, top-left)                                                                                                                                                        |
| Hero serif "Different is Everything."                    | **"Find what you actually qualify for."** (serif, ends in period)                                                                                                                             |
| Subline "Creative, Story and Production. Made In Utah."  | **"Verified. Deadline-tracked. Built for Filipino students."**                                                                                                                                |
| Intro "We are Playfight…" + "Fighting for authenticity." | **"IskolarMatch matches you to CHED, DOST-SEI, and local scholarships you actually qualify for — then tracks the deadlines."** + **"Built on verified data. Nothing you don't qualify for."** |
| "What we do" services list                               | **"What we check"** — Education level · GWA · Course field · Region · Income bracket · Special status · Deadlines · Requirements                                                              |
| "Recent work"                                            | **"Featured scholarships"** (or "Recently verified")                                                                                                                                          |
| Project card "Frank & Morris / Adventure Safe"           | Scholarship tile "**CHED Merit Scholarship / Commission on Higher Education**"                                                                                                                |
| Stacked serif nav "Work / Originals / The Studio"        | **"Find scholarships / Saved / How it works"**                                                                                                                                                |
| "Let's chat. 801.673.8588"                               | **"Questions? / How it works"** link (no phone at MVP)                                                                                                                                        |
| "Subscribe for the latest" + Email                       | **"Get deadline reminders" + Email** (real feature hook)                                                                                                                                      |

---

## 2. Information Architecture

Routes are unchanged from the product spec; only their **skin** follows the reference.

```
PUBLIC (anonymous, server-rendered, readable with no JS)
  /                landing — editorial hero + intro + featured gallery + nav/footer
  /match           profile form → results (two states, same route)
  /s/[slug]        scholarship detail (SSR + SEO metadata)
  /about /privacy  how it works, privacy notice, disclaimer

AUTH (magic link; only on save / reminder)
  /auth            "check your email" screen
  /saved           saved list + reminder management

ADMIN (role-gated, internal — utilitarian, NOT editorial-skinned)
  /admin           records + verify queue
  /admin/scholarships/*   CRUD + eligibility-rule builder + mark verified
  /admin/suggestions      (Phase 2) ingestion review
```

**Navigation:** slim top bar — **IskolarMatch** wordmark left (sans bold), hamburger/menu right (as in the reference). The large **stacked serif nav** ("Find scholarships / Saved / How it works") lives near the footer on black, mirroring "Work / Originals / The Studio". No mega-menu; the app is shallow by design.

---

## 3. Core User Flows

Unchanged in logic; the visual states now use the editorial system.

```
Landing ──▶ Profile form ──▶ Results (buckets) ──▶ Detail ──▶ Sign in (magic link) ──▶ Saved + reminder
```

**Mermaid (for later diagram generation):**

```
flowchart TD
  A[Landing] --> B[Profile form]
  B --> C{Validate profile}
  C -->|invalid| B
  C -->|valid| D[Results: Eligible / Near-miss / Not-eligible]
  D --> E[Scholarship detail]
  E -->|Apply| F[Redirect to OFFICIAL portal - allowlisted domain]
  E -->|Save| G{Signed in?}
  G -->|no| H[Magic-link auth] --> I[Saved list]
  G -->|yes| I
  I --> J[Set reminder N days before] --> K[Confirmation toast]
```

**Decision points / edge states** (unchanged from v1): missing mandatory field → matcher fails conservatively + "answer 1 more to unlock N matches"; save-while-anonymous → magic link then return to the exact scholarship; no eligible results → invitation + near-miss list; slow/failed match → skeleton then friendly retry; magic-link not received → resend (rate-limited). Every screen defines **empty / loading / populated / error** states.

---

## 4. Screen Specifications (editorial layout wireframes)

Mobile wireframes below reflect the reference's whitespace, serif headers, eyebrows, gallery tiles, and pill buttons.

### 4.1 Landing (`/`)

```
┌───────────────────────────────┐
│ IskolarMatch             ☰    │  sans bold wordmark · menu
│                               │
│                               │  ← generous whitespace
│      Find what you            │  SERIF display XL
│      actually qualify for.    │  (sentence case, period)
│                               │
│   Verified. Deadline-tracked. │  caption sans, --muted
│   Built for Filipino students.│
│                               │
│   ┌─────────┐   ┌───────────┐ │  asymmetric provider tiles
│   │  CHED   │   │ DOST-SEI  │ │  (typographic, flat fields)
│   └─────────┘   └───────────┘ │
│        ┌─────────────────┐    │
│        │ N verified      │    │  live-stat tile
│        │ deadlines       │    │
│        └─────────────────┘    │
│                               │
│   ( Find my scholarships → )  │  solid-ink PILL, full-width
│                               │
│   ─────────────────────────   │
│   WHAT WE CHECK               │  eyebrow (uppercase sans)
│   Education level             │
│   GWA · Course field          │
│   Region · Income bracket     │
│   Special status              │
│   Deadlines · Requirements    │
└───────────────────────────────┘
        ↓ (black section)
┌───────────────────────────────┐
│ FEATURED SCHOLARSHIPS         │  eyebrow, on --noir
│                               │
│   CHED Merit Scholarship      │  SERIF display L (tile title)
│   Commission on Higher Educ.  │  caption
│   ● Open · closes Aug 30      │  status dot + word
│                               │
│   DOST-SEI Undergraduate      │
│   Science Education Institute │
│   ● Closing soon · 9 days     │
│   …                           │
└───────────────────────────────┘
        ↓ (black statement band)
┌───────────────────────────────┐
│   Every listing links to      │  SERIF, large, no photo
│   the official source, and    │  (replaces B&W landscape)
│   shows when it was verified. │
└───────────────────────────────┘
        ↓ (footer, black)
┌───────────────────────────────┐
│   Find scholarships           │  STACKED SERIF NAV
│   Saved                       │  (mirrors Work/Originals/Studio)
│   How it works                │
│   ( How it works )            │  outline pill
│   Privacy · Instagram         │  caption links
│   GET DEADLINE REMINDERS      │  eyebrow
│   [ your@email ]  ( → )       │  email capture (real feature)
│   © 2026                      │  marginalia
└───────────────────────────────┘
```

**Components:** `TopBar` · `Hero` (serif thesis, caption, `ProviderTile[]`, `StatTile`, `PrimaryPill`) · `WhatWeCheck` (eyebrow + list) · `FeaturedGallery` (`ScholarshipTile[]`) · `StatementBand` · `StackedSerifNav` · `ReminderCapture` · `Footer`.
**States:** static, server-rendered. Hero is first-paint/SEO priority.

> **▸ DECIDE 4a — Hero: pure typographic vs. one photo.** Recommendation: **typographic + provider tiles** (above) — honest and fast. _Alternative:_ anchor with one optimized student/education photo for warmth (accept the bytes). The reference is photo-led, so this is the main place we diverge; confirm the call.

### 4.2 Profile form (`/match`, state 1)

```
┌───────────────────────────────┐
│ ‹ Back                        │
│ A few quick questions.        │  SERIF display L
│ NOTHING IS SAVED              │  eyebrow (privacy reassurance)
│                               │
│ EDUCATION LEVEL               │  eyebrow label per field
│  ( ) Senior high graduate     │  large radio targets
│  ( ) College student          │
│                               │
│ GWA / AVERAGE                 │
│  [ 90 ]   ⓘ how we use this   │
│ COURSE FIELD    [ STEM ▾ ]    │
│ REGION          [ Region I ▾ ]│
│ INCOME BRACKET  [ Low ▾ ]  ⓘ  │  bracket, never exact peso
│                               │
│ SPECIAL STATUS (OPTIONAL)     │
│  ☐ PWD   ☐ Solo-parent dep.   │  session-only (security doc)
│  ☐ Indigenous  ☐ Top graduate │
│  Used only to match — not stored
│                               │
│  ( Show my matches → )        │  solid-ink pill
└───────────────────────────────┘
```

**Components:** `MatchForm` › `FieldGroup` (eyebrow + control) › `HelpTooltip` › `SubmitPill`. Validation on blur; disabled + spinner on submit; Zod schema shared client/server.

> **▸ DECIDE 4b — Single scroll vs. stepper.** Recommendation: **single scrollable form** (fastest, no-JS friendly). _Alt:_ 2–3 step wizard.

### 4.3 Results (`/match`, state 2) — the signature screen

```
┌───────────────────────────────┐
│ 12 eligible · 5 near · 20 no  │  sticky summary/jump bar (sans)
│                               │
│ ELIGIBLE                      │  eyebrow
│                               │
│ CHED Merit Scholarship        │  SERIF display L (title)
│ Commission on Higher Education│  caption
│ ● Closes in 9 days            │  status dot + word
│ WHY  GWA ✓ · Course ✓ ·       │  eyebrow "WHY" + reason chips
│      Region ✓                 │  (outlined pills)
│ 5 requirements · Verified Aug 12
│ ( View & apply )              │  outline pill
│ ───────────────────────────── │  hairline divider between items
│ DOST-SEI Undergraduate        │
│ … more …                      │
│                               │
│ NEAR-MISS                     │  eyebrow
│ DOST-SEI Merit                │
│ One step away: needs GWA 90   │  gap explainer (sans)
│ (you entered 88)              │
│                               │
│ ( Show 20 you don't qualify ) │  outline pill, collapsed
└───────────────────────────────┘
```

**Layout note:** the reference's asymmetric gallery becomes a **hairline-separated editorial list** on mobile and a **two-column tile grid ≥ 768px** — same rhythm as "Recent work". Card priority top→bottom: title → deadline → why-matched → trust meta → CTA.
**Components:** `ResultsSummaryBar` · `BucketSection` (eyebrow) · `ScholarshipTile` (`SerifTitle`, `ProviderCaption`, `StatusDot`, `WhyChips`, `TrustMeta`, `Pill`) · `NearMissTile` (+`GapExplainer`) · `NotEligibleToggle`.
**States:** loading (skeleton tiles) · populated · empty (invitation) · error (retry).

> **▸ DECIDE 4c — Buckets: stacked vs. tabbed.** Recommendation: **stacked sections** (matches the reference's scrolling gallery; zero-JS). _Alt:_ tabs (needs JS).

### 4.4 Scholarship detail (`/s/[slug]`)

```
┌───────────────────────────────┐
│ ‹ Back to results             │
│ CHED Merit Scholarship        │  SERIF display XL
│ Commission on Higher Education│  caption
│ ● Open · closes Aug 30, 2026  │  status
│ VERIFIED AUG 12, 2026         │  eyebrow (trust stamp, prominent)
│                               │
│ ( Save )   ( Set reminder )   │  pills
│                               │
│ WHAT YOU GET                  │  eyebrow
│ Full tuition + stipend …      │  body
│ WHO QUALIFIES                 │  eyebrow
│  ✓ GWA 90+   ✓ STEM course    │  matched vs unmet marked
│  ✓ Region I  ✗ …              │
│ REQUIREMENTS                  │  eyebrow
│  ☐ Form 138 (CTC)             │  interactive checklist
│  ☐ ITR / tax exemption        │
│ DEADLINES THIS CYCLE          │  eyebrow
│  Opens … · Closes …           │
│                               │
│ ⚠ Always confirm details on   │  disclaimer (consistent spot)
│   the official site first.    │
│ ( Apply on official site → )  │  solid-ink pill
│   ched.gov.ph                 │  destination domain shown
└───────────────────────────────┘
```

**Components:** `DetailHeader` (serif title, caption, `StatusPill`, `VerifiedEyebrow`) · `SaveReminderPills` · `EyebrowBlock`×(benefits / eligibility / requirements / deadlines) · `EligibilityList` (`RuleRow`) · `RequirementChecklist` · `Disclaimer` · `OfficialLinkPill` (shows domain).

> **▸ DECIDE 4d — Checklist persistence.** Recommendation: **ephemeral when anonymous, saved when signed-in** (privacy). _Alt:_ persist in session.

### 4.5 Magic-link auth (`/auth`)

```
┌───────────────────────────────┐
│ Save this scholarship.        │  SERIF display L (context-aware)
│ Enter your email — we'll send │  body
│ a one-tap sign-in link.       │
│ [ juan@email.com ]            │
│ ( Send my link → )            │  solid-ink pill
│ We only use this to save your │  caption (minor-safe)
│ list and send reminders.      │
└───────────────────────────────┘  → "Check your email" state + Resend
```

### 4.6 Saved list (`/saved`)

```
┌───────────────────────────────┐
│ Your saved scholarships.      │  SERIF display L
│                               │
│ CHED Merit Scholarship        │  serif title
│ ● Closes in 9 days            │  status
│ 🔔 Reminder: 7 days before     │  reminder state inline
│ ( Edit reminder )  ( Remove ) │  pills
│ ─────────────────────────────  │
│ Empty: "Nothing saved yet —   │  invitation
│ run a match to start."        │
└───────────────────────────────┘
```

Reminder editor: lead-days (default 7) → `remind_on = closes_at − lead_days`; toast "Reminder set for Aug 23."

### 4.7 Admin (internal — deliberately NOT editorial)

> **⟡ ADAPTATION 3 — admin stays utilitarian.** The editorial serif/whitespace system is for the public product; the curator tool prioritizes density and speed. Plain shadcn/ui defaults: record table with **publish state + verified-age** (stale flagged), scholarship editor with **eligibility-rule builder** (`field ∈ ProfileField` enforced), **Mark verified**, and (Phase 2) **suggestions diff review**. The **URL allowlist** (`SECURITY.md` §3.2) surfaces as a form error here.

---

## 5. Trust & Safety UI Patterns (restyled to the editorial system)

- **`VerifiedEyebrow`** — "VERIFIED AUG 12, 2026" as a small uppercase eyebrow. Beyond a staleness threshold (**▸ DECIDE 5a: 60 days**) it reads "CONFIRM ON OFFICIAL SITE."
- **`OfficialLinkPill`** — the outbound "Apply" pill always prints its **destination domain** beneath (e.g. `ched.gov.ph`), `rel="noopener noreferrer"`, allowlisted domains only (`SECURITY.md` §3.2). Anti-phishing, made visible.
- **`Disclaimer`** — one consistent sentence, same placement on every detail page.
- **`GapExplainer`** (near-miss) — states the single unmet rule in plain terms, framed as a next step.
- **Privacy microcopy** — profile form + auth screen each carry a one-line plain-language note (security doc PR2/PR3); full notice at `/privacy`.
- **No manufactured urgency** — countdowns reflect real close dates only.

---

## 6. Accessibility (WCAG 2.1 AA — build requirement)

- **Serif legibility:** the editorial serif is display-only; **body/UI stay in the sans** so small text remains legible on cheap screens (a key reason not to set paragraphs in the serif).
- **Contrast:** ink `#0A0A0A` on paper `#FFFFFF` and paper-ink on noir both exceed AA; the four status colors are used only where they pass, and always with an icon + word.
- **Color independence:** deadline status is **dot + word**, never color alone.
- **Keyboard:** full flow operable without a mouse; visible focus rings on pills, fields, tiles; logical tab order.
- **Screen reader:** semantic HTML (`<form>`, `<fieldset>`/`<legend>` for radio groups, real `<button>`/`<a>`); gallery tiles are headed regions; status has a text equivalent.
- **Touch targets:** ≥ 44×44px; generous spacing between options (the reference's whitespace helps here).
- **Motion:** all reveals/hovers respect `prefers-reduced-motion`.
- **Marginalia** (rotated edge text) is decorative and `aria-hidden`.

---

## 7. Interaction Patterns

- **Inputs:** validate on blur; submit disabled + spinner (no double-submit); GWA uses `inputmode="decimal"`.
- **Feedback:** every action → matching toast, verb-consistent with the pill that triggered it ("Save" → "Saved").
- **Micro-interactions (restrained, per reference):** section fade/rise on scroll; tile scale-on-hover (desktop); status dot is static (no pulsing — no fake urgency).
- **Low-JS:** reading results/detail works as server-rendered HTML with real links; save/reminder/checklist are the only client-interactive pieces and degrade to a sign-in link.

---

## 8. Technical Implementation Notes

- **Rendering split:** Landing, `/match` results, `/s/[slug]` = **Server Components** (fast paint, SEO, no-JS reading). Client Components only for: form live-validation, save/reminder actions, checklist toggles.
- **Font loading (critical for the editorial look on 3G/4G):** self-host and **subset** the serif to display glyphs only; `font-display: swap`; **preload** the one serif weight used above the fold; body sans = Inter subset or system stack. This delivers the reference aesthetic without a bandwidth penalty on the target devices.
- **Imagery:** typographic/provider tiles are HTML/CSS (near-zero bytes); any optional photo is lazy-loaded, width-capped, AVIF/WebP.
- **State:** no global store; server state via Server Actions (`matchProfile`, `saveScholarship`, `setReminder`); local UI via `useState`. Anonymous profile never persisted (`SECURITY.md` §1, SEC-G1).
- **Components:** shadcn/ui + Tailwind, **restyled to the tokens in §1** (don't ship default shadcn look). Design tokens as CSS variables = single source of truth for app + admin.
- **Performance budget:** < 2s to results on 4G — near-zero JS on results, reserve status/verified rows to avoid layout shift, subset fonts.
- **v0.dev handoff:** §1 tokens + §4 wireframes + §5 patterns are the raw material for the Stage-6 v0 prompt (generatable next).

---

## 9. Decisions to Finalize

Font and layout are **fixed to the reference** per your instruction. Remaining:

| #   | Decision                        | Recommendation                                                     |
| --- | ------------------------------- | ------------------------------------------------------------------ |
| —   | Exact display serif / body sans | **Confirm real families off the live site**; else Fraunces + Inter |
| 4a  | Hero: typographic vs. one photo | **Typographic + provider tiles**                                   |
| 4b  | Profile: scroll vs. stepper     | **Single scrollable form**                                         |
| 4c  | Buckets: stacked vs. tabbed     | **Stacked (matches gallery, zero-JS)**                             |
| 4d  | Checklist persistence           | **Ephemeral anon / saved signed-in**                               |
| 5a  | Verified staleness threshold    | **60 days → "confirm on official site"**                           |
| —   | Localization at MVP             | **English-only, structured for later i18n**                        |

**Product-level (affects UI):** which 6–8 profile fields are required vs. optional; shareable results/detail links (distribution vs. extra public surface); PWA/push later vs. email-only reminders (PRD leans email).

---

## Appendix — Adaptation notes (where a literal copy was deliberately changed)

The reference is a **creative studio portfolio**; IskolarMatch is a **trust utility for students, many minors, on slow connections**. Three deliberate departures keep the exact font + layout while serving the product:

1. **Functional status color** (§1.2) — pure monochrome can't signal a deadline; a minimal dot+word set is added, used only as small indicators.
2. **Typographic/provider tiles instead of stock photos** (§1.4) — scholarships have no honest hero photography, and heavy images fight the < 2s / low-bandwidth goal; the gallery _layout_ is identical, the _content_ is real.
3. **Admin stays utilitarian** (§4.7) — the editorial system is for the public product; the curator tool optimizes for density and speed.

Everything else — the serif-display + sans-body pairing, monochrome white/black sections, asymmetric whitespace-heavy composition, eyebrow labels, pill buttons, stacked serif nav, marginalia, restrained motion — follows the reference directly.
