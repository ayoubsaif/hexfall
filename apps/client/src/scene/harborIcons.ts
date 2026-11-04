// Harbor marker icons as SVG path strings in a 24×24 viewBox, stroked onto the harbor
// label canvas with Path2D (2-unit stroke, round caps and joins).
//
// anchor, wheat, trees, brick-wall and mountain: path data from Lucide
// (https://lucide.dev), ISC license, Copyright (c) Lucide Contributors. Rects and circles
// are rewritten as paths. sheep: original, drawn in the same style (Lucide has no sheep).

export type HarborIcon = "anchor" | "wheat" | "trees" | "brickWall" | "mountain" | "sheep";

/** The viewBox side every icon path is drawn in. */
export const ICON_VIEWBOX = 24;

export const HARBOR_ICON_PATHS: Readonly<Record<HarborIcon, readonly string[]>> = {
  anchor: [
    "M12 6v16",
    "m19 13 2-1a9 9 0 0 1-18 0l2 1",
    "M9 11h6",
    "M14 4a2 2 0 1 1-4 0a2 2 0 1 1 4 0Z",
  ],
  wheat: [
    "M2 22 16 8",
    "M3.47 12.53 5 11l1.53 1.53a3.5 3.5 0 0 1 0 4.94L5 19l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z",
    "M7.47 8.53 9 7l1.53 1.53a3.5 3.5 0 0 1 0 4.94L9 15l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z",
    "M11.47 4.53 13 3l1.53 1.53a3.5 3.5 0 0 1 0 4.94L13 11l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z",
    "M20 2h2v2a4 4 0 0 1-4 4h-2V6a4 4 0 0 1 4-4Z",
    "M11.47 17.47 13 19l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L5 19l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z",
    "M15.47 13.47 17 15l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L9 15l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z",
    "M19.47 9.47 21 11l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L13 11l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z",
  ],
  trees: [
    "M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0Z",
    "M7 16v6",
    "M13 19v3",
    "M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .8-1.7L13 3l-1.4 1.5",
  ],
  brickWall: [
    "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z",
    "M12 9v6",
    "M16 15v6",
    "M16 3v6",
    "M3 15h18",
    "M3 9h18",
    "M8 15v6",
    "M8 3v6",
  ],
  mountain: ["m8 3 4 8 5-5 5 15H2L8 3z"],
  sheep: [
    // Woolly body: a clockwise ring of bumps, open on the left where the head sits.
    "M8 8a2.5 2.5 0 0 1 4-1.5a2.5 2.5 0 0 1 4 0a2.5 2.5 0 0 1 3.5 2.5a2.5 2.5 0 0 1 0 4.5a2.5 2.5 0 0 1-3.5 2.5a2.5 2.5 0 0 1-4 0a2.5 2.5 0 0 1-4-1.5",
    // Head.
    "M8.5 11a2.5 3 0 1 1-5 0a2.5 3 0 1 1 5 0Z",
    // Ear.
    "M4.2 9 2.5 7.8",
    // Legs.
    "M11 16.2V20",
    "M16 16.2V20",
  ],
};
