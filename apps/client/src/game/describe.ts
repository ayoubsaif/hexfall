// Event text (design.md decision 10): a readable line for every engine event,
// and toasts for the events that concern the viewer or change the standings.
// All words come from the catalog through `t` (specs/client-i18n).
import type { GameEvent, PhaseKind, Resource, Seat } from "@hexfall/engine";
import type { T } from "../i18n/index.ts";
import { devCardLabel } from "../i18n/labels.ts";
import { formatBundle, formatList, joinList } from "./cards.ts";

/** Seat -> display name. */
export type Names = (seat: Seat) => string;

export interface LogLine {
  text: string;
  /** Seats mentioned, for color accents. */
  seats: Seat[];
}

type Describers = {
  [K in GameEvent["type"]]: (
    e: Extract<GameEvent, { type: K }>,
    n: Names,
    t: T,
    next?: GameEvent,
  ) => LogLine;
};

/** "Ana", "Ana and Ben", "Ana, Ben and Cy". */
export function joinNames(names: readonly string[], t: T): string {
  if (names.length === 0) return t("game.nobody");
  return joinList(names, t);
}

/**
 * What the server did after a timeout. In the main turn that is the roll when the event
 * that follows is a roll (the timer ran out before the roll), otherwise the end of the turn.
 */
export function timeoutOutcome(phase: PhaseKind, t: T, next?: GameEvent): string {
  return phase === "turn" && next?.type === "diceRolled"
    ? t("game.timeout.rolled")
    : t(`game.timeout.${phase}`);
}

/** A resource name inside running text ("grain"). */
const res = (t: T, r: Resource) => t(`game.res.${r}`);

const DESCRIBE: Describers = {
  gameCreated: (e, _n, t) => ({
    text: t("game.log.gameCreated", { mode: t(`game.mode.${e.mode}`), count: e.playerCount }),
    seats: [],
  }),
  orderRolled: (e, n, t) => ({
    text: t("game.log.orderRolled", {
      name: n(e.seat),
      a: e.dice[0],
      b: e.dice[1],
      total: e.dice[0] + e.dice[1],
    }),
    seats: [e.seat],
  }),
  orderTied: (e, n, t) => ({
    text: t("game.log.orderTied", { names: e.seats.map(n).join(", ") }),
    seats: e.seats,
  }),
  startingPlayer: (e, n, t) => ({
    text: t("game.log.startingPlayer", { name: n(e.seat) }),
    seats: [e.seat],
  }),
  built: (e, n, t) => {
    const name = n(e.seat);
    const piece = t(`game.piece.${e.piece}`);
    const text =
      e.piece === "city"
        ? t("game.log.builtCity", { name })
        : e.free && e.piece === "road"
          ? t("game.log.placedRoadFree", { name })
          : e.free
            ? t("game.log.placed", { name, piece })
            : t("game.log.built", { name, piece });
    return { text, seats: [e.seat] };
  },
  startingResources: (e, n, t) => ({
    text: t("game.log.startingResources", {
      name: n(e.seat),
      bundle: formatBundle(e.resources, t),
    }),
    seats: [e.seat],
  }),
  diceRolled: (e, n, t) => ({
    text: t("game.log.diceRolled", { name: n(e.seat), a: e.dice[0], b: e.dice[1], total: e.total }),
    seats: [e.seat],
  }),
  produced: (e, n, t) => ({
    text: t("game.log.produced", { name: n(e.seat), bundle: formatBundle(e.resources, t) }),
    seats: [e.seat],
  }),
  shortage: (e, _n, t) => ({
    text: t("game.log.shortage", { resource: res(t, e.resource) }),
    seats: [],
  }),
  discarded: (e, n, t) => ({
    text: t("game.log.discarded", { name: n(e.seat), bundle: formatBundle(e.resources, t) }),
    seats: [e.seat],
  }),
  robberMoved: (e, n, t) => ({
    text: t("game.log.robberMoved", { name: n(e.seat) }),
    seats: [e.seat],
  }),
  stole: (e, n, t) => ({
    text:
      e.resource === null
        ? t("game.log.stoleHidden", { thief: n(e.thief), victim: n(e.victim) })
        : t("game.log.stole", {
            thief: n(e.thief),
            victim: n(e.victim),
            resource: res(t, e.resource),
          }),
    seats: [e.thief, e.victim],
  }),
  devCardBought: (e, n, t) => ({
    text:
      e.card === null
        ? t("game.log.devCardBoughtHidden", { name: n(e.seat) })
        : t("game.log.devCardBought", { name: n(e.seat), card: devCardLabel(t, e.card) }),
    seats: [e.seat],
  }),
  devCardPlayed: (e, n, t) => ({
    text: t("game.log.devCardPlayed", { name: n(e.seat), card: devCardLabel(t, e.card) }),
    seats: [e.seat],
  }),
  yearOfPlenty: (e, n, t) => ({
    text: t("game.log.yearOfPlenty", { name: n(e.seat), bundle: formatList(e.resources, t) }),
    seats: [e.seat],
  }),
  monopoly: (e, n, t) => ({
    text: t("game.log.monopoly", {
      name: n(e.seat),
      resource: res(t, e.resource),
      count: e.taken.reduce((a, b) => a + b, 0),
    }),
    seats: [e.seat],
  }),
  tradeOffered: (e, n, t) => ({
    text: t("game.log.tradeOffered", {
      name: n(e.offer.from),
      give: formatBundle(e.offer.give, t),
      get: formatBundle(e.offer.get, t),
    }),
    seats: [e.offer.from],
  }),
  tradeAccepted: (e, n, t) => ({
    text: t("game.log.tradeAccepted", {
      from: n(e.from),
      by: n(e.by),
      give: formatBundle(e.give, t),
      get: formatBundle(e.get, t),
    }),
    seats: [e.from, e.by],
  }),
  tradeRejected: (e, n, t) => ({
    text: t("game.log.tradeRejected", { name: n(e.seat) }),
    seats: [e.seat],
  }),
  tradeCancelled: (_e, _n, t) => ({ text: t("game.log.tradeCancelled"), seats: [] }),
  maritimeTrade: (e, n, t) => ({
    text: t("game.log.maritimeTrade", {
      name: n(e.seat),
      giveCount: e.giveCount,
      give: res(t, e.give),
      getCount: e.getCount,
      get: res(t, e.get),
    }),
    seats: [e.seat],
  }),
  longestRoad: (e, n, t) => ({
    text:
      e.to === null
        ? t("game.log.longestRoadAside")
        : t("game.log.longestRoad", { name: n(e.to), count: e.length }),
    seats: e.to === null ? [] : [e.to],
  }),
  largestArmy: (e, n, t) => ({
    text: t("game.log.largestArmy", { name: n(e.to), count: e.knights }),
    seats: [e.to],
  }),
  vpRevealed: (e, n, t) => ({
    text: t("game.log.vpRevealed", { name: n(e.seat), count: e.count }),
    seats: [e.seat],
  }),
  turnEnded: (e, n, t) => ({
    text: t("game.log.turnEnded", { name: n(e.seat) }),
    seats: [e.seat],
  }),
  turnStarted: (e, n, t) => ({
    text: t("game.log.turnStarted", { number: e.number, name: n(e.seat) }),
    seats: [e.seat],
  }),
  timedOut: (e, n, t, next) => ({
    text: t("game.log.timedOut", {
      names: joinNames(e.seats.map(n), t),
      outcome: timeoutOutcome(e.phase, t, next),
    }),
    seats: e.seats,
  }),
  gameWon: (e, n, t) => ({
    text: t("game.log.gameWon", { name: n(e.seat), vp: e.vp }),
    seats: [e.seat],
  }),
};

/**
 * A readable log line for any event. Uses only what the (redacted) event holds, plus the
 * event that follows it in the log (`timedOut` names the move the server made next).
 */
export function describe(event: GameEvent, names: Names, t: T, next?: GameEvent): LogLine {
  const fn = DESCRIBE[event.type] as (e: GameEvent, n: Names, t: T, next?: GameEvent) => LogLine;
  return fn(event, names, t, next);
}

/** Event types with a log line (for the coverage test). */
export const DESCRIBED_TYPES = Object.keys(DESCRIBE) as GameEvent["type"][];

export type ToastTone = "info" | "good" | "bad";

export interface ToastSpec {
  text: string;
  tone: ToastTone;
  /** The player the toast is about; its avatar is shown beside the text. */
  seat?: Seat;
}

/** The seat a toast is about, from the viewer's point of view (player-avatars). */
function toastSeat(event: GameEvent, viewer: Seat | null): Seat | null {
  switch (event.type) {
    case "timedOut":
      return event.seats[0] ?? null;
    case "tradeOffered":
      return event.offer.from;
    case "stole":
      return viewer !== null && event.victim === viewer ? event.thief : event.victim;
    case "turnStarted":
    case "produced":
    case "startingResources":
    case "monopoly":
    case "discarded":
    case "yearOfPlenty":
      return event.seat;
    case "longestRoad":
    case "largestArmy":
      return event.to;
    default:
      return null;
  }
}

/** A toast for a key event, from the viewer's point of view; null for the rest. */
export function toastFor(
  event: GameEvent,
  viewer: Seat | null,
  names: Names,
  t: T,
  next?: GameEvent,
): ToastSpec | null {
  const spec = toastText(event, viewer, names, t, next);
  if (!spec) return null;
  const seat = toastSeat(event, viewer);
  return seat === null ? spec : { ...spec, seat };
}

function toastText(
  event: GameEvent,
  viewer: Seat | null,
  names: Names,
  t: T,
  next?: GameEvent,
): ToastSpec | null {
  const me = (s: Seat) => viewer !== null && s === viewer;
  switch (event.type) {
    case "timedOut": {
      const outcome = timeoutOutcome(event.phase, t, next);
      if (viewer !== null && event.seats.includes(viewer)) {
        const others = event.seats.filter((s) => s !== viewer);
        return {
          text:
            others.length === 0
              ? t("game.toast.timedOutYou", { outcome })
              : t("game.toast.timedOutYouAnd", { names: joinNames(others.map(names), t), outcome }),
          tone: "bad",
        };
      }
      return {
        text: t("game.toast.timedOut", { names: joinNames(event.seats.map(names), t), outcome }),
        tone: "info",
      };
    }
    case "turnStarted":
      return me(event.seat) ? { text: t("game.toast.yourTurn"), tone: "good" } : null;
    // specs/player-trade "Incoming offer notification": only offers made to the viewer.
    case "tradeOffered":
      return viewer !== null && !me(event.offer.from) && event.offer.to.includes(viewer)
        ? { text: t("game.toast.tradeOffered", { name: names(event.offer.from) }), tone: "info" }
        : null;
    case "produced":
      return me(event.seat)
        ? {
            text: t("game.toast.produced", { bundle: formatBundle(event.resources, t) }),
            tone: "good",
          }
        : null;
    case "startingResources":
      return me(event.seat)
        ? {
            text: t("game.toast.startingResources", { bundle: formatBundle(event.resources, t) }),
            tone: "good",
          }
        : null;
    case "stole":
      if (me(event.thief)) {
        return {
          text:
            event.resource === null
              ? t("game.toast.stoleNothing", { name: names(event.victim) })
              : t("game.toast.stole", {
                  name: names(event.victim),
                  resource: res(t, event.resource),
                }),
          tone: event.resource === null ? "info" : "good",
        };
      }
      if (me(event.victim)) {
        return {
          text:
            event.resource === null
              ? t("game.toast.robbedNothing", { name: names(event.thief) })
              : t("game.toast.robbed", {
                  name: names(event.thief),
                  resource: res(t, event.resource),
                }),
          tone: event.resource === null ? "info" : "bad",
        };
      }
      return null;
    case "monopoly": {
      const resource = res(t, event.resource);
      if (me(event.seat)) {
        const got = event.taken.reduce((a, b) => a + b, 0);
        return { text: t("game.toast.monopoly", { count: got, resource }), tone: "good" };
      }
      const lost = viewer === null ? 0 : (event.taken[viewer] ?? 0);
      return lost > 0
        ? {
            text: t("game.toast.monopolyLost", { name: names(event.seat), count: lost, resource }),
            tone: "bad",
          }
        : null;
    }
    case "discarded":
      return me(event.seat)
        ? {
            text: t("game.toast.discarded", { bundle: formatBundle(event.resources, t) }),
            tone: "bad",
          }
        : null;
    case "yearOfPlenty":
      return me(event.seat)
        ? {
            text: t("game.toast.yearOfPlenty", { bundle: formatList(event.resources, t) }),
            tone: "good",
          }
        : null;
    case "diceRolled":
      return event.total === 7 ? { text: t("game.toast.seven"), tone: "info" } : null;
    case "longestRoad":
      if (event.to === null) return { text: t("game.toast.longestRoadAside"), tone: "info" };
      return {
        text: me(event.to)
          ? t("game.toast.longestRoadYou")
          : t("game.toast.longestRoad", { name: names(event.to) }),
        tone: me(event.to) ? "good" : me(event.from ?? -1) ? "bad" : "info",
      };
    case "largestArmy":
      return {
        text: me(event.to)
          ? t("game.toast.largestArmyYou")
          : t("game.toast.largestArmy", { name: names(event.to) }),
        tone: me(event.to) ? "good" : me(event.from ?? -1) ? "bad" : "info",
      };
    case "shortage":
      return { text: t("game.toast.shortage", { resource: res(t, event.resource) }), tone: "info" };
    default:
      return null;
  }
}
