## MODIFIED Requirements

### Requirement: Futuristic WCAG 2.2 AA-compliant UI theme
The frontend SHALL implement a futuristic dark-mode UI theme that meets WCAG 2.2 Level AA accessibility standards.
The app shell (header and footer) SHALL use a semi-transparent glassmorphism style with `backdrop-filter: blur(12px)` and cyan accent borders.
The app logo SHALL have a pulsing `text-shadow` glow animation (2s infinite).
Navigation links SHALL transition to cyan with a glow effect on hover.

#### Scenario: Colour contrast for body text
- **WHEN** the application is rendered
- **THEN** all body text achieves a contrast ratio of at least 4.5:1 against its background

#### Scenario: Colour contrast for large text and UI components
- **WHEN** the application is rendered
- **THEN** large text (≥ 18pt normal or ≥ 14pt bold) and UI component boundaries achieve a contrast ratio of at least 3:1

#### Scenario: Keyboard navigation
- **WHEN** a user navigates using only the keyboard (Tab / Shift+Tab / Enter / Space)
- **THEN** all interactive elements receive a visible focus indicator and are reachable in logical order

#### Scenario: Screen reader landmark structure
- **WHEN** a screen reader traverses the page
- **THEN** the page contains at minimum a `<header>`, `<main>`, and `<footer>` landmark, and the document `<title>` is set to "J.A.R.V.I.S"

#### Scenario: App header glass effect
- **WHEN** the application renders on any page
- **THEN** the header has `backdrop-filter: blur(12px)`, a bottom border of `1px solid rgba(0, 212, 255, 0.2)`, and a semi-transparent background

#### Scenario: Logo glow animation
- **WHEN** the application renders
- **THEN** the J.A.R.V.I.S logo text has a pulsing cyan `text-shadow` animation cycling at 2s

## ADDED Requirements

### Requirement: Dashboard uses brain-centric HUD layout
The Dashboard page SHALL place the Brain animation at the center of the viewport and allow orbital metric blocks around it. See `dashboard-hud-layout` capability spec for full requirements.

#### Scenario: Brain is central element on Dashboard
- **WHEN** the user opens the Dashboard (`/`) on a viewport ≥ 1024px
- **THEN** the Brain SVG is the most prominent visual element, centered in the page

### Requirement: ParticlesBackground is always visible
The application SHALL render a floating particles background at `z-index: -1` on all pages. See `particles-background` capability spec for full requirements.

#### Scenario: Particles visible on all routes
- **WHEN** the user navigates to any route in the application
- **THEN** dim cyan particles are drifting slowly in the background
