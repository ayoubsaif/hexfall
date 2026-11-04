// Spec "All user-facing text is translated": the in-game HUD in Spanish shows no
// English-only words, in visible text or in accessible names.
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { Hud } from "../../src/hud/Hud.tsx";
import { i18n } from "../../src/i18n/index.ts";
import { give, playState } from "../game/fixtures.ts";
import {
  type Mounted,
  mount,
  recordSession,
  resetAll,
  seatRoom,
  showGame,
} from "../hud/helpers.tsx";

const ENGLISH_ONLY = [
  "Roll",
  "Build",
  "Trade",
  "Brick",
  "Lumber",
  "Grain",
  "Wool",
  "Ore",
  "Knight",
  "Settlement",
  "City",
  "Road",
  "End",
  "Your",
  "turn",
  "cards",
  "Bank",
  "Log",
  "Victory",
  "Longest",
  "Largest",
  "points",
  "Cancel",
  "Language",
];

/** Visible text plus every accessible name or tooltip in the tree. */
function allText(root: Element): string {
  const attrs = [...root.querySelectorAll("[aria-label],[title],[placeholder],[alt]")].flatMap(
    (el) => ["aria-label", "title", "placeholder", "alt"].map((a) => el.getAttribute(a) ?? ""),
  );
  // Text nodes joined with spaces: textContent runs neighbors together ("LogNo events").
  const texts: string[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) texts.push(n.textContent ?? "");
  return [...texts, ...attrs].join(" | ");
}

function englishWords(text: string): string[] {
  return ENGLISH_ONLY.filter((w) => new RegExp(String.raw`\b${w}\b`).test(text));
}

let m: Mounted;

beforeEach(async () => {
  resetAll();
  recordSession();
  await act(() => i18n.changeLanguage("es"));
});
afterEach(async () => {
  m?.unmount();
  resetAll();
  await act(() => i18n.changeLanguage("en"));
});

describe("in-game HUD in Spanish", () => {
  it("shows no English-only words before the roll", () => {
    seatRoom(0);
    const s = playState({ rolled: false });
    give(s, 0, { brick: 2, lumber: 1, ore: 3, grain: 2, wool: 1 });
    showGame(s, 0);
    m = mount(<Hud />);
    expect(englishWords(allText(document.body))).toEqual([]);
  });

  it("shows no English-only words on the viewer's turn after the roll", () => {
    seatRoom(0);
    const s = playState({ rolled: true });
    give(s, 0, { brick: 2, lumber: 2, ore: 3, grain: 2, wool: 2 });
    showGame(s, 0);
    m = mount(<Hud />);
    const text = allText(document.body);
    expect(englishWords(text)).toEqual([]);
    expect(text).toMatch(/Ladrillo/);
  });

  it("shows no English-only words while another player plays", () => {
    seatRoom(0);
    showGame(playState({ seat: 2 }), 0);
    m = mount(<Hud />);
    expect(englishWords(allText(document.body))).toEqual([]);
  });

  it("control: the same check finds English words when the HUD is in English", async () => {
    await act(() => i18n.changeLanguage("en"));
    seatRoom(0);
    const s = playState({ rolled: true });
    give(s, 0, { brick: 2, lumber: 2, ore: 3, grain: 2, wool: 2 });
    showGame(s, 0);
    m = mount(<Hud />);
    expect(englishWords(allText(document.body)).length).toBeGreaterThan(5);
  });
});
