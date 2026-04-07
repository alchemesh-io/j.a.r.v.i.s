# Spec: particles-background

## Purpose

Defines the requirements for the global floating particles background canvas rendered on all pages of the J.A.R.V.I.S application.

## Requirements

### Requirement: A global floating particles background is rendered on all pages
The application SHALL render a `ParticlesBackground` canvas component in `App.tsx` (outside the router), fixed to the viewport at `z-index: -1`, visible on all routes.

#### Scenario: Particles visible on Dashboard
- **WHEN** the user navigates to `/`
- **THEN** small dim cyan particles are visible drifting slowly across the background

#### Scenario: Particles visible on TaskBoard
- **WHEN** the user navigates to `/tasks`
- **THEN** the same floating particles are visible behind the TaskBoard content

#### Scenario: Particles persist across navigation
- **WHEN** the user navigates between `/` and `/tasks`
- **THEN** the particles canvas continues without restarting (single mounted instance)

### Requirement: Particles do not interfere with UI interactions
The particles canvas SHALL have `pointer-events: none` so it never captures mouse or touch events.

#### Scenario: Click-through on canvas
- **WHEN** the user clicks any interactive element above the particles canvas
- **THEN** the click event reaches the intended element and the canvas does not intercept it

### Requirement: Particles loop toroidally across viewport edges
Each particle SHALL wrap around to the opposite edge when it exits the viewport, creating continuous toroidal motion.

#### Scenario: Particle wrapping
- **WHEN** a particle reaches the right edge of the canvas
- **THEN** it reappears at the left edge at the same vertical position without a visible jump

### Requirement: Particles adapt to window resize
The particles canvas SHALL fill 100% of the viewport at all times. On window resize, the canvas dimensions SHALL update.

#### Scenario: Canvas resizes with window
- **WHEN** the user resizes the browser window
- **THEN** the canvas width and height update to match the new `window.innerWidth` and `window.innerHeight`

### Requirement: Particle animation is cleaned up on unmount
The `requestAnimationFrame` loop and `resize` event listener SHALL be cancelled/removed when `ParticlesBackground` unmounts.

#### Scenario: No memory leak after unmount
- **WHEN** the application unmounts `ParticlesBackground` (e.g., during hot reload)
- **THEN** no active animation frame or event listener remains from the previous instance
