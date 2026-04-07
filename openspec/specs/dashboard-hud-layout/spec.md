# Spec: dashboard-hud-layout

## Purpose

Defines the requirements for the Dashboard HUD layout, including the brain-centric orbital positioning of metric blocks, hover-expand behavior, DnD reordering, sticky topbar, and chat input styling.

## Requirements

### Requirement: Dashboard uses a brain-centric orbital layout
The Dashboard page SHALL place the Brain animation at the center of a HUD container with three metric blocks in orbital positions using `position: absolute`: Workers at top-center, Daily Tasks at left-center, Weekly Tasks at right-center.

#### Scenario: Brain occupies center of HUD
- **WHEN** the Dashboard is rendered at viewport width ≥ 1024px
- **THEN** the Brain SVG component is absolutely centered (`top:50%; left:50%; transform: translate(-50%,-50%)`) in the HUD container

#### Scenario: Orbital blocks at correct positions
- **WHEN** the Dashboard is rendered at viewport width ≥ 1024px
- **THEN** the Workers block appears at `top:20px; left:50%; width:380px`, Daily Tasks at `top:50%; left:0; width:380px`, Weekly Tasks at `top:50%; right:0; width:380px`

#### Scenario: Responsive stack on mobile
- **WHEN** the Dashboard is rendered at viewport width < 1024px
- **THEN** sections stack vertically in order: Workers → Brain → Daily Tasks → Weekly Tasks

### Requirement: Orbital blocks are visible as nameplates and expand on brain hover
The 3 metric blocks SHALL always be visible as compact "nameplate" panels showing only their title. When the user hovers over the Brain animation, all blocks SHALL grow slightly (`scale(1.03)`) and their metric content SHALL expand into view. A cyan scan-line shimmer animation SHALL run on the nameplate when collapsed.

#### Scenario: Blocks visible as nameplates by default
- **WHEN** the Dashboard is rendered with no mouse interaction
- **THEN** all 3 metric blocks are visible with only the card title row; the metrics body is hidden (`max-height: 0; opacity: 0`)

#### Scenario: Scan shimmer on nameplate
- **WHEN** a block is in nameplate (collapsed) state
- **THEN** a horizontal cyan gradient line animates across the bottom of the card wrapper in a looping `nameplate-scan` keyframe animation

#### Scenario: Blocks expand on brain hover
- **WHEN** the user moves the cursor over the Brain animation (`.dashboard__hud-brain`)
- **THEN** all 3 metric blocks scale to `1.03`, their body expands to show metrics (`max-height: 140px; opacity: 1`), the header divider appears, and the border glows cyan

#### Scenario: Block expands on self-hover
- **WHEN** the user moves the cursor directly over a metric block
- **THEN** that block expands with the same scale + glow effect as the brain-hover state

#### Scenario: Scan shimmer synchronized
- **WHEN** multiple blocks are in nameplate state simultaneously
- **THEN** all 3 scan animations share `animation-delay: 0s` and run in perfect sync

#### Scenario: Scan shimmer hidden when expanded
- **WHEN** the blocks are in expanded state (brain hovered or block self-hovered)
- **THEN** the `::after` scan animation is hidden

#### Scenario: Blocks always expanded on mobile
- **WHEN** the Dashboard is rendered at viewport width < 1024px
- **THEN** all blocks are permanently expanded (no collapse, no scan animation)

### Requirement: DnD block reordering works in the orbital layout
The existing drag-and-drop reordering behaviour (using `@dnd-kit`) SHALL remain functional within the orbital layout. The cursor SHALL indicate drag affordance, and hover-expand effects SHALL be suppressed while dragging.

#### Scenario: User reorders orbital blocks
- **WHEN** the user drags a metric block from one orbital position to another
- **THEN** the block order updates and persists to `localStorage` under `jarvis-dashboard-layout`

#### Scenario: Non-dragged blocks do not shift
- **WHEN** a drag is in progress
- **THEN** non-dragged blocks remain at their absolute positions (no dnd-kit transform applied)

#### Scenario: Drag cursor feedback
- **WHEN** the user hovers a metric block
- **THEN** the cursor is `grab`; once dragging starts, the cursor becomes `grabbing` across the entire HUD

#### Scenario: Hover-expand suppressed during drag
- **WHEN** a drag is in progress (`data-dragging` attribute on `.dashboard__hud`)
- **THEN** block hover-expand (scale, body reveal, glow) is disabled for all blocks

### Requirement: Dashboard has a sticky topbar with the Compact toggle
A sticky topbar row SHALL appear above the HUD area, pinned below the app header. It SHALL contain the Compact toggle button aligned to the right.

#### Scenario: Topbar stays visible on scroll
- **WHEN** the user scrolls down on the Dashboard
- **THEN** the topbar with the Compact toggle remains stuck to the top of the viewport below the header

#### Scenario: Compact toggle styled as HUD button
- **WHEN** the Dashboard renders
- **THEN** the Compact toggle uses the same HUD pill style as the Tasks page controls (dark glass background, cyan border, uppercase text)

### Requirement: Chat input is styled as a pill with an icon
The chat input ('Ask J.A.R.V.I.S anything...') SHALL use a `border-radius: 24px` pill shape, include a speech-bubble icon on the left, and be centered with `max-width: 720px`.

#### Scenario: Chat input pill shape
- **WHEN** the Dashboard is rendered
- **THEN** the chat input has a fully rounded pill appearance

#### Scenario: Chat icon visible
- **WHEN** the Dashboard is rendered
- **THEN** a speech-bubble SVG icon is visible to the left of the placeholder text
