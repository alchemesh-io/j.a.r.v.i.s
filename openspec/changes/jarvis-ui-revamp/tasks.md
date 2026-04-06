## 1. Design System Tokens & Theme

- [x] 1.1 Add `--jads-glass-bg`, `--jads-glass-blur`, `--jads-glow-cyan-border` tokens to `frontend/packages/jads/src/theme.css`
- [x] 1.2 Verify all existing `--jads-*` tokens remain unchanged (no regressions on Vitest snapshots)

## 2. J.A.D.S Component CSS Upgrades

- [x] 2.1 **Card** — Add `::before` top-left L-bracket (12×12px, cyan), hover border glow + `box-shadow` in `Card.css`
- [x] 2.2 **Button primary** — Add `::after` scanner-line `@keyframes` (sweep top→bottom on hover) in `Button.css`
- [x] 2.3 **Button secondary/ghost** — Add `border-style: dashed` + glow pulse on hover in `Button.css`
- [x] 2.4 **Input** — Change to bottom-border-only style; add cyan underline + `box-shadow` on `:focus` in `Input.css`
- [x] 2.5 **Select** — Match Input HUD underline treatment in `Select.css`
- [x] 2.6 **IconButton** — Add circular `box-shadow` glow + cyan `border-radius: 50%` border on hover in `IconButton.css`
- [x] 2.7 **TaskCard** — Add `border-left: 3px solid` (per type color), pulsing opacity keyframe (0.7→1 at 2s) in `TaskCard.css`
- [x] 2.8 **Calendar** — Add pulsing cyan `outline` + `box-shadow` keyframe on `.jads-calendar__day--today` in `Calendar.css`
- [x] 2.9 Run `npm test` in `frontend/packages/jads/` — all Vitest tests must pass

## 3. App Shell (header/footer/logo)

- [x] 3.1 Update `.app-header` in `App.css`: `backdrop-filter: blur(12px)`, semi-transparent bg `rgba(11,14,26,0.85)`, bottom border cyan
- [x] 3.2 Add pulsing `text-shadow` `@keyframes` to `.app-header .logo` (2s infinite, cyan glow)
- [x] 3.3 Update `.app-header nav a:hover`: cyan color + `text-shadow` glow
- [x] 3.4 Update `.app-footer` in `App.css`: same glass bg as header, top border `1px solid rgba(0,212,255,0.1)`
- [x] 3.5 Add `@supports (backdrop-filter: blur(1px))` fallback for browsers without blur support

## 4. ParticlesBackground Component

- [x] 4.1 Create `frontend/src/components/ParticlesBackground.tsx` — canvas fixed fullscreen at `z-index: -1`, `pointer-events: none`
- [x] 4.2 Implement 60–80 particles (radius 1–2px, `rgba(0,212,255,0.25)`, vx/vy ≤ 0.3) with toroidal wrapping
- [x] 4.3 Handle `window.resize`: update canvas `width`/`height` to `window.innerWidth` / `window.innerHeight`
- [x] 4.4 Clean up `cancelAnimationFrame` and `removeEventListener('resize')` on unmount
- [x] 4.5 Mount `<ParticlesBackground />` in `App.tsx` outside the router, before `<div className="app">`
- [x] 4.6 Verify particles are visible on `/` and `/tasks` without blocking UI interactions

## 5. Brain Animation — Full Replacement

- [x] 5.1 Delete content of `BrainAnimation.tsx` and `BrainAnimation.css`; replace with SVG-based implementation
- [x] 5.2 Define `@keyframes rotate-cw` and `@keyframes rotate-ccw` in `BrainAnimation.css`
- [x] 5.3 Implement Ring 1 (r=18%): static, full-opacity `circle` stroke, inner glow gradient background (`radial-gradient`)
- [x] 5.4 Implement Ring 2 (r=28%): CW 0.8rpm, segmented arc dashes (`stroke-dasharray`)
- [x] 5.5 Implement Ring 3 (r=38%): CCW 0.5rpm, 24 tick marks every 15° using `<line>` elements rotated in a `<g>` transform
- [x] 5.6 Implement Ring 4 (r=48%): CW 0.3rpm, sparse dashes + 4 `<rect>` notches at 0°/90°/180°/270°
- [x] 5.7 Implement Ring 5 (r=58%): CCW 0.15rpm, dotted arc + 12 `<rect>` squares at 30° intervals
- [x] 5.8 Replace clock with inner canvas overlay: 45 random-walk particles constrained inside Ring 1 radius with circular boundary repulsion
- [x] 5.9 Apply `filter: drop-shadow(0 0 6px rgba(0,212,255,0.7))` to SVG root
- [x] 5.10 Add `role="img"` and `aria-label` to the SVG element
- [x] 5.11 Set container: `width: min(60vmin, 520px)`, `height: min(60vmin, 520px)` in `BrainAnimation.css`
- [x] 5.12 Add Konami code easter egg (`↑↑↓↓←→←→BA`) in `Dashboard.tsx`: `konamiMode` state toggled via `keydown` listener, passed as prop to `BrainAnimation`
- [x] 5.13 Heart mode SVG: replace all rings with `heartPath()` shapes (4-bezier, taller than wide `w=s*0.68`); central heart (size 32) + 32 seeded-random outer hearts scattered between R2–R5
- [x] 5.14 Firefly hearts: 10 `FlyHeart` objects animated on canvas with random-walk (perturbation 0.07/frame, max speed 1.4, boundary repulsion 0.5) bounded between Ring1–Ring2
- [x] 5.15 Heart mode glow: `@keyframes heart-pulse` on `.brain-animation--konami` SVG (`drop-shadow` pink, 1.5s); `@keyframes heart-beat` on `.brain-heart--center` (scale pulse, 1.2s)

## 6. Dashboard HUD Layout

- [x] 6.1 Replace `.dashboard__grid` with `.dashboard__hud` container in `Dashboard.css`: full-width, `height: min(calc(100dvh - 120px), 640px)`, relative positioning
- [x] 6.2 Update `Dashboard.tsx`: Brain absolutely centered (`top:50%; left:50%; translate(-50%,-50%)`), orbital blocks as absolute divs at edges
- [x] 6.3 Orbital blocks: Workers `top:20px; left:50%; width:380px`, Daily `top:50%; left:0; width:380px`, Weekly `top:50%; right:0; width:380px`
- [x] 6.4 Orbital block visibility: nameplate (title only) by default; body hidden (`max-height:0; opacity:0`); expand on brain hover OR block self-hover via CSS `:hover`; all 3 scans synchronized (`animation-delay: 0s`)
- [x] 6.5 Add mobile media query `@media (max-width: 1023px)`: collapse to single column, blocks always visible
- [x] 6.6 Fix double border: `.dashboard__card-wrapper .jads-card { border: none; background: transparent }`
- [x] 6.7 Remove `clip-path` that caused asymmetric corner cuts; use plain `border-radius: 4px`

## 7. MetricBlock HUD Style

- [x] 7.1 Update `.dashboard__card-wrapper`: glass bg `var(--jads-glass-bg)`, `backdrop-filter: var(--jads-glass-blur)`, border `1px solid var(--jads-glow-cyan-border)`, `border-radius: 4px`
- [x] 7.2 Add `border-top-color: rgba(0,212,255,0.6)` as 1px top accent line
- [x] 7.3 Update metric count typography: `font-size: 2rem`, `font-weight: 700`, `font-variant-numeric: tabular-nums`
- [x] 7.4 Update metric label typography: `font-size: 0.65rem`, `text-transform: uppercase`, `letter-spacing: 0.1em`
- [x] 7.5 Add hover state on `.dashboard__card-wrapper:hover`: `border-color: rgba(0,212,255,0.6)`, `box-shadow: 0 0 20px rgba(0,212,255,0.2)`
- [x] 7.6 Add `cursor: grab` on `.dashboard__card-wrapper`; `cursor: grabbing` on `.dashboard__hud[data-dragging]`
- [x] 7.7 Freeze hover-expand effects during drag: `data-dragging` attr on `.dashboard__hud` resets scale/body/glow for `:hover` state

## 8. Dashboard Controls (Compact Toggle & Chat)

- [x] 8.1 Move Compact toggle out of absolute HUD into a dedicated sticky `.dashboard__topbar` row pinned below app header
- [x] 8.2 Style `.dashboard__topbar`: `position: sticky; top: 0; background: rgba(11,14,26,0.9); backdrop-filter: blur(14px); border-bottom: 1px solid rgba(0,212,255,0.12)`
- [x] 8.3 Restyle Compact toggle as HUD pill button (dark glass, cyan border, inactive=muted, active=cyan glow) — same style as TaskBoard HUD toggles
- [x] 8.4 Style chat bar: `border-radius: 24px` pill, speech-bubble SVG icon on left, `max-width: 720px` centered

## 9. TaskBoard UI Revamp

- [x] 9.1 Replace native `<select>` scope dropdown with HUD tab group (DAY / WEEK / ALL buttons) in `TaskBoard.tsx`
- [x] 9.2 Move calendar out of sidebar into a floating dropdown triggered by a date button in the toolbar
- [x] 9.3 Date button shows formatted date with calendar icon and chevron; closes on outside click via `useRef` + `useEffect`
- [x] 9.4 Make toolbar sticky: `position: sticky; top: 0; background: rgba(11,14,26,0.9); backdrop-filter: blur(14px); border-bottom cyan`
- [x] 9.5 Restyle `+ Create` as ghost HUD button (transparent bg, cyan border, uppercase)
- [x] 9.6 Replace iOS pill Done toggle with HUD text button (same style as scope tabs)
- [x] 9.7 Remove sidebar layout; TaskBoard is now single-column grid (`grid-template-columns: 1fr`)
- [x] 9.8 Create `EmptyState` component (`EmptyState.tsx` + `EmptyState.css`) with radar-sweep SVG, scope-aware title/subtitle, fade-in animation

## 10. Verification & Cleanup

- [x] 10.1 Run `npm test` in `frontend/packages/jads/` — all Vitest tests pass
- [x] 10.2 Run `npm run build` in `frontend/` — production build completes without errors
- [x] 10.3 Manual visual check: Brain rings rotating, inner particles animating, orbital blocks on hover, particles background visible
- [x] 10.4 Manual check Tasks page: sticky toolbar, calendar dropdown, HUD scope tabs, empty state radar component
