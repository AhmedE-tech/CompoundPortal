# SPEC 2 — Aeon Feature Expansion (Compound Portal)

> Author: Claude (manager). Implementer: OpenCode. Repo: `CompoundPortal`.
> Implements the DB→Portal handoff (`handoff-compounds-aeon-compound-portal.md`).
> **Do Spec 1 (dark redesign) first and get it approved.** This spec builds on the polished
> dark base and reuses its tokens. Follow `refero-design` for any new UI (roster window,
> complaints list, request states).

---

## 1. Goal

The DB now supports **per-person portal logins with a permissions object**, a **complaints
feed** (status + date only), a **client roster** gated behind admin approval, and a
**registered-clients counter**. Wire all of it into the portal: gate every feature on the
`permissions` returned at login, add the third counter, add a Complaints view, add a
"See my clients" request→approval→view flow rendered as a **view-only widget** (no export,
ever), and make the header + watermark reflect the **logged-in user** (not just the
compound). Everything still flows through the existing session-token RPCs.

---

## 2. Files to create / edit

**EDIT**
- `src/types/index.ts` — add `Permissions`, extend `UserInfo`, add
  `LiveSessionsResponse.compound_clients_count`, add complaint + roster types (§4).
- `src/contexts/AuthContext.tsx` — store `user.permissions`, `user.role_label`, `user.phone`
  from the claim response; expose them via context. **Only** widen the stored state + the
  `UserInfo` mapping — do NOT change the login RPC, heartbeat, or single-session logic.
- `src/pages/DashboardPage.tsx` — fill the third counter (`compound_clients_count`); add
  entry points (Complaints, See my clients) gated on permissions; show the logged-in user's
  `display_name` / `role_label` in the header.
- `src/pages/WatchPage.tsx` — turn the bottom watermark into a **per-user watermark**
  (display_name + timestamp) and apply the best-effort screenshot deterrence (§5.5) to the
  roster window (and reuse the util here). No logic/timer changes.

**CREATE**
- `src/pages/ComplaintsPage.tsx` — the complaints list view (status + date only).
- `src/components/ClientRosterWindow.tsx` — the view-only roster widget/modal + its
  request/approval/polling states.
- `src/hooks/useClientRoster.ts` — encapsulates request → poll → data → expiry logic for
  the roster (keeps the component clean and the RPC calls in one place).
- `src/utils/screenshotDeterrence.ts` — small helper: applies `user-select:none`,
  right-click/print disable, blur-on-window-blur, and a name/time watermark overlay.
   Deterrence only — documented as such.
- Routes for `/complaints` (and the roster as a modal launched from the dashboard, not a
  separate route, so it stays a focused overlay).

**Add routes** in `src/App.tsx`: `/complaints` behind `ProtectedRoute` + a permission guard.

---

## 3. Do NOT touch / do NOT do (blast-radius + handoff rules)

- Do NOT read `compound_users`, `compound_active_sessions`, or
  `compound_roster_access_requests` directly. **RPCs only.** (Handoff §6.)
- Do NOT add ANY download / export / print / PDF / screenshot / "save image" of the roster
  or complaints. The DB deliberately returns rows, never a file. (Handoff §5, §6.)
- Do NOT change `compound_claim_session` arguments, the heartbeat cadence, or the
  single-session enforcement. Session is now **per user** — do not re-introduce any
  "one login per compound" assumption. (Handoff §6.)
- Do NOT touch Agora/streaming/timer logic in WatchPage (watermark + deterrence overlay
  are additive DOM only).
- Do NOT gate on permissions **only** in the UI and assume that's security — the DB enforces
  it too; but you MUST NOT render a button that will just error (hide/disable instead).
- No new heavy dependencies. Use existing React + lucide + supabase-js only.

---

## 4. Data contract (EXACT — from the handoff; do not invent names)

All RPCs are `SECURITY DEFINER` and take the session token from `compound_claim_session`,
same pattern as the existing live-view calls: `supabase.rpc('<name>', { p_session_token })`.

### Login (changed return)
`compound_claim_session(p_device_fingerprint, p_user_agent, p_ip)` →
```
{ session_token, compound:{id,code,name},
  user:{ id, display_name, role_label, permissions:{ view_live, view_complaints, view_clients } } }
```
- `permissions` is a jsonb object of booleans. **Gate the UI on it.**
- Raises `ALREADY_LOGGED_IN` if THIS user already has a live session (already handled).
- `user` also carries `phone` per handoff §2 (display only; optional to surface).

### Live sessions (new field)
`compound_get_live_sessions(p_session_token)` →
```
{ tiles[], todays_completed_count, compound_clients_count }
```
- `compound_clients_count` = registered clients living in this compound → the third counter.

### Complaints (new; requires `view_complaints`)
`compound_get_complaints(p_session_token)` →
```
{ complaints: [ { reference, status, priority, type, created_at, resolved_at } ] }
```
- **Status + date only. No complaint text, no client name — by design. Do not ask for or
  render detail; there is none.** Raises `PERMISSION_DENIED` if the flag is off.

### Client roster — request (new; requires `view_clients`)
`compound_request_client_roster(p_session_token)` →
```
{ request_id, status, already_granted }
```
- The "See my clients" button. Opens a pending request, OR returns `already_granted:true`
  if a valid approval is still active.

### Client roster — read (new; requires `view_clients` AND approved, non-expired request)
`compound_get_client_roster(p_session_token)` →
```
{ clients: [ { full_name, vehicles: [ { location, make, model, year, license_plate } ] } ],
  access_expires_at }
```
- Raises `ROSTER_ACCESS_NOT_GRANTED` until approved. Returns rows once approved.
- Respect `access_expires_at`: close the window when it passes.

### TypeScript types to add (`src/types/index.ts`)
```ts
export interface Permissions {
  view_live: boolean;
  view_complaints: boolean;
  view_clients: boolean;
}
export interface UserInfo {
  id: string;
  display_name: string;
  role_label?: string | null;
  phone?: string | null;
  permissions: Permissions;
}
// extend existing:
export interface LiveSessionsResponse {
  tiles: LiveSessionTile[];
  todays_completed_count: number;
  compound_clients_count: number;   // NEW
}
export interface Complaint {
  reference: string;
  status: string;
  priority: string | null;
  type: string | null;
  created_at: string;
  resolved_at: string | null;
}
export interface RosterVehicle {
  location: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  license_plate: string | null;
}
export interface RosterClient {
  full_name: string;
  vehicles: RosterVehicle[];
}
export interface ClientRosterResponse {
  clients: RosterClient[];
  access_expires_at: string;
}
export interface RosterRequestResponse {
  request_id: string;
  status: string;
  already_granted: boolean;
}
```

---

## 5. Implementation detail

### 5.1 AuthContext — carry permissions (minimal change)
- Extend `UserInfo` usage so `state.user` includes `role_label`, `phone`, `permissions`.
- In the successful `compound_claim_session` branch, `data.user` already contains these —
  just stop narrowing them out. No other change. If `permissions` is missing on an older
  session, default all three flags to `false` (fail-closed).
- Expose `user` as it already is (the object now simply has more fields).

### 5.2 Third counter (Dashboard)
- Read `compound_clients_count` from the live-sessions response (already polled every 15s).
- Fill the commented slot Spec 1 left in the counters strip: label "registered clients",
  value in `--color-text-main` semibold. If `view_live` is false the dashboard itself
  shouldn't be the primary view, but the counter is harmless; show it whenever the count is
  present. Keep the three counters evenly weighted on desktop; wrap on mobile.

### 5.3 Permissions gating (the rule: never show a button that will just error)
- `view_complaints === false` → do not render the Complaints entry point at all.
- `view_clients === false` → do not render the "See my clients" button at all.
- `view_live === false` → the live tiles/watch entry are hidden; show a calm dark empty
  state ("Live viewing isn't enabled for your account — contact Enaya"). Still allow
  Complaints/roster if those flags are on. (A user may have clients access but not live.)
- Defense in depth: even with a flag on, if an RPC returns `PERMISSION_DENIED` /
  `ROSTER_ACCESS_NOT_GRANTED`, handle it gracefully (message, no crash) — don't assume the
  flag and the server can never disagree.

### 5.4 Complaints view (`ComplaintsPage.tsx`, route `/complaints`)
- Entry point: a header nav item or a button on the dashboard (gold-soft text, lucide
  `MessageSquareWarning` or `FileText`), shown only if `view_complaints`.
- On mount call `compound_get_complaints`. Handle loading / empty / error / `PERMISSION_DENIED`.
- Render a **clean dark list** (NOT a card grid — anti-slop #2): rows separated by
  `--color-border`, columns = reference (mono), a **status pill**, type, priority, and
  dates (`created_at`, and `resolved_at` when present) formatted via `Intl.DateTimeFormat`
  in Africa/Cairo. Status pill colors: open/pending → gold-tint; resolved → success-tint;
  urgent/high priority → a small red dot, not a full red row.
- **No detail drill-down, no text column** — the data intentionally has none. Do not add a
  "view details" affordance.
- Empty state: "No complaints on record." in muted text. Back-to-dashboard link.

### 5.5 Client roster (request → approval → view), `ClientRosterWindow.tsx` + `useClientRoster.ts`
Launched as a **modal overlay** from a dashboard button "See my clients" (only if
`view_clients`). Flow (mirrors handoff §5):
1. On open, call `compound_request_client_roster`.
   - If `already_granted === true` → immediately call `compound_get_client_roster` and show
     the roster.
   - Else → show a calm "Request sent — waiting for Enaya admin approval" state with a quiet
     spinner, and **poll** `compound_get_client_roster` every ~10s. It errors
     (`ROSTER_ACCESS_NOT_GRANTED`) until approved, then returns data. On data, switch to the
     roster view. Stop polling when the window closes.
2. **Roster view = strictly view-only widget.** For each client: `full_name` as a row/section
   header, and their vehicles listed (location · make model year · license_plate). Use a
   quiet dark layout: sectioned list, mono for plates, `--color-text-muted` for secondary
   fields. This is sensitive personal data — keep it sober, not flashy.
3. Respect `access_expires_at`: show a small "access expires HH:MM" note; when the time
   passes, close the window and return to a "request again" state. Re-poll `get_client_roster`
   only while open.
4. Errors: network/other → "Couldn't load your clients right now" with retry.

**Screenshot deterrence (best-effort only — `screenshotDeterrence.ts`):** apply to the
roster window (and reuse on WatchPage):
- `user-select: none` on the sensitive content; disable right-click (`contextmenu`) and
  `beforeprint` on that view; blur/obscure the content when the window loses focus
  (`window blur` → overlay a "paused — click to resume" scrim); render a faint tiled
  watermark of `display_name` + current time behind the data.
- Add a one-line code comment: "Deterrence only — the web cannot block OS screenshots; the
  real control is the request-approval gate." (Handoff §5.) **Do NOT** claim it prevents
  capture and do NOT block legitimate keyboard use elsewhere.

### 5.6 Per-user header + watermark
- **Header (Dashboard):** in addition to compound name/code (from Spec 1), show the
  logged-in user's `display_name` and `role_label` (e.g. "Sara · Manager") near the logout
  button, `--color-text-muted`. Sessions are per-user now — the header must identify the person.
- **WatchPage watermark:** change the bottom line to include `display_name` +
  live timestamp (faint, `--color-text-subtle`) — a light deterrence + accountability cue.
  DOM/styling only; no timer or stream change.

---

## 6. Conventions to follow

- Reuse Spec 1's dark tokens for every new surface; new views must look native to the theme.
- All RPC calls go through `supabase.rpc(name, { p_session_token: sessionToken })` using the
  token from `useAuth()`, exactly like `DashboardPage.fetchSessions`. Never a direct table read.
- Handle all four states (loading / empty / error / success) for every new async view.
- `Intl.DateTimeFormat` for all dates/times (Africa/Cairo), never hardcoded formatting.
- Icons from lucide only; no emoji.
- Follow `refero-design` for the roster window and complaints list (research the "view-only
  list", "empty state", "pending approval" patterns; keep them calm and dark).
- Read/refresh `agent.md` and `context.md`; keep the refero reference-lock note in `conversation.md`.
- Build + lint must pass.

---

## 7. Acceptance checks (review verifies each)

1. `types/index.ts` has `Permissions`, extended `UserInfo` (with `role_label`, `phone`,
   `permissions`), `compound_clients_count` on `LiveSessionsResponse`, and the complaint +
   roster types — names EXACTLY as §4.
2. AuthContext stores and exposes `user.permissions` / `role_label` / `phone`; login RPC,
   heartbeat, and single-session logic are otherwise unchanged (diff is additive only);
   missing permissions default to `false`.
3. Third counter shows `compound_clients_count`; dashboard renders 3 counters, wrapping on mobile.
4. Complaints entry point renders ONLY when `view_complaints`; "See my clients" renders ONLY
   when `view_clients`; `view_live===false` hides live tiles with a calm message. No
   error-guaranteed button is ever shown.
5. `ComplaintsPage` calls `compound_get_complaints`, renders status + dates only (NO text/name
   column, NO detail drill-down), handles loading/empty/error/`PERMISSION_DENIED`.
6. Roster: `compound_request_client_roster` on open; `already_granted` → immediate
   `compound_get_client_roster`; otherwise pending state + ~10s polling until approved;
   renders view-only (name + vehicles: location/make/model/year/plate); honors
   `access_expires_at` (auto-closes); handles `ROSTER_ACCESS_NOT_GRANTED`.
7. **No download/export/print/PDF anywhere** for roster or complaints (grep the diff: no
   `download`, no `print(`, no blob/anchor-download, no jspdf/html2canvas). Screenshot
   deterrence present with the "deterrence only" comment; it does not claim to block capture.
8. No direct table reads of `compound_users` / `compound_active_sessions` /
   `compound_roster_access_requests`. All access via the named RPCs.
9. Header shows the logged-in user's `display_name` + `role_label`; WatchPage watermark
   includes `display_name` + timestamp. No Agora/timer/streaming logic changed.
10. No new heavy deps; `npm run build` + `npm run lint` clean; no horizontal scroll at 400px.

---

## 8. Out of scope

- Any admin-side approval UI (that lives in the Admin Dashboard, a different department —
  `compound_roster_access_requests` is admin-only; the portal only *requests*).
- The Emergencies module (separate future handoff).
- Real screenshot *prevention* (impossible on web; deterrence only).
- Changing streaming, timers, or the live-view limit (per-compound single stream is enforced
  by the DB automatically — no portal change).

When done: `TASK COMPLETE` in `conversation.md` with changed files + commit hash. I review
against §7, then we finalize context.md + Changelog.
