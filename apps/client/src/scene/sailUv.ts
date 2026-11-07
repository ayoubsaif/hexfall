// Flat texture coordinates for a boat sail (specs/asset-theming, "Model coordinate contract":
// a sail without UVs is accepted). The sail's face points along ±X, so each vertex's (z, y)
// is mapped onto [0,1]² from the bounding box. Seen from the +X side, the image reads
// left-to-right (u grows toward −Z) and upright (v grows with y). Pure, so it is testable.
import { BufferAttribute, type BufferGeometry } from "three";

export function sailUVs(positions: ArrayLike<number>): Float32Array {
  const count = Math.floor(positions.length / 3);
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < count; i++) {
    const y = positions[i * 3 + 1]!;
    const z = positions[i * 3 + 2]!;
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  const spanY = maxY - minY || 1;
  const spanZ = maxZ - minZ || 1;
  const uv = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    uv[i * 2] = (maxZ - positions[i * 3 + 2]!) / spanZ;
    uv[i * 2 + 1] = (positions[i * 3 + 1]! - minY) / spanY;
  }
  return uv;
}

/**
 * Adds sail UVs to a geometry that has none. Geometries are shared between clones of one
 * model; the attribute is the same for all of them, so applying it once is enough.
 */
export function ensureSailUVs(geometry: BufferGeometry): void {
  if (geometry.getAttribute("uv")) return;
  const position = geometry.getAttribute("position");
  if (!position) return;
  geometry.setAttribute("uv", new BufferAttribute(sailUVs(position.array), 2));
}
