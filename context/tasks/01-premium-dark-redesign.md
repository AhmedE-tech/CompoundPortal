# SPEC 1 — Premium Dark-Luxury Redesign (Compound Portal)

> Author: Claude (manager). Implementer: OpenCode. Repo: `CompoundPortal`.
> This is a **UI/visual** task only. No new RPCs, no new data. Features (permissions,
> complaints, roster, new counter) come in **Spec 2** on top of this polished base.
> Follow the `refero-design` skill fully (research-first, reference lock, anti-slop gate).

---

## 1. Goal

The portal is the **face Enaya shows its compound clients** — it must feel premium,
elegant, and trustworthy the moment it loads. Today it is a light ivory/cream theme with a
tiny text "Enaya" wordmark and no real logo. We are replacing that with a **dark-luxury
theme built around the real gold Enaya logo**: deep near-black canvas, gold as a rare,
purposeful accent, refined typography, and tightened chrome across Login, Dashboard, and
the Watch overlay. Same layouts and same data — this is a skin + polish pass, not a
rewrite of behavior.

### Why dark is correct here (do NOT "correct" it back to light)
The `refero-design` anti-slop guide calls dark-by-default a slop tell **and** calls warm
ivory/cream "calm editorial" a slop tell. Both escape hatches require justification; ours:
- The **brand mark is gold artwork designed on black** (`public/enaya-logo.png` is
  gold-on-transparent). Gold reads as premium specifically against dark; on cream it
  muddies. This is the skill's **"luxury"** allowed direction, source-backed by the brand asset.
- Audience = residential compound managers judging whether Enaya looks like a serious
  premium operator. Dark + gold = valet/luxury-automotive language, which is the product.
- So: **one committed dark theme.** No light mode, no theme toggle (that was decided).

---

## 2. Files to create / edit

**EDIT**
- `src/index.css` — replace the light `@theme` + `:root` token block with the dark token
  system in §5. Keep the existing structural CSS (reset, focus ring, pulse-live keyframes,
  scrollbar) but retune to dark values.
- `index.html` — swap favicon to `/favicon-256.png`; add `color-scheme: dark` support via
  a `<meta name="theme-color">` and `<meta name="color-scheme" content="dark">`; keep the
  existing Google Fonts link (Fraunces / Inter / JetBrains Mono are already loaded).
- `src/pages/LoginPage.tsx` — restyle to dark; replace the Shield-icon-in-a-circle with the
  **real full logo** (`/enaya-logo.png`). Convert its inline-style colors to the new tokens.
- `src/pages/DashboardPage.tsx` — dark header with **emblem + wordmark logo**, the
  header/date fixes (§6.3), dark session tiles, dark counters strip, dark empty state.
- `src/pages/WatchPage.tsx` — retune the overlay chrome, modals, and toast to the dark
  token system and the gold accent (mostly already dark; this is polish + token alignment).

**CREATE**
- `public/logo-note.md` — one short line documenting which asset is which (optional, nice-to-have).

Logos are **already in `public/`** (committed by the manager):
`enaya-logo.png` (full stacked, primary), `enaya-emblem.png` (hand only),
`enaya-wordmark.png` (Enaya text), `favicon-256.png`.

---

## 3. Do NOT touch

- `src/contexts/AuthContext.tsx` — auth/session logic. (You may NOT change any RPC calls,
  heartbeat timing, or state shape. Zero logic edits.)
- `src/lib/supabase.ts`, `src/utils/fingerprint.ts`, `src/components/ProtectedRoute.tsx`.
- `src/types/index.ts` — no type changes in this spec (Spec 2 adds types).
- Any RPC call, any Agora logic, any timer values in WatchPage. **Visual only.**
- `.env`, `vercel.json`, build config, `package.json` (no new dependencies — use the fonts
  and lucide icons already installed).

If a visual change would require touching logic, STOP and ask in `conversation.md`.

---

## 4. Data contract

None. This spec changes **no** data flow. All existing RPC calls
(`compound_claim_session`, `compound_get_live_sessions`, `compound_heartbeat`,
`compound_request_stream_token`, `compound_report_stream_disconnect`, `compound_logout`)
stay byte-for-byte identical. Do not rename, re-order, or re-argument any of them.

---

## 5. The dark token system (put in `src/index.css`)

Replace the current light tokens. Keep BOTH the Tailwind v4 `@theme` block (so utility
classes like `bg-ink`, `text-gold` work) AND the `:root` CSS vars (LoginPage uses
`var(--color-...)` inline). **Names by purpose, not by color.** One accent: gold.

```css
@import "tailwindcss";

@theme {
  /* Surfaces (dark, layered — NOT pure black) */
  --color-ink: #0E0F12;          /* app background / canvas */
  --color-surface-1: #16181D;    /* header, panels, tiles base */
  --color-surface-2: #1E2127;    /* elevated: cards, modals, inputs */
  --color-surface-3: #262A31;    /* hover of elevated */

  /* Text on dark */
  --color-text-main: #F3F1EC;    /* primary (warm off-white, not #fff) */
  --color-text-muted: #A8A79F;   /* secondary */
  --color-text-subtle: #6F6E68;  /* tertiary / metadata */

  /* Gold accent — the ONLY brand accent. Use sparingly. */
  --color-gold: #C9A227;         /* base gold (matches logo) */
  --color-gold-soft: #E4C766;    /* highlight / light gold for text-on-dark */
  --color-gold-hover: #D8B23A;   /* interactive hover */
  --color-gold-tint: rgba(201,162,39,0.12); /* faint gold wash for active/selected */

  /* Borders (low-contrast on dark) */
  --color-border: rgba(243,241,236,0.08);
  --color-border-strong: rgba(243,241,236,0.16);
  --color-border-gold: rgba(201,162,39,0.45);

  /* Semantic */
  --color-live-red: #E5484D;     /* LIVE dot / errors keep red but slightly brighter for dark */
  --color-error: #E5484D;
  --color-success: #46A758;

  --font-body: "Inter", -apple-system, BlinkMacSystemFont, sans-serif;
  --font-display: "Fraunces", Georgia, serif;   /* for the few luxury display moments */
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
}

:root {
  color-scheme: dark;

  /* Mirror for inline-style consumers (LoginPage) — purpose-named */
  --color-bg-ink: #0E0F12;
  --color-bg-surface-1: #16181D;
  --color-bg-surface-2: #1E2127;
  --color-bg-surface-3: #262A31;
  --color-text-main: #F3F1EC;
  --color-text-muted: #A8A79F;
  --color-text-subtle: #6F6E68;
  --color-gold-accent: #C9A227;
  --color-gold-soft: #E4C766;
  --color-gold-hover: #D8B23A;
  --color-gold-tint: rgba(201,162,39,0.12);
  --color-border: rgba(243,241,236,0.08);
  --color-border-strong: rgba(243,241,236,0.16);
  --color-error: #E5484D;
  --color-success: #46A758;

  --shadow-sm: 0 1px 2px rgba(0,0,0,0.4);
  --shadow-md: 0 6px 24px rgba(0,0,0,0.45);
  --shadow-gold: 0 0 0 1px rgba(201,162,39,0.35), 0 8px 30px rgba(201,162,39,0.10);
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
}
```

Body background must become `var(--color-bg-ink)`, body text `var(--color-text-main)`.
Retune scrollbar track to `--color-bg-ink` and thumb to `--color-border-strong`.
Focus ring stays gold (`--color-gold-accent`) but use `:focus-visible` (already correct).

### Token role rules (do not break — anti-slop #8)
- **Gold is accent-only.** Never a full background fill, never a large surface. Allowed
  uses: the logo, the LIVE-tile hover border, primary button fill, a thin active/selected
  indicator, small numeric emphasis, the focus ring. That is the whole list.
- Surfaces carry the UI (60–80% of pixels). Text hierarchy is the next layer. Gold is the
  last 5–10%. This is the 60/30/10 discipline from the color guide.
- No gradients as UI surfaces. One subtle radial vignette behind the login logo is the only
  gradient allowed, and it must be barely perceptible.

---

## 6. Implementation detail — per page

### 6.1 index.html
- `<link rel="icon" type="image/png" href="/favicon-256.png" />`
- Add in `<head>`: `<meta name="color-scheme" content="dark" />` and
  `<meta name="theme-color" content="#0E0F12" />`.
- Keep the font `<link>` as-is (Fraunces/Inter/JetBrains Mono already requested).

### 6.2 LoginPage (`src/pages/LoginPage.tsx`)
Keep the component's logic, state, and the `ALREADY_LOGGED_IN` blocking branch exactly.
Only restyle:
- Page background: `var(--color-bg-ink)`. Center card on `var(--color-bg-surface-1)` with
  `border: 1px solid var(--color-border)`, `--radius-lg`, `--shadow-md`. Max width 400px.
- **Replace the Shield icon block** with the real logo:
  `<img src="/enaya-logo.png" alt="Enaya" width="180" height="115" />` centered, with the
  intrinsic ratio preserved (`height: auto`), sitting above the form. Remove the `<Shield>`
  import and the circular icon wrapper. Under it, keep a small caption "Compound Portal" in
  `--color-text-muted`, letter-spaced uppercase 11px. Remove the now-redundant "Enaya" text
  `<h1>` (the logo IS the wordmark).
- Behind the logo, one **barely-visible** radial gold vignette
  (`radial-gradient(closest-side, rgba(201,162,39,0.10), transparent)`) as a soft halo —
  the only gradient in the app. Keep it subtle; it must pass the "remove-it-and-nothing-breaks"
  test as decoration only.
- Inputs: `background: var(--color-bg-surface-2)`, `border: 1px solid var(--color-border)`,
  text `--color-text-main`, placeholder `--color-text-subtle`. Focus border → gold
  (`--color-gold-accent`) as it does now, and add `box-shadow: 0 0 0 3px var(--color-gold-tint)`
  on focus. Keep `autoComplete`, correct `type`, no paste-blocking (already fine).
- Primary "Sign in" button: fill `var(--color-gold-accent)`, text `#0E0F12` (dark text on
  gold reads premium and passes contrast), hover `--color-gold-hover`. Keep disabled 0.5 opacity.
- Error text + forced-logout banner: use `--color-error` on a faint red tint
  (`rgba(229,72,77,0.12)`) with a subtle border.
- Footer "Enaya Compound Portal · v1.0" in `--color-text-subtle`.

### 6.3 DashboardPage (`src/pages/DashboardPage.tsx`) — includes the handoff header fixes
Keep ALL data logic (`fetchSessions`, polling, `useCairoTime`, tiles/count state) untouched.
Restyle + apply the two header fixes the handoff flagged as "pure UI, portal owns this":

**Header (the "face" bar):**
- Background `var(--color-surface-1)`, bottom border `--color-border`. Sticky as now.
- **Left:** the logo, done right. Use the **emblem + wordmark** so it's crisp and compact:
  `<img src="/enaya-emblem.png" .../>` at ~28px tall next to
  `<img src="/enaya-wordmark.png" .../>` at ~18px tall, vertically centered, gap 10px.
  (Do NOT render "Enaya" as text anymore — use the real wordmark asset.) After a thin
  vertical divider (`--color-border-strong`), show the **compound name** in
  `--color-text-main` (14px, medium) and the **compound code** in `--color-text-subtle`
  mono 11px. This is per-compound identity and must be legible — it's who they are.
- **Right (HEADER FIX — add the date next to the clock):** show the **Cairo date** next to
  the existing Cairo live clock. Date format: `EEE, D MMM YYYY` (e.g. "Sat, 12 Sep 2026")
  via `toLocaleDateString('en-GB', { timeZone:'Africa/Cairo', weekday:'short', day:'numeric', month:'short', year:'numeric' })`,
  in `--color-text-muted` 12px; the clock stays mono 12px in `--color-text-main`. Put a thin
  dot/divider between date and clock. Then the Logout button (lucide `LogOut`), muted →
  gold-soft on hover.
- **Sizing fix:** the old header had a cramped text wordmark; give the header `py-4`,
  comfortable horizontal padding, and make sure at ≥1280px the content is centered in the
  existing max-width container, and on mobile (<640px) the compound code and date can hide
  gracefully (keep name + clock + logout). No horizontal scroll at 400px width.

**Counters strip** (below header): dark strip on `var(--color-surface-1)` with a subtle top
border. Keep the two existing counters ("sessions in progress", "today's completed").
Leave a clear, comment-marked slot for the **third counter** (registered clients) that
Spec 2 will fill — but do not add it now (no data for it yet). Numbers in
`--color-text-main` semibold; labels in `--color-text-muted`.

**Session tiles (`SessionTile`):**
- Base `var(--color-surface-2)`, `--radius-md`, `border: 1px solid var(--color-border)`.
- Hover: border → `--color-border-gold`, plus a soft `--shadow-gold`, and reveal the
  "Watch" affordance. Keep the live dot + label + elapsed minutes. The tile is a real
  interactive card (justified per anti-slop #2 — it IS a clickable item), so the card
  treatment is allowed here.
- Keep the aspect-video grid (1/2/3 cols responsive) exactly.

**Empty state:** dark, centered, understated. Replace the giant "0" mono block with a
smaller composition: the emblem at low opacity (~0.15), a one-line
"No active wash sessions right now" in `--color-text-muted`, and the
"the page will refresh automatically" hint in `--color-text-subtle` uppercase tracked.
No card box around it (anti-slop #2 — remove the border box; use spacing to group).

**Loading state:** replace "Loading..." text with a small gold pulse dot + "Loading…" in
muted text, consistent with WatchPage's connecting state.

### 6.4 WatchPage (`src/pages/WatchPage.tsx`) — polish only
This page is already dark. Do NOT touch any Agora, timer, heartbeat, token-refresh, or
navigation logic. Only:
- Point every hardcoded `#1C1C1C` and `bg-[#1C1C1C]` at `var(--color-bg-ink)` /
  `bg-ink` so it matches the new canvas exactly.
- Modals (inactivity "Still watching?") and the hard-cap toast: move off pure white onto
  `var(--color-bg-surface-2)` with `--color-text-main`, `--color-border`, `--radius-md`,
  `--shadow-md`. Buttons use the gold fill + dark text recipe.
- Bottom watermark line "Enaya Compound Portal — {compound.name}": keep, in
  `--color-text-subtle`. (Spec 2 will make this a proper per-user watermark; leave the
  structure ready but don't add user data now.)
- Top-bar controls (rotate/fit/close): keep behavior; align hover to gold-soft.

---

## 7. Conventions to follow

- Match the repo's existing style mix: Tailwind utility classes on Dashboard/Watch, inline
  `var(--color-*)` styles on Login. Do not convert one page's approach to the other's.
- Tailwind v4 tokens come from `@theme`; new utilities like `bg-surface-2`, `text-gold-soft`
  work only if the token exists there. Keep `@theme` and `:root` in sync (both listed in §5).
- Real assets only — use the committed logo PNGs. **Do not** hand-draw the logo in CSS/SVG,
  do not use an emoji or a generic icon as the brand mark (anti-slop #5, #9).
- All CAPS labels get letter-spacing (already a pattern; keep it).
- `:focus-visible` for focus, never bare `outline:none` (already correct — keep it).
- Read OpenCode's `agent.md`: load `refero-design` and follow its reference-lock + decision
  ledger + anti-slop gate before coding. Produce the short reference lock in `conversation.md`
  before you start (see §handoff note).
- Build MUST pass: `npm run build` (tsc + vite build) and `npm run lint` (oxlint) clean.

---

## 8. Acceptance checks (review will verify each)

1. `src/index.css` exposes the dark token set from §5 in BOTH `@theme` and `:root`; body
   background is `--color-bg-ink`, text `--color-text-main`; `color-scheme: dark` is set.
2. No indigo/violet anywhere; exactly ONE accent (gold); gold never used as a full surface
   background (anti-slop #1, #8 pass).
3. Login shows the **real `/enaya-logo.png`** (not the Shield icon, not text "Enaya"); the
   `Shield` import is removed; the login card + inputs + button are dark with the gold
   button recipe; the `ALREADY_LOGGED_IN` branch still renders and is styled dark.
4. Dashboard header shows the **emblem + wordmark image logo** (no text "Enaya"), the
   compound name + code, and **both the Cairo clock AND the new Cairo date** next to it.
5. Dashboard header, counters strip, tiles, empty state, and loading state are all dark and
   token-driven; the tile hover shows gold border + soft gold shadow.
6. A clearly commented **empty slot for the third (registered-clients) counter** exists in
   the counters strip, with no data wired yet.
7. WatchPage canvas/modals/toast are on the new dark tokens; **zero** changes to Agora,
   timers, heartbeat, token refresh, or navigation logic (diff shows only styling + color
   token lines in WatchPage).
8. `index.html` favicon → `/favicon-256.png`; `theme-color` + `color-scheme` metas present.
9. No new dependencies added to `package.json`. No RPC call changed. `AuthContext.tsx`
   logic diff is empty (color/token changes only if any).
10. `npm run build` passes and `npm run lint` is clean. No horizontal scroll at 400px width;
    header degrades gracefully on mobile.
11. Passes the refero **AI-slop detector checklist** (dark is justified in-brief; ALL CAPS
    tracked; cards only where interactive; real logo asset used).

---

## 9. Out of scope (this spec)

- Any new RPC, new counter DATA, complaints tab, client roster, permissions gating,
  per-user header/watermark content, screenshot deterrence. **All of that is Spec 2.**
- Adding a light theme or theme toggle (explicitly not wanted).
- Changing any timing, polling, or streaming behavior.
- New fonts or new libraries.

When done: post `TASK COMPLETE` in `conversation.md` with the changed files and the commit
hash, and I will review against §8 before we move to Spec 2.
