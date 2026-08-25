// GLSL vertex/fragment shader source for the Aurora background's WebGL2 field.
export const AURORA_VERTEX_SHADER = `#version 300 es
in vec2 a_position;
out vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

// Blends a warped noise field across up to three model color territories.
export const AURORA_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_energy;
// x = model 0 weight, y = model 1 weight, z = model 2 weight (sums to ~1)
uniform vec3 u_weights;
uniform vec2 u_mouse;
uniform float u_mouseActive;
// 0 = full vibrancy, 1 = fully softened; rises only while previewing.
uniform float u_previewSoftness;

uniform vec3 u_colorPrimary0;
uniform vec3 u_colorSecondary0;
uniform vec3 u_colorHighlight0;
uniform vec3 u_colorPrimary1;
uniform vec3 u_colorSecondary1;
uniform vec3 u_colorHighlight1;
uniform vec3 u_colorPrimary2;
uniform vec3 u_colorSecondary2;
uniform vec3 u_colorHighlight2;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                      -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float fbm(vec2 p) {
  float sum = 0.0;
  float amp = 0.55;
  float freq = 1.0;
  for (int i = 0; i < 3; i++) {
    sum += amp * snoise(p * freq);
    freq *= 2.1;
    amp *= 0.55;
  }
  return sum;
}

vec2 warp(vec2 p, float t) {
  return vec2(
    fbm(p + t * 0.03),
    fbm(p + vec2(5.2, 1.3) - t * 0.025)
  );
}

void main() {
  vec2 p = v_uv - 0.5;
  p.x *= u_resolution.x / max(u_resolution.y, 1.0);

  float t = u_time;
  vec2 flow = vec2(0.05, -0.03) * t;

  // Bends the sampled space toward the cursor instead of adding a light.
  vec2 toMouse = p - u_mouse;
  float mouseDist = length(toMouse);
  float mouseInfluence = (1.0 - smoothstep(0.0, 0.5, mouseDist)) * u_mouseActive;
  vec2 bend = (toMouse / max(mouseDist, 0.0001)) * mouseInfluence * 0.12;
  vec2 pField = p - bend;

  vec2 warped = warp(pField * 1.45 + flow * 0.35, t);
  float field = fbm(pField * 1.9 + warped * 1.25 + flow);
  float n = field * 0.5 + 0.5;

  // Territory centers, each with its own slow orbital wobble.
  vec2 pos0 = vec2(-0.34, 0.16) + 0.15 * vec2(sin(t * 0.1), cos(t * 0.12));
  vec2 pos1 = vec2(0.0, 0.08) + 0.15 * vec2(cos(t * 0.085), sin(t * 0.105));
  vec2 pos2 = vec2(0.34, -0.08) + 0.15 * vec2(sin(t * 0.095 + 2.0), cos(t * 0.09 + 1.3));

  float d0 = length(pField - pos0);
  float d1 = length(pField - pos1);
  float d2 = length(pField - pos2);

  // Combines fields by max (not sum) so overlaps blend, not stack brighter.
  float presence0 = smoothstep(0.0, 0.18, u_weights.x);
  float presence1 = smoothstep(0.0, 0.18, u_weights.y);
  float presence2 = smoothstep(0.0, 0.18, u_weights.z);

  float focus0 = (1.0 - smoothstep(0.0, 0.85, d0)) * presence0;
  float focus1 = (1.0 - smoothstep(0.0, 0.85, d1)) * presence1;
  float focus2 = (1.0 - smoothstep(0.0, 0.85, d2)) * presence2;

  float focus = max(focus0, max(focus1, focus2));

  // Subtle mesh-like contour lines over the main field.
  float contour = 1.0 - smoothstep(0.0, 0.03, abs(fract(field * 4.5) - 0.5) - 0.44);

  // Each model's territory blends naturally with its neighbors by distance.
  float prox0 = 1.0 / (0.16 + d0 * d0 * 2.2);
  float prox1 = 1.0 / (0.16 + d1 * d1 * 2.2);
  float prox2 = 1.0 / (0.16 + d2 * d2 * 2.2);

  float inf0 = prox0 * u_weights.x;
  float inf1 = prox1 * u_weights.y;
  float inf2 = prox2 * u_weights.z;
  float totalInf = max(inf0 + inf1 + inf2, 0.0001);

  float w0 = inf0 / totalInf;
  float w1 = inf1 / totalInf;
  float w2 = inf2 / totalInf;

  vec3 colorLow = u_colorPrimary0 * w0 + u_colorPrimary1 * w1 + u_colorPrimary2 * w2;
  vec3 colorHigh = u_colorSecondary0 * w0 + u_colorSecondary1 * w1 + u_colorSecondary2 * w2;
  vec3 highlight = u_colorHighlight0 * w0 + u_colorHighlight1 * w1 + u_colorHighlight2 * w2;
  vec3 flowColor = mix(colorHigh, colorLow, n);

  // Softens a hovered preview by reducing saturation, not hue.
  float luma = dot(flowColor, vec3(0.299, 0.587, 0.114));
  flowColor = mix(flowColor, vec3(luma), u_previewSoftness * 0.4);

  float energyAmount = 0.3 + 0.42 * n + 0.68 * focus;
  energyAmount *= mix(1.0, 0.74, u_previewSoftness);
  vec3 energyColor = flowColor * energyAmount + highlight * contour * 0.14 * mix(1.0, 0.8, u_previewSoftness);

  vec3 bg = mix(
    vec3(0.022, 0.024, 0.033),
    vec3(0.005, 0.006, 0.011),
    clamp(length(p) * 1.1, 0.0, 1.0)
  );

  vec3 col = bg + energyColor * (0.4 + 0.62 * u_energy);
  col = 1.0 - exp(-col * 1.22);

  float vignette = 1.0 - smoothstep(0.3, 1.2, length(p));
  col = mix(bg, col, vignette);

  outColor = vec4(col, 1.0);
}
`;
