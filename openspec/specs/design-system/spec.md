# Spec: design-system

## Purpose

Defines the requirements for J.A.D.S (Just A Design System), the shared component library powering the J.A.R.V.I.S frontend, including its packaging, theming, testing, accessibility, and documentation.

## Requirements

### Requirement: J.A.D.S packaged as npm workspace library
J.A.D.S (Just A Design System) SHALL be an independent npm package under `frontend/packages/jads/`, importable by the main app as `@jarvis/jads`.

#### Scenario: App imports J.A.D.S component
- **WHEN** the main app imports `import { Button } from '@jarvis/jads'`
- **THEN** the component is resolved via npm workspace linking and renders correctly

### Requirement: Storybook 10.3 documentation
J.A.D.S SHALL include a Storybook 10.3 setup that documents all components with usage examples.

#### Scenario: Storybook launches successfully
- **WHEN** `npm run storybook` is executed in the J.A.D.S package
- **THEN** Storybook starts and displays all documented components

#### Scenario: Each component has a story
- **WHEN** a new component is added to J.A.D.S
- **THEN** it SHALL have at least one Storybook story demonstrating its usage

### Requirement: Vitest 4.1.2 test coverage for components
Every J.A.D.S component SHALL have Vitest unit tests covering its usage patterns.

#### Scenario: Component tests pass
- **WHEN** `npm run test` is executed in the J.A.D.S package
- **THEN** all component tests pass

### Requirement: Responsive design
All J.A.D.S components SHALL be responsive and adapt to different screen sizes.

#### Scenario: Component renders on mobile viewport
- **WHEN** a J.A.D.S component is rendered at 375px width
- **THEN** the component adapts its layout without overflow or broken UI

### Requirement: WCAG accessibility compliance
All J.A.D.S components SHALL follow WCAG guidelines: keyboard-accessible interactive elements, visible focus indicators, proper ARIA attributes, sufficient color contrast.

#### Scenario: Interactive element keyboard accessible
- **WHEN** a user navigates to an interactive J.A.D.S component using Tab
- **THEN** the element receives visible focus and is operable via keyboard

#### Scenario: Color contrast meets WCAG AA
- **WHEN** J.A.D.S text components are rendered
- **THEN** text-to-background color contrast ratio meets WCAG AA minimum (4.5:1 for normal text)

### Requirement: Dark futuristic theme
J.A.D.S SHALL implement a dark futuristic theme inspired by the J.A.R.V.I.S aesthetic (holographic blues, dark backgrounds, glowing accents). The theme SHALL use CSS custom properties defined in a central file.
Three glass design tokens SHALL be defined in `theme.css`:
- `--jads-glass-bg`: `rgba(11, 14, 26, 0.75)`
- `--jads-glass-blur`: `blur(8px)`
- `--jads-glow-cyan-border`: `rgba(0, 212, 255, 0.25)`

#### Scenario: Theme applied via CSS variables
- **WHEN** J.A.D.S components are rendered
- **THEN** all colors, fonts, and spacing derive from CSS custom properties

#### Scenario: New glass tokens available
- **WHEN** any J.A.D.S component references `var(--jads-glass-bg)`
- **THEN** the correct semi-transparent dark value is applied

### Requirement: Card component has a HUD corner bracket accent
The Card component SHALL display a 12×12px cyan L-bracket pseudo-element (`::before`) in the top-left corner, and apply a cyan border glow on hover.

#### Scenario: Corner bracket visible
- **WHEN** a Card is rendered
- **THEN** a small cyan L-shaped corner accent is visible at the top-left of the card

#### Scenario: Card hover glow
- **WHEN** the user hovers a Card
- **THEN** `border-color` transitions to `rgba(0, 212, 255, 0.5)` and `box-shadow` shows `0 0 16px rgba(0, 212, 255, 0.15)`

### Requirement: Button primary has a scanner-line hover animation
The primary Button SHALL display a thin cyan horizontal line sweeping from top to bottom on hover, using a `::after` pseudo-element and `@keyframes`.

#### Scenario: Scanner line on hover
- **WHEN** the user hovers a primary Button
- **THEN** a thin translucent cyan line animates from the top edge to the bottom edge once

### Requirement: Button secondary has a dashed border on hover
The secondary/ghost Button SHALL change to a `border-style: dashed` with a cyan glow pulse on hover.

#### Scenario: Dashed border visible on hover
- **WHEN** the user hovers a secondary Button
- **THEN** the border becomes dashed cyan with a glow pulse animation

### Requirement: Input has a HUD underline focus style
The Input component SHALL use a bottom-border-only style. On focus, the bottom border SHALL become cyan with a glow shadow beneath the field.

#### Scenario: HUD underline on focus
- **WHEN** the user focuses an Input
- **THEN** only the bottom border is highlighted in `var(--jads-color-accent-cyan)` with `box-shadow: 0 4px 12px rgba(0, 212, 255, 0.2)`

### Requirement: Select has a HUD underline style matching Input
The Select component SHALL match the Input HUD underline treatment.

#### Scenario: Select focus matches Input focus
- **WHEN** the user focuses a Select
- **THEN** the visual treatment is identical to the focused Input

### Requirement: IconButton has a radial glow on hover
The IconButton component SHALL display a circular `box-shadow` glow and a cyan border circle on hover.

#### Scenario: Radial glow on IconButton hover
- **WHEN** the user hovers an IconButton
- **THEN** a circular cyan `box-shadow` glow appears and the component border becomes a full cyan circle

### Requirement: TaskCard has a pulsing type-color left accent bar
The TaskCard component SHALL display a `border-left: 3px solid` accent in the task type color, with a subtle opacity pulse animation (0.7 → 1 at 2s infinite).

#### Scenario: Left accent bar present
- **WHEN** a TaskCard is rendered
- **THEN** a colored left border matching the task type color is visible

#### Scenario: Accent bar pulses
- **WHEN** a TaskCard is rendered and at rest
- **THEN** the left border opacity oscillates between 0.7 and 1 every 2 seconds

### Requirement: Calendar today cell has a pulsing cyan outline
The Calendar component SHALL display a pulsing `outline` + `box-shadow` on the cell representing today's date.

#### Scenario: Today cell pulse effect
- **WHEN** the Calendar renders and today's date is visible in the grid
- **THEN** the today cell has a cyan outline with a keyframe-animated shadow pulse at 1.5s intervals

### Requirement: Playwright E2E testing setup
The frontend SHALL include a Playwright configuration for end-to-end tests under `frontend/e2e/`.

#### Scenario: E2E test runs against local deployment
- **WHEN** `npx playwright test` is executed with the frontend and backend running
- **THEN** E2E tests execute in a browser and validate user flows
