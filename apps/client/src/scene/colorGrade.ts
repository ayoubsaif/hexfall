// Warm colour grade and vignette (specs/ambient-look). Runs last, on display (sRGB) colours, so
// the JS port below matches the shader exactly and lets tests check that terrains, seat colours
// and the red 6/8 numbers stay apart after grading.

/** Gain per channel: a gentle golden cast. */
export const WARMTH = [1.05, 1.0, 0.9] as const;
/** Cool lift added to the shadows (scaled by darkness), keeps dark areas from going muddy. */
export const SHADOW_TINT = [0.0, 0.012, 0.03] as const;
/** S-curve contrast blend, 0 = none. */
export const CONTRAST = 0.18;
/** Saturation multiplier around luma. */
export const SATURATION = 1.08;
/** Vignette: how dark the corners get, and where the fade starts and ends (0 = centre, 1 = corner). */
export const VIGNETTE = { strength: 0.3, start: 0.45, end: 1.0, tint: [0.22, 0.14, 0.08] } as const;

const LUMA = [0.2126, 0.7152, 0.0722] as const;
const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export type Rgb = readonly [number, number, number];

/** The grade (no vignette) on one display colour, channels 0..1. */
export function gradeColor(c: Rgb): Rgb {
  let r = c[0] * WARMTH[0],
    g = c[1] * WARMTH[1],
    b = c[2] * WARMTH[2];
  r += (smoothstep(0, 1, r) - r) * CONTRAST;
  g += (smoothstep(0, 1, g) - g) * CONTRAST;
  b += (smoothstep(0, 1, b) - b) * CONTRAST;
  const l = r * LUMA[0] + g * LUMA[1] + b * LUMA[2];
  r = l + (r - l) * SATURATION;
  g = l + (g - l) * SATURATION;
  b = l + (b - l) * SATURATION;
  const dark = 1 - clamp01(l);
  return [
    clamp01(r + SHADOW_TINT[0] * dark),
    clamp01(g + SHADOW_TINT[1] * dark),
    clamp01(b + SHADOW_TINT[2] * dark),
  ];
}

/** Vignette darkening at a screen point (uv 0..1, aspect = width / height); 0 = untouched. */
export function vignetteAmount(u: number, v: number, aspect: number): number {
  const x = (u - 0.5) * Math.min(aspect, 2),
    y = v - 0.5;
  const d = Math.hypot(x, y) / Math.hypot(0.5 * Math.min(aspect, 2), 0.5);
  return VIGNETTE.strength * smoothstep(VIGNETTE.start, VIGNETTE.end, d);
}

const v3 = (v: readonly number[]) => `vec3(${v.map((n) => n.toFixed(4)).join(", ")})`;
const f = (n: number) => n.toFixed(4);

/** Full-screen pass: `tDiffuse` in, graded and vignetted colour out (ShaderPass format). */
export const GradeShader = {
  name: "GradeShader",
  uniforms: {
    tDiffuse: { value: null },
    uAspect: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uAspect;
    varying vec2 vUv;
    void main() {
      vec4 src = texture2D(tDiffuse, vUv);
      vec3 c = src.rgb * ${v3(WARMTH)};
      c += (smoothstep(0.0, 1.0, c) - c) * ${f(CONTRAST)};
      float l = dot(c, ${v3(LUMA)});
      c = l + (c - l) * ${f(SATURATION)};
      c = clamp(c + ${v3(SHADOW_TINT)} * (1.0 - clamp(l, 0.0, 1.0)), 0.0, 1.0);
      float a = min(uAspect, 2.0);
      float d = length(vec2((vUv.x - 0.5) * a, vUv.y - 0.5)) / length(vec2(0.5 * a, 0.5));
      float vig = ${f(VIGNETTE.strength)} * smoothstep(${f(VIGNETTE.start)}, ${f(VIGNETTE.end)}, d);
      c = mix(c, c * ${v3(VIGNETTE.tint)}, vig);
      gl_FragColor = vec4(c, src.a);
    }`,
};
