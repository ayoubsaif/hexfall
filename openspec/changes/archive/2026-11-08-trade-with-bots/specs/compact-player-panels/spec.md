## ADDED Requirements

### Requirement: Bot seats are marked
The player panel of every bot seat that is not an open seat SHALL show a bot badge next to the name: a robot icon with the localized label "Bot" on desktop, and the icon alone on phones and short screens. The badge SHALL have a tooltip and screen-reader text saying the seat is played by the computer, in English and Spanish. Open seats SHALL keep their existing open-seat badge instead, and human seats SHALL show no bot badge. The badge SHALL NOT push the four stat chips out of the panel at any supported width.

#### Scenario: Solo game panels
- **WHEN** a human plays against two bots
- **THEN** the two bot panels show the bot badge and the human's panel does not

#### Scenario: Phone width
- **WHEN** the screen is a phone or short viewport
- **THEN** the bot badge shows only the robot icon, and its label stays available to screen readers and as a tooltip

#### Scenario: Open seat
- **WHEN** a player left and a bot plays their seat
- **THEN** that panel shows the open-seat badge and no separate bot badge

#### Scenario: Spanish
- **WHEN** the interface language is Spanish
- **THEN** the badge tooltip and screen-reader text are in Spanish
