## Context

The J.A.R.V.I.S frontend (`frontend/`) is a Vite 7 + React 19 + TypeScript 5.9 SPA. The design system (`frontend/packages/jads/`) is an npm workspace package exporting 7 components. All styling is plain CSS with custom properties; no CSS preprocessor is in use.

**Current Dashboard state:**
1. `BrainAnimation.tsx` — Canvas 2D, 200 px tall band, renders moving scatter nodes and connecting lines
2. `Dashboard.tsx` — 3-column grid of MetricBlocks at the top, BrainAnimation below, disabled chat input at the bottom
3. No global background effect; header/footer are flat dark panels

**Constraints:**
- No new npm runtime dependencies
- No Sass / CSS preprocessor
- WCAG 2.2 AA compliance must be preserved
- Existing Vitest and Playwright tests must still pass

## Goals / Non-Goals

**Goals:**
- Replace `BrainAnimation` with an all-SVG + CSS `@keyframes` ring component
- Ship a `ParticlesBackground` canvas that persists across all routes
- Invert the Dashboard layout to brain-centric HUD with orbital metric blocks
- Apply glassmorphism + glow treatments to the App shell and all 7 J.A.D.S components

**Non-Goals:**
- Animated route transitions
- Real-time worker data from an API (mock data stays mock)
- Canvas-based background effects for J.A.D.S Storybook (Storybook gets a plain dark bg)
- Mobile layouts below 375px (min supported width is 375px)
- Any backend or infrastructure change

## Decisions

### Decision 1 — SVG + CSS for Brain rings (not Canvas 2D)

**Choice:** Pure SVG elements with CSS `@keyframes` rotation, rendered as a React functional component.

**Rationale:**
- CSS `transform-origin` + `animation` on `<g>` SVG groups produces hardware-accelerated ring rotation with zero JavaScript per-frame logic
- SVG scales crisply to any `vmin` size (retina-ready without devicePixelRatio math)
- `filter: drop-shadow(...)` on the SVG root produces the holographic cyan glow natively
- Accessibility: SVG text elements for the clock are part of the accessibility tree; a hidden `<time>` element also exposes the time to screen readers

**Alternative considered:** Canvas 2D (current approach)
- Requires computing ring arcs manually each frame
- Doesn't benefit from GPU compositing for rotation
- Canvas content is opaque to screen readers
- Rejected because SVG offers identical visual output with better performance and accessibility

**Alternative considered:** CSS-only `border` rings (div + border-radius)
- Cannot produce segmented arcs, tick marks, or decorative notches without complex hacks
- Rejected in favour of SVG

---

### Decision 2 — Orbital layout via CSS Grid (not absolute positioning)

**Choice:** A CSS Grid cell layout for the HUD area:
```
grid-template-areas: ". workers ." / "daily brain weekly"
grid-template-columns: 240px min(60vmin, 500px) 240px
```

**Rationale:**
- Grid ensures the brain cell is exactly centred without JavaScript measurement
- Orbital blocks are in normal document flow → DnD (`@dnd-kit`) works without any coordinate hacks
- Responsive: at `< 1024px`, grid collapses to a single-column stack via a media query
- The hover state for orbital block visibility is managed on the `.dashboard__hud` parent, covering the entire grid area

**Alternative considered:** `position: absolute` for orbital blocks
- Would position blocks visually around the circle but takes blocks out of flow
- `@dnd-kit` `useSortable` relies on DOM layout feedback; absolute elements behave unexpectedly
- Rejected

---

### Decision 3 — Hover transition with `transition-delay` for fade-out

**Challenge:** Blocks must be reachable after triggering their visibility from the brain hover. Moving the cursor from the brain to a block causes a brief "exit" from the brain's hover zone before entering the block's zone.

**Choice:** Set `transition-delay: 1.2s` on the opacity **out** transition only:
```css
/* default state - delayed fade-out */
.dashboard__orbital-block {
  opacity: 0.08;
  transform: scale(0.95);
  transition: opacity 0.4s ease 1.2s, transform 0.4s ease 1.2s;
}
/* hovered parent - no delay on fade-in */
.dashboard__hud:hover .dashboard__orbital-block {
  opacity: 1;
  transform: scale(1);
  transition: opacity 0.4s ease 0s, transform 0.4s ease 0s;
}
```

The 1.2s delay on fade-out gives the user enough time to physically move the cursor to any block. Blocks themselves are also hover targets within `.dashboard__hud`, so they reset the delay.

**Alternative considered:** JavaScript `onMouseLeave` with `setTimeout`
- More explicit but adds JS complexity and potential race conditions with DnD
- Rejected for the pure-CSS solution

---

### Decision 4 — `ParticlesBackground` as a single global canvas

**Choice:** Mount a `<ParticlesBackground />` component in `App.tsx` (outside the router), rendered as `position: fixed; inset: 0; z-index: -1`. It draws 60-80 slow-drifting particles using `requestAnimationFrame`.

**Rationale:**
- Single canvas instance shared across all routes — no particle reset on navigation
- `z-index: -1` ensures it never captures pointer events
- Cleanup on unmount avoids memory leaks during hot reload

**Alternative considered:** CSS `radial-gradient` + `animation` pseudo-elements
- Fixed, non-random pattern; doesn't achieve the drifting organic feel
- Rejected

---

### Decision 5 — J.A.D.S component upgrades via CSS only

**Choice:** Modify only the `.css` files of each component (no TSX changes except `theme.css` token additions). No new CSS custom properties are added to individual component files — only to `theme.css`.

**Rationale:**
- Preserves component API and test snapshots
- Storybook stories require no new props
- Tokens stay centralised in `theme.css`

**New tokens added to `theme.css`:**
```css
--jads-glass-bg: rgba(11, 14, 26, 0.75);
--jads-glass-blur: blur(8px);
--jads-glow-cyan-border: rgba(0, 212, 255, 0.25);
```

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| `backdrop-filter: blur()` not supported on Firefox ESR < 103 | Feature is progressive enhancement; fallback to `background: rgba(11,14,26,0.92)` via `@supports` |
| SVG `filter: drop-shadow` is expensive on very large viewports (> 1000px) | Limit SVG container to `max(60vmin, 500px)`; use `will-change: transform` on animated `<g>` elements |
| `transition-delay` of 1.2s on fade-out may feel sluggish on fast interactions | Value configurable via CSS custom property `--hud-fadeout-delay: 1.2s` for future tuning |
| Canvas particles competing with Brain SVG glow on low-end hardware | Particles use `opacity: 0.25`, very small radius — negligible GPU cost; reduce particle count from 80 → 60 if needed |
| DnD within an orbital grid (non-linear layout) may confuse drag preview positioning | Test with @dnd-kit `DragOverlay` component to give a floating preview during drag |

## Migration Plan

1. `ParticlesBackground` component added to `App.tsx` — no rollback needed (just remove the JSX import)
2. `BrainAnimation` replaced in-place — no other components consume it
3. Dashboard layout: `dashboard__grid` → `dashboard__hud` class rename — if rollback needed, revert the two CSS/TSX files
4. J.A.D.S CSS updates are purely additive (new hover states, new pseudo-elements) — no visual regression on existing content outside hover interactions
5. No database, API, or infra changes → zero migration risk for production deployment

## Open Questions

- **Font for clock center:** Should the clock use `'Inter'` (matches body) or a monospace like `'Courier New'`? → Prefer `Inter` with `font-variant-numeric: tabular-nums` so digit widths don't shift.
- **Workers block data:** The `mockWorkerMetrics` is hardcoded. Should this task include a note to connect to a real API endpoint (e.g., a future "agents" endpoint)? → Out of scope — keep mock; but add a `TODO` comment in the component.
- **Calendar component pulse on today:** The Calendar is only visible on TaskBoard. Should its animation be conditional on being the "active" view? → Yes — the CSS `:where(.jads-calendar__day--today)` selector handles it globally, which is acceptable.
