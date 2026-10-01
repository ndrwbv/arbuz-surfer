import * as THREE from 'three';

// ───────────────────────── utils
const $ = (id) => document.getElementById(id);
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const store = {
  get(k, d) { try { const v = localStorage.getItem('arbuz.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('arbuz.' + k, JSON.stringify(v)); } catch {} },
};

// ───────────────────────── content
const PASHA = [
  'Оль, есть минутка?', 'Созвонимся на 5 мин?', 'Глянь доку, плиз 🙏', 'Апрувни PR', 'А когда релиз?',
  'Тут вопросик…', 'Ты в офисе?', 'Добавил тебя в митинг', 'Срочно!!!', 'Видела мой коммент?', 'Пинг 👀',
  'Оль?', 'Можем синкнуться?', 'Обновил табличку', 'Ну что там?', 'Есть идея 💡', 'Напомню завтра',
  'Ответь в треде', 'Оль, ау', 'Это на сегодня',
];
const WISHES = [
  'Пусть каждая волна будет твоей 🌊', 'Больше закатов, арбузов и свободных вечеров 🍉',
  'Пусть Паша пишет только хорошие новости 😄', 'Самый красивый сёрфер на любом споте 🏄‍♀️',
  'Ветер — в спину, солнце — в лицо ☀️', 'Новых стран, дорог и вэна с доской 🚐',
  'Счастья размером с Атлантику 💙', 'Пусть дреды развеваются, а мечты сбываются ✨',
  'Тагазут, Бали, Португалия — всё будет 🌍', 'Тёплой воды и идеального сета 🤙',
  'Обнимаем крепче, чем волна накрывает 🫶', 'Пусть всё складывается легко, как закат над океаном 🌅',
];
const OVER_TITLES = ['Паша дописался 📩', 'Сообщение доставлено ✓✓', 'Пришлось ответить Паше', 'Паша поймал тебя в треде', 'Волна победила. Пока что'];
const RANKS = [
  [0, '🫧', 'Пенка'], [300, '🐚', 'Ракушка'], [700, '🏄‍♀️', 'Лонгбордистка'], [1300, '🌊', 'Покорительница Атлантики'],
  [2200, '🐬', 'Дельфин на минималках'], [3500, '👑', 'Королева волны'], [5200, '🍉', 'Арбузная легенда Тагазута'],
];
const PHOTOS = ['olya-beanie', 'olya-selfie', 'olya-denim', 'olya-texaco', 'olya-braid'];

// ───────────────────────── renderer / scene
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

const scene = new THREE.Scene();
const FOG_HEX = '#f6b98f';
scene.fog = new THREE.Fog(FOG_HEX, 45, 270);
// our shaders mix fog in output (sRGB) space, the same way three.js does
const fogOut = new THREE.Vector3(); { const c = new THREE.Color(FOG_HEX); const o = {}; c.getRGB(o, THREE.SRGBColorSpace); fogOut.set(o.r, o.g, o.b); }

const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1200);
const SUN_DIR = new THREE.Vector3(0.2, 0.075, -1).normalize();

scene.add(new THREE.HemisphereLight('#ffd6b0', '#2a6f78', 1.25));
const sunLight = new THREE.DirectionalLight('#ffb27a', 2.4);
sunLight.position.copy(SUN_DIR).multiplyScalar(60);
scene.add(sunLight);
const fillLight = new THREE.DirectionalLight('#cfe0ff', 1.15);
fillLight.position.set(-4, 7, 12);
scene.add(fillLight);

const GLSL_NOISE = /* glsl */`
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1.,0.)), u.x), mix(hash(i+vec2(0.,1.)), hash(i+vec2(1.,1.)), u.x), u.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a*noise(p); p *= 2.03; a *= 0.5; } return v; }
`;

// ───────────────────────── sky
const skyMat = new THREE.ShaderMaterial({
  uniforms: {
    uSun: { value: SUN_DIR }, uTime: { value: 0 }, uHorizon: { value: fogOut },
    uMid: { value: new THREE.Vector3(0.93, 0.55, 0.47) }, uTop: { value: new THREE.Vector3(0.33, 0.33, 0.55) },
  },
  vertexShader: /* glsl */`varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
  fragmentShader: /* glsl */`
    uniform vec3 uSun, uHorizon, uMid, uTop; uniform float uTime; varying vec3 vDir;
    ${GLSL_NOISE}
    void main(){
      vec3 d = normalize(vDir); float h = d.y;
      vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.2, h));
      col = mix(col, uTop, smoothstep(0.16, 0.8, h));
      float s = max(dot(d, uSun), 0.0);
      col += vec3(1.0, 0.55, 0.25) * pow(s, 6.0) * 0.32;
      col += vec3(1.0, 0.8, 0.5) * pow(s, 48.0) * 0.55;
      vec2 cp = vec2(atan(d.x, -d.z) * 5.0 + uTime * 0.004, h * 30.0);
      float c = fbm(vec2(cp.x, cp.y * 0.45) * vec2(1.0, 2.6));
      float band = smoothstep(0.035, 0.1, h) * (1.0 - smoothstep(0.2, 0.42, h));
      c = smoothstep(0.52, 0.82, c) * band;
      vec3 cloud = mix(vec3(0.99, 0.62, 0.6), vec3(1.0, 0.88, 0.62), pow(s, 2.5));
      col = mix(col, cloud, c * 0.75);
      float disc = smoothstep(0.99925, 0.9996, s);
      col = mix(col, vec3(1.0, 0.96, 0.86), disc);
      col = mix(col, uHorizon, smoothstep(0.015, -0.03, h));
      gl_FragColor = vec4(col, 1.0);
    }`,
  side: THREE.BackSide, depthWrite: false, fog: false,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), skyMat);
sky.renderOrder = -10;
scene.add(sky);

// ───────────────────────── ocean + the wave wall
const WALL_X0 = -3.6, WALL_X1 = -11, WALL_H = 8.5;
const LANES = [-2.7, 0, 2.7];
function waveH(x, p, t) {
  return Math.sin(p * 0.18 + t * 1.1 + x * 0.05) * 0.22 + Math.sin(p * 0.37 - x * 0.21 + t * 1.7) * 0.12
    + Math.sin(x * 0.6 + p * 0.11 + t * 2.3) * 0.06 + Math.sin(p * 0.9 + x * 0.4 - t * 2.9) * 0.035;
}
const GLSL_WAVES = /* glsl */`
float waves(vec2 p, float t){
  return sin(p.y*0.18 + t*1.1 + p.x*0.05)*0.22 + sin(p.y*0.37 - p.x*0.21 + t*1.7)*0.12
       + sin(p.x*0.6 + p.y*0.11 + t*2.3)*0.06 + sin(p.y*0.9 + p.x*0.4 - t*2.9)*0.035;
}
float wallH(float x){ float t = clamp((${WALL_X0.toFixed(2)} - x) / ${(WALL_X0 - WALL_X1).toFixed(2)}, 0.0, 1.0); return pow(t, 1.8) * ${WALL_H.toFixed(2)}; }
`;
const waterUniforms = {
  uTime: { value: 0 }, uDist: { value: 0 }, uSun: { value: SUN_DIR },
  uDeep: { value: new THREE.Color('#0b4250') }, uShallow: { value: new THREE.Color('#1d8a8c') },
  uWallLight: { value: new THREE.Color('#62d6c4') }, uFoam: { value: new THREE.Color('#fff5e8') },
  uSkyRefl: { value: new THREE.Color('#f7b68e') }, uSunCol: { value: new THREE.Color('#ffd49c') },
  uFogColor: { value: fogOut }, uFogNear: { value: 45 }, uFogFar: { value: 270 },
};
const waterMat = new THREE.ShaderMaterial({
  uniforms: waterUniforms,
  vertexShader: /* glsl */`
    uniform float uTime, uDist;
    varying vec3 vWorld; varying vec3 vN; varying float vWave; varying float vWall;
    ${GLSL_WAVES}
    void main(){
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vec2 p = vec2(wp.x, wp.z - uDist);
      float w = waves(p, uTime); float wl = wallH(wp.x);
      float e = 0.2;
      float hx = waves(p + vec2(e, 0.0), uTime) + wallH(wp.x + e);
      float hz = waves(p + vec2(0.0, e), uTime) + wl;
      float h = w + wl;
      vN = normalize(vec3(h - hx, e, h - hz));
      wp.y += h; vWorld = wp.xyz; vWave = w; vWall = wl;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`,
  fragmentShader: /* glsl */`
    uniform float uTime, uDist, uFogNear, uFogFar; uniform vec3 uSun, uDeep, uShallow, uWallLight, uFoam, uSkyRefl, uSunCol, uFogColor;
    varying vec3 vWorld; varying vec3 vN; varying float vWave; varying float vWall;
    ${GLSL_NOISE}
    void main(){
      vec3 n = normalize(vN);
      vec3 V = normalize(cameraPosition - vWorld);
      float ndv = max(dot(n, V), 0.0);
      float fres = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);
      vec2 p = vec2(vWorld.x, vWorld.z - uDist);
      float wallT = clamp(vWall / ${WALL_H.toFixed(2)}, 0.0, 1.0);
      vec3 base = mix(uDeep, uShallow, 0.2 + 0.55 * smoothstep(-0.25, 0.35, vWave));
      float trans = smoothstep(0.12, 0.8, wallT);
      base = mix(base, uWallLight, trans * 0.85);
      float streak = noise(vec2(p.x * 1.4, p.y * 0.1 + uTime * 0.25));
      base *= 0.82 + 0.36 * streak * smoothstep(0.02, 0.3, wallT);
      vec3 col = base * (0.62 + 0.38 * max(dot(n, normalize(vec3(0.2, 1.0, 0.6))), 0.0));
      vec3 R = reflect(-V, n);
      vec3 refl = mix(uSkyRefl, uSkyRefl * vec3(0.7, 0.62, 0.8), clamp(R.y * 1.6, 0.0, 1.0));
      col = mix(col, refl, clamp(fres * 0.9, 0.0, 0.9) * (1.0 - trans * 0.6));
      float sd = max(dot(R, uSun), 0.0);
      col += uSunCol * (pow(sd, 380.0) * 5.0 + pow(sd, 36.0) * 0.45);
      float gl = noise(p * vec2(3.2, 1.1) + vec2(0.0, uTime * 2.2));
      col += uSunCol * smoothstep(0.86, 0.97, gl) * pow(sd, 60.0) * 0.9;
      float fn = noise(p * vec2(1.3, 0.55) + vec2(0.0, uTime * 0.6)) * 0.6 + noise(p * 4.0 + uTime) * 0.4;
      float f = smoothstep(0.4, 0.52, vWave + fn * 0.1) * 0.3;
      f += smoothstep(0.82, 0.98, wallT + fn * 0.12);
      float baseLine = 1.0 - smoothstep(0.0, 1.5, abs(vWorld.x + 4.1 + sin(p.y * 0.21) * 0.45));
      f += baseLine * smoothstep(0.45, 0.8, fn) * 0.8;
      col = mix(col, uFoam, clamp(f, 0.0, 1.0) * 0.92);
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      float dist = length(vWorld - cameraPosition);
      gl_FragColor.rgb = mix(gl_FragColor.rgb, uFogColor, smoothstep(uFogNear, uFogFar, dist));
    }`,
});
{
  const geo = new THREE.PlaneGeometry(2, 2, 170, 300);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i), v = pos.getZ(i); // both -1..1
    const s = (u + 1) / 2;
    const x = -14 + 104 * Math.pow(s, 1.65);
    const z = v < 0 ? -340 * Math.pow(-v, 1.7) : 220 * Math.pow(v, 1.7);
    pos.setXYZ(i, x, 0, z);
  }
  geo.computeBoundingSphere();
  geo.boundingSphere.radius = 1e5;
  const water = new THREE.Mesh(geo, waterMat);
  water.frustumCulled = false;
  scene.add(water);
}
// curling lip of the wave
const lipMat = new THREE.ShaderMaterial({
  uniforms: { uTime: waterUniforms.uTime, uDist: waterUniforms.uDist, uWallLight: waterUniforms.uWallLight, uFoam: waterUniforms.uFoam, uShallow: waterUniforms.uShallow, uFogColor: { value: fogOut }, uFogNear: { value: 45 }, uFogFar: { value: 270 } },
  vertexShader: /* glsl */`
    uniform float uTime, uDist; varying float vV; varying vec3 vWorld; varying float vZ;
    void main(){
      vec3 pos = position; float pz = pos.z - uDist;
      float wob = sin(pz * 0.21 + uTime * 1.3) * 0.16 + sin(pz * 0.065 - uTime * 0.5) * 0.28;
      pos += normal * wob * uv.y; pos.y += wob * 0.25 * uv.y;
      vV = uv.y; vZ = pz;
      vec4 wp = modelMatrix * vec4(pos, 1.0); vWorld = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`,
  fragmentShader: /* glsl */`
    uniform float uTime, uFogNear, uFogFar; uniform vec3 uWallLight, uFoam, uShallow, uFogColor;
    varying float vV; varying vec3 vWorld; varying float vZ;
    ${GLSL_NOISE}
    void main(){
      float n = noise(vec2(vV * 9.0, vZ * 0.35 + uTime * 0.9)) * 0.6 + noise(vec2(vV * 26.0, vZ * 1.4 - uTime * 2.0)) * 0.4;
      vec3 col = mix(uWallLight, uShallow, smoothstep(0.55, 1.0, vV) * 0.5);
      float foam = smoothstep(0.18, 0.42, vV) * (1.0 - smoothstep(0.5, 0.78, vV));
      foam += smoothstep(0.72, 0.95, vV);
      foam = clamp(foam + (n - 0.5) * 0.7, 0.0, 1.0);
      col = mix(col, uFoam, foam);
      float a = 1.0 - smoothstep(0.86, 1.0, vV + (n - 0.5) * 0.25);
      if (a < 0.02) discard;
      gl_FragColor = vec4(col, a);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      gl_FragColor.rgb = mix(gl_FragColor.rgb, uFogColor, smoothstep(uFogNear, uFogFar, length(vWorld - cameraPosition)));
    }`,
  transparent: true, side: THREE.DoubleSide,
});
const LIP = { cx: -9.6, cy: 8.4, r: 1.95, a0: Math.PI, a1: -1.25 };
{
  const NZ = 220, NA = 26, z0 = 60, z1 = -330;
  const positions = [], normals = [], uvs = [], idx = [];
  for (let i = 0; i <= NZ; i++) {
    const t = i / NZ; const z = lerp(z0, z1, Math.pow(t, 1.25));
    for (let j = 0; j <= NA; j++) {
      const v = j / NA; const a = lerp(LIP.a0, LIP.a1, v);
      const r = LIP.r * (1 - 0.12 * v);
      positions.push(LIP.cx + Math.cos(a) * r, LIP.cy + Math.sin(a) * r, z);
      normals.push(Math.cos(a), Math.sin(a), 0);
      uvs.push(t, v);
    }
  }
  for (let i = 0; i < NZ; i++) for (let j = 0; j < NA; j++) {
    const a = i * (NA + 1) + j, b = a + NA + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  const lip = new THREE.Mesh(g, lipMat);
  lip.frustumCulled = false;
  scene.add(lip);
}

// ───────────────────────── particles
const MAXP = 2400;
const P = {
  pos: new Float32Array(MAXP * 3), col: new Float32Array(MAXP * 3), size: new Float32Array(MAXP), alpha: new Float32Array(MAXP),
  vel: new Float32Array(MAXP * 3), life: new Float32Array(MAXP), max: new Float32Array(MAXP), grav: new Float32Array(MAXP),
  scroll: new Uint8Array(MAXP), base: new Float32Array(MAXP), next: 0,
};
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(P.pos, 3).setUsage(THREE.DynamicDrawUsage));
pGeo.setAttribute('pcolor', new THREE.BufferAttribute(P.col, 3).setUsage(THREE.DynamicDrawUsage));
pGeo.setAttribute('psize', new THREE.BufferAttribute(P.size, 1).setUsage(THREE.DynamicDrawUsage));
pGeo.setAttribute('palpha', new THREE.BufferAttribute(P.alpha, 1).setUsage(THREE.DynamicDrawUsage));
const pMat = new THREE.ShaderMaterial({
  uniforms: { uScale: { value: 400 } },
  vertexShader: /* glsl */`
    attribute vec3 pcolor; attribute float psize; attribute float palpha; uniform float uScale;
    varying vec3 vC; varying float vA;
    void main(){ vC = pcolor; vA = palpha; vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = psize * uScale / max(-mv.z, 0.1); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: /* glsl */`
    varying vec3 vC; varying float vA;
    void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5 || vA < 0.01) discard;
      gl_FragColor = vec4(vC, smoothstep(0.5, 0.15, d) * vA); }`,
  transparent: true, depthWrite: false,
});
const points = new THREE.Points(pGeo, pMat);
points.frustumCulled = false;
scene.add(points);
const _c = new THREE.Color();
function emit(x, y, z, vx, vy, vz, life, size, color, grav = 14, scroll = 1) {
  const i = P.next; P.next = (P.next + 1) % MAXP;
  P.pos[i * 3] = x; P.pos[i * 3 + 1] = y; P.pos[i * 3 + 2] = z;
  P.vel[i * 3] = vx; P.vel[i * 3 + 1] = vy; P.vel[i * 3 + 2] = vz;
  _c.set(color); P.col[i * 3] = _c.r; P.col[i * 3 + 1] = _c.g; P.col[i * 3 + 2] = _c.b;
  P.life[i] = life; P.max[i] = life; P.base[i] = size; P.grav[i] = grav; P.scroll[i] = scroll;
}
function burst(x, y, z, n, opt = {}) {
  const { spread = 3, up = 5, life = 0.8, size = 0.25, colors = ['#ffffff'], grav = 14, scroll = 1 } = opt;
  for (let k = 0; k < n; k++) {
    emit(x + rand(-0.3, 0.3), y + rand(-0.2, 0.2), z + rand(-0.3, 0.3), rand(-spread, spread), rand(up * 0.4, up), rand(-spread, spread),
      life * rand(0.6, 1.2), size * rand(0.6, 1.3), pick(colors), grav, scroll);
  }
}
function updateParticles(dt, dz) {
  for (let i = 0; i < MAXP; i++) {
    if (P.life[i] <= 0) { P.alpha[i] = 0; continue; }
    P.life[i] -= dt;
    const k = i * 3;
    P.vel[k + 1] -= P.grav[i] * dt;
    P.pos[k] += P.vel[k] * dt; P.pos[k + 1] += P.vel[k + 1] * dt; P.pos[k + 2] += P.vel[k + 2] * dt + (P.scroll[i] ? dz : 0);
    const t = clamp(P.life[i] / P.max[i], 0, 1);
    P.alpha[i] = Math.min(1, t * 2.2);
    P.size[i] = P.base[i] * (0.6 + 0.6 * (1 - t));
  }
  pGeo.attributes.position.needsUpdate = true; pGeo.attributes.psize.needsUpdate = true;
  pGeo.attributes.palpha.needsUpdate = true; pGeo.attributes.pcolor.needsUpdate = true;
}

// ───────────────────────── Olya
const MAT = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0, ...o });
const mats = {
  skin: MAT('#d99c76', { roughness: 0.6 }), denim: MAT('#7895c2', { roughness: 0.9 }), denimDark: MAT('#5c79a8', { roughness: 0.9 }),
  black: MAT('#1f1e23'), shorts: MAT('#2c2b31'), cap: MAT('#8d9095', { roughness: 0.95 }), brim: MAT('#4a4c51', { roughness: 0.9 }),
  glasses: MAT('#0f0f12', { roughness: 0.2, metalness: 0.4 }), board: MAT('#f6b51e', { roughness: 0.35 }), stripe: MAT('#e8452c', { roughness: 0.4 }),
  white: MAT('#fbf7ef', { roughness: 0.5 }), hairBase: MAT('#33201a'),
};
const HAIR_SEG = 8;
const hairMats = Array.from({ length: HAIR_SEG }, (_, i) => {
  const c = new THREE.Color('#3a2418').lerp(new THREE.Color('#c98d52'), Math.pow(i / (HAIR_SEG - 1), 1.4));
  return MAT(c, { roughness: 0.85 });
});
const glowables = [];
const UNIT_CYL = new THREE.CylinderGeometry(1, 1, 1, 10);
const UNIT_SPH = new THREE.SphereGeometry(1, 18, 12);
const _v1 = new THREE.Vector3(), _UP = new THREE.Vector3(0, 1, 0);
function setLimb(m, a, b, r) {
  _v1.subVectors(b, a); const L = _v1.length();
  m.position.copy(a).addScaledVector(_v1, 0.5);
  m.quaternion.setFromUnitVectors(_UP, _v1.normalize());
  m.scale.set(r, L, r);
}
function sph(mat, sx, sy, sz, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(UNIT_SPH, mat); m.scale.set(sx, sy ?? sx, sz ?? sx); m.position.set(x, y, z); return m;
}

function makeBoard() {
  const L = 2.7, W = 0.37, N = 26, pts = [];
  const w = (t) => W * Math.pow(Math.sin(Math.PI * (t * 0.86)), 0.58);
  for (let i = 0; i <= N; i++) { const t = i / N; pts.push(new THREE.Vector2(w(t), L / 2 - t * L)); }
  for (let i = N; i >= 0; i--) { const t = i / N; pts.push(new THREE.Vector2(-w(t), L / 2 - t * L)); }
  const shape = new THREE.Shape(pts);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.03, bevelSegments: 3 });
  geo.rotateX(-Math.PI / 2); geo.translate(0, 0.03, 0);
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, mats.board));
  const stringer = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.006, 2.45), mats.white); stringer.position.y = 0.108; g.add(stringer);
  for (const z of [-0.78, -0.88]) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.007, 0.045), mats.stripe); s.position.set(0, 0.108, z); g.add(s); }
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.16, 0.16), mats.white); fin.position.set(0, -0.04, 1.12); fin.rotation.x = 0.4; g.add(fin);
  return g;
}

function makeOlya() {
  const root = new THREE.Group();      // world position (x, y)
  const model = new THREE.Group();     // tricks spin
  root.add(model);
  const board = makeBoard(); model.add(board);
  const rider = new THREE.Group(); rider.rotation.y = -Math.PI / 2; rider.position.y = 0.1; model.add(rider);

  const legs = {};
  for (const s of [-1, 1]) {
    const thigh = new THREE.Mesh(UNIT_CYL, mats.skin), shin = new THREE.Mesh(UNIT_CYL, mats.skin);
    const shorts = new THREE.Mesh(UNIT_CYL, mats.shorts), knee = sph(mats.skin, 0.06), foot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.24), mats.skin);
    rider.add(thigh, shin, shorts, knee, foot);
    legs[s] = { thigh, shin, shorts, knee, foot };
  }
  const pelvis = sph(mats.shorts, 0.17, 0.12, 0.13); rider.add(pelvis);

  const torso = new THREE.Group(); torso.rotation.order = 'YXZ'; rider.add(torso);
  torso.add(sph(mats.denim, 0.21, 0.14, 0.155, 0, 0.06, 0));            // shirt hem
  torso.add(sph(mats.denim, 0.19, 0.26, 0.135, 0, 0.29, 0));             // chest
  torso.add(sph(mats.black, 0.13, 0.18, 0.08, 0, 0.29, 0.075));          // black top under open shirt
  const collarL = sph(mats.denimDark, 0.05, 0.1, 0.03, 0.08, 0.45, 0.1); collarL.rotation.z = -0.5; torso.add(collarL);
  const collarR = sph(mats.denimDark, 0.05, 0.1, 0.03, -0.08, 0.45, 0.1); collarR.rotation.z = 0.5; torso.add(collarR);
  const neck = new THREE.Mesh(UNIT_CYL, mats.skin); neck.scale.set(0.045, 0.14, 0.045); neck.position.y = 0.55; torso.add(neck);

  const arms = {};
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * 0.19, 0.46, 0); sh.rotation.order = 'ZXY'; torso.add(sh);
    sh.add(sph(mats.denim, 0.065));
    const upper = new THREE.Mesh(UNIT_CYL, mats.denim); upper.scale.set(0.055, 0.27, 0.055); upper.position.y = -0.135; sh.add(upper);
    const elbow = new THREE.Group(); elbow.position.y = -0.27; sh.add(elbow);
    const cuff = new THREE.Mesh(UNIT_CYL, mats.denimDark); cuff.scale.set(0.062, 0.07, 0.062); cuff.position.y = -0.01; elbow.add(cuff);
    const fore = new THREE.Mesh(UNIT_CYL, mats.skin); fore.scale.set(0.042, 0.25, 0.042); fore.position.y = -0.125; elbow.add(fore);
    const hand = sph(mats.skin, 0.048, 0.06, 0.035, 0, -0.27, 0); elbow.add(hand);
    arms[s] = { sh, elbow, hand };
  }

  const head = new THREE.Group(); head.position.y = 0.6; head.rotation.order = 'YXZ'; torso.add(head);
  head.add(sph(mats.skin, 0.118, 0.135, 0.125, 0, 0.1, 0.005));
  head.add(sph(mats.skin, 0.02, 0.026, 0.02, 0, 0.085, 0.128));                 // nose
  for (const s of [-1, 1]) {
    head.add(sph(mats.skin, 0.022, 0.034, 0.018, s * 0.118, 0.095, -0.005));      // ears
    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.04, 0.014), mats.glasses); lens.position.set(s * 0.048, 0.118, 0.118); lens.rotation.y = s * 0.18; head.add(lens);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.008, 0.12), mats.glasses); arm.position.set(s * 0.116, 0.122, 0.06); head.add(arm);
  }
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.008, 0.01), mats.glasses); bridge.position.set(0, 0.126, 0.124); head.add(bridge);
  const lips = sph(new THREE.MeshStandardMaterial({ color: '#b86a5e', roughness: 0.6 }), 0.03, 0.01, 0.01, 0, 0.035, 0.118); head.add(lips);
  // backwards cap
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.135, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mats.cap);
  crown.scale.set(1.03, 0.82, 1.08); crown.position.set(0, 0.15, -0.005); head.add(crown);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.142, 0.035, 24, 1, true), mats.cap); band.scale.set(1.03, 1, 1.08); band.position.set(0, 0.155, -0.005); head.add(band);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.014, 24, 1, false, Math.PI / 2, Math.PI), mats.brim);
  brim.scale.set(1, 1, 1.25); brim.position.set(0, 0.155, -0.1); brim.rotation.x = -0.12; head.add(brim);
  const snap = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.03, 0.01), mats.black); snap.position.set(0, 0.17, 0.142); head.add(snap);
  const button = sph(mats.cap, 0.018, 0.012, 0.018, 0, 0.262, -0.005); head.add(button);
  // hair: long dreads streaming in the wind, dark roots → honey tips
  head.add(sph(mats.hairBase, 0.128, 0.12, 0.12, 0, 0.1, -0.035));
  const strands = [];
  const NS = 16;
  for (let k = 0; k < NS; k++) {
    const f = k / (NS - 1);
    const phi = Math.PI * (0.48 + f * 1.04);
    const pivot = new THREE.Group(); pivot.rotation.order = 'YXZ';
    pivot.position.set(Math.sin(phi) * 0.112, 0.07 + (k % 3) * 0.022, Math.cos(phi) * 0.112 - 0.01);
    pivot.rotation.y = (phi - Math.PI) * 0.55;
    head.add(pivot);
    const segs = []; let parent = pivot;
    const len = rand(0.075, 0.095);
    for (let i = 0; i < HAIR_SEG; i++) {
      const r = 0.024 - i * 0.0016;
      const seg = new THREE.Group(); if (i > 0) seg.position.y = -len; parent.add(seg);
      const m = new THREE.Mesh(UNIT_CYL, hairMats[i]); m.scale.set(r, len * 1.12, r); m.position.y = -len / 2; seg.add(m);
      segs.push(seg); parent = seg;
    }
    strands.push({ pivot, segs, phase: rand(0, 6.28), lift: rand(-0.15, 0.2), side: Math.sin(phi) });
  }

  // balloons (visible during boost)
  const balloons = new THREE.Group(); balloons.visible = false; root.add(balloons);
  const bcols = ['#ff4f7b', '#ffc93c', '#4fd1c5', '#ff8a3d'];
  const balloonList = [];
  bcols.forEach((c, i) => {
    const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.25, emissive: c, emissiveIntensity: 0.25 });
    const b = sph(m, 0.26, 0.31, 0.26); balloons.add(b);
    const knot = sph(m, 0.04); balloons.add(knot);
    const str = new THREE.Mesh(UNIT_CYL, mats.white); balloons.add(str);
    balloonList.push({ b, knot, str, ph: i * 1.7, off: new THREE.Vector3((i - 1.5) * 0.36, 2.7 + (i % 2) * 0.35, 0.5 + (i % 2) * 0.2) });
  });
  // golden halo for boost
  const haloTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,230,140,1)'); gr.addColorStop(0.4, 'rgba(255,170,70,.5)'); gr.addColorStop(1, 'rgba(255,120,60,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
  halo.scale.set(3.4, 3.4, 1); halo.position.y = 1.0; root.add(halo);
  // soft shadow
  const shTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(0,30,40,.55)'); gr.addColorStop(1, 'rgba(0,30,40,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 3.2), new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false, fog: false }));
  shadow.rotation.x = -Math.PI / 2; scene.add(shadow);

  return { root, model, board, rider, legs, pelvis, torso, arms, head, strands, balloons, balloonList, halo, shadow };
}

const olya = makeOlya();
olya.model.scale.setScalar(1.1);
scene.add(olya.root);

const _hipL = new THREE.Vector3(), _foot = new THREE.Vector3(), _knee = new THREE.Vector3(), _mid = new THREE.Vector3(), _fw = new THREE.Vector3(), _axis = new THREE.Vector3();
function poseOlya(t, duck, air, carve, wind) {
  const o = olya;
  const bob = Math.sin(t * 3.4) * 0.025 * (1 - air);
  const hipY = 0.8 - duck * 0.32 - air * 0.12 + bob;
  const lean = carve * 0.1;
  o.pelvis.position.set(0.02, hipY, -0.03);
  for (const s of [-1, 1]) {
    const L = o.legs[s];
    _hipL.set(s * 0.1 + 0.02, hipY - 0.02, -0.03);
    _foot.set(s * (0.46 - air * 0.06), 0.04 + air * 0.05 * (s > 0 ? 1 : 0.4), s > 0 ? 0.0 : 0.03);
    const d = _hipL.distanceTo(_foot), seg = 0.47;
    const h = Math.sqrt(Math.max(0, seg * seg - (d / 2) * (d / 2)));
    _mid.addVectors(_hipL, _foot).multiplyScalar(0.5);
    _axis.subVectors(_foot, _hipL).normalize();
    _fw.set(s * 0.3, 0, 1); _fw.addScaledVector(_axis, -_fw.dot(_axis)).normalize();
    _knee.copy(_mid).addScaledVector(_fw, h);
    setLimb(L.thigh, _hipL, _knee, 0.068);
    setLimb(L.shin, _knee, _foot, 0.052);
    _mid.lerpVectors(_hipL, _knee, 0.5);
    setLimb(L.shorts, _hipL, _mid, 0.085);
    L.knee.position.copy(_knee);
    L.foot.position.set(_foot.x, 0.03, _foot.z + 0.04);
  }
  o.torso.position.set(0.02, hipY, -0.03);
  o.torso.rotation.set(0.28 + duck * 0.5 + air * 0.15, -0.55 + Math.sin(t * 1.3) * 0.05, lean + Math.sin(t * 2.1) * 0.03);
  o.head.rotation.set(-0.15 - duck * 0.25, -0.62 + Math.sin(t * 0.9) * 0.08, 0);
  const swing = Math.sin(t * 2.2) * 0.12;
  o.arms[1].sh.rotation.set(0.45 + swing - air * 0.4, 0, 1.15 + air * 0.5 + carve * 0.2);
  o.arms[1].elbow.rotation.x = -0.5;
  o.arms[-1].sh.rotation.set(-0.35 - swing * 0.7 - air * 0.3, 0, -1.05 - air * 0.45 + carve * 0.2);
  o.arms[-1].elbow.rotation.x = -0.35;
  for (const s of o.strands) {
    s.pivot.rotation.x = 1.05 + wind * 0.45 + s.lift + Math.sin(t * 7 + s.phase) * 0.08;
    s.pivot.rotation.z = Math.sin(t * 5.2 + s.phase) * 0.1;
    for (let i = 1; i < s.segs.length; i++) {
      const g = s.segs[i];
      g.rotation.x = -0.07 * (1.2 - wind) + Math.sin(t * (8 + wind * 6) - i * 0.85 + s.phase) * (0.1 + i * 0.022) * (0.6 + wind);
      g.rotation.z = Math.sin(t * 6.1 - i * 0.6 + s.phase * 1.3) * 0.07 * (0.5 + wind);
    }
  }
}

// ───────────────────────── canvas textures
const texCache = new Map();
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
const BW = 2.45, BH = 0.96;
function bubbleTexture(text) {
  if (texCache.has(text)) return texCache.get(text);
  const W = 640, H = 250, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  roundRect(g, 0, 0, W, H, 52); g.fillStyle = '#ffffff'; g.fill();
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(230,236,245,.9)'); g.fillStyle = gr; g.fill();
  const ax = 78, ay = H / 2;
  const ag = g.createLinearGradient(ax - 46, ay - 46, ax + 46, ay + 46); ag.addColorStop(0, '#ff9a5a'); ag.addColorStop(1, '#ff4f7b');
  g.fillStyle = ag; g.beginPath(); g.arc(ax, ay, 48, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff'; g.font = '800 36px Manrope, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ПП', ax, ay + 2);
  g.fillStyle = '#3ad16f'; g.beginPath(); g.arc(ax + 34, ay + 34, 10, 0, Math.PI * 2); g.fill(); g.lineWidth = 4; g.strokeStyle = '#fff'; g.stroke();
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.fillStyle = '#2f8fe8'; g.font = '800 32px Manrope, sans-serif'; g.fillText('Паша Притчин', 148, 82);
  let fs = 52; g.font = `800 ${fs}px Manrope, sans-serif`;
  while (g.measureText(text).width > W - 180 && fs > 26) { fs -= 2; g.font = `800 ${fs}px Manrope, sans-serif`; }
  g.fillStyle = '#17161b'; g.fillText(text, 148, 156);
  g.font = '700 25px Manrope, sans-serif'; g.fillStyle = '#9aa0ab'; g.textAlign = 'right';
  g.fillText(`${randi(9, 23)}:${String(randi(0, 59)).padStart(2, '0')}  ✓✓`, W - 36, H - 30);
  g.fillStyle = '#ff3b4e'; g.beginPath(); g.arc(W - 46, 46, 22, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff'; g.font = '800 26px Manrope, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(randi(2, 99)), W - 46, 48);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  texCache.set(text, tex);
  return tex;
}
const bubbleGeo = (() => {
  const w = BW, h = BH, r = 0.18, s = new THREE.Shape();
  const x0 = -w / 2, y0 = -h / 2;
  s.moveTo(x0 + r, y0);
  s.lineTo(x0 + 0.62, y0); s.lineTo(x0 + 0.3, y0 - 0.26); s.lineTo(x0 + 0.42, y0); // tail
  s.lineTo(x0 + w - r, y0); s.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r);
  s.lineTo(x0 + w, y0 + h - r); s.quadraticCurveTo(x0 + w, y0 + h, x0 + w - r, y0 + h);
  s.lineTo(x0 + r, y0 + h); s.quadraticCurveTo(x0, y0 + h, x0, y0 + h - r);
  s.lineTo(x0, y0 + r); s.quadraticCurveTo(x0, y0, x0 + r, y0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.035, bevelSegments: 3, curveSegments: 6 });
  g.translate(0, 0, -0.07);
  return g;
})();
const bubbleFaceGeo = new THREE.PlaneGeometry(BW, BH);
const bubbleMat = MAT('#ffffff', { roughness: 0.35, emissive: '#ffffff', emissiveIntensity: 0.35 });

const melonTex = (() => {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
  const ring = (r, col) => { g.beginPath(); g.moveTo(128 - r, 0); g.arc(128, 0, r, Math.PI, 0, true); g.closePath(); g.fillStyle = col; g.fill(); };
  g.fillStyle = '#ff3b4e'; g.fillRect(0, 0, 256, 128);
  ring(128, '#2e7d32'); ring(118, '#8bc34a'); ring(110, '#f4f8e6');
  const fg = g.createRadialGradient(128, 0, 10, 128, 0, 104); fg.addColorStop(0, '#ff2d48'); fg.addColorStop(1, '#ff5a64');
  g.beginPath(); g.moveTo(24, 0); g.arc(128, 0, 104, Math.PI, 0, true); g.closePath(); g.fillStyle = fg; g.fill();
  g.fillStyle = '#1a1214';
  for (const [a, rr] of [[0.35, 55], [0.75, 70], [1.15, 58], [1.55, 72], [1.95, 56], [2.35, 70], [2.75, 55], [1.3, 35], [1.85, 33]]) {
    const x = 128 + Math.cos(a) * rr, y = Math.sin(a) * rr;
    g.save(); g.translate(x, y); g.rotate(a + Math.PI / 2); g.beginPath(); g.ellipse(0, 0, 4.5, 8, 0, 0, Math.PI * 2); g.fill(); g.restore();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();
const MELON_R = 0.42;
const melonGeo = (() => {
  const s = new THREE.Shape(); s.moveTo(-MELON_R, 0); s.absarc(0, 0, MELON_R, Math.PI, 2 * Math.PI, false); s.lineTo(-MELON_R, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.02, bevelSegments: 2, curveSegments: 20 });
  g.translate(0, MELON_R * 0.45, -0.05);
  return g;
})();
melonTex.repeat.set(1 / (2 * MELON_R), 1 / MELON_R); melonTex.offset.set(0.5, 1);
const melonMats = [new THREE.MeshStandardMaterial({ map: melonTex, roughness: 0.45, emissive: '#ff2040', emissiveIntensity: 0.18 }), MAT('#2e7d32', { roughness: 0.5, emissive: '#1b5e20', emissiveIntensity: 0.2 })];

// gift = birthday greeting boost
function makeGift() {
  const g = new THREE.Group();
  const boxMat = MAT('#ff5d8f', { roughness: 0.4, emissive: '#ff2d6f', emissiveIntensity: 0.35 });
  const gold = MAT('#ffc93c', { roughness: 0.3, metalness: 0.3, emissive: '#ffb000', emissiveIntensity: 0.45 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.62, 0.7), boxMat); g.add(box);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.16, 0.78), boxMat); lid.position.y = 0.36; g.add(lid);
  const r1 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.8, 0.8), gold); r1.position.y = 0.06; g.add(r1);
  const r2 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.14), gold); r2.position.y = 0.06; g.add(r2);
  for (const s of [-1, 1]) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.045, 8, 16), gold); t.position.set(s * 0.12, 0.54, 0); t.rotation.y = s * 0.5; g.add(t); }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.035, 8, 48), new THREE.MeshBasicMaterial({ color: '#ffe08a', transparent: true, opacity: 0.85 }));
  ring.rotation.x = Math.PI / 2; g.add(ring);
  g.userData.ring = ring;
  return g;
}

// ───────────────────────── scenery (shore, dunes, palms, van, camels, mountains)
const sand = new THREE.Mesh(new THREE.PlaneGeometry(500, 700), MAT('#e9a46b', { roughness: 1 }));
sand.rotation.x = -Math.PI / 2; sand.position.set(330, 0.15, -120); scene.add(sand);
const scenery = [];
const SPAN = 420;
const sandMat = MAT('#eaa064', { roughness: 1 }), sandMat2 = MAT('#d98a52', { roughness: 1 });
for (let i = 0; i < 14; i++) {
  const d = sph(i % 2 ? sandMat : sandMat2, rand(10, 22), rand(3, 8), rand(14, 30), rand(92, 190), 0, -i * (SPAN / 14));
  scene.add(d); scenery.push(d);
}
function makePalm() {
  const g = new THREE.Group(); const trunk = MAT('#6a4630'), leaf = MAT('#2f5b3c', { side: THREE.DoubleSide });
  let y = 0, x = 0; const bend = rand(0.04, 0.1);
  for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(UNIT_CYL, trunk); m.scale.set(0.22 - i * 0.02, 1.25, 0.22 - i * 0.02); m.position.set(x, y + 0.6, 0); m.rotation.z = -bend * i; g.add(m); y += 1.2; x += bend * i * 1.2; }
  for (let k = 0; k < 8; k++) { const f = sph(leaf, 0.35, 0.06, 1.9); f.position.set(x, y, 0); f.rotation.set(0.45, (k / 8) * Math.PI * 2, 0, 'YXZ'); f.translateZ(1.4); g.add(f); }
  return g;
}
function makeVan() {
  const g = new THREE.Group(); const body = MAT('#cfd3d6', { roughness: 0.4, metalness: 0.2 }), dark = MAT('#25303a', { roughness: 0.2 }), tire = MAT('#18181b');
  const b = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.7, 4.6), body); b.position.y = 1.35; g.add(b);
  const top = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.5, 3.8), body); top.position.set(0, 2.35, -0.2); g.add(top);
  const w1 = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.6, 3.2), dark); w1.position.set(0, 1.75, 0.1); g.add(w1);
  const w2 = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.65, 0.05), dark); w2.position.set(0, 1.75, -2.31); g.add(w2);
  for (const [x, z] of [[-1, -1.5], [1, -1.5], [-1, 1.5], [1, 1.5]]) { const t = new THREE.Mesh(UNIT_CYL, tire); t.scale.set(0.42, 0.3, 0.42); t.rotation.z = Math.PI / 2; t.position.set(x, 0.42, z); g.add(t); }
  const board = makeBoard(); board.rotation.set(-1.3, 0, 0.15); board.position.set(-1.35, 1.4, 1.2); g.add(board);
  return g;
}
function makeCamel() {
  const g = new THREE.Group(); const m = MAT('#a8744c');
  g.add(sph(m, 0.55, 0.42, 1.0, 0, 2.0, 0)); g.add(sph(m, 0.32, 0.38, 0.38, 0, 2.45, 0.05));
  const neck = new THREE.Mesh(UNIT_CYL, m); neck.scale.set(0.14, 1.0, 0.14); neck.position.set(0, 2.5, -1.05); neck.rotation.x = -0.5; g.add(neck);
  g.add(sph(m, 0.16, 0.16, 0.35, 0, 2.95, -1.45));
  for (const [x, z] of [[-0.3, -0.6], [0.3, -0.6], [-0.3, 0.6], [0.3, 0.6]]) { const l = new THREE.Mesh(UNIT_CYL, m); l.scale.set(0.08, 1.7, 0.08); l.position.set(x, 0.9, z); g.add(l); }
  g.rotation.y = rand(-0.4, 0.4) + Math.PI / 2;
  return g;
}
for (let i = 0; i < 10; i++) { const p = makePalm(); p.position.set(rand(76, 86), 0, -i * (SPAN / 10) - rand(0, 20)); p.scale.setScalar(rand(0.9, 1.3)); scene.add(p); scenery.push(p); }
for (let i = 0; i < 2; i++) { const v = makeVan(); v.position.set(rand(80, 84), 0.15, -i * (SPAN / 2) - 60); v.rotation.y = rand(-0.5, 0.5); scene.add(v); scenery.push(v); }
for (let i = 0; i < 3; i++) { const c = makeCamel(); c.position.set(rand(90, 100), 0, -i * 140 - 30); c.scale.setScalar(1.2); scene.add(c); scenery.push(c); }
{
  const mtn = new THREE.MeshBasicMaterial({ color: '#c58f98', fog: false }), mtn2 = new THREE.MeshBasicMaterial({ color: '#d9a29f', fog: false }), snow = new THREE.MeshBasicMaterial({ color: '#f6e1d8', fog: false });
  for (let i = 0; i < 9; i++) {
    const h = rand(35, 75), r = rand(50, 90);
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 5), i % 2 ? mtn : mtn2); m.position.set(140 + i * 55 + rand(-15, 15), h / 2 - 4, -560 + rand(-30, 30)); m.rotation.y = rand(0, 3); scene.add(m);
    if (h > 55) { const s = new THREE.Mesh(new THREE.ConeGeometry(r * 0.25, h * 0.25, 5), snow); s.position.set(m.position.x, h - 4 - h * 0.125 + 0.5, m.position.z); s.rotation.y = m.rotation.y; scene.add(s); }
  }
}

// ───────────────────────── audio
const Sound = {
  ctx: null, master: null, music: null, muted: store.get('muted', false), step: 0, nextT: 0, timer: null, wind: null,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    const ctx = this.ctx = new C();
    this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.85; this.master.connect(ctx.destination);
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    this.brown = buf;
    const wb = ctx.createBuffer(1, len, ctx.sampleRate), wd = wb.getChannelData(0); for (let i = 0; i < len; i++) wd[i] = Math.random() * 2 - 1;
    this.white = wb;
    const ocean = ctx.createBufferSource(); ocean.buffer = buf; ocean.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 650;
    const og = ctx.createGain(); og.gain.value = 0.22;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.12; const lg = ctx.createGain(); lg.gain.value = 0.1; lfo.connect(lg).connect(og.gain); lfo.start();
    ocean.connect(lp).connect(og).connect(this.master); ocean.start();
    const wind = ctx.createBufferSource(); wind.buffer = wb; wind.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.6;
    this.wind = ctx.createGain(); this.wind.gain.value = 0.0; wind.connect(bp).connect(this.wind).connect(this.master); wind.start();
    this.music = ctx.createGain(); this.music.gain.value = 0.16; this.music.connect(this.master);
    this.nextT = ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 25);
  },
  setMuted(m) { this.muted = m; store.set('muted', m); if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.85, this.ctx.currentTime, 0.05); },
  setMusic(v) { if (this.music) this.music.gain.setTargetAtTime(v, this.ctx.currentTime, 0.3); },
  setWind(v) { if (this.wind) this.wind.gain.setTargetAtTime(v, this.ctx.currentTime, 0.2); },
  // 16th-note sequencer: D – Bm – G – A, sunny surf-pop
  chords: [[73.42, [293.66, 369.99, 440, 587.33]], [61.74, [246.94, 293.66, 369.99, 493.88]], [49.0, [196, 246.94, 293.66, 392]], [55.0, [220, 277.18, 329.63, 440]]],
  schedule() {
    const ctx = this.ctx, spb = 60 / 108 / 4;
    while (this.nextT < ctx.currentTime + 0.12) {
      const s = this.step % 16, bar = Math.floor(this.step / 16) % 4, [bass, tones] = this.chords[bar], t = this.nextT;
      if (s === 0 || s === 8 || s === 10) this.kick(t);
      if (s === 4 || s === 12) this.snap(t);
      if (s % 2 === 1) this.hat(t, s % 4 === 3 ? 0.05 : 0.03);
      if (s === 0 || s === 6 || s === 8 || s === 14) this.tone(bass * (s === 14 ? 2 : 1), t, spb * 2.2, 'triangle', 0.32, this.music, 400);
      if ([0, 3, 6, 8, 10, 13, 14].includes(s)) this.tone(tones[(s + bar) % 4] * (s > 9 ? 2 : 1), t, 0.28, 'triangle', 0.08, this.music, 2600);
      this.nextT += spb; this.step++;
    }
  },
  tone(f, t, dur, type = 'sine', gain = 0.1, dest = this.master, cutoff = 0, f2 = 0) {
    const ctx = this.ctx; if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o; if (cutoff) { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cutoff; o.connect(lp); node = lp; }
    node.connect(g).connect(dest); o.start(t); o.stop(t + dur + 0.05);
  },
  noise(t, dur, type, f0, f1, gain, dest = this.master, buf = this.white) {
    const ctx = this.ctx; if (!ctx) return;
    const s = ctx.createBufferSource(); s.buffer = buf; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur); f.Q.value = 0.9;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(dest); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  },
  kick(t) { this.tone(130, t, 0.3, 'sine', 0.55, this.music, 0, 42); },
  snap(t) { this.noise(t, 0.16, 'bandpass', 1800, 1200, 0.22, this.music); },
  hat(t, g) { this.noise(t, 0.05, 'highpass', 7000, 9000, g, this.music); },
  now() { return this.ctx ? this.ctx.currentTime : 0; },
  melon(streak) { const sc = [1046.5, 1174.7, 1318.5, 1568, 1760, 2093]; this.tone(sc[streak % sc.length], this.now(), 0.16, 'sine', 0.14); this.tone(sc[streak % sc.length] * 2, this.now() + 0.03, 0.1, 'sine', 0.04); },
  jump() { this.noise(this.now(), 0.28, 'bandpass', 500, 2400, 0.2); },
  lane() { this.noise(this.now(), 0.13, 'bandpass', 1500, 700, 0.09); },
  land() { this.noise(this.now(), 0.35, 'lowpass', 2000, 300, 0.28, this.master, this.brown); },
  duck() { this.noise(this.now(), 0.22, 'lowpass', 900, 250, 0.2, this.master, this.brown); },
  ding() { const t = this.now(); this.tone(1318.5, t, 0.12, 'sine', 0.05); this.tone(1760, t + 0.08, 0.16, 'sine', 0.05); },
  smash() { const t = this.now(); this.tone(700, t, 0.2, 'square', 0.06, this.master, 2500, 180); this.noise(t, 0.2, 'bandpass', 2500, 600, 0.18); },
  bump() { const t = this.now(); this.tone(180, t, 0.2, 'sine', 0.3, this.master, 0, 70); this.noise(t, 0.2, 'lowpass', 1200, 200, 0.25, this.master, this.brown); },
  crash() { const t = this.now(); this.noise(t, 1.1, 'lowpass', 1500, 120, 0.6, this.master, this.brown); this.tone(330, t, 0.7, 'sawtooth', 0.08, this.master, 1200, 70); },
  birthday() { // Happy Birthday, first phrase (traditional melody)
    const t0 = this.now() + 0.02, b = 0.2, notes = [[440, 0.75], [440, 0.25], [493.88, 1], [440, 1], [587.33, 1], [554.37, 2]];
    let t = t0; for (const [f, d] of notes) { this.tone(f, t, d * b * 1.1, 'triangle', 0.16); this.tone(f * 2, t, d * b, 'sine', 0.04); t += d * b; }
  },
};

// ───────────────────────── game state
const G = {
  state: 'loading', t: 0, run: 0, dist: 0, speed: 12, score: 0, scoreF: 0, melons: 0, best: store.get('best', 0),
  boost: 0, boostMax: 6.5, nextRowZ: -50, sinceGift: 0, lastHitMsg: '', streak: 0, lastMelonT: 0, shake: 0,
  slowmo: 1, dyingT: 0, stumbleT: 0,
};
const player = { lane: 1, prevLane: 1, x: 0, h: 0, vy: 0, air: false, duckT: 0, duck: 0, invuln: 0, jumpT: 0, trick: 0, carve: 0 };
const entities = [];
let camMode = 'title';
const PHX = 0.36, PHZ = 0.62;

function difficulty() { return clamp(G.run / 85, 0, 1); }

function addObstacle(type, lane, z) {
  const g = new THREE.Group();
  let yMin = 0, yMax = 1.0; const msgs = [];
  const bubble = (y, xo = 0, rz = 0) => {
    const text = pick(PASHA); msgs.push(text);
    const b = new THREE.Group();
    b.add(new THREE.Mesh(bubbleGeo, bubbleMat));
    const face = new THREE.Mesh(bubbleFaceGeo, new THREE.MeshBasicMaterial({ map: bubbleTexture(text), transparent: true, toneMapped: false }));
    face.position.z = 0.115; b.add(face);
    b.position.set(xo, y, 0); b.rotation.z = rz; g.add(b);
    return b;
  };
  if (type === 'low') { bubble(0.52, 0, rand(-0.04, 0.04)); yMax = 0.98; }
  else if (type === 'tall') { bubble(0.52, -0.08, 0.03); bubble(1.45, 0.1, -0.04); bubble(2.38, -0.05, 0.02); yMax = 2.9; }
  else { bubble(2.06, 0, rand(-0.05, 0.05)); yMin = 1.6; yMax = 2.55; const drip = sph(new THREE.MeshBasicMaterial({ color: '#bfeee6', transparent: true, opacity: 0.6 }), 0.05, 0.08, 0.05, 0, 1.45, 0); g.add(drip); g.userData.drip = drip; }
  g.position.set(LANES[lane], -4, z); g.visible = false;
  scene.add(g);
  entities.push({ kind: 'obs', type, lane, x: LANES[lane], z, yMin, yMax, hz: 0.32, hx: 1.08, mesh: g, rise: 0, risen: false, msg: msgs[msgs.length - 1], seed: rand(0, 6) });
}
function addMelon(lane, z, y = 0.75) {
  const m = new THREE.Mesh(melonGeo, melonMats);
  m.position.set(LANES[lane], y, z); m.rotation.y = rand(0, 6); scene.add(m);
  entities.push({ kind: 'melon', lane, x: LANES[lane], z, y, mesh: m, seed: rand(0, 6), magnet: false });
}
function addGift(lane, z) {
  const m = makeGift(); m.position.set(LANES[lane], 1.0, z); scene.add(m);
  entities.push({ kind: 'gift', lane, x: LANES[lane], z, y: 1.0, mesh: m, seed: 0 });
}
function melonLine(lane, zStart, n, gap = 2.5) { for (let i = 0; i < n; i++) addMelon(lane, zStart - i * gap); }
function melonArc(lane, z) { for (let i = -3; i <= 3; i++) { const k = i / 3.4; addMelon(lane, z + i * 1.25, 0.75 + 1.25 * (1 - k * k)); } }

function spawnRow(z) {
  const d = difficulty();
  const lanes = [0, 1, 2].sort(() => Math.random() - 0.5);
  const obsType = () => { const r = Math.random(); return r < 0.4 ? 'low' : r < 0.72 ? 'tall' : 'high'; };
  if (G.sinceGift > 16 && Math.random() < 0.35) {
    G.sinceGift = 0;
    addGift(lanes[0], z);
    if (d > 0.2) addObstacle(pick(['low', 'tall']), lanes[1], z);
    return;
  }
  const r = Math.random();
  if (r < 0.14 || G.run < 2.5) { melonLine(lanes[0], z + 5, randi(5, 8)); return; }
  if (r < 0.5 - d * 0.15 || G.run < 9) {
    const t = obsType(); addObstacle(t, lanes[0], z);
    if (t === 'low' && Math.random() < 0.5) melonArc(lanes[0], z); else melonLine(lanes[1], z + 6, 5);
    return;
  }
  if (r < 0.88 || d < 0.3) {
    addObstacle(obsType(), lanes[0], z); addObstacle(obsType(), lanes[1], z);
    melonLine(lanes[2], z + 6, 5);
    return;
  }
  // all three lanes: never three walls
  const kinds = Math.random() < 0.5 ? ['low', 'low', 'low'] : ['tall', 'tall', pick(['low', 'high'])];
  kinds.forEach((k, i) => addObstacle(k, lanes[i], z));
  if (kinds[2] === 'low') melonArc(lanes[2], z);
}
function rowGap() { return Math.max(12, G.speed * rand(0.62, 0.95) * (G.run < 10 ? 1.35 : 1)); }

function removeEntity(i) { const e = entities[i]; scene.remove(e.mesh); entities.splice(i, 1); }
function clearEntities() { for (let i = entities.length - 1; i >= 0; i--) removeEntity(i); }

// ───────────────────────── DOM / UI
const ui = {
  hud: $('hud'), score: $('score'), melons: $('melons'), boost: $('boost'), boostBar: $('boostBar'), toast: $('toast'), toastWish: $('toastWish'),
  title: $('title'), over: $('over'), pause: $('pause'), card: $('card'), floats: $('floats'), flash: $('flash'),
};
const floats = [];
const _p = new THREE.Vector3();
function floatText(text, x, y, z, cls = '') {
  const el = document.createElement('div'); el.className = 'float ' + cls; el.textContent = text; ui.floats.appendChild(el);
  floats.push({ el, pos: new THREE.Vector3(x, y, z), t: 0 });
}
function updateFloats(dt) {
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i]; f.t += dt; f.pos.y += dt * 1.6;
    _p.copy(f.pos).project(camera);
    const x = (_p.x * 0.5 + 0.5) * innerWidth, y = (-_p.y * 0.5 + 0.5) * innerHeight;
    f.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${1 + f.t * 0.4})`;
    f.el.style.opacity = String(clamp(1.4 - f.t * 1.6, 0, 1));
    if (f.t > 0.9) { f.el.remove(); floats.splice(i, 1); }
  }
}
let toastTimer = 0;
function showToast(wish) {
  ui.toastWish.textContent = wish; ui.toast.hidden = false; ui.toast.classList.remove('out');
  void ui.toast.offsetWidth; ui.toast.style.animation = 'none'; void ui.toast.offsetWidth; ui.toast.style.animation = '';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { ui.toast.classList.add('out'); setTimeout(() => { ui.toast.hidden = true; }, 350); }, 2600);
}
function flash() { ui.flash.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => ui.flash.classList.remove('on'))); }
function show(el) { for (const s of [ui.title, ui.over, ui.pause, ui.card]) s.hidden = s !== el; }
function rankFor(score) { let r = RANKS[0], next = null; for (let i = 0; i < RANKS.length; i++) { if (score >= RANKS[i][0]) { r = RANKS[i]; next = RANKS[i + 1] || null; } } return { r, next }; }
$('bestTitle').textContent = G.best;
$('btnSound').textContent = Sound.muted ? '🔇' : '🔊';

// ───────────────────────── flow
function resetPlayerPose() {
  olya.rider.position.set(0, 0.1, 0); olya.rider.rotation.set(0, -Math.PI / 2, 0);
  olya.board.position.set(0, 0, 0); olya.board.rotation.set(0, 0, 0);
  olya.model.rotation.set(0, 0, 0);
}
function startRun() {
  Sound.init();
  clearEntities(); resetPlayerPose();
  Object.assign(G, { state: 'play', run: 0, speed: 15, score: 0, scoreF: 0, melons: 0, boost: 0, nextRowZ: -55, sinceGift: 6, streak: 0, slowmo: 1, stumbleT: 0 });
  Object.assign(player, { lane: 1, prevLane: 1, h: 0, vy: 0, air: false, duckT: 0, invuln: 0, trick: 0 });
  camMode = 'chase';
  show(null); ui.hud.hidden = false; ui.boost.hidden = true; ui.toast.hidden = true;
  Sound.setMusic(0.2);
}
function gameOver() {
  G.state = 'over'; G.slowmo = 1;
  const score = G.score;
  const isRecord = score > G.best;
  if (isRecord) { G.best = score; store.set('best', score); }
  const runs = store.get('runs', []); const me = { s: score, d: Date.now() }; runs.push(me); runs.sort((a, b) => b.s - a.s); store.set('runs', runs.slice(0, 5));
  $('overScore').textContent = score; $('overMelons').textContent = G.melons; $('overBest').textContent = G.best; $('bestTitle').textContent = G.best;
  $('newRecord').hidden = !isRecord;
  $('overTitle').textContent = pick(OVER_TITLES);
  $('overMsg').innerHTML = `<span class="ava">ПП</span><span><small>Паша Притчин</small>${escapeHtml(G.lastHitMsg || 'Оль?')}</span>`;
  $('overPhoto').src = `img/${pick(PHOTOS)}.jpg`;
  const { r, next } = rankFor(score);
  $('rankEmoji').textContent = r[1]; $('rankName').textContent = r[2];
  $('rankNext').textContent = next ? `до «${next[2]}» — ${next[0] - score} очков` : 'выше только звёзды';
  $('leaders').innerHTML = runs.slice(0, 5).map((x) => `<li class="${x === me ? 'me' : ''}"><span>${new Date(x.d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</span><b>${x.s}</b></li>`).join('');
  ui.hud.hidden = true; show(ui.over);
  clearEntities(); resetPlayerPose(); camMode = 'title'; player.lane = 1; player.h = 0; player.air = false;
  Sound.setMusic(0.12);
}
function escapeHtml(s) { return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function wipeout(e) {
  G.state = 'dying'; G.dyingT = 0; G.lastHitMsg = e.msg; G.shake = 1; flash();
  Sound.crash(); Sound.setWind(0);
  burst(player.x, player.h + 0.6, 0, 70, { spread: 4, up: 8, life: 1.1, size: 0.35, colors: ['#ffffff', '#dff7f2', '#bfeee6'] });
  olya.riderVel = new THREE.Vector3(rand(-1, 1), 6.5, -5); olya.boardVel = new THREE.Vector3(rand(-2, 2), 5, 3);
}
function startBoost() {
  G.boost = G.boostMax; ui.boost.hidden = false;
  Sound.birthday(); flash();
  showToast(pick(WISHES));
  burst(player.x, player.h + 1.4, 0, 120, { spread: 5, up: 9, life: 1.6, size: 0.18, colors: ['#ff4f7b', '#ffc93c', '#4fd1c5', '#ff8a3d', '#ffffff', '#8b6cff'], grav: 9, scroll: 0 });
  floatText('🎂 С днём рождения!', player.x, player.h + 2.4, 0, 'smash');
}

function move(dir) {
  if (G.state !== 'play') return;
  const nl = clamp(player.lane + dir, 0, 2);
  if (nl === player.lane) return;
  player.prevLane = player.lane; player.lane = nl; Sound.lane();
}
function jump() {
  if (G.state !== 'play' || player.air) return;
  player.air = true; player.vy = 10.6; player.jumpT = 0; player.duckT = 0;
  player.trick = Math.random() < 0.4 ? (Math.random() < 0.5 ? 1 : -1) : 0;
  Sound.jump();
  burst(player.x, 0.3, 0.8, 18, { spread: 1.5, up: 4, life: 0.6, size: 0.25 });
}
function duck() {
  if (G.state !== 'play') return;
  if (player.air) { player.vy = -18; player.duckT = 0.55; } else { player.duckT = 0.85; Sound.duck(); }
}
function togglePause() {
  if (G.state === 'play') { G.state = 'paused'; show(ui.pause); Sound.setMusic(0.05); }
  else if (G.state === 'paused') { G.state = 'play'; show(null); Sound.setMusic(0.2); clock.getDelta(); }
}

// input
addEventListener('keydown', (e) => {
  const k = e.code;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(k)) e.preventDefault();
  if (G.state === 'title' || G.state === 'over') { if ((k === 'Enter' || k === 'Space') && ui.card.hidden) startRun(); return; }
  if (k === 'ArrowLeft' || k === 'KeyA') move(-1);
  else if (k === 'ArrowRight' || k === 'KeyD') move(1);
  else if (k === 'ArrowUp' || k === 'KeyW' || k === 'Space') jump();
  else if (k === 'ArrowDown' || k === 'KeyS') duck();
  else if (k === 'Escape' || k === 'KeyP') togglePause();
});
let touch = null;
addEventListener('touchstart', (e) => { if (e.target.closest('button, .screen')) return; const t = e.changedTouches[0]; touch = { x: t.clientX, y: t.clientY, done: false }; }, { passive: true });
addEventListener('touchmove', (e) => {
  if (!touch || touch.done) return; const t = e.changedTouches[0]; const dx = t.clientX - touch.x, dy = t.clientY - touch.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 26) return;
  touch.done = true;
  if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1); else if (dy < 0) jump(); else duck();
}, { passive: true });
addEventListener('touchend', () => { touch = null; });
document.addEventListener('touchmove', (e) => { if (!e.target.closest('.screen')) e.preventDefault(); }, { passive: false });
$('btnPlay').onclick = startRun; $('btnAgain').onclick = startRun;
$('btnCardPlay').onclick = startRun;
$('btnResume').onclick = togglePause; $('btnPause').onclick = togglePause;
$('btnSound').onclick = () => { Sound.init(); Sound.setMuted(!Sound.muted); $('btnSound').textContent = Sound.muted ? '🔇' : '🔊'; };
let cardReturn = null;
const openCard = () => { cardReturn = G.state === 'over' ? ui.over : ui.title; show(ui.card); };
$('btnCard1').onclick = openCard; $('btnCard2').onclick = openCard;
$('btnCloseCard').onclick = () => show(cardReturn || ui.title);
$('btnShare').onclick = async () => {
  const text = `Мой рекорд в Arbuz Surfer — ${$('overScore').textContent} 🍉🏄‍♀️ Сможешь больше?`;
  const url = location.href.split('#')[0];
  try { if (navigator.share) { await navigator.share({ title: 'Arbuz Surfer', text, url }); return; } } catch { return; }
  try { await navigator.clipboard.writeText(`${text} ${url}`); $('btnShare').textContent = 'Ссылка скопирована ✓'; } catch {}
};
addEventListener('pointerdown', () => Sound.init(), { once: true });
document.addEventListener('visibilitychange', () => { if (document.hidden && G.state === 'play') togglePause(); });

// ───────────────────────── resize
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

// ───────────────────────── main loop
const clock = new THREE.Clock();
const camPos = new THREE.Vector3(5, 2.4, -4), camLook = new THREE.Vector3(0, 1.2, 0), _tp = new THREE.Vector3(), _tl = new THREE.Vector3();
let fov = 62;

function update(rawDt) {
  const dt = rawDt * G.slowmo;
  G.t += rawDt;
  const t = G.t;
  const playing = G.state === 'play';
  const dying = G.state === 'dying';

  // speed
  if (playing) {
    G.run += dt; G.sinceGift += dt;
    const target = Math.min(15 + G.run * 0.24, 36) * (G.boost > 0 ? 1.3 : 1);
    G.speed = damp(G.speed, target, 2, dt);
  } else if (dying) {
    G.speed = damp(G.speed, 0, 2.5, dt);
  } else if (G.state !== 'paused') {
    G.speed = damp(G.speed, 11, 1, dt);
  }
  const dz = G.speed * dt;
  G.dist += dz;
  waterUniforms.uTime.value = t; waterUniforms.uDist.value = G.dist; skyMat.uniforms.uTime.value = t;

  // player
  if (playing) {
    player.x = damp(player.x, LANES[player.lane], 13, dt);
    if (player.air) {
      player.jumpT += dt; player.h += player.vy * dt; player.vy -= 30 * dt;
      if (player.h <= 0) { player.h = 0; player.air = false; player.trick = 0; Sound.land(); burst(player.x, 0.2, 0.3, 26, { spread: 2.2, up: 4.5, life: 0.7, size: 0.28 }); }
    }
    player.duckT = Math.max(0, player.duckT - dt);
    player.invuln = Math.max(0, player.invuln - dt);
    G.stumbleT = Math.max(0, G.stumbleT - dt);
  } else if (!dying) {
    player.x = damp(player.x, Math.sin(t * 0.35) * 0.9, 2, dt);
  }
  const ducking = player.duckT > 0 && !player.air;
  player.duck = damp(player.duck, ducking ? 1 : 0, 16, dt);
  player.carve = damp(player.carve, (playing ? LANES[player.lane] : Math.sin(t * 0.35) * 0.9) - player.x, 10, dt);
  const waterY = waveH(player.x, -G.dist, t);
  const slope = (waveH(player.x, -G.dist - 0.8, t) - waveH(player.x, -G.dist + 0.8, t)) / 1.6;
  olya.root.position.set(player.x, waterY + player.h, 0);
  if (!dying) {
    olya.root.rotation.set(slope * 0.9 + (player.air ? -0.12 : 0), -player.carve * 0.12, -player.carve * 0.16 + Math.sin(t * 1.7) * 0.03);
    const airK = player.air ? 1 : 0;
    poseOlya(t, player.duck, airK, player.carve, clamp((G.speed - 8) / 26, 0, 1) + (player.air ? 0.3 : 0));
    if (player.trick) olya.model.rotation.y = player.trick * Math.PI * 2 * clamp(player.jumpT / 0.68, 0, 1);
    else olya.model.rotation.y = damp(olya.model.rotation.y, 0, 10, dt);
  } else {
    G.dyingT += rawDt;
    const rv = olya.riderVel, bv = olya.boardVel;
    rv.y -= 22 * dt; bv.y -= 22 * dt;
    olya.rider.position.addScaledVector(rv, dt); olya.board.position.addScaledVector(bv, dt);
    if (olya.rider.position.y < -0.6) { olya.rider.position.y = -0.6; rv.set(0, 0, 0); }
    if (olya.board.position.y < 0) { olya.board.position.y = 0; bv.set(0, 0, 0); }
    olya.rider.rotation.x += dt * 6 * (rv.lengthSq() > 0 ? 1 : 0); olya.board.rotation.z += dt * 9 * (bv.lengthSq() > 0 ? 1 : 0);
    poseOlya(t, 0, 1, 0, 1);
    G.slowmo = G.dyingT < 0.5 ? 0.35 : damp(G.slowmo, 1, 4, rawDt);
    if (G.dyingT > 1.5) gameOver();
  }
  olya.shadow.position.set(player.x, waterY + 0.03, 0.1);
  olya.shadow.material.opacity = clamp(1 - player.h / 2.5, 0.2, 1);
  olya.shadow.scale.setScalar(1 + player.h * 0.25);

  // spray from the board
  if (!player.air && !dying && G.speed > 4) {
    const n = G.speed > 20 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const side = Math.random() < 0.5 ? -1 : 1;
      emit(player.x + side * 0.3 + rand(-0.1, 0.1), waterY + 0.1, 1.1 + rand(0, 0.4), side * rand(0.6, 2.2) - player.carve * 2, rand(1.2, 3.4), rand(0.5, 2.5), rand(0.35, 0.7), rand(0.16, 0.32), Math.random() < 0.8 ? '#ffffff' : '#c9f2ea');
    }
  }
  // lip spray
  for (let i = 0; i < 3; i++) {
    const z = rand(-80, 15), a = LIP.a1 + rand(-0.05, 0.1);
    emit(LIP.cx + Math.cos(a) * LIP.r, LIP.cy + Math.sin(a) * LIP.r, z, rand(0.5, 2.2), rand(-1, 0.6), rand(-0.5, 0.5), rand(0.6, 1.1), rand(0.3, 0.7), '#ffffff', 6);
  }
  if (G.boost > 0 && !dying) {
    for (let i = 0; i < 2; i++) emit(player.x + rand(-0.5, 0.5), player.h + waterY + rand(0.2, 1.8), 0.6, rand(-0.5, 0.5), rand(0, 1), rand(1, 3), rand(0.4, 0.8), rand(0.12, 0.24), pick(['#ffd34a', '#ff7aa2', '#7fe3d4', '#ffffff']), 1);
  }

  // boost visuals
  const boosted = G.boost > 0 && (playing || dying);
  if (playing && G.boost > 0) {
    G.boost -= dt; ui.boostBar.style.transform = `scaleX(${clamp(G.boost / G.boostMax, 0, 1)})`;
    if (G.boost <= 0) { ui.boost.hidden = true; player.invuln = 1.0; }
  }
  olya.balloons.visible = boosted;
  olya.halo.material.opacity = damp(olya.halo.material.opacity, boosted ? 0.55 + Math.sin(t * 10) * 0.15 : 0, 8, rawDt);
  if (boosted) {
    for (const b of olya.balloonList) {
      b.b.position.set(b.off.x + Math.sin(t * 1.7 + b.ph) * 0.12, b.off.y + Math.sin(t * 2.3 + b.ph) * 0.1, b.off.z + Math.cos(t * 1.3 + b.ph) * 0.1 + 0.25);
      b.knot.position.copy(b.b.position).y -= 0.32;
      _tp.set(0.25, 1.45, 0.3);
      setLimb(b.str, _tp, b.knot.position, 0.006);
    }
  }
  // invulnerability blink
  olya.model.visible = !(player.invuln > 0 && G.boost <= 0 && Math.floor(t * 14) % 2 === 0);

  // world objects
  if (playing) {
    G.nextRowZ += dz;
    while (G.nextRowZ > -150) { spawnRow(G.nextRowZ); G.nextRowZ -= rowGap(); }
  }
  for (let i = entities.length - 1; i >= 0; i--) {
    const e = entities[i];
    const prevZ = e.z;
    e.z += dz;
    e.mesh.position.z = e.z;
    const wy = waveH(e.x, e.z - G.dist, t);
    if (e.kind === 'obs') {
      if (!e.risen && e.z > -62) { e.risen = true; e.mesh.visible = true; burst(e.x, 0.3, e.z, 30, { spread: 2.5, up: 6, life: 0.9, size: 0.35 }); if (e.z > -70) Sound.ding(); }
      if (e.risen) e.rise = Math.min(1, e.rise + dt * 2.6);
      const k = e.rise, back = 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2);
      e.mesh.position.y = lerp(-4, wy, clamp(back, 0, 1.15));
      e.mesh.rotation.z = Math.sin(t * 2 + e.seed) * 0.03;
      e.mesh.rotation.y = Math.sin(t * 1.4 + e.seed) * 0.06;
      if (e.mesh.userData.drip) e.mesh.userData.drip.position.y = 1.45 - ((t * 1.3 + e.seed) % 1) * 1.2;
      if (e.dead) { e.mesh.scale.multiplyScalar(1 - dt * 6); e.mesh.position.y += dt * 6; }
      // collision (swept)
      if (playing && !e.dead && e.rise > 0.55 && prevZ - e.hz <= PHZ && e.z + e.hz >= -PHZ && Math.abs(player.x - e.x) < e.hx * 0.86 + PHX) {
        const bottom = player.h, top = player.h + (player.duck > 0.5 ? 0.95 : 1.72);
        if (bottom < e.yMax && top > e.yMin) hitObstacle(e);
      }
    } else if (e.kind === 'melon') {
      e.mesh.rotation.y += dt * 3.2;
      let y = e.y + Math.sin(t * 3 + e.seed) * 0.08;
      if (G.boost > 0 && playing && e.z > -16 && e.z < 2) e.magnet = true;
      if (e.magnet) { e.x = damp(e.x, player.x, 10, dt); e.y = damp(e.y, player.h + 1.0, 10, dt); e.z = damp(e.z, 0, 6, dt); e.mesh.position.z = e.z; y = e.y; }
      e.mesh.position.set(e.x, y + wy * 0.5, e.z);
      if (playing && Math.abs(e.z) < 0.95 && Math.abs(e.x - player.x) < 0.95 && y > player.h - 0.3 && y < player.h + 2.1) { collectMelon(e); removeEntity(i); continue; }
    } else if (e.kind === 'gift') {
      e.mesh.rotation.y += dt * 2;
      e.mesh.position.y = 1.0 + wy * 0.5 + Math.sin(t * 3) * 0.12;
      e.mesh.userData.ring.rotation.z += dt * 3; e.mesh.userData.ring.scale.setScalar(1 + Math.sin(t * 6) * 0.08);
      if (Math.random() < 0.5) emit(e.x + rand(-0.6, 0.6), e.mesh.position.y + rand(-0.4, 0.8), e.z, 0, rand(0.5, 1.5), 0, 0.6, rand(0.12, 0.22), pick(['#ffd34a', '#ff7aa2']), 0);
      if (playing && Math.abs(e.z) < 1.1 && Math.abs(e.x - player.x) < 1.1 && player.h < 1.8) { removeEntity(i); startBoost(); continue; }
    }
    if (e.z > 14) removeEntity(i);
  }
  // scenery recycling
  for (const s of scenery) { s.position.z += dz; if (s.position.z > 120) s.position.z -= SPAN; }

  // score
  if (playing) {
    G.scoreF += dz * 0.5 * (G.boost > 0 ? 2 : 1);
    G.score = Math.floor(G.scoreF);
    ui.score.textContent = G.score; ui.melons.textContent = G.melons;
  }
  Sound.setWind(playing ? clamp((G.speed - 12) / 24, 0, 1) * 0.07 : 0);

  updateParticles(dt, dz);
  updateFloats(rawDt);
  updateCamera(rawDt, waterY);
}

function hitObstacle(e) {
  if (G.boost > 0 || player.invuln > 0) {
    if (G.boost > 0) {
      e.dead = true; G.scoreF += 50; Sound.smash(); G.shake = Math.max(G.shake, 0.35);
      burst(e.x, 1.2, e.z, 40, { spread: 4, up: 6, life: 0.8, size: 0.3, colors: ['#ffffff', '#ffd34a', '#ff7aa2'] });
      floatText(pick(['Паша, потом!', 'Не сейчас 🙅‍♀️', 'Я на волне', 'В отпуске 🌴']) + ' +50', e.x, 2.4, e.z, 'smash');
    }
    return;
  }
  const switching = Math.abs(player.x - LANES[player.lane]) > 0.3 && e.lane === player.lane;
  if (switching) {
    player.lane = player.prevLane; player.invuln = 0.7; G.shake = 0.5; Sound.bump();
    burst(player.x, 1.0, 0, 20, { spread: 2, up: 4, life: 0.6, size: 0.3 });
    if (G.stumbleT > 0) { wipeout(e); return; }
    G.stumbleT = 5;
    floatText('Ой!', player.x, 2.2, 0);
    return;
  }
  wipeout(e);
}
function collectMelon(e) {
  if (G.t - G.lastMelonT > 0.7) G.streak = 0;
  G.lastMelonT = G.t; Sound.melon(G.streak++);
  G.melons++; const pts = G.boost > 0 ? 20 : 10; G.scoreF += pts;
  burst(e.x, e.mesh.position.y, e.z, 10, { spread: 1.5, up: 3, life: 0.5, size: 0.2, colors: ['#ff3b4e', '#8bc34a', '#ffffff'], grav: 6, scroll: 0 });
  if (G.melons % 25 === 0) floatText(`🍉 ×${G.melons}`, player.x, 2.4, 0, 'melon');
}

function updateCamera(dt, waterY) {
  const portrait = camera.aspect < 0.9;
  if (camMode === 'chase') {
    if (portrait) { _tp.set(player.x * 0.62, 3.7 + player.h * 0.3, 7.3); _tl.set(player.x * 0.7, 1.45 + player.h * 0.35, -6); }
    else { _tp.set(player.x * 0.55, 3.15 + player.h * 0.35, 6.7); _tl.set(player.x * 0.75, 1.35 + player.h * 0.5, -7); }
    const k = G.state === 'dying' ? 2 : 6;
    camPos.x = damp(camPos.x, _tp.x, k, dt); camPos.y = damp(camPos.y, _tp.y, k * 0.8, dt); camPos.z = damp(camPos.z, _tp.z, k * 0.6, dt);
    camLook.lerp(_tl, 1 - Math.exp(-k * dt));
    const targetFov = (portrait ? 74 : 62) + clamp((G.speed - 15) * 0.32, 0, 7) + (G.boost > 0 ? 6 : 0);
    fov = damp(fov, targetFov, 3, dt);
  } else {
    const a = -0.2 + Math.sin(G.t * 0.16) * 0.32, r = portrait ? 6.6 : 5.4;
    _tp.set(player.x + Math.sin(a) * r, 1.75 + waterY * 0.4, -Math.cos(a) * r);
    _tl.set(player.x + (portrait ? 0 : 1.1), portrait ? -0.35 : 1.15, 0);
    camPos.lerp(_tp, 1 - Math.exp(-2.2 * dt)); camLook.lerp(_tl, 1 - Math.exp(-3 * dt));
    fov = damp(fov, portrait ? 66 : 50, 2, dt);
  }
  camera.position.copy(camPos);
  if (G.shake > 0) { camera.position.x += rand(-1, 1) * G.shake * 0.25; camera.position.y += rand(-1, 1) * G.shake * 0.25; G.shake = Math.max(0, G.shake - dt * 2.2); }
  camera.lookAt(camLook);
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  sky.position.copy(camera.position);
  pMat.uniforms.uScale.value = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
}

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (G.state !== 'paused' && G.state !== 'loading') update(dt);
  renderer.render(scene, camera);
}

// ───────────────────────── boot
(async function boot() {
  resize();
  try { await Promise.race([Promise.all([document.fonts.load('800 40px Manrope'), document.fonts.load('700 30px Manrope')]), new Promise((r) => setTimeout(r, 2500))]); } catch {}
  for (const m of PASHA) bubbleTexture(m);
  G.state = 'title';
  poseOlya(0, 0, 0, 0, 0.5);
  renderer.compile(scene, camera);
  frame();
  setTimeout(() => $('loading').classList.add('done'), 150);
  // debug handle: deterministic stepping for testing in a hidden tab
  window.__arbuz = { G, player, entities, startRun, startBoost, addGift, addObstacle, jump, duck, move,
    step(sec) { for (let i = 0; i < Math.round(sec * 60); i++) update(1 / 60); renderer.render(scene, camera); },
    setView(w, h) { renderer.setPixelRatio(1); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); } };
})();
