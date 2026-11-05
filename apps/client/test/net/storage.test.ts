import { describe, expect, it } from "vite-plus/test";
import { createAddress, type AddressEnv } from "../../src/net/address.ts";
import {
  createSeatStorage,
  LAST_ROOM_KEY,
  SEATS_KEY,
  type StorageLike,
} from "../../src/net/seatStorage.ts";

class MapStorage implements StorageLike {
  map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

const throwing: StorageLike = {
  getItem() {
    throw new Error("SecurityError");
  },
  setItem() {
    throw new Error("QuotaExceeded");
  },
  removeItem() {
    throw new Error("SecurityError");
  },
};

describe("seat storage", () => {
  it("saves, reads (any case) and forgets seats", () => {
    const store = new MapStorage();
    const seats = createSeatStorage(store);
    seats.save("k7qx2m", "tok");
    expect(seats.token("K7QX2M")).toBe("tok");
    expect(seats.token("k7qx2m")).toBe("tok");
    expect(JSON.parse(store.getItem(SEATS_KEY)!)).toEqual({
      K7QX2M: { token: "tok", usedAt: expect.any(Number) },
    });
    seats.setLastRoom("k7qx2m");
    expect(seats.lastRoom()).toBe("K7QX2M");
    seats.forget("K7QX2M");
    expect(seats.token("K7QX2M")).toBeNull();
    expect(seats.lastRoom()).toBeNull();
    expect(store.getItem(SEATS_KEY)).toBeNull();
  });

  it("survives a reload (a new instance over the same storage)", () => {
    const store = new MapStorage();
    createSeatStorage(store).save("ABCDEF", "t1");
    createSeatStorage(store).setLastRoom("ABCDEF");
    const again = createSeatStorage(store);
    expect(again.token("ABCDEF")).toBe("t1");
    expect(again.lastRoom()).toBe("ABCDEF");
  });

  it("drops malformed data", () => {
    const store = new MapStorage();
    store.setItem(SEATS_KEY, "{not json");
    const seats = createSeatStorage(store);
    expect(seats.token("ABCDEF")).toBeNull();
    expect(store.getItem(SEATS_KEY)).toBeNull();
    store.setItem(SEATS_KEY, JSON.stringify(["x"]));
    expect(seats.token("ABCDEF")).toBeNull();
    store.setItem(SEATS_KEY, JSON.stringify({ ABCDEF: 5, GHJKMN: "ok" }));
    expect(seats.token("ABCDEF")).toBeNull();
    expect(seats.token("GHJKMN")).toBe("ok");
  });

  it("works in memory when storage throws", () => {
    const seats = createSeatStorage(throwing);
    seats.save("ABCDEF", "tok");
    seats.setLastRoom("ABCDEF");
    expect(seats.token("ABCDEF")).toBe("tok");
    expect(seats.lastRoom()).toBe("ABCDEF");
    seats.forget("ABCDEF");
    expect(seats.token("ABCDEF")).toBeNull();
  });

  it("works in memory without storage", () => {
    const seats = createSeatStorage(null);
    seats.save("ABCDEF", "tok");
    expect(seats.token("abcdef")).toBe("tok");
    expect(seats.lastRoom()).toBeNull();
    seats.setLastRoom("x");
    expect(seats.lastRoom()).toBe("X");
    expect(LAST_ROOM_KEY).toBe("hexfall.lastRoom");
  });
});

function env(search = "", hash = ""): AddressEnv & { urls: string[] } {
  const urls: string[] = [];
  const e = {
    urls,
    location: { origin: "https://hexfall.test", pathname: "/play/", search, hash },
    history: {
      replaceState(_d: unknown, _u: string, url?: string) {
        urls.push(url ?? "");
        const u = new URL(url ?? "", "https://hexfall.test");
        e.location.search = u.search;
        e.location.pathname = u.pathname;
      },
    },
  };
  return e;
}

describe("address", () => {
  it("reads ?room= in any case", () => {
    expect(createAddress(env("?room=k7qx2m")).room()).toBe("K7QX2M");
    expect(createAddress(env("?room=")).room()).toBeNull();
    expect(createAddress(env("?room=a b")).room()).toBeNull();
    expect(createAddress(env("")).room()).toBeNull();
  });

  it("writes and clears the room without touching other params or the hash", () => {
    const e = env("?debug=1", "#x");
    const a = createAddress(e);
    a.setRoom("k7qx2m");
    expect(e.urls.at(-1)).toBe("/play/?debug=1&room=K7QX2M#x");
    expect(a.room()).toBe("K7QX2M");
    a.setRoom(null);
    expect(e.urls.at(-1)).toBe("/play/?debug=1#x");
    expect(a.room()).toBeNull();
  });

  it("builds invite links", () => {
    expect(createAddress(env("?room=OLD")).inviteLink("k7qx2m")).toBe(
      "https://hexfall.test/play/?room=K7QX2M",
    );
  });

  it("is inert without a window", () => {
    const a = createAddress(null);
    expect(a.room()).toBeNull();
    a.setRoom("ABC");
    expect(a.inviteLink("abc")).toBe("?room=ABC");
  });
});

describe("saved seat list (saved-games)", () => {
  it("records usedAt on save and when entering a room; old values read as usedAt 0", () => {
    const store = new MapStorage();
    let t = 10;
    const seats = createSeatStorage(store, () => t);
    store.setItem(SEATS_KEY, JSON.stringify({ OLDOLD: "old" }));
    seats.save("newnew", "n");
    expect(seats.list()).toEqual([
      { room: "OLDOLD", token: "old", usedAt: 0 },
      { room: "NEWNEW", token: "n", usedAt: 10 },
    ]);
    t = 50;
    seats.setLastRoom("oldold");
    expect(seats.list().find((s) => s.room === "OLDOLD")?.usedAt).toBe(50);
    expect(seats.token("OLDOLD")).toBe("old");
    seats.forget("NEWNEW");
    expect(seats.list().map((s) => s.room)).toEqual(["OLDOLD"]);
  });
});
