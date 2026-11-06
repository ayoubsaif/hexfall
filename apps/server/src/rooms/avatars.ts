// Seat avatars (specs/player-avatars, game-server "Seat avatars").
import { AVATAR_IDS, type AvatarId } from "@hexfall/protocol";

const KNOWN = new Set<string>(AVATAR_IDS);

export function isAvatarId(v: unknown): v is AvatarId {
  return typeof v === "string" && KNOWN.has(v);
}

/** First catalog avatar not in `taken`. The catalog has more ids than seats, so one exists. */
export function firstFreeAvatar(taken: Iterable<string>): AvatarId {
  const used = new Set(taken);
  return AVATAR_IDS.find((id) => !used.has(id)) ?? AVATAR_IDS[0];
}

/**
 * The avatar of every seat. Stored avatars win; a seat stored without one (a game saved before
 * avatars) gets the catalog id of its index, or the first free one when that is taken.
 */
export function resolveAvatars(seats: readonly { avatar?: string }[]): AvatarId[] {
  const out: (AvatarId | null)[] = seats.map((s) => (isAvatarId(s.avatar) ? s.avatar : null));
  const used = new Set(out.filter((a): a is AvatarId => a !== null));
  return out.map((a, i) => {
    if (a) return a;
    const preferred = AVATAR_IDS[i];
    const pick = preferred && !used.has(preferred) ? preferred : firstFreeAvatar(used);
    used.add(pick);
    return pick;
  });
}

/** The requested avatar when it is free, else the first free one. */
export function chooseAvatar(requested: AvatarId | undefined, taken: Iterable<string>): AvatarId {
  const used = new Set(taken);
  return requested && !used.has(requested) ? requested : firstFreeAvatar(used);
}
