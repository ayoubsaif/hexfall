// Pure card helpers for the HUD (specs/game-hud). Checks here only gate HUD
// buttons; the server decides legality and rejects anything else.
import type { Resource, ResourceBundle, ResourceCounts } from "@hexfall/engine";
import { RESOURCES } from "@hexfall/engine/geometry";
import type { T } from "../i18n/index.ts";

export function emptyCounts(): ResourceCounts {
  return { brick: 0, grain: 0, lumber: 0, ore: 0, wool: 0 };
}

/** Number of cards in a bundle or hand. */
export function total(b: ResourceBundle | ResourceCounts): number {
  let n = 0;
  for (const r of RESOURCES) n += b[r] ?? 0;
  return n;
}

/** The bundle without zero entries, in resource order. */
export function compact(b: ResourceBundle): ResourceBundle {
  const out: ResourceBundle = {};
  for (const r of RESOURCES) {
    const n = b[r] ?? 0;
    if (n > 0) out[r] = n;
  }
  return out;
}

/** True when `have` covers every count in `need`. */
export function covers(have: ResourceBundle | ResourceCounts, need: ResourceBundle): boolean {
  return RESOURCES.every((r) => (have[r] ?? 0) >= (need[r] ?? 0));
}

// ---- Discard

/** A discard selection is valid when it has exactly `owed` cards, all from the hand. */
export function isValidDiscard(
  hand: ResourceCounts,
  chosen: ResourceBundle,
  owed: number,
): boolean {
  if (owed <= 0) return false;
  return total(chosen) === owed && covers(hand, chosen);
}

// ---- Year of Plenty

/** How many cards Year of Plenty takes: 2, or what the bank holds if fewer. */
export function yearOfPlentyCount(bank: ResourceCounts): number {
  return Math.min(2, total(bank));
}

/** Valid when the picks are exactly `yearOfPlentyCount` cards the bank holds. */
export function isValidYearOfPlenty(bank: ResourceCounts, picks: readonly Resource[]): boolean {
  const need = yearOfPlentyCount(bank);
  if (picks.length !== need || need === 0) return false;
  const wanted: ResourceBundle = {};
  for (const r of picks) wanted[r] = (wanted[r] ?? 0) + 1;
  return covers(bank, wanted);
}

/** Whether one more card of `r` can be added to the current picks. */
export function canAddYearOfPlenty(
  bank: ResourceCounts,
  picks: readonly Resource[],
  r: Resource,
): boolean {
  if (picks.length >= yearOfPlentyCount(bank)) return false;
  return picks.filter((p) => p === r).length < bank[r];
}

// ---- Maritime trade

/** Whether the player can give `r` at their rate at all. */
export function canGive(hand: ResourceCounts, rates: ResourceCounts, r: Resource): boolean {
  return hand[r] >= rates[r];
}

/** Most cards of `get` obtainable for `give`: limited by the hand and the bank. */
export function maritimeMax(
  hand: ResourceCounts,
  bank: ResourceCounts,
  rates: ResourceCounts,
  give: Resource,
  get: Resource,
): number {
  if (give === get) return 0;
  return Math.min(Math.floor(hand[give] / rates[give]), bank[get]);
}

export function isValidMaritime(
  hand: ResourceCounts,
  bank: ResourceCounts,
  rates: ResourceCounts,
  give: Resource,
  get: Resource,
  count: number,
): boolean {
  return (
    Number.isInteger(count) && count >= 1 && count <= maritimeMax(hand, bank, rates, give, get)
  );
}

/** Joins items as a conjunction list in the catalog's language ("a, b and c"). */
export function joinList(items: readonly string[], t: T): string {
  return new Intl.ListFormat(t("game.listLocale"), { type: "conjunction" }).format(items);
}

/** "2 grain and 1 ore"; "nothing" for an empty bundle. */
export function formatBundle(b: ResourceBundle, t: T): string {
  const parts = RESOURCES.filter((r) => (b[r] ?? 0) > 0).map((r) =>
    t("game.bundle.item", { count: b[r] ?? 0, resource: t(`game.res.${r}`) }),
  );
  if (parts.length === 0) return t("game.bundle.nothing");
  return joinList(parts, t);
}

/** "2 grain and 1 ore" from a list of resources. */
export function formatList(rs: readonly Resource[], t: T): string {
  const b: ResourceBundle = {};
  for (const r of rs) b[r] = (b[r] ?? 0) + 1;
  return formatBundle(b, t);
}
