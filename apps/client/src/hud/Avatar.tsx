// Circular player avatar with a seat-color ring (specs/player-avatars "Avatar display").
// Art is /avatars/<id>.webp (500x500, no frame); the ring and fallback come from the seat color.
import type { AvatarId } from "@hexfall/protocol";
import { useState } from "react";
import { cn } from "@/lib/utils.ts";
import { seatColor } from "../game/colors.ts";
import { useAvatars, useNames } from "./names.ts";

export type AvatarSize = "xs" | "sm" | "md" | "xl" | "lg";

const SIZE_CLASS: Record<AvatarSize, string> = {
  xs: "size-5 text-[10px]",
  sm: "size-7 text-xs",
  md: "size-10 text-base",
  xl: "size-11 text-lg",
  lg: "size-16 text-2xl",
};

export function avatarUrl(id: AvatarId): string {
  return `${import.meta.env.BASE_URL ?? "/"}avatars/${id}.webp`.replace("//", "/");
}

interface AvatarProps {
  /** Catalog id, or undefined to show the initial only. */
  id?: AvatarId | undefined;
  /** Seat whose color rings the avatar. */
  seat: number;
  /** Name for the fallback initial. */
  name: string;
  size?: AvatarSize;
  eager?: boolean;
  className?: string;
}

export function Avatar({ id, seat, name, size = "md", eager = false, className }: AvatarProps) {
  const c = seatColor(seat);
  const [failed, setFailed] = useState<string | null>(null);
  const showImage = id !== undefined && failed !== id;
  const initial = Array.from(name.trim())[0]?.toUpperCase() ?? "?";
  return (
    <span
      data-testid="avatar"
      data-avatar={id ?? ""}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ring-offset-1 ring-offset-black/40 select-none",
        SIZE_CLASS[size],
        className,
      )}
      style={{ background: c.hex, color: c.ink, ["--tw-ring-color" as string]: c.hex }}
    >
      {showImage ? (
        <img
          src={avatarUrl(id)}
          alt=""
          width={500}
          height={500}
          loading={eager ? "eager" : "lazy"}
          draggable={false}
          className="size-full object-cover"
          onError={() => setFailed(id)}
        />
      ) : (
        <span aria-hidden="true" className="font-bold leading-none">
          {initial}
        </span>
      )}
    </span>
  );
}

/** The avatar of a seat from the room store, ringed in the seat's color. */
export function SeatAvatar({
  seat,
  size,
  className,
}: {
  seat: number;
  size?: AvatarSize;
  className?: string;
}) {
  const avatars = useAvatars();
  const names = useNames();
  return (
    <Avatar
      id={avatars(seat)}
      seat={seat}
      name={names(seat)}
      {...(size ? { size } : {})}
      {...(className ? { className } : {})}
    />
  );
}
