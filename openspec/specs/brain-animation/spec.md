# Spec: brain-animation

## Purpose

Defines the requirements for the Brain animation component displayed at the center of the Dashboard, including its SVG ring structure, decorative HUD elements, inner particle animation, and the Konami code easter egg.

## Requirements

### Requirement: Brain is rendered as concentric SVG/CSS rings
The system SHALL render the Brain animation as an SVG component with 5 concentric rings using CSS `@keyframes` animations, not a Canvas 2D element.

#### Scenario: Ring animation starts on mount
- **WHEN** the Dashboard page is rendered
- **THEN** all 5 rings begin rotating continuously without JavaScript per-frame logic

#### Scenario: Rings have differential speeds and directions
- **WHEN** the Brain animation is visible
- **THEN** ring 2 rotates clockwise at 0.8 rpm, ring 3 counter-clockwise at 0.5 rpm, ring 4 clockwise at 0.3 rpm, ring 5 counter-clockwise at 0.15 rpm, and ring 1 is static

#### Scenario: Brain is responsive
- **WHEN** the viewport width changes
- **THEN** the Brain container scales between `min(60vmin, 520px)` maintaining a square aspect ratio

### Requirement: Brain rings include decorative HUD elements
The Brain SVG SHALL include decorative elements on outer rings: segmented arcs on ring 2, tick marks on ring 3, rectangular notches on ring 4, and small squares on ring 5.

#### Scenario: Tick marks visible on ring 3
- **WHEN** the Dashboard is rendered
- **THEN** ring 3 displays short radial tick marks every 15° (24 marks total)

#### Scenario: Rectangular notches on ring 4
- **WHEN** the Dashboard is rendered
- **THEN** ring 4 displays 4 rectangular notch elements at 0°, 90°, 180°, and 270°

#### Scenario: Small squares on ring 5
- **WHEN** the Dashboard is rendered
- **THEN** ring 5 displays 12 small squares evenly distributed at 30° intervals

### Requirement: Brain center displays inner particle animation
The Brain component SHALL display 45 randomly-walking particles constrained inside Ring 1 radius as a canvas overlay (instead of a clock). Particles use random-walk motion with circular boundary repulsion.

#### Scenario: Particles visible in brain center
- **WHEN** the Brain is rendered
- **THEN** small cyan point particles are visible drifting within the innermost ring

#### Scenario: Particles bounded by ring 1
- **WHEN** a particle approaches the boundary of ring 1
- **THEN** it is repelled back toward the center and never exits the inner circle

#### Scenario: Canvas overlay cleans up on unmount
- **WHEN** the Dashboard component is unmounted
- **THEN** the canvas animation frame is cancelled and no further rendering occurs

### Requirement: Brain has a holographic cyan glow
The Brain SVG SHALL have a `filter: drop-shadow(0 0 6px rgba(0, 212, 255, 0.7))` applied to the SVG root and a radial gradient background behind all rings.

#### Scenario: Glow visible on dark background
- **WHEN** the dashboard renders on `--color-bg: #0a0e1a`
- **THEN** the Brain visually glows with a cyan halo visible to the eye

### Requirement: Konami code activates heart mode easter egg
Typing the Konami sequence (↑↑↓↓←→←→BA) on the Dashboard SHALL toggle a heart mode: SVG rings are replaced by pink heart shapes, the canvas particles become pink firefly hearts that drift near the center, and a `heart-pulse` glow animation replaces the cyan glow. Typing the sequence again reverts to normal.

#### Scenario: Konami sequence triggers heart mode
- **WHEN** the user types `ArrowUp ArrowUp ArrowDown ArrowDown ArrowLeft ArrowRight ArrowLeft ArrowRight b a` on the Dashboard
- **THEN** the Brain SVG switches to heart mode: central large heart, scattered static outer hearts, 10 animated firefly hearts near center

#### Scenario: Sequence is a toggle
- **WHEN** the user types the Konami sequence a second time
- **THEN** the Brain reverts to the normal cyan ring mode

#### Scenario: Firefly hearts animate
- **WHEN** heart mode is active
- **THEN** 10 small hearts near the center drift continuously with random-walk motion (max speed 1.4px/frame, bounded between Ring 1 and Ring 2 radius) rendered on the canvas layer

#### Scenario: Heart mode uses pink glow
- **WHEN** heart mode is active
- **THEN** the SVG has a pulsing `drop-shadow` in `rgba(255,107,157)` at 1.5s interval instead of the cyan glow

#### Scenario: Canvas particles turn pink
- **WHEN** heart mode is active
- **THEN** the inner random-walk dot particles use `rgba(255,107,157)` instead of cyan
