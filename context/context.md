# CONTEXT — Compounds Module (department)

> Living memory of the **Compounds** module — its own portal + the Compounds pages in the admin dashboard, sharing the one HQ database.
> Read fully at the start of every session; update at the end. Kept ~80% accurate on purpose.
> Database is HQ ([[carwash-hq-database]]). Built accurate from the live DB (Supabase MCP) + the portal repo, 2026-09-11.

---

## 0. The ritual
- **Start:** read this file, then say what you want to change.
- **End:** output updated context.md + Changelog line; save to repo `/context`, commit, push, re-upload to the Claude project.
- Manager (Claude) writes specs → OpenCode implements → Claude reviews. Skills: enaya-workflow / enaya-spec / enaya-conversation.

## 1. What this is
- A B2B module: Enaya contracts with residential **compounds**; a compound gets a **portal** to watch live wash sessions happening in their compound. Admin manages compounds from the dashboard.
- **Two surfaces:** the **Compound Portal** (separate repo, this repo) + **Compounds pages in the Admin Dashboard** (`CompoundsPage`, `CompoundAnalyticsPage`). Both share the one HQ database.
- Portal repo: `C:\Users\Admin\Documents\Enaya\CompoundPortal`. Stack: React 19 + Vite 8 + TypeScript + **Tailwind v4**, `@supabase/supabase-js`, **agora-rtc-sdk-ng** (web live streaming), lucide icons, oxlint. Deployed on Vercel.

## 2. Portal structure (small & focused)
- `lib/supabase.ts` — client. `contexts/AuthContext.tsx` — the session-token auth (see §4). `components/ProtectedRoute.tsx`.
- `pages/`: **LoginPage**, **DashboardPage** (live sessions list), **WatchPage** (Agora live viewer — the core), **ComplaintsPage** (status+date only, route `/complaints`).
- `hooks/useClientRoster.ts` — request→poll→data→expiry state machine for the roster RPC pair. `components/ClientRosterWindow.tsx` — view-only roster modal (backdrop + panel, `overscroll-contain`, `aria-live="polite"`), launched from the dashboard via a user gesture, never a route. `utils/screenshotDeterrence.ts` — best-effort deterrence hooks (`user-select:none`, contextmenu/beforeprint disable, window-blur scrim, `useWatermarkStamp()` Cairo HH:MM on a 15s tick); the tiled `WatermarkOverlay` sits inline in ClientRosterWindow to keep the hook module `.ts` fast-refresh clean.
- `utils/fingerprint.ts` — device fingerprint for session claiming. `types/index.ts`.
- **Theme (since Spec 1, 2026-09-12):** committed dark-luxury system in `src/index.css` — tokens live in BOTH the Tailwind v4 `@theme` block (utilities like `bg-ink`, `text-gold-soft`, `shadow-gold`) AND the `:root` CSS vars (LoginPage inline styles). One accent: gold (`#C9A227`; `gold-soft #E4C766` for gold **text** on dark). Surfaces layered ink → surface-1 → surface-2 → surface-3. Fonts: Inter (body), Fraunces (display, defined but unused so far), JetBrains Mono.
- **Logo assets in `public/`** (real PNGs, no CSS/SVG redraw): `enaya-logo.png` (full stacked, login), `enaya-emblem.png` (248×144 hand emblem, header + empty state), `enaya-wordmark.png` (480×135), `favicon-256.png`. Header serves emblem at 48×28 + wordmark at 64×18 (2×-safe, explicit width/height to avoid CLS).

## 3. Database — tables
`compounds`, `compound_users`, `compound_active_sessions`, `compound_stream_access_logs`, `compound_activity_logs`, `customer_compound_history`. Plus signup helpers that assign a customer to a compound.

## 4. Database — RPCs (exact, from live DB) & auth model
**The portal uses a SESSION-TOKEN auth model** (not Supabase Auth, not the client custom auth) — a compound logs in and gets a `p_session_token`, tracked with device fingerprint + heartbeat + single-session enforcement:
- `compound_claim_session(p_device_fingerprint, p_user_agent, p_ip)` — claim/login a session.
- `_compound_verify_session(p_session_token)` — internal verify.
- `compound_heartbeat(p_session_token)` — keep session alive.
- `compound_logout(p_session_token)`.
- `compound_get_live_sessions(p_session_token)` — the dashboard feed (now also returns `compound_clients_count` → the third counter).
- `compound_request_stream_token(p_session_token, p_session_id)` — get an Agora token to watch a stream.
- `compound_get_complaints(p_session_token)` — complaints feed (status + date only; needs `view_complaints`).
- `compound_request_client_roster(p_session_token)` — request roster access → `{ request_id, status, already_granted }` (needs `view_clients`).
- `compound_get_client_roster(p_session_token)` — roster rows + `access_expires_at`; errors `ROSTER_ACCESS_NOT_GRANTED` until approved.
- `compound_report_stream_disconnect(p_session_token, p_log_id, p_reason)`.
- `compound_cleanup_stale_sessions()` — cron cleanup.

**Admin (dashboard) RPCs:** `admin_list_compounds`, `admin_create_compound`, `admin_update_compound`, `admin_delete_compound(p_compound_id, p_confirm_code)` (confirm-code guarded; CEO-only per HQ history), `admin_assign_customer_to_compound`, `admin_register_compound_user`, `admin_force_logout_compound`, `admin_get_compound_cost_analytics(p_days)`.
**Signup/customer:** `get_active_compounds`, `get_signup_compounds`, `set_my_compound(p_compound_id)`.
**Triggers:** `trg_compounds_generate_code`, `trg_compounds_touch_updated`, `trg_compound_close_on_stream_end`, `trg_log_customer_compound_change`.
All are SECURITY DEFINER except the two INVOKER `trg_compounds_*` triggers.

## 5. How it connects
- Portal → session-token RPCs above → live sessions + Agora stream tokens.
- Admin dashboard → the `admin_*compound*` RPCs (in `lib/api/compounds.ts` there).
- RLS: `compound_*` tables are admin-role-read (`has_any_role(ceo, leader, customer_service)`); the portal reaches data through the SECURITY DEFINER session-token RPCs, not direct table reads.

## 6. Safety rules
- Surgical changes; all DB access via the RPCs above — never direct table writes from the portal.
- `admin_delete_compound` needs a confirm code and is CEO-only — respect that guard.
- Never rename DB columns/tables (shared schema). DB changes are an HQ job → handoff.
- `.env` must stay gitignored (portal has VITE_SUPABASE_* keys).

## 7. Open items
- context.md ~80% — deepen WatchPage/Agora flow as we work.
- No AGENTS.md in the portal repo yet — global OpenCode skill applies.
- **Spec 2 done (shipped pending Claude review).** Per-user permissions gating (fail-closed), third counter (registered clients), Complaints view, admin-approved client roster (view-only, poll 10s, expires), per-user header (+ watermark). Spec 1 (dark-luxury) approved 2026-09-12.
- `--font-display` (Fraunces) still defined but unused — reserved for display moments.
- Design standard: **refero-design** skill is the primary UI methodology for this repo (installed globally ~/.agents/skills/refero-design). Dark-luxury is a decided brand choice, not a default.

## Sources
- Live DB via Supabase MCP (exact compound RPC list), 2026-09-11. Portal repo: package.json, README, src tree.
- Spec 1 (premium dark-luxury redesign) from Claude via conversation.md + context/tasks, approved 2026-09-12.

## Changelog
- **2026-09-12** — Spec 2 done (awaiting Claude §7 review). Added per-user `permissions` from `compound_claim_session` (AuthContext `normalizeUser`, fail-closed); third counter "registered clients" (`compound_clients_count`); permission-gated entry points (Complaints → `/complaints`, "See my clients" → roster modal); `ComplaintsPage` (clean dark list, status pills, priority red dot, Cairo dates, no text/name — status+date only); `useClientRoster` request→poll(10s)→view→expiry + `ClientRosterWindow` (view-only, plates mono, `access expires HH:MM`, request-again after expiry, `aria-live`); `screenshotDeterrence` util (user-select/contextmenu/beforeprint/blur-scrim, "deterrence only" comment) applied to roster + WatchPage; WatchPage bottom line → `display_name · HH:MM` live stamp; per-user identity in Dashboard header (hidden <sm); `/complaints` route behind ProtectedRoute + permission guard. Build + oxlint clean (same 5 pre-existing warnings). All data via the session-token RPCs only; zero download/export/print.
- **2026-09-12** — Spec 1 done: full dark-luxury reskin (visual only, zero data/RPC changes). Replaced light ivory tokens with the dark token system (ink/surfaces/gold, mirrored in `@theme` + `:root`, `color-scheme: dark`); login now shows the real `/enaya-logo.png` with a barely-visible gold halo + "Compound Portal" caption (Shield icon + text wordmark removed); dashboard header now emblem+wordmark PNG logos, compound name+code, and Cairo clock + new Cairo date, with mobile-save degradation (<640px hide code+date); counters strip got a commented Spec-2 slot for the third counter; tiles are token dark cards with gold hover border + soft gold shadow; empty state = low-opacity emblem + spaced copy (no card box); loading = gold pulse dot + "Loading…"; WatchPage modals/toast/canvas moved to dark tokens, controls hover gold-soft. Favicon → `/favicon-256.png`, added `color-scheme`/`theme-color` metas. Build + oxlint clean; AuthContext/package.json untouched.
- **2026-09-11** — Context created for the Compounds module (Task 8), accurate from live DB + portal code. Captured the two surfaces (portal + admin pages), the session-token auth model, the exact RPC set, and tables.
