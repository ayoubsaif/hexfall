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

/** One saved seat, for the saved games list (saved-games). */
export interface SavedSeat {
  room: string;
  token: string;
  /** ms since epoch when the seat was last saved or entered; 0 for seats stored before. */
  usedAt: number;
}

export interface SeatStorage {
  /** Saved token for a room code (any case), or null. */
  token(room: string): string | null;
  save(room: string, token: string): void;
  /** Every saved seat. */
  list(): SavedSeat[];
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

/**
 * Stored value per room: `{ "token": …, "usedAt": … }`. Plain token strings (written before
 * the saved games list) read as `usedAt: 0`.
 */
interface StoredSeat {
  token: string;
  usedAt: number;
}

function parseSeat(v: unknown): StoredSeat | null {
  if (typeof v === "string") return v.length > 0 ? { token: v, usedAt: 0 } : null;
  if (!v || typeof v !== "object") return null;
  const { token, usedAt } = v as Record<string, unknown>;
  if (typeof token !== "string" || token.length === 0) return null;
  return { token, usedAt: typeof usedAt === "number" && Number.isFinite(usedAt) ? usedAt : 0 };
}

/** Creates seat storage over `storage` (default: localStorage), with a memory fallback. */
export function createSeatStorage(
  storage: StorageLike | null = defaultStorage(),
  now: () => number = () => Date.now(),
): SeatStorage {
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

  const seats = (): Record<string, StoredSeat> => {
    const raw = read(SEATS_KEY);
    if (!raw) return {};
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("shape");
      const out: Record<string, StoredSeat> = {};
      for (const [k, v] of Object.entries(parsed)) {
        const seat = parseSeat(v);
        if (seat) out[normalizeRoom(k)] = seat;
      }
      return out;
    } catch {
      write(SEATS_KEY, null);
      return {};
    }
  };
  const writeSeats = (map: Record<string, StoredSeat>): void => {
    write(SEATS_KEY, Object.keys(map).length > 0 ? JSON.stringify(map) : null);
  };

  return {
    token: (room) => seats()[normalizeRoom(room)]?.token ?? null,
    save(room, token) {
      writeSeats({ ...seats(), [normalizeRoom(room)]: { token, usedAt: now() } });
    },
    list: () => Object.entries(seats()).map(([room, s]) => ({ room, ...s })),
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
      const code = room ? normalizeRoom(room) : null;
      write(LAST_ROOM_KEY, code);
      // Entering a room counts as using its seat.
      const map = seats();
      const seat = code ? map[code] : undefined;
      if (code && seat) writeSeats({ ...map, [code]: { ...seat, usedAt: now() } });
    },
  };
}
