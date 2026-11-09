// Painted gold icon set for HUD buttons. All icons share one embossed-gold look, matching the
// leather buttons and the wax-seal close mark. They live in one sprite sheet
// (public/ui/icons.webp, built by tools/hud-icon-sprite.mjs from apps/client/brand/hud-icons), so
// the game loads one image for every icon; each icon is that sheet as a CSS background, positioned
// on its cell. `gameIcon` returns a component with the same shape as a lucide icon, so it drops
// into `<Fab icon=...>` and any `<Icon aria-hidden />` slot.
import type { LucideIcon } from "lucide-react";
import { ICON_CELLS, ICON_SPRITE, type GameIconName } from "./iconSprite.ts";

export type { GameIconName };

const BASE: string = import.meta.env.BASE_URL ?? "/";
const SHEET_URL = `${BASE.endsWith("/") ? BASE : `${BASE}/`}${ICON_SPRITE.path}`;
const { columns, rows } = ICON_SPRITE;

/** Background position (in %) of an icon's cell: with a background `columns` x `rows` times the
 * element's size, X% lines up the X% point of the sheet with the X% point of the element. */
export function iconPosition(name: GameIconName): string {
  const [col, row] = ICON_CELLS[name];
  const x = columns > 1 ? (col / (columns - 1)) * 100 : 0;
  const y = rows > 1 ? (row / (rows - 1)) * 100 : 0;
  return `${x}% ${y}%`;
}

const cache = new Map<GameIconName, LucideIcon>();

export function gameIcon(name: GameIconName): LucideIcon {
  let icon = cache.get(name);
  if (!icon) {
    const Component = ({ className }: { className?: string }) => (
      <span
        data-icon={name}
        aria-hidden="true"
        className={`inline-block bg-no-repeat ${className ?? "size-5 shrink-0"}`}
        style={{
          backgroundImage: `url("${SHEET_URL}")`,
          backgroundSize: `${columns * 100}% ${rows * 100}%`,
          backgroundPosition: iconPosition(name),
          filter: "drop-shadow(0 1px 1px rgb(0 0 0 / 60%))",
        }}
      />
    );
    Component.displayName = `GameIcon(${name})`;
    icon = Component as unknown as LucideIcon;
    cache.set(name, icon);
  }
  return icon;
}
