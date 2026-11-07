// Card flights (openspec/changes/card-flight-animations): which cards move where for one batch
// of live game events. Pure, so it is tested without a DOM; hud/CardFlights.tsx draws them.
import type { DevCard, GameEvent, Resource, ResourceBundle, Seat } from "@hexfall/engine";
import { COSTS, RESOURCES } from "@hexfall/engine/geometry";

export type FlightEndpoint = { kind: "bank" } | { kind: "seat"; seat: Seat };

/** A resource, a development card, or a card back (the view does not reveal it). */
export type FlightFace =
  | { kind: "resource"; resource: Resource }
  | { kind: "dev"; card: DevCard }
  | { kind: "back" };

export interface Flight {
  from: FlightEndpoint;
  to: FlightEndpoint;
  face: FlightFace;
  /** Milliseconds after the batch arrives. */
  delay: number;
}

/** Most cards drawn for one transfer (a 12-card Monopoly still reads as a stream). */
export const MAX_PER_TRANSFER = 6;
/** Most cards drawn for one batch of events. */
export const MAX_PER_BATCH = 40;
/** Gap between consecutive cards of one batch. */
export const STAGGER_MS = 70;

const BANK: FlightEndpoint = { kind: "bank" };
const seat = (s: Seat): FlightEndpoint => ({ kind: "seat", seat: s });
const res = (resource: Resource): FlightFace => ({ kind: "resource", resource });

interface Move {
  from: FlightEndpoint;
  to: FlightEndpoint;
  face: FlightFace;
  count: number;
}

function bundleMoves(from: FlightEndpoint, to: FlightEndpoint, b: ResourceBundle): Move[] {
  return RESOURCES.filter((r) => (b[r] ?? 0) > 0).map((r) => ({
    from,
    to,
    face: res(r),
    count: b[r] ?? 0,
  }));
}

function movesFor(e: GameEvent): Move[] {
  switch (e.type) {
    case "produced":
    case "startingResources":
      return bundleMoves(BANK, seat(e.seat), e.resources);
    case "yearOfPlenty":
      return e.resources.map((r) => ({ from: BANK, to: seat(e.seat), face: res(r), count: 1 }));
    case "discarded":
      return bundleMoves(seat(e.seat), BANK, e.resources);
    case "built":
      return e.free ? [] : bundleMoves(seat(e.seat), BANK, COSTS[e.piece]);
    case "devCardBought":
      return [
        ...bundleMoves(seat(e.seat), BANK, COSTS.devCard),
        {
          from: BANK,
          to: seat(e.seat),
          face: e.card ? { kind: "dev", card: e.card } : { kind: "back" },
          count: 1,
        },
      ];
    case "devCardPlayed":
      return [{ from: seat(e.seat), to: BANK, face: { kind: "dev", card: e.card }, count: 1 }];
    case "stole":
      // `resource` is null when redacted (card back) or when the victim had nothing; the
      // second case is filtered in flightsForEvents for the seats that can tell.
      return [
        {
          from: seat(e.victim),
          to: seat(e.thief),
          face: e.resource ? res(e.resource) : { kind: "back" },
          count: 1,
        },
      ];
    case "monopoly":
      return e.taken.flatMap((n, victim) =>
        n > 0 && victim !== e.seat
          ? [{ from: seat(victim), to: seat(e.seat), face: res(e.resource), count: n }]
          : [],
      );
    case "tradeAccepted":
      return [
        ...bundleMoves(seat(e.from), seat(e.by), e.give),
        ...bundleMoves(seat(e.by), seat(e.from), e.get),
      ];
    case "maritimeTrade":
      return [
        { from: seat(e.seat), to: BANK, face: res(e.give), count: e.giveCount },
        { from: BANK, to: seat(e.seat), face: res(e.get), count: e.getCount },
      ];
    default:
      return [];
  }
}

/**
 * The flights for one batch of events seen by `viewer` (null: spectator). A steal whose card the
 * viewer can see but which carried nothing (empty-handed victim) draws no card.
 */
export function flightsForEvents(events: readonly GameEvent[], viewer: Seat | null): Flight[] {
  const out: Flight[] = [];
  for (const e of events) {
    // The thief and victim always see the stolen card, so null for them means "nothing taken".
    if (e.type === "stole" && e.resource === null && (viewer === e.thief || viewer === e.victim)) {
      continue;
    }
    for (const m of movesFor(e)) {
      for (let i = 0; i < Math.min(m.count, MAX_PER_TRANSFER); i++) {
        if (out.length >= MAX_PER_BATCH) return out;
        out.push({ from: m.from, to: m.to, face: m.face, delay: out.length * STAGGER_MS });
      }
    }
  }
  return out;
}
