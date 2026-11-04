## MODIFIED Requirements

### Requirement: Harbor markers

Each of the 9 harbor slots SHALL show a flat harbor marker (asset key `harbor.generic` or `harbor.<resource>` by its harbor type). The marker sits on the sea side of its slot path, offset along the path's outward direction. It SHALL have two visible links to the slot's two intersections, showing which settlement spots use the harbor. The marker SHALL show its trade rate ("3:1" for generic, "2:1" for special harbors). The marker SHALL also show an icon for its type: special harbors show an icon of their resource (grain: wheat, lumber: trees, brick: brick wall, ore: mountain, wool: sheep), and generic harbors show an anchor. The marker SHALL contain no words, so it looks the same in every language. Icons SHALL be drawn without loading any image file, so markers show their icons even when no theme is loaded. All six harbor types SHALL be distinguishable from one another by icon alone, and also by marker color.

#### Scenario: Harbor at its slot
- **WHEN** the beginner board is rendered
- **THEN** slot 1 shows a grain harbor marker labeled "2:1" with a wheat icon, outside its slot path and linked to that path's two intersections

#### Scenario: Generic harbor label
- **WHEN** a generic harbor is rendered
- **THEN** its marker shows "3:1" and an anchor icon

#### Scenario: Six distinct icons
- **WHEN** one harbor of each of the six types is rendered
- **THEN** each shows a different icon

#### Scenario: Language does not change the marker
- **WHEN** the client language is switched from English to Spanish
- **THEN** every harbor marker shows the same icon and rate as before, with no text in either language
