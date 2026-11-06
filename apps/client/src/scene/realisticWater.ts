import { beachHeightGlsl } from "./coastTerrain.ts";
import { SIM_DX } from "./waterSimulation.ts";
import { FIELD_HALF } from "./coastField.ts";

// Shared analytic wave spectrum: vertex displacement and fragment normals stay in phase.
// Original shader; no simulation code or assets are copied from the visual references.
const waves = /* glsl */ `
uniform float uTime;
uniform sampler2D uField;
uniform sampler2D uSimulation;
uniform sampler2D uBed;
uniform float uPhysical;
uniform float uSeaLevel;
uniform float uSeaHalf;

#define HALF ${FIELD_HALF.toFixed(1)}
vec4 coast(vec2 p) { return texture2D(uField, p / (2.0 * HALF) + 0.5); }
vec3 analyticWave(vec2 p) {
  vec3 result = vec3(0.0);
  for (int i = 0; i < WAVE_COUNT; i++) {
    float f = float(i);
    vec2 d = vec2(cos(0.65 + f * 2.399), sin(0.65 + f * 2.399));
    float k = 1.8 * pow(1.65, f);
    float a = 0.025 * pow(0.49, f);
    float phase = dot(d, p) * k - uTime * sqrt(1.8 * k);
    result += vec3(a * sin(phase), d * a * k * cos(phase));
  }
  return result;
}
vec3 wave(vec2 p) {
  vec3 analytic = analyticWave(p);
  if (uPhysical < 0.5) return analytic;
  vec2 uv = p / (2.0 * HALF) + 0.5;
  vec2 texel = vec2(${SIM_DX} / (2.0 * HALF), 0.0);
  float h = texture2D(uSimulation, uv).r;
  float gx = (texture2D(uSimulation, uv + texel.xy).r - texture2D(uSimulation, uv - texel.xy).r) / ${2 * SIM_DX};
  float gz = (texture2D(uSimulation, uv + texel.yx).r - texture2D(uSimulation, uv - texel.yx).r) / ${2 * SIM_DX};
  float edge = max(abs(p.x), abs(p.y));
  return mix(vec3(h, gx, gz), analytic, smoothstep(7.2, 8.8, edge));
}
${beachHeightGlsl}
`;

export const realisticVertex = /* glsl */ `
${waves}
varying vec3 vWorld;
void main() {
  // Concentrate the grid around the island, covering only the visible sea footprint.
  vec3 p = position;
  p.xy = sign(p.xy) * pow(abs(p.xy) / 100.0, vec2(2.0)) * uSeaHalf;
  vec4 w = modelMatrix * vec4(p, 1.0);
  float shore = coast(w.xz).r;
  // Leave harbors and land edges calm; never lift the water over playable intersections.
  #if WAVE_COUNT > 3
    w.y += wave(w.xz).x * (uPhysical > 0.5 ? 1.0 : smoothstep(0.55, 2.0, shore));
  #endif
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

export const realisticFragment = /* glsl */ `
${waves}
uniform sampler2D uSand;
uniform sampler2D uNoise;
uniform float uHasSand;
uniform float uHasNoise;
varying vec3 vWorld;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
             mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
}
float caustic(vec2 p) {
  if (uHasNoise > 0.5) return texture2D(uNoise, p).r;
  return pow(1.0 - abs(sin(p.x * 23.0 + sin(p.y * 19.0))
    * sin(p.y * 21.0 + sin(p.x * 17.0))), 8.0);
}
void main() {
  vec2 p = vWorld.xz;
  vec4 field = coast(p);
  float d = field.r;
  float tide = 0.25 + 0.055 * sin(uTime * 0.65 + field.b * 4.0);
  float depth = max(0.0, (d - tide) * 0.65 + max(field.g, 0.0) * 0.16);
  vec3 swell = wave(p);
  vec2 slope = swell.yz * (uPhysical > 0.5 ? 1.0 : smoothstep(0.2, 1.8, d));
  float bed = min(-0.005 - uSeaLevel, beachHeight(d));
  if (uPhysical > 0.5) {
    depth = max(0.0, vWorld.y - uSeaLevel - bed);
    // Actual geometry supplies exposed sand, rather than painting it on the sea.
    if (vWorld.y - uSeaLevel < bed || d < -0.18) discard;
  }
  #if WAVE_COUNT > 3
    slope += vec2(sin(p.x * 32.0 + p.y * 19.0 - uTime * 2.0),
                  cos(p.y * 29.0 - p.x * 17.0 + uTime * 1.7)) * 0.009;
  #endif
  vec3 N = normalize(vec3(-slope.x, 1.0, -slope.y));
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 L = normalize(vec3(-0.4, 0.8, -0.35));
  vec2 floorUv = (p + slope * min(depth, 1.0) * 0.8) * 0.5;
  vec3 sand = mix(vec3(0.53, 0.39, 0.21), vec3(0.76, 0.64, 0.41), noise(p * 5.0));
  if (uHasSand > 0.5) sand = texture2D(uSand, floorUv).rgb * vec3(0.9, 0.88, 0.8);
  // Beer-Lambert attenuation: warm seabed disappears into clear jade, then blue offshore.
  vec3 transmission = exp(-depth * vec3(2.4, 0.85, 0.58));
  vec3 deep = vec3(0.012, 0.105, 0.16);
  vec3 water = sand * transmission + deep * (1.0 - transmission);
  water += vec3(0.015, 0.19, 0.15) * (1.0 - exp(-depth * 3.0)) * exp(-depth * 0.65);
  float c = caustic(floorUv * 0.65 + vec2(uTime * 0.014, -uTime * 0.011));
  #if WAVE_COUNT > 3
    c = min(c, caustic(floorUv * 0.92 + vec2(-uTime * 0.009, uTime * 0.012)));
  #endif
  water += vec3(0.38, 0.55, 0.36) * c * exp(-depth * 1.3) * smoothstep(0.05, 0.4, depth);
  // Analytic sky reflection and a broad sun lobe, with the physical water Fresnel base of .02.
  vec3 R = reflect(-V, N);
  vec3 sky = mix(vec3(0.68, 0.78, 0.79), vec3(0.22, 0.43, 0.64), clamp(R.y, 0.0, 1.0));
  float fresnel = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec3 col = mix(water, sky, fresnel);
  float sun = pow(max(dot(reflect(-L, N), V), 0.0), 180.0);
  col += vec3(1.0, 0.89, 0.65) * sun * 0.85;

  // Dry beach → damp sand → transparent wash, using the same irregular shore field.
  float wet = smoothstep(tide - 0.2, tide + 0.05, d);
  vec3 beach = sand * mix(1.18, 0.68, wet);
  float sea = smoothstep(tide - 0.03, tide + 0.14, d);
  if (uPhysical < 0.5) col = mix(beach, col, sea);

  // Advancing surf fades in the backwash. Noise breaks the crest into lace, not drawn rings.
  float phase = d * 5.0 + field.b * 2.0 + uTime * 0.95;
  float crest = pow(0.5 + 0.5 * sin(phase), 12.0);
  float lace = noise(p * 13.0 + slope * 3.0 - uTime * 0.08);
  float foam = crest * smoothstep(0.28, 0.7, lace)
    * (1.0 - smoothstep(0.35, 1.6, d)) * smoothstep(tide, tide + 0.12, d);
  float wash = exp(-abs(d - tide - 0.055) * 35.0) * (0.3 + lace * 0.7);
  if (uPhysical > 0.5) {
    vec2 uv = p / (2.0 * HALF) + 0.5;
    float breaking = texture2D(uSimulation, uv).b;
    float obstacleBed = texture2D(uBed, uv).r;
    float contact = min(depth, max(0.0, vWorld.y - uSeaLevel - obstacleBed));
    wash = (1.0 - smoothstep(0.005, 0.065, contact)) * (0.35 + lace * 0.65);
    foam = breaking * (0.4 + lace * 0.6);
  }
  col = mix(col, vec3(0.88, 0.95, 0.89), clamp(foam * 0.65 + wash * 0.45, 0.0, 0.8));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
