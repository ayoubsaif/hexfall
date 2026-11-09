// Pure board geometry and static board data the client may import (allow-listed subpath).
// No randomness and no rules logic here (design.md decision 4).
export {
  AXIAL_DIRECTIONS,
  LARGE_TOPOLOGY,
  STANDARD_TOPOLOGY,
  edgeMidpoint,
  edgeOutward,
  hexAt,
  hexCenter,
  hexRing,
  hexToWorld,
  topologyFor,
  topologyOf,
  vertexPosition,
  type BoardLayout,
  type EdgeId,
  type EdgeInfo,
  type HexId,
  type HexInfo,
  type Topology,
  type VertexId,
  type VertexInfo,
  type XZ,
} from "./topology.ts";
export {
  TERRAIN_RESOURCE,
  beginnerBoard,
  type Board,
  type BoardHex,
  type HarborType,
  type Resource,
  type Terrain,
} from "./board.ts";
// Static cost data (client HUD labels and checks). Plain frozen data, no rules logic.
export { COSTS, RESOURCES } from "./costs.ts";
