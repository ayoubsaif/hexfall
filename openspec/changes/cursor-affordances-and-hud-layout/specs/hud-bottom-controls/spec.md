## ADDED Requirements

### Requirement: Top edge holds only Log and player panels

In a game, the top edge of the HUD SHALL contain only the Log button (top-left), the player panels and transient toasts or alerts. Settings, view controls, the host game menu and the connection badge SHALL NOT be placed at the top edge at any screen size.

#### Scenario: Desktop in game
- **WHEN** a game is shown on a desktop viewport
- **THEN** only the Log button and the player panels are anchored to the top edge

#### Scenario: Mobile in game
- **WHEN** a game is shown on a 360x640 viewport
- **THEN** the top edge holds only the Log button and the player panels

### Requirement: Other controls in the bottom-left corner

Settings, view controls, the host game menu and the connection badge SHALL sit together in the bottom-left corner beside the hand (stacked above the raised hand on portrait phones). The Log button SHALL still open the drawer with the Log and Dice-stats tabs.

#### Scenario: Open stats from the top
- **WHEN** the user presses the Log button and selects the Dice tab
- **THEN** the drawer opens showing the dice statistics

### Requirement: Connection badge at the bottom

The connection badge SHALL be shown at the bottom of the screen, in the same corner area as the bottom control cluster, in the lobby, the start screen and in game. It SHALL keep its status text, latency display, live-region semantics and test ids.

#### Scenario: Badge position
- **WHEN** the client is connected
- **THEN** the badge shows "connected" with the ping at the bottom, not at the top

#### Scenario: Reconnecting
- **WHEN** the connection drops
- **THEN** the bottom badge announces the reconnecting state and attempt count

### Requirement: No overlap at any breakpoint

The relocated controls SHALL NOT overlap the hand, the action buttons, the status pill, the offers tray or the dice dock on desktop, tablet, mobile portrait, mobile landscape and short viewports.

#### Scenario: Small landscape phone
- **WHEN** the viewport is 667x375 in game with offers visible
- **THEN** the bottom cluster, badge, offers tray, hand and action buttons do not overlap
