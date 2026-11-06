## ADDED Requirements

### Requirement: Single bottom control band

In a game, Settings, the pause/end-game control, the Log button, the connection indicator and the dice control SHALL sit in one bottom band: Settings, pause/end, Log and connection together at the left, the dice control at the right beside the action buttons. The view-preset controls SHALL stay in the band's left group. This supersedes the placement of Settings and the Log button in `hud-bottom-controls`. The top edge SHALL hold only the player panels (plus transient toasts and alerts).

#### Scenario: Desktop band
- **WHEN** a game is shown on a 1440x900 viewport
- **THEN** Settings, pause/end, Log and the connection indicator share one row at the bottom-left, and the dice control sits at the bottom-right

#### Scenario: Phone portrait band
- **WHEN** a game is shown on a 360x640 viewport
- **THEN** all band controls are visible in a single row above the hand with no wrapping to a second row

#### Scenario: Top edge
- **WHEN** a game is shown at any size
- **THEN** no Log button is at the top; only player panels are

### Requirement: Icon-only controls

Settings, pause/end and Log SHALL render as icon-only round buttons of the same style and size (at least 40 px, 44 px on coarse pointers), each with an accessible name and a tooltip. Hover or focus SHALL show the tooltip. The Log button SHALL still open the drawer with the Log and Dice tabs.

#### Scenario: Accessible names
- **WHEN** a screen reader reads the band
- **THEN** it announces "Settings", "Pause" (or "End game") and "Log" as buttons

#### Scenario: Log opens drawer
- **WHEN** the user presses the Log icon
- **THEN** the drawer opens on the last selected tab

### Requirement: Compact connection indicator

The connection indicator SHALL show a status dot and, when connected, the ping, without the status word. The status text SHALL remain available to assistive tech (live region, `connection-status` test id) and as a tooltip. When not connected (connecting, reconnecting, closed, version mismatch, replaced), the visible text SHALL expand so state is never conveyed by color alone.

#### Scenario: Connected
- **WHEN** the client is connected with a 2 ms ping
- **THEN** the band shows a green dot and "2 ms", and a screen reader reads "Connected"

#### Scenario: Reconnecting
- **WHEN** the connection drops
- **THEN** the indicator shows the reconnecting text and attempt count visibly

### Requirement: No overlap and full fit

The band SHALL NOT overlap or be overlapped by the hand, action buttons, status pill, offers tray, dice dock or player panels, and every control SHALL stay fully on screen, on desktop, tablet, mobile portrait, mobile landscape and short viewports. If the width cannot fit all controls, the view-preset controls SHALL collapse into one icon button opening the presets, before any control wraps or is clipped.

#### Scenario: 360 px wide
- **WHEN** the viewport is 360x640 in game
- **THEN** no band control is clipped or overlapping

#### Scenario: Landscape phone
- **WHEN** the viewport is 667x375 with offers visible
- **THEN** the band, the hand, the offers tray and the dice do not overlap

### Requirement: Dice control in the band

The dice control SHALL keep its accessible names ("Roll dice", "Roll for order"), highlight when ready and send-once behavior, and SHALL dock in the bottom band so it never covers the board center or the hand.

#### Scenario: Ready highlight
- **WHEN** it is the viewer's turn to roll
- **THEN** the dice control is highlighted and docked in the band
