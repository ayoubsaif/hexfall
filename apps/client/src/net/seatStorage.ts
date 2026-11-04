// Saved seats per room plus the last room used (specs/client-session, "Seat tokens and
// automatic resume"). Every storage access is wrapped: private windows, blocked storage or
// a quota error fall back to memory for the current page.

/** The subset of `Storage` this module uses. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const SEATS_KEY = "hexfall.seats";
export const LAST_ROOM_KEY = "hexfall.lastRoom";

export interface SeatStorage {
  /** Saved token for a room code (any case), or null. */
  token(room: string): string | null;
  save(room: string, token: string): void;
  forget(room: string): void;
  lastRoom(): string | null;
  setLastRoom(room: string | null): void;
}

export function normalizeRoom(room: string): string {
  return room.trim().toUpperCase();
}

function defaultStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Creates seat storage over `storage` (default: localStorage), with a memory fallback. */
export function createSeatStorage(storage: StorageLike | null = defaultStorage()): SeatStorage {
  const memory = new Map<string, string>();

  const read = (key: string): string | null => {
    if (storage) {
      try {
        const v = storage.getItem(key);
        if (v !== null) return v;
        if (!memory.has(key)) return null;
      } catch {
        // fall through to memory
      }
    }
    return memory.get(key) ?? null;
  };
  const write = (key: string, value: string | null): void => {
    if (value === null) memory.delete(key);
    else memory.set(key, value);
    if (!storage) return;
    try {
      if (value === null) storage.removeItem(key);
      else storage.setItem(key, value);
    } catch {
      // memory already holds it
    }
  };

  const seats = (): Record<string, string> => {
    const raw = read(SEATS_KEY);
    if (!raw) return {};
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("shape");
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === "string" && v.length > 0) out[normalizeRoom(k)] = v;
      }
      return out;
    } catch {
      write(SEATS_KEY, null);
      return {};
    }
  };
  const writeSeats = (map: Record<string, string>): void => {
    write(SEATS_KEY, Object.keys(map).length > 0 ? JSON.stringify(map) : null);
  };

  return {
    token: (room) => seats()[normalizeRoom(room)] ?? null,
    save(room, token) {
      writeSeats({ ...seats(), [normalizeRoom(room)]: token });
    },
    forget(room) {
      const code = normalizeRoom(room);
      const map = seats();
      delete map[code];
      writeSeats(map);
      if (this.lastRoom() === code) this.setLastRoom(null);
    },
    lastRoom() {
      const v = read(LAST_ROOM_KEY);
      return v ? normalizeRoom(v) : null;
    },
    setLastRoom(room) {
      write(LAST_ROOM_KEY, room ? normalizeRoom(room) : null);
    },
  };
}
