import { useCallback, useEffect, useMemo } from "react";
import { beachMaterial, coastMaterialFor, useCoastTextures } from "./coastMaterials.ts";
import { beachGeometry } from "./coastTerrain.ts";
import { CoastProps } from "./CoastProps.tsx";
import type { PropInstance } from "./coastScatter.ts";
import { QUALITY, useGraphicsQuality } from "./graphicsQuality.ts";
import type { XZ } from "./layout.ts";

export function CoastTerrain({
  land,
  props,
  y,
  raisedBeach = true,
}: {
  land: readonly XZ[];
  props: readonly PropInstance[];
  y: number;
  raisedBeach?: boolean;
}) {
  const shadows = QUALITY[useGraphicsQuality()].shadows;
  const maps = useCoastTextures();
  const material = useMemo(() => beachMaterial(maps), [maps]);
  useEffect(() => () => material.dispose(), [material]);
  const materialFor = useMemo(() => coastMaterialFor(maps), [maps]);
  const beach = useMemo(
    () => (raisedBeach ? beachGeometry(land, y) : null),
    [land, y, raisedBeach],
  );
  useEffect(() => () => beach?.dispose(), [beach]);
  // Same surface as the beach mesh (clamped below the pieces); on the flat sea, the sea table.
  const baseY = useCallback(
    (p: PropInstance) => (raisedBeach ? Math.min(-0.005, y + p.ground) : y),
    [raisedBeach, y],
  );
  return (
    <group>
      {beach && <mesh raycast={() => {}} geometry={beach} material={material} receiveShadow />}
      <CoastProps props={props} baseY={baseY} shadows={shadows} materialFor={materialFor} />
    </group>
  );
}
