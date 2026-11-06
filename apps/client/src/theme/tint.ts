// Player-color tinting for themed piece models (specs/asset-theming, "Player color tinting").
import { Color, type Material, Mesh, type Object3D } from "three";
import { type AssetKey, PLAYER_COLOR_MATERIAL, isPlayerTinted } from "./keys.ts";

function materialsOf(mesh: Mesh): Material[] {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

function setColor(material: Material, color: Color): void {
  const withColor = material as Material & { color?: Color };
  if (withColor.color instanceof Color) withColor.color.copy(color);
}

/**
 * Clones `source` for one instance. For player-tinted keys every material is cloned
 * (so players never share a tint) and tinted: only `PlayerColor` materials if the model
 * has any, otherwise all of them. Other keys (incl. `piece.robber`) keep authored
 * materials, which stay shared.
 */
export function instantiateModel(
  source: Object3D,
  key: AssetKey,
  playerColor: string | undefined,
): Object3D {
  const root = source.clone(true);
  // Themed models cast and receive shadows like the procedural fallbacks.
  root.traverse((node) => {
    if (node instanceof Mesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });
  if (!isPlayerTinted(key) || playerColor === undefined) return root;

  const meshes: Mesh[] = [];
  root.traverse((node) => {
    if (node instanceof Mesh) meshes.push(node);
  });
  const hasPlayerMaterial = meshes.some((mesh) =>
    materialsOf(mesh).some((m) => m.name === PLAYER_COLOR_MATERIAL),
  );
  const color = new Color(playerColor);
  const cache = new Map<Material, Material>();
  for (const mesh of meshes) {
    const cloned = materialsOf(mesh).map((m) => {
      let copy = cache.get(m);
      if (!copy) {
        copy = m.clone();
        if (!hasPlayerMaterial || m.name === PLAYER_COLOR_MATERIAL) setColor(copy, color);
        cache.set(m, copy);
      }
      return copy;
    });
    mesh.material = Array.isArray(mesh.material) ? cloned : (cloned[0] ?? mesh.material);
  }
  return root;
}
