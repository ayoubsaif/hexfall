// Avatar picker (specs/player-avatars "Choosing an avatar before the game").
// A radio group of the catalog; avatars held by other seats are disabled with the owner's name.
import { AVATAR_IDS, type AvatarId } from "@hexfall/protocol";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils.ts";
import { Avatar } from "./Avatar.tsx";

interface Props {
  value: AvatarId;
  /** Avatars held by other seats, with the owner's name. */
  taken?: ReadonlyMap<AvatarId, string>;
  /** Seat whose color rings the options. */
  seat?: number;
  onChange: (id: AvatarId) => void;
}

export function AvatarPicker({ value, taken, seat = 0, onChange }: Props) {
  const { t } = useTranslation();
  const label = (id: AvatarId) => t(`session.avatars.names.${id}`);
  const move = (from: AvatarId, delta: number) => {
    const n = AVATAR_IDS.length;
    const start = AVATAR_IDS.indexOf(from);
    for (let step = 1; step <= n; step++) {
      const next = AVATAR_IDS[(start + delta * step + n * n) % n] as AvatarId;
      if (!taken?.has(next)) {
        onChange(next);
        return;
      }
    }
  };
  return (
    <div
      role="radiogroup"
      aria-label={t("session.avatars.title")}
      data-testid="avatar-picker"
      className="grid grid-cols-6 gap-2 max-sm:grid-cols-4"
    >
      {AVATAR_IDS.map((id) => {
        const owner = taken?.get(id);
        const checked = id === value;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-disabled={owner !== undefined}
            aria-label={label(id)}
            title={owner !== undefined ? t("session.avatars.taken", { name: owner }) : label(id)}
            tabIndex={checked ? 0 : -1}
            data-avatar={id}
            className={cn(
              "group relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg border-2 border-transparent p-1 outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring",
              owner !== undefined && "cursor-not-allowed opacity-35 grayscale",
              checked && "border-hud-fg",
            )}
            onClick={() => owner === undefined && onChange(id)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault();
                move(id, 1);
              } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                move(id, -1);
              }
            }}
          >
            <Avatar id={id} seat={seat} name={label(id)} size="lg" eager />
            <span
              aria-hidden="true"
              data-testid="avatar-tile-overlay"
              className={cn(
                "pointer-events-none absolute inset-0 transition-colors",
                checked ? "bg-black/25" : owner === undefined && "group-hover:bg-black/20",
              )}
            />
            {checked && (
              <span
                data-testid="avatar-check"
                aria-hidden="true"
                className="absolute right-0.5 bottom-0.5 inline-flex size-4 items-center justify-center rounded-full bg-hud-fg text-hud-solid"
              >
                <Check className="size-3" strokeWidth={3} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
