## ADDED Requirements

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

#### Scenario: Theme applied via CSS variables
- **WHEN** J.A.D.S components are rendered
- **THEN** all colors, fonts, and spacing derive from CSS custom properties

### Requirement: Playwright E2E testing setup
The frontend SHALL include a Playwright configuration for end-to-end tests under `frontend/e2e/`.

#### Scenario: E2E test runs against local deployment
- **WHEN** `npx playwright test` is executed with the frontend and backend running
- **THEN** E2E tests execute in a browser and validate user flows
