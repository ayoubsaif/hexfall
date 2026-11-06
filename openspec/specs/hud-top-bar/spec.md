# hud-top-bar Specification

## Purpose

Pin the player panels in a fixed, non-wrapping top container with the board view controls directly under it, kept thin.

## Requirements

### Requirement: Fixed top player container
The game HUD SHALL show all player panels in one container pinned to the top edge of the HUD. The panels SHALL stay in a single non-wrapping row, and the container's height SHALL NOT change when badges, countdowns, offline state or hand counts change. Long names SHALL truncate.

#### Scenario: Four players with badges
- **WHEN** a 4-player game has Longest Road, Largest Army, an offline seat and a waiting countdown shown at once
- **THEN** all four panels are in one row and the container height equals its height with none of those shown

#### Scenario: Narrow viewport
- **WHEN** the viewport is 390 px wide with 4 players
- **THEN** the panels share the row width, use compact stat labels and do not wrap or scroll the page horizontally

### Requirement: View controls follow the container
The board view controls SHALL be placed directly below the player container, left-aligned, on every viewport size, with a gap of at most 8 px. They SHALL NOT be placed beside or above the container.

#### Scenario: Short screen
- **WHEN** the viewport height is below the `short` breakpoint
- **THEN** the view controls still appear directly below the player container, not at the top-right

### Requirement: Thin view controls
The view controls SHALL be thinner than before: mouse-theme bar height at most 36 px, and touch/touchpad buttons keep a hit area of at least 40 px while their visible chrome stays slim.

#### Scenario: Mouse bar height
- **WHEN** the mouse theme is active at desktop width
- **THEN** the controls bar is at most 36 px tall
