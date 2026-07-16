// Gargantua: analytic gravitational-lensing shader on a world-fixed quad + far starfield.
import * as THREE from 'three';
import { CONFIG } from '../config.js';

const VERT = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv * 2.0 - 1.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform float uTime;

const float RS = 0.15;
const float FLAT = 0.22;
const float DISK_IN = 1.5;
const float DISK_OUT = 4.6;
const float HALO_IN = 1.02;
const float HALO_OUT = 1.8;
const float BEAM = 0.42;

float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
    u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.55;
  for (int i = 0; i < 3; i++) {
    v += a * vnoise(p);
    p = p * 2.13 + 17.7;
    a *= 0.5;
  }
  return v;
}

vec3 diskColor(float t) {
  vec3 hot = vec3(1.35, 1.28, 1.15);
  vec3 mid = vec3(1.45, 0.86, 0.42);
  vec3 cool = vec3(0.85, 0.32, 0.10);
  return t < 0.45 ? mix(hot, mid, t / 0.45) : mix(mid, cool, (t - 0.45) / 0.55);
}

float diskStreaks(float r, float theta, float tNorm) {
  float omega = 0.14 / pow(max(r, 0.35), 1.5);
  float n = fbm(vec2(log(r) * 5.5, theta * 3.5 - uTime * omega * 60.0));
  float n2 = fbm(vec2(log(r) * 11.0 + 40.0, theta * 7.0 - uTime * omega * 95.0));
  return 0.45 + 0.75 * n + 0.35 * n2;
}

float starLayer(vec2 p, float density, float bright) {
  vec2 cell = floor(p * density);
  vec2 f = fract(p * density);
  float h = hash21(cell);
  if (h > 0.06) return 0.0;
  vec2 sp = vec2(hash21(cell + 7.1), hash21(cell + 13.7));
  float d = length(f - sp);
  float sz = 0.04 + 0.10 * hash21(cell + 3.3);
  return bright * (0.3 + 0.7 * hash21(cell + 5.5)) * smoothstep(sz, 0.0, d);
}

void main() {
  vec2 u = vUv;
  float b = length(u);
  float rN = b / RS;

  float edgeFade = 1.0 - smoothstep(0.88, 0.995, b);

  float shadow = smoothstep(1.02, 0.94, rN);

  float photon = exp(-abs(rN - 1.06) * 16.0) * 1.6;

  vec3 col = vec3(0.0);
  float lum = 0.0;

  float defl = 0.55 * RS / max(b, 1e-4);
  float swirl = defl * defl * 90.0;
  float ca = cos(swirl); float sa = sin(swirl);
  vec2 wu = mat2(ca, -sa, sa, ca) * u;
  wu *= (1.0 - 0.35 * defl);
  float stars = starLayer(wu * 6.0, 9.0, 1.0) + starLayer(wu * 6.0 + 31.7, 21.0, 0.55);
  stars *= smoothstep(0.94, 1.35, rN);
  col += vec3(0.75, 0.82, 1.0) * stars;

  {
    vec2 q = vec2(u.x, u.y / FLAT);
    float rq = length(q) / RS;
    float theta = atan(q.y, q.x);
    float band = smoothstep(DISK_IN, DISK_IN + 0.55, rq) * (1.0 - smoothstep(DISK_OUT * 0.4, DISK_OUT * 0.92, rq));
    if (band > 0.001) {
      float tR = clamp((rq - DISK_IN) / (DISK_OUT - DISK_IN), 0.0, 1.0);
      float st = diskStreaks(rq * 0.3, theta, tR);
      float doppler = pow(1.0 + BEAM * cos(theta + 3.14159), 3.0);
      float frontMask = mix(smoothstep(1.06, 0.98, rN), 1.0, smoothstep(0.005, -0.005, u.y));
      float inGlow = 1.0 + 2.4 * exp(-(rq - DISK_IN) * 1.4);
      float fall = exp(-tR * tR * 3.4);
      float I = band * st * doppler * fall * inGlow * frontMask;
      col += diskColor(tR) * I * 1.35;
      lum += I;
    }
  }

  {
    float haloR = rN;
    float band = smoothstep(HALO_IN, HALO_IN + 0.07, haloR) * (1.0 - smoothstep(HALO_IN + 0.22, HALO_OUT, haloR));
    if (band > 0.001) {
      float theta = atan(u.y, u.x);
      float tR = clamp((haloR - HALO_IN) / (HALO_OUT - HALO_IN), 0.0, 1.0);
      float st = diskStreaks(haloR * 0.55 + 1.7, theta * 0.5, tR);
      float doppler = pow(1.0 + BEAM * 0.8 * cos(theta + 3.14159), 3.0);
      float vertBoost = 0.45 + 0.95 * abs(sin(theta));
      float I = band * st * doppler * vertBoost * exp(-tR * 2.6) * 0.95;
      col += diskColor(tR * 0.65) * I;
      lum += I;
    }
  }

  col += vec3(1.5, 1.25, 0.95) * photon;
  lum += photon;

  col *= (1.0 - shadow);
  lum *= (1.0 - shadow);

  float alpha = max(max(shadow, clamp(lum * 2.0, 0.0, 1.0)), clamp(stars * 1.5, 0.0, 1.0));
  alpha = max(alpha, smoothstep(1.35, 0.94, rN));
  alpha *= edgeFade;

  gl_FragColor = vec4(col * edgeFade, alpha);
}
`;

export function createBlackHole(scene) {
  const { bhDistance, bhSize, starCount, starRadius } = CONFIG.world;

  const uniforms = { uTime: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const dir = new THREE.Vector3(-0.62, 0.10, -0.78).normalize();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(bhSize, bhSize), mat);
  quad.position.copy(dir).multiplyScalar(bhDistance);
  quad.lookAt(0, 0, 0);
  quad.renderOrder = -1;
  scene.add(quad);

  const pos = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);
  const rng = mulberry(1337);
  for (let i = 0; i < starCount; i++) {
    const t = rng() * Math.PI * 2;
    const z = rng() * 2 - 1;
    const r = Math.sqrt(1 - z * z);
    pos[i * 3] = r * Math.cos(t) * starRadius;
    pos[i * 3 + 1] = z * starRadius;
    pos[i * 3 + 2] = r * Math.sin(t) * starRadius;
    const br = 0.25 + rng() * 0.75;
    const warm = rng() < 0.25 ? 0.85 : 1.0;
    colors[i * 3] = br;
    colors[i * 3 + 1] = br * (0.9 + 0.1 * warm);
    colors[i * 3 + 2] = br * warm * (0.95 + 0.25 * (1 - warm));
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
    size: 2.2, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false,
  }));
  stars.renderOrder = -2;
  scene.add(stars);

  return {
    quad,
    direction: dir,
    update(t) { uniforms.uTime.value = t; },
  };
}

function mulberry(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
