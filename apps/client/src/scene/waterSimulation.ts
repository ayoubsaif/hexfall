import {
  Color,
  DataTexture,
  DataUtils,
  HalfFloatType,
  LinearFilter,
  Mesh,
  NearestFilter,
  OrthographicCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  WebGLRenderTarget,
  type Texture,
  type WebGLRenderer,
} from "three";
import { FIELD_HALF, sampleCoast } from "./coastField.ts";
import { beachHeight, type CoastRock } from "./coastTerrain.ts";
import type { XZ } from "./layout.ts";

export const SIM_SIZE = 256;
export const SIM_DT = 1 / 120;
export const SIM_DX = (FIELD_HALF * 2) / SIM_SIZE;
export const SIM_MAX_STEPS = 4;
export const SIM_DEPTH = 2;
export const SIM_GRAVITY = 9.81;

/** Drop excess wall time after stalls rather than destabilizing the CFL-limited solver. */
export class WaterStepper {
  private remainder = 0;
  time = 0;
  advance(delta: number, frozen: boolean, step: (time: number) => void): number {
    if (frozen || !Number.isFinite(delta) || delta <= 0) {
      this.remainder = 0;
      return 0;
    }
    this.remainder = Math.min(this.remainder + delta, SIM_DT * SIM_MAX_STEPS);
    let count = 0;
    while (this.remainder + 1e-10 >= SIM_DT && count < SIM_MAX_STEPS) {
      this.time += SIM_DT;
      step(this.time);
      this.remainder = Math.max(0, this.remainder - SIM_DT);
      count++;
    }
    return count;
  }
}

/** Same clamped bed as the rendered beach, in sea-relative coordinates. */
export function bedHeight(shore: number, seaLevel: number): number {
  return Math.min(-0.005 - seaLevel, beachHeight(shore));
}

export function bathymetry(
  land: readonly XZ[],
  rocks: readonly CoastRock[],
  seaLevel: number,
  size = SIM_SIZE,
): Float32Array {
  const data = new Float32Array(size * size * 4);
  const bases = rocks.map((r) => bedHeight(sampleCoast(land, r.x, r.z).shore, seaLevel));
  for (let row = 0; row < size; row++) {
    const z = (((row + 0.5) / size) * 2 - 1) * FIELD_HALF;
    for (let col = 0; col < size; col++) {
      const x = (((col + 0.5) / size) * 2 - 1) * FIELD_HALF;
      const shore = sampleCoast(land, x, z).shore;
      let bed = bedHeight(shore, seaLevel);
      let obstacle = shore < -0.18;
      rocks.forEach((r, i) => {
        // Conservative footprint includes the deformed and tilted rendered stone.
        const q = Math.hypot(x - r.x, z - r.z) / (r.radius * 1.08);
        if (q < 1) {
          bed = Math.max(bed, bases[i]! + r.height * (0.25 + Math.sqrt(1 - q * q)));
          obstacle = true;
        }
      });
      const o = (row * size + col) * 4;
      data[o] = bed;
      data[o + 1] = obstacle || bed > 0.055 ? 0 : Math.max(0.018, Math.min(SIM_DEPTH, -bed));
      data[o + 3] = 1;
    }
  }
  return data;
}

const fragment = /* glsl */ `
uniform sampler2D uState;
uniform sampler2D uBed;
uniform float uTime;
varying vec2 vUv;
const float dx = ${SIM_DX};
const float dt = ${SIM_DT};
const vec2 texel = vec2(${1 / SIM_SIZE});
// Divergence of depth-weighted height gradient: eta_tt = g div(h grad eta).
// Closed faces carry zero flux, reflecting at land and rocks rather than leaking through.
float flux(vec2 uv, float height, float depth) {
  float h = texture2D(uBed, uv).g;
  return h > 0.0 ? min(h, depth) * (texture2D(uState, uv).r - height) : 0.0;
}
void main() {
  vec4 bed = texture2D(uBed, vUv);
  if (bed.g <= 0.0) { gl_FragColor = vec4(0.0); return; }
  vec4 s = texture2D(uState, vUv);
  float lap = flux(vUv + vec2(texel.x, 0.0), s.r, bed.g)
    + flux(vUv - vec2(texel.x, 0.0), s.r, bed.g)
    + flux(vUv + vec2(0.0, texel.y), s.r, bed.g)
    + flux(vUv - vec2(0.0, texel.y), s.r, bed.g);
  vec2 p = (vUv * 2.0 - 1.0) * ${FIELD_HALF.toFixed(1)};
  float edge = max(abs(p.x), abs(p.y));
  float sponge = smoothstep(7.0, 8.9, edge);
  float velocity = (s.g + dt * ${SIM_GRAVITY} * lap / (dx * dx))
    * exp(-dt * (0.38 + sponge * 5.0));
  // Wave maker away from shore; a smooth startup avoids an impulsive first frame.
  float ramp = smoothstep(0.0, 3.0, uTime);
  float forcing = exp(-pow((p.y + 6.6) / 0.38, 2.0))
    * (sin(uTime * 3.1 + p.x * 0.28) + 0.35 * sin(uTime * 4.4 - p.x * 0.5));
  velocity += dt * 0.32 * forcing * ramp;
  float height = s.r + velocity * dt;
  // Bounded breaking in very shallow water dissipates energy at run-up.
  float limit = max(0.025, bed.g * 0.65);
  float breaking = smoothstep(limit * 0.6, limit, abs(height));
  height = clamp(height, -limit, limit);
  velocity *= 1.0 - breaking * 0.08;
  float foam = max(s.b * exp(-dt * 1.6), breaking * 0.6);
  gl_FragColor = vec4(height, velocity, foam, 1.0);
}`;

/** Two half-float targets (~1 MB total). Owns all GPU objects and restores renderer state. */
export class WaterSimulation {
  readonly stepper = new WaterStepper();
  readonly bed: DataTexture;
  /** The same seabed, linearly filtered, for drawing: smooth waterlines and rock contact
   * instead of the solver's square cells. The solver itself must read exact cells (`bed`). */
  readonly bedSmooth: DataTexture;
  private read: WebGLRenderTarget;
  private write: WebGLRenderTarget;
  private readonly scene = new Scene();
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly geometry = new PlaneGeometry(2, 2);
  private readonly material: ShaderMaterial;
  private initialized = false;

  constructor(land: readonly XZ[], rocks: readonly CoastRock[], y: number) {
    const values = bathymetry(land, rocks, y);
    const half = new Uint16Array(values.length);
    for (let i = 0; i < values.length; i++) half[i] = DataUtils.toHalfFloat(values[i]!);
    this.bed = new DataTexture(half, SIM_SIZE, SIM_SIZE, RGBAFormat, HalfFloatType);
    this.bed.minFilter = this.bed.magFilter = NearestFilter;
    this.bed.needsUpdate = true;
    this.bedSmooth = new DataTexture(half, SIM_SIZE, SIM_SIZE, RGBAFormat, HalfFloatType);
    this.bedSmooth.minFilter = this.bedSmooth.magFilter = LinearFilter;
    this.bedSmooth.needsUpdate = true;
    const options = {
      type: HalfFloatType,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      depthBuffer: false,
      stencilBuffer: false,
    };
    this.read = new WebGLRenderTarget(SIM_SIZE, SIM_SIZE, options);
    this.write = new WebGLRenderTarget(SIM_SIZE, SIM_SIZE, options);
    this.material = new ShaderMaterial({
      uniforms: {
        uState: { value: this.read.texture },
        uBed: { value: this.bed },
        uTime: { value: 0 },
      },
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: fragment,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    this.scene.add(new Mesh(this.geometry, this.material));
  }

  get texture(): Texture {
    return this.read.texture;
  }

  advance(renderer: WebGLRenderer, delta: number, frozen: boolean) {
    const target = renderer.getRenderTarget();
    const clearColor = renderer.getClearColor(new Color());
    const clearAlpha = renderer.getClearAlpha();
    const autoClear = renderer.autoClear;
    const xr = renderer.xr.enabled;
    try {
      renderer.xr.enabled = false;
      renderer.autoClear = true;
      if (!this.initialized) {
        renderer.setClearColor(0, 0);
        for (const rt of [this.read, this.write]) {
          renderer.setRenderTarget(rt);
          renderer.clear();
        }
        this.initialized = true;
      }
      this.stepper.advance(delta, frozen, (time) => {
        this.material.uniforms.uTime!.value = time;
        this.material.uniforms.uState!.value = this.read.texture;
        renderer.setRenderTarget(this.write);
        renderer.render(this.scene, this.camera);
        [this.read, this.write] = [this.write, this.read];
      });
    } finally {
      renderer.setRenderTarget(target);
      renderer.setClearColor(clearColor, clearAlpha);
      renderer.autoClear = autoClear;
      renderer.xr.enabled = xr;
    }
  }

  dispose() {
    this.read.dispose();
    this.write.dispose();
    this.bed.dispose();
    this.bedSmooth.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }
}

export function supportsWaterSimulation(renderer: WebGLRenderer): boolean {
  return renderer.capabilities.isWebGL2 && renderer.extensions.has("EXT_color_buffer_float");
}
