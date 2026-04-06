## Why

The current J.A.R.V.I.S dashboard presents a generic dark-theme UI: a flat metric grid above a minimal particle-network canvas. This doesn't reflect the Iron Man JARVIS brand identity. A full visual revamp is needed to establish a coherent holographic HUD aesthetic — concentric rotating ring animation as the dominant center element, metric blocks in an orbital layout, and a polished futuristic treatment across the entire app and design system.

## What Changes

- **Replace** `BrainAnimation` canvas (scatter nodes) with a pure SVG/CSS concentric ring HUD identical to the Iron Man JARVIS reference GIF (5 rings, differential rotation, live clock center)
- **Invert Dashboard layout**: Brain becomes the central viewport element; 3 metric blocks are placed in orbital positions (12h, 8h, 4h) at 8% default opacity, appearing at full opacity on hover of the HUD area
- **Add** a global `ParticlesBackground` canvas fixed to the viewport, rendering faint drifting particles behind all content on every page
- **Update** `App.css` — header and footer become semi-transparent glassmorphism panels with cyan glow accents
- **Upgrade all 7 J.A.D.S components** with HUD-style visual treatments: Card corner brackets, Button scanner-line animations, Input/Select HUD underline style, IconButton radial glow, TaskCard pulsing type-color accent bar, Calendar today-cell pulse
- **Update MetricBlock** to use a HUD panel aesthetic: clipped corners, glass background, monospace metrics

## Capabilities

### New Capabilities
- `brain-animation`: Concentric rotating ring SVG/CSS animation component with live digital clock center; replaces the existing canvas-based BrainAnimation
- `dashboard-hud-layout`: Orbital layout system for the Dashboard — Brain central at 60vmin, 3 metric blocks at orbital positions with hover fade-in/fade-out behavior
- `particles-background`: Global floating particles canvas rendered in App.tsx, fixed viewport background, wrapping toroidal motion

### Modified Capabilities
- `design-system`: All 7 J.A.D.S components updated with HUD visual treatments (glow, glass effects, animated accents) — requirements for component hover states and focus indicators are extended
- `frontend-app`: Dashboard layout requirements change fundamentally (brain-centric, orbital blocks); app shell (header/footer) gains glassmorphism requirement

## Impact

**Files changed:**
- `frontend/src/pages/Dashboard/BrainAnimation.tsx` — full replacement
- `frontend/src/pages/Dashboard/BrainAnimation.css` — full replacement
- `frontend/src/pages/Dashboard/Dashboard.tsx` — layout restructure, new orbital grid
- `frontend/src/pages/Dashboard/Dashboard.css` — new HUD grid, orbital block styles
- `frontend/src/App.tsx` — add `<ParticlesBackground />`
- `frontend/src/App.css` — glass header/footer, logo glow
- `frontend/packages/jads/src/components/*/` — CSS updates for all 7 components
- `frontend/packages/jads/src/theme.css` — add new tokens if needed (glass properties)

**Dependencies added:** none (no Sass, no new npm packages)

**No breaking changes to APIs, routing, or data model.**
