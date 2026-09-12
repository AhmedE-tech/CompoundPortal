# agent.md — OpenCode's personal memory

> This is OpenCode's own notebook, separate from context.md (the department's shared brain).
> OpenCode reads this at the start of every session and updates it at the end.
> Use it for repo-specific knowledge that helps future sessions go faster and avoid repeated mistakes.

## Repo basics
- Repo: <name / purpose>
- Stack: <framework, language, key libraries>
- Run/build commands that work: <e.g. `npm run dev`, `npm run build`, `npm run typecheck`>
- How to run tests: <...>

## Conventions in this repo (match these)
- File/folder structure: <...>
- Naming conventions: <...>
- State management / data fetching pattern: <...>
- How the frontend calls the database RPCs: <...>

## Gotchas & lessons (things that bit me before)
- <e.g. "the build fails if X isn't imported first">

## Recurring reminders
- Always update context.md and this file at end of task.
- Never invent — ask in conversation.md.
- For ANY UI/frontend/design work in this repo: load the `refero-design` skill (installed at ~/.agents/skills/refero-design by Ahmed, 2026-09-12) and follow it fully — research-first, reference lock + decision ledger before coding, anti-slop quality gate.

## Notes log
- 2026-09-12 — Ahmed installed `refero-design` skill globally via `npx skills add https://github.com/referodesign/refero_skill` (copied to ~/.agents/skills/refero-design; opencode must restart to load it). It is the PRIMARY design skill for all UI work — refero-design overrides generic design skills; use bundled craft references + MCP research when available.
- 2026-09-12 — COMPLETED Spec 2 (Aeon feature expansion), commit <pending>. New surfaces: `ComplaintsPage.tsx` (route `/complaints`, RPC `compound_get_complaints`), roster modal `ClientRosterWindow.tsx` + `hooks/useClientRoster.ts`, `utils/screenshotDeterrence.ts`. Gotchas learned:
  - `.ts` vs `.tsx`: a file exporting a JSX component (even helpers) must be `.tsx` — BUT mixing component + non-component exports triggers oxlint `react/only-export-components`. Keep hook-only modules as `.ts` (e.g. `screenshotDeterrence.ts`) and inline JSX components where they render.
  - Tailwind v4 NORMALIZES arbitrary color values in output: `bg-[rgba(70,167,88,0.12)]` compiles to `background-color:#46a7581f` (hex+alpha). Grep built CSS by resulting hex, not source form.
  - AuthContext now has `normalizeUser()` (fail-closed: missing `permissions` → all flags false). Diff is additive ONLY; don't touch login heartbeat/single-session.
  - Roster RPC flow: `compound_request_client_roster` → `{already_granted}` → if true immediately `compound_get_client_roster`; else poll `compound_get_client_roster` every 10s (it errors `ROSTER_ACCESS_NOT_GRANTED` until approved); respect `access_expires_at` (timer → phase 'expired' → request-again). `access_expires_at` is an ISO string; parse with `new Date(...)`.
  - Open the roster from a USER GESTURE in Dashboard (button onClick calls `roster.open()`), NOT a mount effect — avoids StrictMode double-invoking the request RPC in dev.
  - Gate every feature on `user.permissions.view_live / view_complaints / view_clients`; never render a button that will RPC-error. Also handle PERMISSION_DENIED / ROSTER_ACCESS_NOT_GRANTED gracefully at runtime.
  - Per-user header identity (`display_name · role_label`) hidden below `sm` (keeps the 400px rule: name+clock+logout survive); WatchPage bottom bar is now `display_name · HH:MM` Cairo live stamp.
  - Deterrence util is best-effort only (spec: "do not claim it prevents capture"); tiled watermark is ON for the roster data view, intentionally OFF over the live video (bottom-line cue suffices).
  - oxlint baseline still exactly the 5 pre-existing warnings (AuthContext ×4, WatchPage:109 clearAllTimers). New files added ZERO new warnings.
- 2026-09-12 — COMPLETED Spec 1 (dark-luxury reskin), commit <pending>. Gotchas learned:
  - The logo PNGs (`public/enaya-emblem.png` 248×144, `enaya-wordmark.png` 480×135, `enaya-logo.png` 540×346) were committed to disk but UNTRACKED in git — remembered to include them in the commit (they're load-bearing).
  - Tailwind v4 only emits utilities that are USED; missing class in built CSS usually means it's just not referenced — verify with the actual used selector (e.g. `hover\:shadow-gold` vs `shadow-gold`).
  - Tokens must be mirrored in BOTH `@theme` (Tailwind utilities) and `:root` (inline `var(--color-*)` on LoginPage). Purpose-named, not color-named.
  - Gold **text** on dark = `--color-gold-soft` (#E4C766), never base gold (contrast at small sizes).
  - oxlint has 5 pre-existing warnings in AuthContext.tsx/WatchPage.tsx — not mine, don't "fix" them (AuthContext is do-not-touch).
  - WatchPage keeps deliberate `text-white` on the video-overlay top bar (over video imagery, not the canvas); hovers there go gold-soft.
  - Cairo date format: `toLocaleDateString('en-GB', { timeZone:'Africa/Cairo', weekday:'short', day:'numeric', month:'short', year:'numeric' })` → "Sat, 12 Sep 2026".
