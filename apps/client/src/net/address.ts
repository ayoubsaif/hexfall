// The room code in the page address (`?room=CODE`) and invite links
// (specs/client-session, "Invite links").

/** The parts of `window.location` / `history` this module uses. */
export interface AddressEnv {
  location: { origin: string; pathname: string; search: string; hash: string };
  history: { replaceState(data: unknown, unused: string, url?: string): void };
}

export const ROOM_PARAM = "room";
const CODE = /^[A-Za-z0-9]{1,16}$/;

export interface Address {
  /** Upper-cased room code from the address, or null. */
  room(): string | null;
  /** Puts `?room=CODE` in the address (or removes it for null) without a reload. */
  setRoom(room: string | null): void;
  /** Shareable link that opens the join form for `room`. */
  inviteLink(room: string): string;
}

function defaultEnv(): AddressEnv | null {
  return typeof window === "undefined" ? null : window;
}

export function createAddress(env: AddressEnv | null = defaultEnv()): Address {
  return {
    room() {
      if (!env) return null;
      const raw = new URLSearchParams(env.location.search).get(ROOM_PARAM)?.trim();
      return raw && CODE.test(raw) ? raw.toUpperCase() : null;
    },
    setRoom(room) {
      if (!env) return;
      const params = new URLSearchParams(env.location.search);
      if (room) params.set(ROOM_PARAM, room.toUpperCase());
      else params.delete(ROOM_PARAM);
      const q = params.toString();
      try {
        env.history.replaceState(
          null,
          "",
          `${env.location.pathname}${q ? `?${q}` : ""}${env.location.hash}`,
        );
      } catch {
        // Some embedded contexts forbid history changes; the address is a convenience only.
      }
    },
    inviteLink(room) {
      const base = env ? `${env.location.origin}${env.location.pathname}` : "";
      return `${base}?${ROOM_PARAM}=${encodeURIComponent(room.toUpperCase())}`;
    },
  };
}
