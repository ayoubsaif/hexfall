// Screen filters (specs/ambient-look): Render → ambient occlusion (Medium/High; half resolution on
// Medium) → Output (tone mapping, sRGB) → warm grade + vignette. Mounted only while the Screen
// filters preference is on; when it unmounts R3F goes back to its plain render. Picking is not
// affected: raycasts use the scene, never these buffers.
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { HalfFloatType, type Material, Mesh, type Object3D, WebGLRenderTarget } from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { GradeShader } from "./colorGrade.ts";
import type { QualityTier } from "./graphicsQuality.ts";

/** True for see-through overlays (chip labels, sail decals): transparent and not writing depth.
 * The AO pass draws its depth and normals with one override material, which would turn such a
 * quad into a solid square and shade a square "box-shadow" round it (seen behind every chip). */
export function isOverlay(o: Object3D): boolean {
  if (!(o instanceof Mesh) || !o.visible) return false;
  const mats = (Array.isArray(o.material) ? o.material : [o.material]) as Material[];
  return mats.length > 0 && mats.every((m) => m.transparent && !m.depthWrite);
}

/** Ambient occlusion resolution scale per tier; null = no AO. */
const AO_SCALE: Record<QualityTier, number | null> = { low: null, medium: 0.5, high: 1 };

export function PostFx({ tier }: { tier: QualityTier }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  const aoScale = AO_SCALE[tier];

  const { composer, grade } = useMemo(() => {
    const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 4 });
    const composer = new EffectComposer(gl, target);
    composer.addPass(new RenderPass(scene, camera));
    if (aoScale !== null) {
      const ao = new GTAOPass(scene, camera, 1, 1);
      ao.updateGtaoMaterial({
        radius: 0.3,
        distanceExponent: 1.5,
        thickness: 1,
        scale: 1,
        samples: aoScale < 1 ? 8 : 16,
      });
      ao.blendIntensity = 0.85;
      // Overlays are hidden while the AO pass draws, so they never occlude anything.
      const render = ao.render.bind(ao);
      const hidden: Object3D[] = [];
      ao.render = (...args: Parameters<typeof render>) => {
        scene.traverse((o) => {
          // Chips (userData.noAO) keep one even shade: AO would darken them by view angle.
          if (isOverlay(o) || (o.visible && o.userData.noAO === true)) hidden.push(o);
        });
        for (const o of hidden) o.visible = false;
        try {
          render(...args);
        } finally {
          for (const o of hidden) o.visible = true;
          hidden.length = 0;
        }
      };
      // Medium renders the AO buffers at half size; the blend samples them by UV.
      const setSize = ao.setSize.bind(ao);
      ao.setSize = (w: number, h: number) =>
        setSize(Math.max(1, Math.round(w * aoScale)), Math.max(1, Math.round(h * aoScale)));
      composer.addPass(ao);
    }
    composer.addPass(new OutputPass());
    const grade = new ShaderPass(GradeShader);
    composer.addPass(grade);
    return { composer, grade };
  }, [gl, scene, camera, aoScale]);

  useEffect(() => {
    composer.setPixelRatio(dpr);
    composer.setSize(size.width, size.height);
    grade.uniforms.uAspect!.value = size.width / Math.max(1, size.height);
  }, [composer, grade, size.width, size.height, dpr]);

  useEffect(
    () => () => {
      for (const pass of composer.passes) pass.dispose();
      composer.dispose();
    },
    [composer],
  );

  // Priority 1 takes over rendering from R3F for as long as this is mounted.
  useFrame((_, delta) => composer.render(delta), 1);
  return null;
}
