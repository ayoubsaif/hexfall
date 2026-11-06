import { useEffect, useMemo, useState } from "react";
import {
  IcosahedronGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
  type Texture,
} from "three";
import { resolveWaterUrls, useTheme } from "../theme/index.ts";
import { beachGeometry, beachHeight, type CoastRock } from "./coastTerrain.ts";
import { sampleCoast } from "./coastField.ts";
import type { XZ } from "./layout.ts";

/** Local copies of Rob Tuytel's CC0 rock_2 material; see public/textures/coast/SOURCE.json. */
const ROCK_MAPS = [
  "/textures/coast/rock-color.webp",
  "/textures/coast/rock-height.webp",
  "/textures/coast/rock-roughness.webp",
] as const;

function useCoastMaps(sandUrl?: string) {
  const [maps, setMaps] = useState<(Texture | null)[]>([]);
  useEffect(() => {
    let active = true;
    const owned: Texture[] = [];
    setMaps([]);
    [sandUrl, ...ROCK_MAPS].forEach((url, i) => {
      if (!url) return;
      new TextureLoader().load(
        url,
        (texture) => {
          if (!active) {
            texture.dispose();
            return;
          }
          texture.wrapS = texture.wrapT = RepeatWrapping;
          if (i === 0 || i === 1) texture.colorSpace = SRGBColorSpace;
          texture.anisotropy = 4;
          owned.push(texture);
          setMaps((previous) => {
            const next = [...previous];
            next[i] = texture;
            return next;
          });
        },
        undefined,
        () => {
          /* The lit sand/stone color remains a complete fallback. */
        },
      );
    });
    return () => {
      active = false;
      owned.forEach((texture) => texture.dispose());
    };
  }, [sandUrl]);
  return maps;
}

export function CoastTerrain({
  land,
  rocks,
  y,
  raisedBeach = true,
  detail = 3,
}: {
  land: readonly XZ[];
  rocks: readonly CoastRock[];
  y: number;
  raisedBeach?: boolean;
  detail?: number;
}) {
  const { theme } = useTheme();
  const maps = useCoastMaps(raisedBeach ? resolveWaterUrls(theme).sand : undefined);
  const beach = useMemo(
    () => (raisedBeach ? beachGeometry(land, y) : null),
    [land, y, raisedBeach],
  );
  const rockGeometry = useMemo(() => {
    const g = new IcosahedronGeometry(1, detail);
    const p = g.attributes.position!;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        yy = p.getY(i),
        z = p.getZ(i);
      const scale = 1 + 0.1 * Math.sin(x * 8 + z * 3) * Math.cos(yy * 7 - z * 5);
      p.setXYZ(i, x * scale, yy * scale, z * scale);
    }
    g.computeVertexNormals();
    return g;
  }, [detail]);
  useEffect(() => () => beach?.dispose(), [beach]);
  useEffect(() => () => rockGeometry.dispose(), [rockGeometry]);
  return (
    <group>
      {beach && (
        <mesh raycast={() => {}} geometry={beach} receiveShadow>
          <meshStandardMaterial
            map={maps[0] ?? null}
            color={maps[0] ? "#efe2bd" : "#d7bd85"}
            vertexColors
            roughness={0.88}
          />
        </mesh>
      )}
      {rocks.map((rock, i) => (
        <mesh
          raycast={() => {}}
          key={i}
          geometry={rockGeometry}
          position={[
            rock.x,
            (raisedBeach
              ? Math.min(-0.005, y + beachHeight(sampleCoast(land, rock.x, rock.z).shore))
              : y) +
              rock.height * 0.25,
            rock.z,
          ]}
          scale={[rock.radius, rock.height, rock.radius * 0.8]}
          rotation={[0.12, rock.yaw, 0.18]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial
            map={maps[1] ?? null}
            bumpMap={maps[2] ?? null}
            bumpScale={0.035}
            roughnessMap={maps[3] ?? null}
            roughness={0.88}
            color={maps[1] ? "#ffffff" : "#c9bea8"}
            emissive="#c9bea8"
            emissiveIntensity={0.1}
          />
        </mesh>
      ))}
    </group>
  );
}
