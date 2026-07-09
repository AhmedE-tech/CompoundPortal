# OpenCode Fix — Center everything horizontally (portal layout, take 2)

**Repo:** enaya-compound-portal
**Scope:** Dashboard page centering — previous fix left everything huddled in the top-left corner.

---

## What's broken right now

Looking at the current dashboard:
- Header content is anchored to the LEFT edge instead of centered
- Top strip content is anchored to the LEFT edge instead of centered
- Empty state card is stuck in the top-left corner, not centered on the page

The `mx-auto` (horizontal centering) got lost somewhere.

## Concrete fixes

Do these three things exactly. Do not "improve" or restructure other layout.

### Fix 1: Header content must be centered horizontally within its full-width background

Find the header. The outer element should keep `w-full` (so the border-bottom spans edge to edge). The **inner content** must be inside a container that is centered:

```jsx
<header className="w-full border-b border-[--slate-line]">
  <div className="max-w-[1280px] mx-auto px-8 py-4 flex justify-between items-center">
    {/* Enaya + Maadi + code on left, time + Logout on right */}
  </div>
</header>
```

Critical: `mx-auto` on the inner div. Without it, content will stick to the left.

### Fix 2: Top strip content must be centered horizontally within its tinted background

Same pattern:

```jsx
<div className="w-full bg-[#F0EAD6]">
  <div className="max-w-[1280px] mx-auto px-8 h-10 flex justify-between items-center">
    {/* 0 sessions in progress on left, today's completed on right */}
  </div>
</div>
```

Critical: the `w-full bg-...` wraps the `max-w-[1280px] mx-auto` inner. The background stretches full-width, the content centers.

### Fix 3: Empty state must be centered BOTH horizontally AND vertically in the main area

Currently the card is in the top-left. It needs to be centered in the remaining page space below the strip.

```jsx
<main className="w-full min-h-[calc(100vh-140px)] flex items-center justify-center px-8">
  <div className="max-w-md w-full border border-[--slate-line] p-16 text-center">
    <div className="text-8xl font-mono text-[--slate-line]">0</div>
    <div className="text-sm text-[--slate-muted] mt-4">no sessions in progress right now</div>
    <div className="text-xs text-[--slate-muted] mt-8 tracking-wider uppercase">the page will refresh automatically</div>
  </div>
</main>
```

Critical parts:
- `flex items-center justify-center` on the main → centers the card BOTH horizontally and vertically
- `min-h-[calc(100vh-140px)]` → uses remaining viewport height so the card actually gets vertical space to center in (140px is approximate header + strip height, adjust if yours is different)
- `max-w-md` on the card → keeps the card modest, not stretched
- `w-full` on the card → fills the max-w-md, doesn't collapse to content width

### Fix 4: Tile grid layout for when there ARE sessions

When there are live sessions, the tile grid also needs to be centered in a constrained container:

```jsx
<main className="max-w-[1280px] mx-auto px-8 py-12 w-full">
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {/* tiles */}
  </div>
</main>
```

Same principle: `mx-auto` on the container.

---

## Verification (check these visually after the fix)

- [ ] On a 1920px wide monitor, the Enaya wordmark should sit at approximately x=320 (not x=0)
- [ ] The Logout button should sit at approximately x=1600 (not x=1900)
- [ ] The tinted top strip content follows the same alignment
- [ ] The empty-state card sits dead center of the viewport horizontally
- [ ] The empty-state card sits roughly in the vertical middle of the space below the top strip (not glued to the top)
- [ ] Resizing the browser window down to 1280px shows the content flush with the edges (with px-8 padding)
- [ ] Resizing below 768px shows content with px-4 padding, and the tile grid becomes 1 column

---

## Do not

- Do not remove the constraint on the header — the previous fix that grouped header content was correct, it just wasn't centered
- Do not change the tinted background on the top strip
- Do not remove the hairline border on the empty-state card
- Do not add shadows, rounded corners, or decorative elements
- Do not reduce the max-width below 1280px

The goal is simple: everything that was left-hugging becomes centered. Nothing else changes.
