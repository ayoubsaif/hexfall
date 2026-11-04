// The one place that decides what the board may pick now (design.md decision 3).
// Pure: board targets and HUD hints both read this, so they never disagree.
import type { EdgeId, HexId, LegalActions, PlayerView, VertexId } from "@hexfall/engine";
import type { BuildChoice } from "../store/ui.ts";

export type PickKind =
  | "placeSettlement"
  | "placeRoad"
  | "buildSettlement"
  | "buildRoad"
  | "buildCity"
  | "moveRobber";

export type TargetKind = "vertex" | "edge" | "hex";

export interface Pick {
  kind: PickKind;
  target: TargetKind;
  /** VertexIds, EdgeIds or HexIds depending on `target`. */
  targets: ReadonlySet<number>;
}

export const PICK_TARGET: Readonly<Record<PickKind, TargetKind>> = {
  placeSettlement: "vertex",
  placeRoad: "edge",
  buildSettlement: "vertex",
  buildRoad: "edge",
  buildCity: "vertex",
  moveRobber: "hex",
};

export interface PickInput {
  view: PlayerView | null;
  legal: LegalActions | null;
  /** Paid build chosen in the HUD. */
  build: BuildChoice | null;
  /** An action is in flight: nothing can be picked until the server answers. */
  inFlight?: boolean;
  /** A robber hex is waiting for a victim choice. */
  victimHex?: HexId | null;
}

const BUILD_PICK = {
  road: "buildRoad",
  settlement: "buildSettlement",
  city: "buildCity",
} as const satisfies Record<BuildChoice, PickKind>;

function make(kind: PickKind, ids: readonly number[]): Pick | null {
  if (ids.length === 0) return null;
  return { kind, target: PICK_TARGET[kind], targets: new Set(ids) };
}

/** The board pick active for the viewer right now, or null. */
export function currentPick({ view, legal, build, inFlight, victimHex }: PickInput): Pick | null {
  if (!view || !legal || view.winner !== null || inFlight) return null;
  switch (view.phase.kind) {
    case "setup":
      return (
        make("placeSettlement", legal.placeSettlement as VertexId[]) ??
        make("placeRoad", legal.placeRoad as EdgeId[])
      );
    case "moveRobber":
      if (victimHex !== null && victimHex !== undefined) return null;
      return make(
        "moveRobber",
        legal.moveRobber.map((o) => o.hex),
      );
    case "roadBuilding":
      return make("buildRoad", legal.buildRoad);
    case "turn": {
      if (!build) return null;
      const kind = BUILD_PICK[build];
      return make(kind, legal[kind]);
    }
    default:
      return null;
  }
}

/** True when a chosen paid build has no legal target any more and should be cleared. */
export function isStaleBuild(legal: LegalActions | null, build: BuildChoice | null): boolean {
  if (!build) return false;
  return !legal || legal[BUILD_PICK[build]].length === 0;
}
