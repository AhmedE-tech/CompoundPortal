# SPEC 3 — Dashboard redesign v2 (approved mockup → production)

> Author: Claude (manager). Implementer: OpenCode. Repo: `CompoundPortal`.
> **This replaces the current cramped dashboard chrome.** Ahmed reviewed & approved an HTML
> mockup — it is committed at `context/tasks/reference-dashboard.html`. **Match that mockup.**
> This is a visual/structural rework of DashboardPage + the roster modal ONLY. No data/RPC/auth
> changes — every existing RPC call, permission gate, poll, and state stays exactly as it is.

---

## 1. Goal
The shipped dashboard looked junior: a thin cramped header, a tiny logo, text-link "nav", flat
counters, and a roster "pending" message that was nearly invisible. Ahmed rejected it. The
approved mockup fixes all of it: a **tall branded header** (big logo + Enaya name, clear
compound identity, clock/date, user chip, Logout), **real navigation tabs** (Live Sessions /
Complaints / My Clients), **three rich stat cards** (big serif numbers, semantic color stripe,
icon), **stronger live tiles** (hover play affordance), and a **proper centered roster modal**
for the request/pending/ready states. Build the production DashboardPage to match the mockup
pixel-intent (exact tokens/sizes below), keeping all current behavior.

## 2. The reference — read it first
`context/tasks/reference-dashboard.html` is the approved static mockup (self-contained; uses
`/enaya-logo.png`). It is the source of truth for layout, sizes, spacing, colors, and the modal.
Where this spec and the mockup agree, follow them; if you think something in the mockup can't map
to the real data, post a `QUESTION:` — do not silently simplify it back toward the old look.

## 3. Files to edit / create
**EDIT**
- `src/pages/DashboardPage.tsx` — rebuild the header, nav, counters, tiles, empty/loading/`!view_live` states to match the mockup. Keep ALL data logic (`fetchSessions`, polling, `useCairoTime`, `useCairoDate`, counts, permission flags, roster hook wiring) unchanged.
- `src/index.css` — add the few new tokens the mockup introduces (see §5); do NOT remove or rename existing tokens (other pages depend on them).
- `src/components/ClientRosterWindow.tsx` — restyle the **pending / requesting / error / expired** states to the mockup's centered-modal treatment (spinning gold ring, big heading, explanation, waiting note). The **ready** state (the actual client list) keeps its current structure + the watermark/deterrence — just align its chrome (header, close button, radius) to the new modal shell.
- `src/pages/ComplaintsPage.tsx` — align its header to the new dashboard header style (same brand bar + back button treatment) and its rows stay as-is functionally; this is light chrome alignment only.

**CREATE** — none required. (If a small `Header`/`StatCard`/`NavTabs` component helps keep DashboardPage readable, that's your call, but not required.)

## 4. Do NOT touch
- `src/contexts/AuthContext.tsx`, `src/hooks/useClientRoster.ts`, `src/utils/screenshotDeterrence.ts` — logic is done and correct. (You may read them; do not change behavior.)
- Any RPC call, argument, or the poll intervals. No new download/export/print — same rule as before.
- `WatchPage.tsx`, `LoginPage.tsx` (login was approved — leave it), routing in `App.tsx`, types, `.env`, `package.json` (no new deps — icons are inline SVG or lucide-react, already installed).

## 5. Tokens to ADD to `src/index.css` (additive — keep everything already there)
The mockup uses a slightly deeper ink, a brighter gold for large text, and card/gradient helpers.
Add these to BOTH `@theme` and `:root` (mirror), alongside the existing ones:
```
--color-ink: #0C0D10;            /* was #0E0F12 — mockup uses a hair deeper */
--color-surface-3: #23272E;      /* (already close; keep or update to this) */
--color-surface-hover: #2A2F37;
--color-gold-bright: #F0D98A;    /* large numerals / active tab text on dark */
--color-border-strong: rgba(244,242,236,0.16);
--shadow-gold: 0 0 0 1px rgba(201,162,39,0.35), 0 10px 40px rgba(201,162,39,0.10);
--radius-lg: 18px;
```
Also: `--font-display: "Fraunces", Georgia, serif;` is already loaded — use it for the big stat
numbers. Keep gold accent-only discipline (no gold surface fills except the small icon tints and the CTA/avatar).
Body gets the subtle top gold radial the mockup uses:
`radial-gradient(1200px 480px at 50% -260px, rgba(201,162,39,0.10), transparent 70%)` over `--color-ink`.

## 6. Implementation detail — match the mockup

### 6.1 Header (tall brand bar) — sticky, `border-bottom` + subtle gradient/blur
- Left: `<img src="/enaya-logo.png" alt="Enaya" height="52" width="auto">` (this is the FULL stacked logo — the header now uses the big logo, per Ahmed: logo + name must be large & unmistakable). Then a vertical divider (`--border-strong`), then compound **name** at **17px/600** and **code** under it in `--gold-soft` mono 11px uppercase. Use the real `compound.name` / `compound.code`.
- Right, in order: a **clock block** (time `mono 19px/500 tabular-nums`, date `11.5px muted` under it — right-aligned) using the existing `useCairoTime` + `useCairoDate`; a **user chip** = a round gold **avatar** with the user's first initial + `display_name` (13.5px/600) and `role_label` (11px muted, capitalized) — from `user.display_name`/`user.role_label`; then a **Logout button** (bordered, lucide `LogOut`, hover → gold border).
- Header vertical padding ~18px (much taller than the old cramped strip).

### 6.2 Nav tabs (real navigation, replaces the tiny text links)
- A second row under the header, own `border-bottom`. Tabs: **Live Sessions** (icon: video), **Complaints** (icon: message-warning), **My Clients** (icon: users). 13.5px/500, `padding-block ~15px`, gap.
- Active tab = `--gold-bright` text + 2px gold bottom border. Inactive = muted, hover → text-main.
- **Gating (unchanged rules):** render **Complaints** tab only if `view_complaints`; **My Clients** tab only if `view_clients`; **Live Sessions** always present but leads to the live view (or the `!view_live` empty message). Clicking Complaints → `navigate('/complaints')`; My Clients → opens the roster modal (existing `roster.open()` + `setRosterOpen(true)`); Live Sessions → this page. So the old "actions row" is GONE — its buttons become these nav tabs.

### 6.3 Stat cards (3-up, replaces the flat counter strip)
- `grid-template-columns: repeat(3,1fr); gap:16px`. Each card: gradient surface (`surface-2`→`surface-1`), `1px border`, `--radius-md`, `22px 24px` padding, and a **3px left color stripe**.
- Card 1 **In Progress** (stripe `--live` red, icon video-tinted red) = `liveCount`. Card 2 **Completed Today** (stripe `--success` green) = `completedCount`. Card 3 **Registered Clients** (stripe `--gold`, icon gold) = `clientsCount`.
- Each card: uppercase label (12px/600 tracked) + icon top-right; big number in **`--font-display` 44px/600 tabular-nums**; a one-line `--text-subtle` descriptor under it ("wash sessions live right now" / "finished since midnight" / "living in this compound").
- On mobile (<820px) they stack to 1 column.

### 6.4 Live tiles section
- A section head: "**Live now**" + a small pulsing **LIVE** badge on the left, "Updates automatically" hint on the right.
- Tiles: `repeat(3,1fr)`, `gap:18px`, `aspect-ratio:16/10`, `--radius-md`. Keep the real data (`display_label`, `started_ago_minutes`). Add a **hover play affordance** (a gold circle with a play glyph, fades in on hover) and the existing gold hover border + `--shadow-gold`. LIVE pill top-left, elapsed top-right (mono). Label + a meta line at the bottom. Click → `navigate('/watch/${session_short_id}')` (unchanged).
- Responsive: 3 → 2 (<820px) → 1 (<560px).

### 6.5 States
- **Loading:** gold pulse dot + "Loading…" (as now, centered).
- **Empty (view_live true, 0 live):** faint emblem (~0.15 opacity) + "No active wash sessions right now" + the "the page will refresh automatically" hint. Keep the stat cards + nav visible above it (empty state is only the tiles area).
- **`!view_live`:** the tiles area shows the calm "Live viewing isn't enabled for your account — contact Enaya" message; stat cards + whichever nav tabs are permitted still render.

### 6.6 Roster modal — the pending state, done right (match mockup)
In `ClientRosterWindow.tsx`, restyle the non-list phases to the mockup:
- Centered modal, `max-width 440px`, gradient surface, `--radius-lg`, `--shadow-md`, scrim `rgba(6,7,9,0.78)` + slight blur.
- Header: "**Client Roster**" + compound name under it; a rounded close button (× ) top-right.
- **requesting / pending body:** a **76px gold ring with a spinning gold arc** (border-top/right gold, `spin 1.2s linear infinite`) around a lock icon; **"Request sent"** heading (17px/600); explanation paragraph ("We've asked Enaya to approve your access to this compound's client roster. This window will open automatically once it's granted."); and a **note pill** ("Waiting for admin approval — refreshing automatically") with a clock icon on `--surface-3`.
- **error:** same shell, message + a "Try again" action (existing `roster.retry`).
- **expired:** same shell, "Your client access has expired." + "Request again" gold button.
- **ready:** keep the existing client list + watermark + blur-scrim + "Viewing only — no export available." — just make its header/close/radius match this shell. Do NOT change the deterrence or the list data.
- Respect `prefers-reduced-motion`: the spinning arc + pulse fall back to static.

## 7. Conventions
- Reuse tokens; gold stays accent-only. Real logo PNG (no CSS redraw). ALL CAPS gets letter-spacing.
- Icons: inline SVG (as in the mockup) or lucide-react — both fine; no emoji.
- `Intl`/existing hooks for all dates/times (Africa/Cairo). `:focus-visible` focus. No horizontal scroll at 400px.
- Follow `refero-design` (anti-slop gate) — but the mockup already embodies the approved direction; match it rather than re-deriving.
- Build + lint must pass (tsc + vite build, oxlint). No new deps.

## 8. Acceptance checks
1. Dashboard matches `reference-dashboard.html`: tall header with the big `/enaya-logo.png`, compound name+code, clock/date, user chip (avatar + display_name + role_label), Logout.
2. Real nav tabs (Live Sessions / Complaints / My Clients) with active-gold underline; Complaints/My Clients tabs render only per `view_complaints`/`view_clients`; the old text-link actions row is gone.
3. Three stat cards with serif 44px numbers, semantic stripes (red/green/gold), icons, descriptors; bound to `liveCount`/`completedCount`/`clientsCount`; stack on mobile.
4. Live tiles have the hover play affordance + gold hover border/shadow; real data; correct responsive columns; click → `/watch/:id`.
5. Loading / empty / `!view_live` states present and styled; stat cards+nav persist above the tiles area.
6. Roster modal pending state matches the mockup (spinning gold ring, "Request sent", explanation, waiting note) — clearly visible, centered; error/expired/ready handled; **ready** state keeps list + watermark + no-export.
7. New tokens added to `index.css` (both `@theme` + `:root`) additively; no existing token removed/renamed; other pages still build.
8. Zero data/RPC/auth/poll changes; no new download/export/print; no new deps; `npm run build` + `npm run lint` clean; no horizontal scroll at 400px.

## 9. Out of scope
- WatchPage, LoginPage (approved), Complaints row internals (chrome alignment only), any DB/RPC work, the Emergencies module.

When done: `TASK COMPLETE` in `conversation.md` with changed files + commit hash. I'll review against §8 and the mockup.
