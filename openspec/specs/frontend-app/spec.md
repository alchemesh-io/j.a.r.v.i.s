# Spec: frontend-app

## Purpose

Defines the requirements for the Vite.js/React frontend application, including its UI theme, accessibility compliance, and Docker packaging.

## Requirements

### Requirement: Vite.js frontend application skeleton
The system SHALL provide a Vite.js frontend application in the `frontend/` directory, implemented as a React single-page application. No `base` path prefix is needed — the frontend is served at the root of its hostname (`main.jarvis.io`). The API client base URL SHALL be `/api/v1`. The Vite dev proxy SHALL forward `/api`, `/docs`, and `/openapi.json` to the backend.

#### Scenario: Development server starts
- **WHEN** developer runs `npm run dev` inside `frontend/`
- **THEN** the Vite development server starts on port 5173 and the application is accessible in a browser

#### Scenario: Production build succeeds
- **WHEN** `npm run build` is executed inside `frontend/`
- **THEN** a production bundle is emitted to `frontend/dist/` with standard asset paths (no prefix)

#### Scenario: Application routes use root paths
- **WHEN** the frontend is accessed via `main.jarvis.io`
- **THEN** client-side routes are at the root (e.g., `/`, `/tasks`) — host-based routing eliminates the need for path prefixes

#### Scenario: API calls use standard paths
- **WHEN** the frontend makes API requests to the backend
- **THEN** requests are sent to `/api/v1/*` on the same hostname

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

### Requirement: Frontend Docker image
The frontend SHALL be packaged as a Docker image that serves the production build via Nginx.

#### Scenario: Image builds successfully
- **WHEN** `docker build -t jarvis-frontend ./frontend` is executed
- **THEN** the build completes without error and produces a runnable image

#### Scenario: Application served correctly
- **WHEN** the frontend container starts and port 80 is accessed
- **THEN** the React application HTML is returned with HTTP 200

#### Scenario: SPA routing supported
- **WHEN** a request is made to any path other than a static file (e.g., `/dashboard`)
- **THEN** Nginx returns `index.html` so the React router can handle the route client-side
