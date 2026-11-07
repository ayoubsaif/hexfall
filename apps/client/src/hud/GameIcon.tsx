// Painted gold icon set for HUD buttons (public/ui/icons/*.webp, 128 px, transparent). All
// icons share one embossed-gold look, matching the leather buttons and the wax-seal close mark.
// `gameIcon` returns a component with the same shape as a lucide icon, so it drops into
// `<Fab icon=...>` and any `<Icon aria-hidden />` slot.
import type { LucideIcon } from "lucide-react";

export type GameIconName =
  | "bank"
  | "city"
  | "devcard"
  | "endturn"
  | "flag"
  | "hand"
  | "knight"
  | "leave"
  | "log"
  | "pause"
  | "road"
  | "settings"
  | "settlement"
  | "trade"
  | "view-diagonal"
  | "view-free"
  | "view-top"
  | "vp";

const cache = new Map<GameIconName, LucideIcon>();

export function gameIcon(name: GameIconName): LucideIcon {
  let icon = cache.get(name);
  if (!icon) {
    const Component = ({ className }: { className?: string }) => (
      <img
        src={`/ui/icons/${name}.webp`}
        data-icon={name}
        alt=""
        aria-hidden="true"
        width={128}
        height={128}
        draggable={false}
        className={className ?? "size-5 shrink-0"}
        style={{ filter: "drop-shadow(0 1px 1px rgb(0 0 0 / 60%))" }}
      />
    );
    Component.displayName = `GameIcon(${name})`;
    icon = Component as unknown as LucideIcon;
    cache.set(name, icon);
  }
  return icon;
}
