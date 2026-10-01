import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

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
const KIRILL = [
  'Я увольняюсь', 'Всё, пишу заявление', 'Это моё последнее сообщение', 'Увольняюсь. Точно.', 'Ну всё, ухожу',
  'Завтра меня тут нет', 'Отрабатываю две недели', 'Я серьёзно. Ухожу', 'Последний день, ребят', 'Остаюсь… шутка, ухожу',
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

const hemi = new THREE.HemisphereLight('#ffd6b0', '#2a6f78', 1.25);
scene.add(hemi);
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
const V3 = () => new THREE.Vector3(1, 1, 1);
const skyMat = new THREE.ShaderMaterial({
  uniforms: {
    uSun: { value: SUN_DIR }, uTime: { value: 0 }, uHorizon: { value: fogOut }, uMid: { value: V3() }, uTop: { value: V3() },
    uGlow: { value: V3() }, uDisc: { value: V3() }, uCloud: { value: V3() }, uNight: { value: 0 }, uGlowAmt: { value: 1 },
  },
  vertexShader: /* glsl */`varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
  fragmentShader: /* glsl */`
    uniform vec3 uSun, uHorizon, uMid, uTop, uGlow, uDisc, uCloud; uniform float uTime, uNight, uGlowAmt; varying vec3 vDir;
    ${GLSL_NOISE}
    void main(){
      vec3 d = normalize(vDir); float h = d.y;
      vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.2, h));
      col = mix(col, uTop, smoothstep(0.16, 0.8, h));
      float s = max(dot(d, uSun), 0.0);
      col += uGlow * pow(s, 6.0) * 0.32 * uGlowAmt;
      col += mix(uGlow, vec3(1.0, 0.85, 0.6), 0.5) * pow(s, 48.0) * 0.55 * uGlowAmt;
      vec2 sp = vec2(atan(d.x, -d.z), h) * 150.0; vec2 cell = floor(sp); float rnd = hash(cell);
      float star = step(0.992, rnd) * smoothstep(0.42, 0.0, length(fract(sp) - 0.5)) * smoothstep(0.03, 0.22, h);
      col += vec3(star * uNight * (0.65 + 0.35 * sin(uTime * 3.0 + rnd * 80.0)));
      vec2 cp = vec2(atan(d.x, -d.z) * 5.0 + uTime * 0.004, h * 30.0);
      float c = fbm(vec2(cp.x, cp.y * 0.45) * vec2(1.0, 2.6));
      float band = smoothstep(0.035, 0.1, h) * (1.0 - smoothstep(0.2, 0.42, h));
      c = smoothstep(0.52, 0.82, c) * band;
      vec3 cloud = mix(uCloud, min(uCloud * 1.12 + 0.05, vec3(1.0)), pow(s, 2.5));
      col = mix(col, cloud, c * 0.75);
      float disc = smoothstep(0.99925, 0.9996, s);
      col = mix(col, uDisc, disc);
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
float wallH(float x){ float t = clamp((${WALL_X0.toFixed(2)} - x) / ${(WALL_X0 - WALL_X1).toFixed(2)}, 0.0, 1.0); return pow(t, 1.8) * ${WALL_H.toFixed(2)} * uWall; }
`;
const waterUniforms = {
  uTime: { value: 0 }, uDist: { value: 0 }, uSun: { value: SUN_DIR },
  uDeep: { value: new THREE.Color('#0b4250') }, uShallow: { value: new THREE.Color('#1d8a8c') },
  uWallLight: { value: new THREE.Color('#62d6c4') }, uFoam: { value: new THREE.Color('#fff5e8') },
  uSkyRefl: { value: new THREE.Color('#f7b68e') }, uSunCol: { value: new THREE.Color('#ffd49c') },
  uFogColor: { value: fogOut }, uFogNear: { value: 45 }, uFogFar: { value: 270 }, uWall: { value: 1 },
};
const waterMat = new THREE.ShaderMaterial({
  uniforms: waterUniforms,
  vertexShader: /* glsl */`
    uniform float uTime, uDist, uWall;
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
      wp.y += h; vWorld = wp.xyz; vWave = w; vWall = wl / uWall;
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
  uniforms: { uTime: waterUniforms.uTime, uDist: waterUniforms.uDist, uWallLight: waterUniforms.uWallLight, uFoam: waterUniforms.uFoam, uShallow: waterUniforms.uShallow, uFogColor: { value: fogOut }, uFogNear: { value: 45 }, uFogFar: { value: 270 }, uWall: waterUniforms.uWall },
  vertexShader: /* glsl */`
    uniform float uTime, uDist, uWall; varying float vV; varying vec3 vWorld; varying float vZ;
    void main(){
      vec3 pos = position; float pz = pos.z - uDist;
      float wob = sin(pz * 0.21 + uTime * 1.3) * 0.16 + sin(pz * 0.065 - uTime * 0.5) * 0.28;
      pos += normal * wob * uv.y; pos.y += wob * 0.25 * uv.y + (uWall - 1.0) * ${WALL_H.toFixed(2)};
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
// barrel: sometimes the wave closes over Olya — a long tube section that scrolls towards the camera
const barrelUniforms = { uTime: waterUniforms.uTime, uDist: waterUniforms.uDist, uWall: waterUniforms.uWall, uBarrel: { value: new THREE.Vector2(-1e4, -1e4) },
  uWallLight: waterUniforms.uWallLight, uFoam: waterUniforms.uFoam, uShallow: waterUniforms.uShallow, uDeep: waterUniforms.uDeep, uFogColor: { value: fogOut }, uFogNear: { value: 45 }, uFogFar: { value: 270 } };
const barrelMat = new THREE.ShaderMaterial({
  uniforms: barrelUniforms,
  vertexShader: /* glsl */`
    uniform float uTime, uDist, uWall; uniform vec2 uBarrel;
    varying float vV; varying vec3 vWorld; varying float vZ; varying float vC;
    void main(){
      float z = position.z, v = uv.y;
      float c = smoothstep(uBarrel.y - 28.0, uBarrel.y, z) * (1.0 - smoothstep(uBarrel.x, uBarrel.x + 28.0, z));
      float th = mix(2.2, mix(2.2, 0.05, c), v);
      float pz = z - uDist;
      float wob = (sin(pz * 0.19 + uTime * 1.4) * 0.3 + sin(pz * 0.06 - uTime * 0.6) * 0.4) * v;
      vec3 pos = vec3(-1.0 + cos(th) * (8.6 + wob), sin(th) * (10.3 + wob) * mix(1.0, uWall, 0.7), z);
      vV = v; vZ = pz; vC = c;
      vec4 wp = modelMatrix * vec4(pos, 1.0); vWorld = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`,
  fragmentShader: /* glsl */`
    uniform float uTime, uFogNear, uFogFar; uniform vec3 uWallLight, uFoam, uShallow, uDeep, uFogColor;
    varying float vV; varying vec3 vWorld; varying float vZ; varying float vC;
    ${GLSL_NOISE}
    void main(){
      if (vC < 0.02) discard;
      float n = noise(vec2(vV * 10.0, vZ * 0.3 + uTime * 1.1)) * 0.6 + noise(vec2(vV * 30.0, vZ * 1.2 - uTime * 2.4)) * 0.4;
      vec3 col = mix(uWallLight * 1.08, mix(uShallow, uDeep, 0.35), smoothstep(0.15, 0.75, vV));
      col *= 0.85 + 0.3 * noise(vec2(vV * 4.0, vZ * 0.08 + uTime * 0.3));
      float foam = smoothstep(0.78, 0.97, vV) + smoothstep(0.75, 0.25, vC) * 0.8;
      foam += (1.0 - smoothstep(0.0, 0.12, vV)) * 0.6;
      foam = clamp(foam + (n - 0.5) * 0.6, 0.0, 1.0);
      col = mix(col, uFoam, foam);
      float a = (1.0 - smoothstep(0.9, 1.0, vV + (n - 0.5) * 0.2)) * smoothstep(0.02, 0.25, vC);
      if (a < 0.02) discard;
      gl_FragColor = vec4(col, a);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      gl_FragColor.rgb = mix(gl_FragColor.rgb, uFogColor, smoothstep(uFogNear, uFogFar, length(vWorld - cameraPosition)));
    }`,
  transparent: true, side: THREE.DoubleSide,
});
{
  const NZ = 240, NA = 40, z0 = 60, z1 = -330, positions = [], uvs = [], idx = [];
  for (let i = 0; i <= NZ; i++) { const z = lerp(z0, z1, Math.pow(i / NZ, 1.2)); for (let j = 0; j <= NA; j++) { positions.push(0, 0, z); uvs.push(i / NZ, j / NA); } }
  for (let i = 0; i < NZ; i++) for (let j = 0; j < NA; j++) { const a = i * (NA + 1) + j, b = a + NA + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.setIndex(idx);
  const barrel = new THREE.Mesh(g, barrelMat); barrel.frustumCulled = false; barrel.renderOrder = 2; scene.add(barrel);
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

function makeBoard(mat = mats.board) {
  const L = 2.7, W = 0.37, N = 26, pts = [];
  const w = (t) => W * Math.pow(Math.sin(Math.PI * (t * 0.86)), 0.58);
  for (let i = 0; i <= N; i++) { const t = i / N; pts.push(new THREE.Vector2(w(t), L / 2 - t * L)); }
  for (let i = N; i >= 0; i--) { const t = i / N; pts.push(new THREE.Vector2(-w(t), L / 2 - t * L)); }
  const shape = new THREE.Shape(pts);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.03, bevelSegments: 3 });
  geo.rotateX(-Math.PI / 2); geo.translate(0, 0.03, 0);
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, mat));
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
const WHO = {
  pasha: { name: 'Паша Притчин', ini: 'ПП', g: ['#ff9a5a', '#ff4f7b'], nameCol: '#2f8fe8' },
  kirill: { name: 'Кирилл Швец', ini: 'КШ', g: ['#5ab0ff', '#6a5cff'], nameCol: '#6a5cff' },
};
function bubbleTexture(text, who = 'pasha') {
  const key = who + '|' + text, P = WHO[who];
  if (texCache.has(key)) return texCache.get(key);
  const W = 640, H = 250, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  roundRect(g, 0, 0, W, H, 52); g.fillStyle = '#ffffff'; g.fill();
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(230,236,245,.9)'); g.fillStyle = gr; g.fill();
  const ax = 78, ay = H / 2;
  const ag = g.createLinearGradient(ax - 46, ay - 46, ax + 46, ay + 46); ag.addColorStop(0, P.g[0]); ag.addColorStop(1, P.g[1]);
  g.fillStyle = ag; g.beginPath(); g.arc(ax, ay, 48, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff'; g.font = '800 36px Manrope, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(P.ini, ax, ay + 2);
  g.fillStyle = '#3ad16f'; g.beginPath(); g.arc(ax + 34, ay + 34, 10, 0, Math.PI * 2); g.fill(); g.lineWidth = 4; g.strokeStyle = '#fff'; g.stroke();
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.fillStyle = P.nameCol; g.font = '800 32px Manrope, sans-serif'; g.fillText(P.name, 148, 82);
  let fs = 52; g.font = `800 ${fs}px Manrope, sans-serif`;
  while (g.measureText(text).width > W - 180 && fs > 26) { fs -= 2; g.font = `800 ${fs}px Manrope, sans-serif`; }
  g.fillStyle = '#17161b'; g.fillText(text, 148, 156);
  g.font = '700 25px Manrope, sans-serif'; g.fillStyle = '#9aa0ab'; g.textAlign = 'right';
  g.fillText(`${randi(9, 23)}:${String(randi(0, 59)).padStart(2, '0')}  ✓✓`, W - 36, H - 30);
  g.fillStyle = '#ff3b4e'; g.beginPath(); g.arc(W - 46, 46, 22, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff'; g.font = '800 26px Manrope, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(randi(2, 99)), W - 46, 48);
  if (who === 'kirill') { // flimsy: cracked glass
    g.strokeStyle = 'rgba(80, 95, 130, .55)'; g.lineWidth = 3;
    for (let k = 0; k < 5; k++) { let x = rand(120, W - 60), y = rand(10, H - 10); g.beginPath(); g.moveTo(x, y); for (let j = 0; j < 5; j++) { x += rand(-70, 70); y += rand(-50, 50); g.lineTo(x, y); } g.stroke(); }
  }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  texCache.set(key, tex);
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
  return g;
}

// ───────────────────────── building blocks
const matCache = new Map();
const mc = (hex, o = {}) => { const k = hex + JSON.stringify(o); if (!matCache.has(k)) matCache.set(k, MAT(hex, o)); return matCache.get(k); };
const BOX = new THREE.BoxGeometry(1, 1, 1);
const CONE4 = new THREE.ConeGeometry(1, 1, 4); CONE4.rotateY(Math.PI / 4);
const CONE8 = new THREE.ConeGeometry(1, 1, 8);
const CYL16 = new THREE.CylinderGeometry(1, 1, 1, 16);
const HEMI = new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
const ONION = new THREE.LatheGeometry([[0, 0], [0.32, 0], [0.45, 0.12], [0.62, 0.38], [0.62, 0.58], [0.46, 0.84], [0.2, 1.08], [0.05, 1.28], [0, 1.42]].map(([x, y]) => new THREE.Vector2(x, y)), 16);
const ROOF = (() => { const s = new THREE.Shape([new THREE.Vector2(-1, 0), new THREE.Vector2(1, 0), new THREE.Vector2(0, 0.8)]); const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }); g.translate(0, 0, -0.5); return g; })();
function box(mat, sx, sy, sz, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(BOX, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); return m; }
function mesh(geo, mat, sx = 1, sy = sx, sz = sx, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); return m; }
const easeOut = (k) => 1 - Math.pow(1 - clamp(k, 0, 1), 3);
const easeIn = (k) => Math.pow(clamp(k, 0, 1), 3);
const nightMats = []; // windows and lamps that light up at night
const GOLD = MAT('#e3b23c', { metalness: 0.6, roughness: 0.3, emissive: '#7a5200', emissiveIntensity: 0.35 });
const lampMat = new THREE.MeshStandardMaterial({ color: '#fff3cf', emissive: '#ffcf7a', emissiveIntensity: 0 }); nightMats.push(lampMat);
const warmGlass = new THREE.MeshStandardMaterial({ color: '#2b4d6b', roughness: 0.2, emissive: '#ffcf7a', emissiveIntensity: 0 }); nightMats.push(warmGlass);

const winTex = (() => {
  const N = 8, S = 32, mk = () => { const c = document.createElement('canvas'); c.width = c.height = N * S; return c; };
  const a = mk(), b = mk(), ga = a.getContext('2d'), gb = b.getContext('2d');
  ga.fillStyle = '#ffffff'; ga.fillRect(0, 0, N * S, N * S); gb.fillStyle = '#000'; gb.fillRect(0, 0, N * S, N * S);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x = i * S + 8, y = j * S + 6;
    ga.fillStyle = '#efe9df'; ga.fillRect(x - 2, y - 2, 20, 24); ga.fillStyle = '#3d4a5c'; ga.fillRect(x, y, 16, 20);
    if (Math.random() < 0.45) { gb.fillStyle = Math.random() < 0.7 ? '#ffd27a' : '#fff1c9'; gb.fillRect(x, y, 16, 20); }
  }
  const t = (c) => { const x = new THREE.CanvasTexture(c); x.colorSpace = THREE.SRGBColorSpace; x.wrapS = x.wrapT = THREE.RepeatWrapping; return x; };
  return [t(a), t(b)];
})();
const winMatCache = new Map();
function winMat(color, rx, ry) {
  rx = Math.max(1, Math.round(rx)); ry = Math.max(1, Math.round(ry));
  const k = `${color}|${rx}|${ry}`; if (winMatCache.has(k)) return winMatCache.get(k);
  const map = winTex[0].clone(), em = winTex[1].clone();
  for (const x of [map, em]) { x.repeat.set(rx / 8, ry / 8); x.needsUpdate = true; }
  const m = new THREE.MeshStandardMaterial({ color, map, emissive: '#ffcf7a', emissiveMap: em, emissiveIntensity: 0, roughness: 0.85 });
  nightMats.push(m); winMatCache.set(k, m); return m;
}

// people for cameos: standing or sitting, faces +z
function makePerson(o) {
  const g = new THREE.Group();
  const skin = mc(o.skin || '#e2ae8c', { roughness: 0.6 }), shirt = mc(o.shirt), pants = mc(o.pants), hair = mc(o.hair);
  const hip = o.sit ? 0.14 : 0.86;
  if (o.sit) {
    for (const s of [-1, 1]) { const l = mesh(CYL16, pants, 0.075, 0.55, 0.075, s * 0.13, 0.08, 0.2); l.rotation.set(Math.PI / 2, 0, -s * 1.0); g.add(l); g.add(sph(skin, 0.05, 0.04, 0.1, -s * 0.12, 0.05, 0.42)); }
  } else {
    for (const s of [-1, 1]) { const l = new THREE.Mesh(CYL16, pants); setLimb(l, new THREE.Vector3(s * 0.1, hip, 0), new THREE.Vector3(s * 0.24, 0.05, 0.03), 0.075); g.add(l); g.add(sph(skin, 0.05, 0.04, 0.11, s * 0.24, 0.03, 0.08)); }
  }
  g.add(sph(pants, 0.18, 0.12, 0.13, 0, hip, 0));
  g.add(sph(shirt, 0.2, 0.28, 0.14, 0, hip + 0.3, 0));
  const head = new THREE.Group(); head.position.y = hip + 0.74; g.add(head);
  head.add(sph(skin, 0.12, 0.14, 0.125));
  head.add(sph(hair, 0.128, 0.1, 0.13, 0, 0.065, -0.03));
  if (o.long) head.add(sph(hair, 0.15, 0.32, 0.09, 0, -0.17, -0.09));
  if (o.beard) head.add(sph(hair, 0.105, 0.08, 0.07, 0, -0.08, 0.075));
  for (const s of [-1, 1]) head.add(sph(mc('#1d1a1c'), 0.016, 0.02, 0.01, s * 0.045, 0.02, 0.12));
  const arms = [];
  for (const s of [-1, 1]) {
    const p = new THREE.Group(); p.position.set(s * 0.21, hip + 0.5, 0); p.rotation.order = 'ZXY'; g.add(p);
    p.add(mesh(CYL16, shirt, 0.055, 0.3, 0.055, 0, -0.15, 0)); p.add(mesh(CYL16, skin, 0.045, 0.28, 0.045, 0, -0.42, 0)); p.add(sph(skin, 0.05, 0.06, 0.04, 0, -0.58, 0));
    p.rotation.z = s * 0.2; arms.push(p);
  }
  g.userData = { head, armA: arms[0], armB: arms[1] };
  return g;
}
function makeSpeech(title, sub) {
  const W = 560, H = 210, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  roundRect(g, 4, 4, W - 8, H - 54, 46); g.fillStyle = '#fff'; g.fill();
  g.beginPath(); g.moveTo(W / 2 - 26, H - 52); g.lineTo(W / 2, H - 8); g.lineTo(W / 2 + 26, H - 52); g.fill();
  g.textAlign = 'center'; g.fillStyle = '#17161b';
  let fs = 46; g.font = `800 ${fs}px Manrope, sans-serif`; while (g.measureText(title).width > W - 50) { fs -= 2; g.font = `800 ${fs}px Manrope, sans-serif`; }
  g.fillText(title, W / 2, 80);
  g.fillStyle = '#7a6f78'; g.font = '700 28px Manrope, sans-serif'; g.fillText(sub, W / 2, 124);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, toneMapped: false }));
  s.scale.set(3.4, 3.4 * H / W, 1); s.renderOrder = 5;
  return s;
}

// ───────────────────────── biomes: pyramids → Moscow river → Neva → Tom
const BIOMES = [
  { id: 'desert', name: '🐪 Пирамиды и пески', ground: '#e6a468' },
  { id: 'moscow', name: '🏙️ Москва-река', ground: '#8d9196' },
  { id: 'piter', name: '🌉 Нева · Питер', ground: '#a0958e' },
  { id: 'tomsk', name: '🌲 Томь · Томск', ground: '#6e8d4c' },
  { id: 'hawaii', name: '🌺 Гавайи', ground: '#d9bf8a' },
  { id: 'phiphi', name: '🏝️ Пхи-Пхи', ground: '#f3e6c8' },
  { id: 'glacier', name: '🧊 Ледники', ground: '#eef4f8' },
];
const BIOME_LEN = 650, SHORE_X = 46, GROUND_LEN = 40, TOD_LEN = 2600;
// pyramids always open the run, the rest come in a fresh random order every run
const biomeAt = (d) => G.order[Math.floor(Math.max(0, d) / BIOME_LEN) % G.order.length];
const shuffledOrder = () => [0, ...[...BIOMES.keys()].slice(1).sort(() => Math.random() - 0.5)];
const PASTEL = ['#f2d48a', '#9fd3c2', '#f2b5a8', '#c9d6e8', '#efe3c8', '#e8c2d8'];

function makePalm() {
  const g = new THREE.Group(); const trunk = mc('#6a4630'), leaf = mc('#2f5b3c', { side: THREE.DoubleSide });
  let y = 0, x = 0; const bend = rand(0.04, 0.1);
  for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(UNIT_CYL, trunk); m.scale.set(0.22 - i * 0.02, 1.25, 0.22 - i * 0.02); m.position.set(x, y + 0.6, 0); m.rotation.z = -bend * i; g.add(m); y += 1.2; x += bend * i * 1.2; }
  for (let k = 0; k < 8; k++) { const f = sph(leaf, 0.35, 0.06, 1.9); f.position.set(x, y, 0); f.rotation.set(0.45, (k / 8) * Math.PI * 2, 0, 'YXZ'); f.translateZ(1.4); g.add(f); }
  g.scale.setScalar(rand(0.9, 1.3));
  return g;
}
function makeVan() {
  const g = new THREE.Group(); const body = mc('#cfd3d6', { roughness: 0.4, metalness: 0.2 }), dark = mc('#25303a', { roughness: 0.2 }), tire = mc('#18181b');
  g.add(box(body, 2.1, 1.7, 4.6, 0, 1.35, 0)); g.add(box(body, 2.0, 0.5, 3.8, 0, 2.35, -0.2));
  g.add(box(dark, 2.12, 0.6, 3.2, 0, 1.75, 0.1)); g.add(box(dark, 1.8, 0.65, 0.05, 0, 1.75, -2.31));
  for (const [x, z] of [[-1, -1.5], [1, -1.5], [-1, 1.5], [1, 1.5]]) { const t = mesh(CYL16, tire, 0.42, 0.3, 0.42, x, 0.42, z); t.rotation.z = Math.PI / 2; g.add(t); }
  const board = makeBoard(); board.rotation.set(-1.3, 0, 0.15); board.position.set(-1.35, 1.4, 1.2); g.add(board);
  g.rotation.y = rand(-0.5, 0.5);
  return g;
}
function makeCamel() {
  const g = new THREE.Group(); const m = mc('#a8744c');
  g.add(sph(m, 0.55, 0.42, 1.0, 0, 2.0, 0)); g.add(sph(m, 0.32, 0.38, 0.38, 0, 2.45, 0.05));
  const neck = mesh(UNIT_CYL, m, 0.14, 1.0, 0.14, 0, 2.5, -1.05); neck.rotation.x = -0.5; g.add(neck);
  g.add(sph(m, 0.16, 0.16, 0.35, 0, 2.95, -1.45));
  for (const [x, z] of [[-0.3, -0.6], [0.3, -0.6], [-0.3, 0.6], [0.3, 0.6]]) g.add(mesh(UNIT_CYL, m, 0.08, 1.7, 0.08, x, 0.9, z));
  g.rotation.y = rand(-0.4, 0.4) + Math.PI / 2; g.scale.setScalar(1.2);
  return g;
}
const makeDune = () => { const g = new THREE.Group(); g.add(sph(mc(Math.random() < 0.5 ? '#eaa064' : '#d98a52', { roughness: 1 }), rand(10, 20), rand(3, 7), rand(12, 26))); return g; };
const makePyramid = () => { const s = rand(8, 22), g = new THREE.Group(); g.add(mesh(CONE4, mc('#d9a86a', { roughness: 1 }), s, s * 0.9, s, 0, s * 0.45, 0)); return g; };
const RED = () => mc('#a8322d', { roughness: 0.9 });
function makeKremlinTower() {
  const g = new THREE.Group(), red = RED();
  g.add(box(red, 4.6, 11, 4.6, 0, 5.5, 0)); g.add(box(mc('#f1ebe0'), 4.9, 0.4, 4.9, 0, 11, 0));
  g.add(box(red, 3.4, 3.2, 3.4, 0, 12.8, 0)); g.add(mesh(CONE4, mc('#2f6b52', { roughness: 0.7 }), 2.6, 7, 2.6, 0, 17.9, 0));
  g.add(mesh(new THREE.OctahedronGeometry(1), mc('#ff2a2a', { emissive: '#ff1a1a', emissiveIntensity: 0.9 }), 0.55, 0.8, 0.22, 0, 22, 0));
  return g;
}
const MERLONS = (() => { const parts = []; for (let i = 0; i < 20; i++) { const b = new THREE.BoxGeometry(0.9, 1.2, 1.1); b.translate(0, 0, -GROUND_LEN / 2 + 1 + i * 2); parts.push(b); } return mergeGeometries(parts); })();
function makeBasil() {
  const g = new THREE.Group();
  g.add(box(mc('#b8463a'), 12, 7, 12, 0, 3.5, 0));
  for (const [x, z, h, c, r] of [[0, 0, 16, '#e0b03a', 3.0], [-3.6, -3.6, 11, '#2e8b57', 2.1], [3.6, -3.6, 12, '#d94040', 2.1], [-3.6, 3.6, 12, '#3a6fc4', 2.1], [3.6, 3.6, 11, '#f08c2a', 2.1]]) {
    g.add(mesh(CYL16, mc('#c9573f'), r * 0.8, h - 7, r * 0.8, x, 7 + (h - 7) / 2, z));
    g.add(mesh(ONION, mc(c, { roughness: 0.5 }), r, r, r, x, h, z));
  }
  return g;
}
const makeLamp = () => { const g = new THREE.Group(); g.add(mesh(CYL16, mc('#2b2d33'), 0.08, 4.6, 0.08, 0, 2.3, 0)); g.add(sph(lampMat, 0.28, 0.32, 0.28, 0, 4.7, 0)); return g; };
const makeTower = () => { const w = rand(10, 16), h = rand(40, 120), g = new THREE.Group(); g.add(box(winMat(pick(['#8fb3d6', '#6f8fb5', '#a9c4dc', '#5d7899']), w / 2.5, h / 3.2), w, h, w, 0, h / 2, 0)); return g; };
function makeFacade(l = rand(10, 16), h = rand(13, 19), color = pick(PASTEL)) {
  const g = new THREE.Group();
  g.add(box(winMat(color, l / 2.6, h / 3.4), 9, h, l, 0, h / 2, 0));
  g.add(box(mc('#f4efe6'), 9.4, 0.6, l + 0.2, 0, h - 0.3, 0));
  g.add(box(mc('#5d6670'), 8.6, 1.6, l - 0.2, 0, h + 0.8, 0));
  return g;
}
function makeAdmiralty() {
  const g = new THREE.Group();
  g.add(box(winMat('#f0cf72', 6, 4), 12, 12, 16, 0, 6, 0)); g.add(box(mc('#f4efe6'), 6, 6, 6, 0, 15, 0));
  g.add(mesh(CYL16, mc('#f0cf72'), 2.4, 5, 2.4, 0, 20.5, 0)); g.add(mesh(CYL16, GOLD, 2.6, 2, 2.6, 0, 24, 0));
  g.add(mesh(CONE8, GOLD, 0.7, 22, 0.7, 0, 36, 0));
  return g;
}
function makeIsaac() {
  const g = new THREE.Group(), stone = mc('#b9ab98');
  g.add(box(stone, 18, 14, 22, 0, 7, 0)); g.add(mesh(CYL16, stone, 7, 7, 7, 0, 17.5, 0));
  g.add(mesh(HEMI, GOLD, 7.4, 6.5, 7.4, 0, 21, 0)); g.add(mesh(CYL16, stone, 1.2, 3, 1.2, 0, 28.5, 0)); g.add(mesh(CONE8, GOLD, 0.5, 4, 0.5, 0, 32, 0));
  return g;
}
function makeIzba() {
  const g = new THREE.Group(), white = mc('#f3efe6');
  g.add(box(mc('#7a5236', { roughness: 1 }), 7, 4.6, 8, 0, 2.3, 0));
  g.add(mesh(ROOF, mc(pick(['#4f7a5a', '#6b4a3a', '#8a3b32'])), 4.3, 4.3, 8.8, 0, 4.6, 0));
  for (const z of [-2, 2]) { g.add(box(white, 0.3, 1.9, 1.6, -3.55, 2.4, z)); g.add(box(warmGlass, 0.34, 1.3, 1.0, -3.55, 2.4, z)); g.add(box(white, 0.36, 0.5, 2.0, -3.55, 3.6, z)); }
  return g;
}
function makeBirch() {
  const g = new THREE.Group(), leaf = mc('#a3c76a');
  g.add(mesh(CYL16, mc('#efece6'), 0.25, 9, 0.25, 0, 4.5, 0));
  for (let i = 0; i < 3; i++) g.add(sph(leaf, rand(1.5, 2.2), rand(1.8, 2.5), rand(1.5, 2.2), rand(-0.8, 0.8), 7.5 + i * 1.2, rand(-0.8, 0.8)));
  return g;
}
function makePine() {
  const g = new THREE.Group(), s = rand(0.8, 1.5), m = mc('#2f5a3a');
  g.add(mesh(CYL16, mc('#5a3d2b'), 0.3 * s, 3 * s, 0.3 * s, 0, 1.5 * s, 0));
  for (let i = 0; i < 3; i++) g.add(mesh(CONE8, m, (2.6 - i * 0.6) * s, 4 * s, (2.6 - i * 0.6) * s, 0, (4 + i * 2.2) * s, 0));
  return g;
}
function makeChurch() {
  const g = new THREE.Group(), w = mc('#f3f0ea');
  g.add(box(w, 6, 8, 8, 0, 4, 0)); g.add(mesh(CYL16, w, 2, 4, 2, 0, 10, 0)); g.add(mesh(ONION, GOLD, 2.4, 2.4, 2.4, 0, 12, 0));
  g.add(box(GOLD, 0.15, 2, 0.15, 0, 16.5, 0)); g.add(box(GOLD, 0.15, 0.15, 1.1, 0, 16.9, 0));
  return g;
}
const makeHill = () => { const g = new THREE.Group(); g.add(sph(mc('#5f8a45', { roughness: 1 }), rand(14, 24), rand(5, 9), rand(20, 32))); return g; };
function makeTiki() {
  const g = new THREE.Group(), wood = mc('#6b4a33'), straw = mc('#c9a35a', { roughness: 1 });
  for (const [x, z] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) g.add(mesh(CYL16, wood, 0.15, 3, 0.15, x, 1.5, z));
  g.add(box(wood, 4, 0.25, 4, 0, 1.2, 0)); g.add(mesh(CONE8, straw, 3.2, 2.6, 3.2, 0, 4.2, 0));
  return g;
}
function makeHibiscus() {
  const g = new THREE.Group(); g.add(sph(mc('#2f6b3a'), rand(1.2, 1.8), rand(0.9, 1.3), rand(1.2, 1.8), 0, 0.9, 0));
  for (let i = 0; i < 6; i++) { const a = rand(0, 6.28); g.add(sph(mc(pick(['#ff3b6b', '#ff7a3d', '#ffd24a', '#ff5fa2'])), 0.28, 0.2, 0.28, Math.cos(a) * 1.3, rand(0.9, 1.9), Math.sin(a) * 1.3)); }
  return g;
}
function makeBoardRack() {
  const g = new THREE.Group();
  ['#ff5e6c', '#4fd1c5', '#ffc93c', '#8b6cff'].slice(0, randi(2, 4)).forEach((c, i) => { const b = makeBoard(mc(c, { roughness: 0.35 })); b.rotation.set(-Math.PI / 2 + rand(-0.15, 0.15), 0, rand(-0.2, 0.2)); b.position.set(0, 1.3, i * 0.9); g.add(b); });
  return g;
}
function makeKarst() {
  const g = new THREE.Group(), rock = mc(pick(['#9c9585', '#8f8a7c', '#a8a08c']), { roughness: 1 }), green = mc('#4f7a3a', { roughness: 1 });
  const h = rand(14, 34), r = rand(4, 9);
  g.add(sph(rock, r, h * 0.5, r * 0.9, 0, h * 0.4, 0)); g.add(sph(rock, r * 0.75, h * 0.35, r * 0.7, rand(-1, 1), h * 0.75, rand(-1, 1)));
  g.add(sph(green, r * 0.7, h * 0.12, r * 0.65, 0, h * 0.98, 0)); g.add(sph(green, r * 0.5, h * 0.2, r * 0.4, r * 0.6, h * 0.6, 0));
  return g;
}
function makeLongtail() {
  const g = new THREE.Group(), wood = mc('#8a5a3a'), dark = mc('#3a2a20');
  g.add(sph(wood, 0.8, 0.45, 4, 0, 0.2, 0)); g.add(box(dark, 1.1, 0.1, 6, 0, 0.55, 0));
  const bow = mesh(CYL16, wood, 0.18, 2.2, 0.18, 0, 1.2, -4); bow.rotation.x = -0.5; g.add(bow);
  ['#ff3b6b', '#ffd24a', '#4fd1c5'].forEach((c, i) => g.add(box(mc(c), 0.05, 0.9, 0.1, 0, 1.6 - i * 0.2, -4.35 + i * 0.12)));
  const pole = mesh(CYL16, dark, 0.06, 3.2, 0.06, 0, 0.6, 4.6); pole.rotation.x = 1.25; g.add(pole);
  g.rotation.y = rand(-0.6, 0.6);
  return g;
}
const ICO = new THREE.IcosahedronGeometry(1, 0);
function makeIceberg() {
  const g = new THREE.Group(), ice = mc(pick(['#eaf7ff', '#dff2fb']), { roughness: 0.25, flatShading: true }), blue = mc('#a9dcf0', { roughness: 0.2, flatShading: true });
  const s = rand(2.5, 7);
  const m = mesh(ICO, ice, s * rand(0.9, 1.4), s * rand(0.6, 1.1), s * rand(0.9, 1.4), 0, s * 0.25, 0); m.rotation.y = rand(0, 3); g.add(m);
  g.add(mesh(ICO, blue, s * 0.7, s * 0.4, s * 0.7, s * 0.4, s * 0.1, rand(-1, 1)));
  return g;
}
function makeIceCliff() {
  const g = new THREE.Group();
  for (let i = 0; i < 4; i++) { const h = rand(6, 16); const m = mesh(ICO, mc(pick(['#dff2fb', '#c4e6f4', '#eef8fd']), { roughness: 0.3, flatShading: true }), rand(3, 6), h, rand(3, 6), rand(-3, 3), h * 0.5, i * 4 - 6); m.rotation.y = rand(0, 3); g.add(m); }
  return g;
}
function makePenguin() {
  const g = new THREE.Group(), black = mc('#1d1f26'), white = mc('#f4f4f2'), orange = mc('#ff9a2a');
  g.add(sph(black, 0.32, 0.5, 0.3, 0, 0.5, 0)); g.add(sph(white, 0.24, 0.4, 0.2, 0, 0.45, 0.12)); g.add(sph(black, 0.2, 0.2, 0.2, 0, 1.05, 0));
  const beak = mesh(new THREE.ConeGeometry(0.06, 0.18, 6), orange, 1, 1, 1, 0, 1.03, 0.24); beak.rotation.x = Math.PI / 2; g.add(beak);
  for (const sx of [-1, 1]) { g.add(sph(orange, 0.1, 0.03, 0.14, sx * 0.12, 0.02, 0.08)); g.add(sph(white, 0.03, 0.03, 0.02, sx * 0.08, 1.1, 0.17)); }
  return g;
}
const makePenguins = () => { const g = new THREE.Group(); for (let i = 0; i < randi(2, 5); i++) { const p = makePenguin(); p.position.set(rand(-1.5, 1.5), 0, rand(-2, 2)); p.rotation.y = -Math.PI / 2 + rand(-0.6, 0.6); p.scale.setScalar(rand(1.1, 1.6)); g.add(p); } return g; };
const PROPS = {
  desert: [[0.32, makePalm, 48, 62], [0.22, makeDune, 70, 130], [0.14, makeCamel, 52, 72], [0.22, makePyramid, 80, 150], [0.1, makeVan, 48, 54]],
  moscow: [[0.35, makeLamp, 47.4, 47.4], [0.42, makeTower, 95, 160], [0.14, makeKremlinTower, 70, 90], [0.09, makeBasil, 64, 74]],
  piter: [[0.4, makeLamp, 47.4, 47.4], [0.12, makeAdmiralty, 70, 80], [0.1, makeIsaac, 80, 100], [0.38, () => makeFacade(rand(10, 16), rand(14, 20)), 66, 90]],
  tomsk: [[0.25, makeIzba, 52, 62], [0.3, makeBirch, 48, 75], [0.35, makePine, 55, 120], [0.05, makeChurch, 66, 80], [0.05, makeHill, 90, 140]],
  // 5th field: 'sea' stands in the water, 'float' bobs on the waves
  hawaii: [[0.36, makePalm, 48, 64], [0.18, makeTiki, 52, 62], [0.2, makeHibiscus, 47.5, 58], [0.12, makeBoardRack, 48, 51], [0.14, makeHill, 80, 140]],
  phiphi: [[0.34, makeKarst, 16, 70, 'sea'], [0.16, makeLongtail, 11, 24, 'float'], [0.3, makePalm, 48, 60], [0.12, makeTiki, 50, 58], [0.08, makeKarst, 60, 120]],
  glacier: [[0.34, makeIceberg, 13, 60, 'float'], [0.26, makeIceCliff, 52, 80], [0.2, makePenguins, 47.5, 50], [0.2, makeIceberg, 60, 110, 'sea']],
};
function makeGround(b) {
  const g = new THREE.Group(), id = BIOMES[b].id;
  g.add(box(mc(BIOMES[b].ground, { roughness: 1 }), 220, 1.6, GROUND_LEN + 0.6, SHORE_X + 110, 0, 0));
  if (id === 'moscow' || id === 'piter') g.add(box(mc(id === 'moscow' ? '#7d8287' : '#b49a8a', { roughness: 0.9 }), 1.2, 1.1, GROUND_LEN + 0.6, SHORE_X + 0.6, 1.3, 0));
  else g.add(box(mc({ desert: '#efc08a', tomsk: '#c9b07a', hawaii: '#e8d3a4', phiphi: '#fbf3de', glacier: '#d6ecf6' }[id], { roughness: 1 }), 6, 0.9, GROUND_LEN + 0.6, SHORE_X - 1.5, 0.05, 0));
  if (id === 'moscow') {
    const red = RED(); g.add(box(red, 2.2, 7, GROUND_LEN, SHORE_X + 9, 4.3, 0));
    g.add(mesh(MERLONS, red, 1, 1, 1, SHORE_X + 9, 8.4, 0));
    if (Math.random() < 0.5) { const t = makeKremlinTower(); t.position.set(SHORE_X + 9, 0.8, rand(-12, 12)); g.add(t); }
  }
  if (id === 'piter') {
    let z = -GROUND_LEN / 2;
    while (z < GROUND_LEN / 2 - 3) { const l = Math.min(rand(9, 14), GROUND_LEN / 2 - z); const f = makeFacade(l - 0.4); f.position.set(SHORE_X + 8, 0.8, z + l / 2); g.add(f); z += l; }
  }
  return g;
}
const scenery = [];
const biomeForZ = (z) => biomeAt(G.runDist - z);
function addProp(z) {
  const list = PROPS[BIOMES[biomeForZ(z)].id];
  let r = Math.random() * list.reduce((s, x) => s + x[0], 0), item = list[0];
  for (const it of list) { r -= it[0]; if (r <= 0) { item = it; break; } }
  const g = item[1](); g.position.set(rand(item[2], item[3]), item[4] ? -0.3 : 0.8, z); g.userData.float = item[4] === 'float'; scene.add(g); scenery.push(g);
}
function addGround(z) { const g = makeGround(biomeForZ(z)); g.position.z = z; scene.add(g); scenery.push(g); }
function updateScenery(dz) {
  G.nextPropZ += dz; G.nextGroundZ += dz;
  while (G.nextGroundZ > -340) { addGround(G.nextGroundZ); G.nextGroundZ -= GROUND_LEN; }
  while (G.nextPropZ > -330) { addProp(G.nextPropZ); G.nextPropZ -= rand(8, 15); }
  for (let i = scenery.length - 1; i >= 0; i--) {
    const s = scenery[i]; s.position.z += dz;
    if (s.userData.float) { s.position.y = waveH(s.position.x, s.position.z - G.dist, G.t) * 0.8 - 0.3; s.rotation.z = Math.sin(G.t * 1.3 + s.position.x) * 0.04; }
    if (s.position.z > 90) { scene.remove(s); scenery.splice(i, 1); }
  }
}
function resetScenery() {
  for (const s of scenery) scene.remove(s); scenery.length = 0;
  G.nextGroundZ = 80; G.nextPropZ = 70; updateScenery(0);
}
// far skylines, one per biome, cross-faded
const skylines = BIOMES.map(() => { const g = new THREE.Group(); g.visible = false; scene.add(g); const near = new THREE.MeshBasicMaterial({ fog: false, transparent: true, opacity: 0, depthWrite: false }); const far = near.clone(); g.userData = { mats: [[near, 0.82], [far, 0.9]], o: 0, near, far }; return g; });
{
  let { near: n, far: f } = skylines[0].userData, g = skylines[0];
  for (const [x, s] of [[150, 90], [260, 125], [365, 72]]) g.add(mesh(CONE4, n, s, s * 0.9, s, x, s * 0.45 - 2, -600));
  for (let i = 0; i < 6; i++) g.add(sph(f, rand(60, 120), rand(10, 22), 40, 90 + i * 70, -4, -650));
  ({ near: n, far: f } = skylines[1].userData); g = skylines[1];
  for (let i = 0; i < 10; i++) { const h = rand(80, 230); g.add(box(i % 2 ? n : f, rand(14, 24), h, 20, 160 + i * 15 + rand(-4, 4), h / 2 - 2, -600 + rand(-20, 20))); }
  g.add(mesh(CYL16, f, 2.5, 300, 2.5, 330, 148, -650)); g.add(sph(f, 9, 6, 9, 330, 200, -650));
  g.add(box(f, 60, 40, 30, 95, 18, -640)); g.add(box(f, 30, 40, 30, 95, 58, -640)); g.add(box(f, 14, 30, 14, 95, 92, -640)); g.add(mesh(CONE8, f, 3, 40, 3, 95, 127, -640));
  ({ near: n, far: f } = skylines[2].userData); g = skylines[2];
  g.add(mesh(new THREE.ConeGeometry(1, 1, 5), n, 18, 300, 18, 270, 148, -620));
  g.add(mesh(CYL16, f, 20, 40, 20, 150, 18, -640)); g.add(mesh(HEMI, f, 20, 18, 20, 150, 38, -640)); g.add(mesh(CONE8, f, 2, 30, 2, 150, 70, -640));
  g.add(mesh(CONE8, n, 2.5, 150, 2.5, 205, 73, -620));
  for (let i = 0; i < 10; i++) g.add(box(f, 30, rand(14, 30), 20, 70 + i * 30, 5, -610));
  ({ near: n, far: f } = skylines[3].userData); g = skylines[3];
  for (let i = 0; i < 5; i++) g.add(sph(i % 2 ? n : f, rand(80, 140), rand(25, 45), 60, 100 + i * 90, -6, -600 - (i % 2) * 40));
  for (let i = 0; i < 40; i++) { const x = 70 + i * 9 + rand(-3, 3); g.add(mesh(CONE8, n, 4, rand(12, 22), 4, x, 24 + Math.sin(i * 0.4) * 10, -560)); }
  ({ near: n, far: f } = skylines[4].userData); g = skylines[4];
  g.add(mesh(new THREE.ConeGeometry(1, 1, 12), n, 150, 120, 150, 230, 56, -640));
  g.add(mesh(new THREE.CylinderGeometry(40, 95, 55, 12), f, 1, 1, 1, 110, 25, -600));
  { const glow = new THREE.MeshBasicMaterial({ color: '#ff6a2a', fog: false, transparent: true, opacity: 0, depthWrite: false }); g.add(sph(glow, 16, 6, 16, 230, 116, -640)); g.userData.extra = [[glow, 0.9]]; }
  ({ near: n, far: f } = skylines[5].userData); g = skylines[5];
  for (let i = 0; i < 16; i++) { const h = rand(40, 120), r = rand(10, 22), x = 60 + i * 26 + rand(-8, 8), z = -560 - rand(0, 80); g.add(sph(i % 2 ? n : f, r, h * 0.5, r, x, h * 0.4, z)); g.add(sph(i % 2 ? n : f, r * 0.7, h * 0.3, r * 0.7, x, h * 0.8, z)); }
  ({ near: n, far: f } = skylines[6].userData); g = skylines[6]; skylines[6].userData.mats = [[n, 1.04], [f, 1.12]];
  for (let i = 0; i < 14; i++) { const h = rand(60, 150); g.add(mesh(new THREE.ConeGeometry(1, 1, 5), i % 2 ? n : f, rand(40, 70), h, rand(40, 70), 70 + i * 30 + rand(-10, 10), h / 2 - 4, -600 - (i % 3) * 30)); }
}

// ───────────────────────── time of day
const PAL = {
  sunset: { horizon: '#f6b98f', mid: '#ee8c78', top: '#54548c', glow: '#ff8c40', disc: '#fff4dc', cloud: '#fca09a', glowAmt: 1, night: 0, elev: 0.075,
    deep: '#0b4250', shallow: '#1d8a8c', wall: '#62d6c4', refl: '#f7b68e', sunCol: '#ffd49c', hemiSky: '#ffd6b0', hemiGround: '#2a6f78', hemiI: 1.25, sun: '#ffb27a', sunI: 2.4, fillI: 1.15 },
  night: { horizon: '#3a3f6e', mid: '#22285a', top: '#090c22', glow: '#7d8cff', disc: '#eef2ff', cloud: '#3e4677', glowAmt: 0.35, night: 1, elev: 0.22,
    deep: '#06202e', shallow: '#0f4a5a', wall: '#2f8f98', refl: '#4a5288', sunCol: '#c9d4ff', hemiSky: '#8a96d8', hemiGround: '#14334a', hemiI: 1.05, sun: '#aebcff', sunI: 1.4, fillI: 1.0 },
  dawn: { horizon: '#fbd3c4', mid: '#d7b9dd', top: '#7b8fcc', glow: '#ffb0a0', disc: '#fff3e6', cloud: '#ffd0d8', glowAmt: 0.8, night: 0, elev: 0.04,
    deep: '#124a5e', shallow: '#2a96a0', wall: '#74dccf', refl: '#f2c6c6', sunCol: '#ffe1cc', hemiSky: '#ffe2e0', hemiGround: '#2e6f80', hemiI: 1.2, sun: '#ffc4b0', sunI: 2.0, fillI: 1.1 },
  day: { horizon: '#d4ecf5', mid: '#a6d2ef', top: '#4a8fdc', glow: '#fff2c0', disc: '#fffef4', cloud: '#ffffff', glowAmt: 0.5, night: 0, elev: 0.45,
    deep: '#0a4d6a', shallow: '#1aa3b0', wall: '#6fe6d8', refl: '#9cc6dc', sunCol: '#a39b88', hemiSky: '#e8f4ff', hemiGround: '#2f7f8c', hemiI: 1.3, sun: '#fff1d6', sunI: 2.6, fillI: 1.1 },
};
const TOD = Object.fromEntries(Object.entries(PAL).map(([k, p]) => [k, Object.fromEntries(Object.entries(p).map(([f, v]) => [f, typeof v === 'string' ? new THREE.Color(v) : v]))]));
const CUR = Object.fromEntries(Object.entries(TOD.sunset).map(([f, v]) => [f, v.isColor ? v.clone() : v]));
const TOD_KEYS = [[0, 'sunset'], [0.1, 'sunset'], [0.22, 'night'], [0.42, 'night'], [0.53, 'dawn'], [0.62, 'day'], [0.86, 'day'], [1, 'sunset']];
const _srgb = {}, _hz = new THREE.Color();
const toV3 = (c, v) => { c.getRGB(_srgb, THREE.SRGBColorSpace); v.set(_srgb.r, _srgb.g, _srgb.b); };
function applyTOD(tod) {
  let i = 0; while (i < TOD_KEYS.length - 2 && tod > TOD_KEYS[i + 1][0]) i++;
  const [t0, a] = TOD_KEYS[i], [t1, b] = TOD_KEYS[i + 1];
  const k = THREE.MathUtils.smoothstep(tod, t0, t1), A = TOD[a], B = TOD[b];
  for (const f in CUR) { if (CUR[f].isColor) CUR[f].lerpColors(A[f], B[f], k); else CUR[f] = lerp(A[f], B[f], k); }
  const u = skyMat.uniforms;
  toV3(CUR.horizon, fogOut); toV3(CUR.mid, u.uMid.value); toV3(CUR.top, u.uTop.value); toV3(CUR.glow, u.uGlow.value); toV3(CUR.disc, u.uDisc.value); toV3(CUR.cloud, u.uCloud.value);
  u.uNight.value = CUR.night; u.uGlowAmt.value = CUR.glowAmt;
  scene.fog.color.copy(CUR.horizon);
  waterUniforms.uDeep.value.copy(CUR.deep); waterUniforms.uShallow.value.copy(CUR.shallow); waterUniforms.uWallLight.value.copy(CUR.wall);
  waterUniforms.uSkyRefl.value.copy(CUR.refl); waterUniforms.uSunCol.value.copy(CUR.sunCol);
  SUN_DIR.set(0.2, CUR.elev, -1).normalize(); sunLight.position.copy(SUN_DIR).multiplyScalar(60);
  hemi.color.copy(CUR.hemiSky); hemi.groundColor.copy(CUR.hemiGround); hemi.intensity = CUR.hemiI;
  sunLight.color.copy(CUR.sun); sunLight.intensity = CUR.sunI; fillLight.intensity = CUR.fillI;
  for (const m of nightMats) m.emissiveIntensity = CUR.night * 1.2;
  for (const s of skylines) for (const [m, f] of s.userData.mats) m.color.copy(CUR.horizon).multiplyScalar(f);
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
  glass() { const t = this.now(); this.noise(t, 0.3, 'highpass', 3000, 7000, 0.25); this.tone(2637, t, 0.15, 'triangle', 0.06); this.tone(3520, t + 0.04, 0.12, 'triangle', 0.05); },
  splash() { this.noise(this.now(), 0.5, 'lowpass', 1400, 200, 0.35, this.master, this.brown); },
  woof() { const t = this.now(); this.tone(330, t, 0.13, 'square', 0.09, this.master, 1200, 160); this.tone(300, t + 0.18, 0.15, 'square', 0.09, this.master, 1200, 140); },
  coffee() { const t = this.now(); this.noise(t, 0.7, 'bandpass', 300, 2200, 0.25); for (let i = 0; i < 6; i++) this.tone(rand(500, 1100), t + i * 0.06, 0.08, 'sine', 0.05); },
  hello() { const t = this.now(); [659.25, 830.6, 987.8].forEach((f, i) => this.tone(f, t + i * 0.09, 0.3, 'triangle', 0.09)); },
  chime() { const t = this.now(); [1318.5, 1568, 1975.5, 2637].forEach((f, i) => this.tone(f, t + i * 0.07, 0.5, 'sine', 0.05)); },
  bump() { const t = this.now(); this.tone(180, t, 0.2, 'sine', 0.3, this.master, 0, 70); this.noise(t, 0.2, 'lowpass', 1200, 200, 0.25, this.master, this.brown); },
  sizzle() { this.noise(this.now(), 0.8, 'highpass', 2500, 6000, 0.14); },
  crash() { const t = this.now(); this.noise(t, 1.1, 'lowpass', 1500, 120, 0.6, this.master, this.brown); this.tone(330, t, 0.7, 'sawtooth', 0.08, this.master, 1200, 70); },
  birthday() { // Happy Birthday, first phrase (traditional melody)
    const t0 = this.now() + 0.02, b = 0.2, notes = [[440, 0.75], [440, 0.25], [493.88, 1], [440, 1], [587.33, 1], [554.37, 2]];
    let t = t0; for (const [f, d] of notes) { this.tone(f, t, d * b * 1.1, 'triangle', 0.16); this.tone(f * 2, t, d * b, 'sine', 0.04); t += d * b; }
  },
};

// ───────────────────────── online: wishes + leaderboard (Yandex Cloud Function → Object Storage)
const API = String(window.ARBUZ_API || '').replace(/\/+$/, '');
const playerId = (() => { let id = store.get('player', null); if (!id) { id = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)); store.set('player', id); } return id; })();
const Online = {
  on: !!API,
  async call(op, data, params = {}) {
    const u = new URL(API); u.searchParams.set('op', op); for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    const ac = new AbortController(); const timer = setTimeout(() => ac.abort(), 7000);
    try {
      // text/plain keeps it a "simple" CORS request — no preflight
      const r = await fetch(u, data ? { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify(data), signal: ac.signal } : { signal: ac.signal });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } finally { clearTimeout(timer); }
  },
};
// Birthday greetings for the gifts: wishes players left come first, none repeats until all were collected
const Wishes = {
  pool: WISHES.map((text, i) => ({ id: 'b' + i, text, name: '' })),
  seen: new Set(store.get('seenWishes', [])),
  collected: store.get('collected', []),
  merge(list) { for (const w of list || []) if (w && w.id && w.text && !this.pool.some((p) => p.id === w.id)) this.pool.unshift({ id: w.id, text: w.text, name: w.name || '' }); },
  async load() { if (!Online.on) return; try { this.merge(await Online.call('wishes')); } catch {} },
  next() {
    let cand = this.pool.filter((w) => !this.seen.has(w.id));
    if (!cand.length) { this.seen.clear(); cand = this.pool.slice(); }
    const fromPeople = cand.filter((w) => !w.id.startsWith('b'));
    const w = fromPeople.length ? fromPeople[0] : pick(cand);
    this.seen.add(w.id); store.set('seenWishes', [...this.seen]);
    if (!this.collected.some((c) => c.id === w.id)) { this.collected.push(w); store.set('collected', this.collected); }
    return w;
  },
};

// ───────────────────────── game state
const G = {
  state: 'loading', lives: 3, t: 0, run: 0, dist: 0, runDist: 0, speed: 12, score: 0, scoreF: 0, melons: 0, best: store.get('best', 0),
  boost: 0, boostMax: 6.5, fly: 0, husky: 0, nextRowZ: -50, sincePower: 0, lastHit: null, streak: 0, lastMelonT: 0, shake: 0,
  slowmo: 1, dyingT: 0, stumbleT: 0, nextPropZ: 70, nextGroundZ: 80, biome: -1, nextCameo: 14, cameoIdx: 0,
  order: [0, 1, 2, 3, 4, 5, 6], barrel: null, nextBarrel: 12, tubeIn: 0, nextCritter: 2,
};
const START_LIVES = 3, MAX_LIVES = 5;
const FLY_T = 6.5, FLY_H = 5.2, HUSKY_T = 3.4, HUSKY_H = 8.5;
const player = { lane: 1, prevLane: 1, x: 0, h: 0, vy: 0, air: false, duckT: 0, duck: 0, invuln: 0, jumpT: 0, trick: 0, carve: 0 };
const entities = [];
const cameos = [];
let camMode = 'title';
const PHX = 0.36, PHZ = 0.62;
const difficulty = () => clamp(G.run / 85, 0, 1);
const flying = () => G.fly > 0 || G.husky > 0;

const kirillSlab = MAT('#e4ecff', { transparent: true, opacity: 0.5, roughness: 0.1, emissive: '#cfe0ff', emissiveIntensity: 0.35 });
function addObstacle(type, lane, z) {
  if (type === 'shark') return addShark(lane, z);
  const g = new THREE.Group();
  let yMin = 0, yMax = 1.0; const msgs = [];
  const bubble = (y, xo = 0, rz = 0, who = 'pasha') => {
    const text = pick(who === 'kirill' ? KIRILL : PASHA); msgs.push(text);
    const b = new THREE.Group();
    b.add(new THREE.Mesh(bubbleGeo, who === 'kirill' ? kirillSlab : bubbleMat));
    const face = new THREE.Mesh(bubbleFaceGeo, new THREE.MeshBasicMaterial({ map: bubbleTexture(text, who), transparent: true, opacity: who === 'kirill' ? 0.88 : 1, toneMapped: false }));
    face.position.z = 0.115; b.add(face);
    b.position.set(xo, y, 0); b.rotation.z = rz; g.add(b);
    return b;
  };
  if (type === 'low') { bubble(0.52, 0, rand(-0.04, 0.04)); yMax = 0.98; }
  else if (type === 'tall') { bubble(0.52, -0.08, 0.03); bubble(1.45, 0.1, -0.04); bubble(2.38, -0.05, 0.02); yMax = 2.9; }
  else if (type === 'kirill') { bubble(0.8, 0, rand(-0.08, 0.08), 'kirill'); yMax = 1.4; }
  else { bubble(2.06, 0, rand(-0.05, 0.05)); yMin = 1.6; yMax = 2.55; const drip = sph(new THREE.MeshBasicMaterial({ color: '#bfeee6', transparent: true, opacity: 0.6 }), 0.05, 0.08, 0.05, 0, 1.45, 0); g.add(drip); g.userData.drip = drip; }
  g.position.set(LANES[lane], -4, z); g.visible = false;
  scene.add(g);
  entities.push({ kind: 'obs', type, lane, x: LANES[lane], z, yMin, yMax, hz: 0.32, hx: 1.08, mesh: g, rise: 0, risen: false, msg: msgs[msgs.length - 1], fragile: type === 'kirill', seed: rand(0, 6) });
}
function makeShark() {
  const g = new THREE.Group(), grey = mc('#6f8796', { roughness: 0.5 }), belly = mc('#e9eef0'), dark = mc('#1b2228'), white = mc('#ffffff');
  g.add(sph(grey, 0.42, 0.42, 1.5)); g.add(sph(belly, 0.36, 0.3, 1.3, 0, -0.13, 0.05));
  const dorsal = mesh(new THREE.ConeGeometry(0.35, 0.85, 3), grey, 1, 1, 1, 0, 0.62, -0.1); dorsal.scale.x = 0.3; dorsal.rotation.x = -0.35; g.add(dorsal);
  for (const s of [-1, 1]) { const p = sph(grey, 0.5, 0.05, 0.22, s * 0.48, -0.15, 0.35); p.rotation.z = s * 0.4; g.add(p); g.add(sph(dark, 0.05, 0.05, 0.05, s * 0.24, 0.12, 1.2)); }
  g.add(sph(dark, 0.2, 0.1, 0.14, 0, -0.08, 1.38));
  for (let i = 0; i < 7; i++) { const a = -0.9 + i * 0.3; const tth = mesh(new THREE.ConeGeometry(0.03, 0.08, 4), white, 1, 1, 1, Math.sin(a) * 0.17, -0.03, 1.42 + Math.cos(a) * 0.02); tth.rotation.x = Math.PI; g.add(tth); }
  const tail = new THREE.Group(); tail.position.z = -1.45; g.add(tail);
  for (const s of [-1, 1]) { const f = sph(grey, 0.05, 0.42, 0.18, 0, s * 0.3, -0.2); f.rotation.x = s * 0.6; tail.add(f); }
  g.userData.tail = tail;
  return g;
}
function addShark(lane, z) {
  const g = makeShark(); g.position.set(LANES[lane], -0.6, z); scene.add(g);
  entities.push({ kind: 'shark', lane, x: LANES[lane], z, yMin: 0, yMax: 0.4, hz: 0.9, hx: 0.6, mesh: g, phase: 'fin', t: 0, msg: 'Ам! 🦈', seed: rand(0, 6) });
}
function addMelon(lane, z, y = 0.75) {
  const m = new THREE.Mesh(melonGeo, melonMats);
  m.position.set(LANES[lane], y, z); m.rotation.y = rand(0, 6); scene.add(m);
  entities.push({ kind: 'melon', lane, x: LANES[lane], z, y, mesh: m, seed: rand(0, 6), magnet: false });
}

// power-ups: birthday gift, filter coffee, husky
function makeCoffee() {
  const g = new THREE.Group(), ceramic = mc('#f7f4ee', { roughness: 0.35, side: THREE.DoubleSide });
  g.add(mesh(new THREE.CylinderGeometry(0.3, 0.26, 0.5, 20), new THREE.MeshStandardMaterial({ color: '#d9eef5', transparent: true, opacity: 0.4, roughness: 0.05 }), 1, 1, 1, 0, -0.1, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.27, 0.24, 0.28, 20), mc('#4a2a17', { roughness: 0.3 }), 1, 1, 1, 0, -0.2, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.03, 20), ceramic, 1, 1, 1, 0, 0.17, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.44, 0.13, 0.42, 20, 1, true), ceramic, 1, 1, 1, 0, 0.4, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.38, 0.1, 0.36, 20, 1, true), mc('#efe0c2', { side: THREE.DoubleSide }), 1, 1, 1, 0, 0.44, 0));
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.03, 8, 16, Math.PI), mc('#d9eef5')); handle.position.set(0.3, -0.1, 0); handle.rotation.z = -Math.PI / 2; g.add(handle);
  return g;
}
function makeHusky() {
  const g = new THREE.Group(), grey = mc('#6f7782', { roughness: 0.9 }), white = mc('#f2f2ee', { roughness: 0.9 }), dark = mc('#1c1d22');
  const eye = mc('#8fdcff', { emissive: '#4fc3ff', emissiveIntensity: 0.7 });
  const body = new THREE.Group(); body.position.y = 0.55; g.add(body);
  body.add(sph(grey, 0.3, 0.28, 0.6, 0, 0.04, 0)); body.add(sph(white, 0.24, 0.2, 0.52, 0, -0.08, -0.02));
  const head = new THREE.Group(); head.position.set(0, 0.3, -0.62); body.add(head);
  head.add(sph(grey, 0.22, 0.2, 0.22)); head.add(sph(white, 0.17, 0.13, 0.12, 0, -0.04, -0.13)); head.add(sph(white, 0.1, 0.08, 0.16, 0, -0.07, -0.25)); head.add(sph(dark, 0.04, 0.035, 0.03, 0, -0.03, -0.41));
  head.add(sph(mc('#ff7a8a'), 0.04, 0.015, 0.06, 0, -0.13, -0.3));
  for (const s of [-1, 1]) { head.add(sph(eye, 0.032, 0.03, 0.02, s * 0.08, 0.04, -0.19)); const ear = mesh(new THREE.ConeGeometry(1, 1, 4), grey, 0.07, 0.17, 0.05, s * 0.12, 0.21, 0.02); ear.rotation.z = -s * 0.25; head.add(ear); }
  const legs = [];
  for (const [x, z] of [[-0.15, -0.38], [0.15, -0.38], [-0.15, 0.38], [0.15, 0.38]]) { const p = new THREE.Group(); p.position.set(x, -0.1, z); body.add(p); p.add(mesh(CYL16, white, 0.065, 0.45, 0.065, 0, -0.22, 0)); legs.push(p); }
  const tail = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.06, 8, 16, Math.PI * 1.3), grey); tail.position.set(0, 0.25, 0.6); tail.rotation.y = Math.PI / 2; body.add(tail);
  g.userData.legs = legs;
  return g;
}
function animHusky(h, t, fly) { h.userData.legs.forEach((l, i) => { l.rotation.x = fly ? (i < 2 ? -1.15 : 1.15) : Math.sin(t * 14 + (i % 2) * Math.PI + (i > 1 ? 1.2 : 0)) * 0.7; }); }
function makeHeart() {
  const g = new THREE.Group(), sh = new THREE.Shape();
  sh.moveTo(0, -0.42); sh.bezierCurveTo(-0.1, -0.3, -0.5, -0.05, -0.5, 0.18); sh.bezierCurveTo(-0.5, 0.42, -0.2, 0.52, 0, 0.3);
  sh.bezierCurveTo(0.2, 0.52, 0.5, 0.42, 0.5, 0.18); sh.bezierCurveTo(0.5, -0.05, 0.1, -0.3, 0, -0.42);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.18, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 3, curveSegments: 16 }); geo.center();
  g.add(new THREE.Mesh(geo, MAT('#ff3b5c', { roughness: 0.3, emissive: '#ff1744', emissiveIntensity: 0.5 })));
  return g;
}
const POWERS = {
  gift: { make: makeGift, ring: '#ffe08a', spark: ['#ffd34a', '#ff7aa2'] },
  coffee: { make: makeCoffee, ring: '#e8c39e', spark: ['#c8a27a', '#ffffff'] },
  husky: { make: makeHusky, ring: '#9fdcff', spark: ['#9fdcff', '#ffffff'] },
  heart: { make: makeHeart, ring: '#ff8aa8', spark: ['#ff4f7b', '#ffffff'] },
};
function addPower(type, lane, z) {
  const P = POWERS[type], m = P.make();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.035, 8, 48), new THREE.MeshBasicMaterial({ color: P.ring, transparent: true, opacity: 0.85 }));
  ring.rotation.x = Math.PI / 2; m.add(ring); m.userData.ring = ring;
  if (type === 'husky') m.rotation.y = Math.PI;
  m.position.set(LANES[lane], 1, z); scene.add(m);
  entities.push({ kind: 'power', type, lane, x: LANES[lane], z, y: 1, mesh: m, seed: 0 });
}
function melonLine(lane, zStart, n, gap = 2.5) { for (let i = 0; i < n; i++) addMelon(lane, zStart - i * gap); }
function melonArc(lane, z) { for (let i = -3; i <= 3; i++) { const k = i / 3.4; addMelon(lane, z + i * 1.25, 0.75 + 1.25 * (1 - k * k)); } }

function spawnRow(z) {
  const d = difficulty();
  const lanes = [0, 1, 2].sort(() => Math.random() - 0.5);
  const obsType = () => { const r = Math.random(); if (G.run > 10 && r < 0.16) return 'shark'; return r < 0.45 ? 'low' : r < 0.74 ? 'tall' : 'high'; };
  const kirill = (lane, p = 0.45) => { if (G.run > 3 && Math.random() < p) { addObstacle('kirill', lane, z); return true; } return false; };
  if (G.sincePower > 12 && !flying() && Math.random() < 0.4) {
    G.sincePower = 0;
    const r = Math.random(), type = G.lives < MAX_LIVES && Math.random() < (G.lives <= 1 ? 0.45 : 0.18) ? 'heart' : r < 0.46 ? 'gift' : r < 0.74 ? 'coffee' : 'husky';
    addPower(type, lanes[0], z);
    if (d > 0.2) addObstacle(pick(['low', 'tall']), lanes[1], z);
    return;
  }
  const r = Math.random();
  if (r < 0.14 || G.run < 2.5) { melonLine(lanes[0], z + 5, randi(5, 8)); kirill(lanes[1]); return; }
  if (r < 0.5 - d * 0.15 || G.run < 9) {
    const t = obsType(); addObstacle(t, lanes[0], z);
    if (t === 'low' && Math.random() < 0.5) melonArc(lanes[0], z); else melonLine(lanes[1], z + 6, 5);
    kirill(lanes[2]);
    return;
  }
  if (r < 0.88 || d < 0.3) {
    addObstacle(obsType(), lanes[0], z); addObstacle(obsType(), lanes[1], z);
    if (!kirill(lanes[2], 0.25)) melonLine(lanes[2], z + 6, 5);
    return;
  }
  const kinds = Math.random() < 0.5 ? ['low', 'low', 'low'] : ['tall', 'tall', pick(['low', 'high'])];
  kinds.forEach((k, i) => addObstacle(k, lanes[i], z));
  if (kinds[2] === 'low') melonArc(lanes[2], z);
}
function rowGap() { return Math.max(12, G.speed * rand(0.62, 0.95) * (G.run < 10 ? 1.35 : 1)); }
function removeEntity(i) { const e = entities[i]; scene.remove(e.mesh); entities.splice(i, 1); }
function clearEntities() { for (let i = entities.length - 1; i >= 0; i--) removeEntity(i); }

// ───────────────────────── cameos: Fyodor says hi, Zhanna & Andrey on a flying carpet
const rugTex = (() => {
  const W = 256, H = 168, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.fillStyle = '#9b1d2a'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#e2b04a'; g.lineWidth = 10; g.strokeRect(8, 8, W - 16, H - 16);
  g.strokeStyle = '#1d2c5e'; g.lineWidth = 6; g.strokeRect(20, 20, W - 40, H - 40);
  g.fillStyle = '#e2b04a'; for (let i = 0; i < 14; i++) { g.beginPath(); g.arc(14 + i * 17.5, 14, 3, 0, 7); g.arc(14 + i * 17.5, H - 14, 3, 0, 7); g.fill(); }
  const cx = W / 2, cy = H / 2;
  g.fillStyle = '#1d2c5e'; g.beginPath(); g.moveTo(cx, cy - 52); g.lineTo(cx + 78, cy); g.lineTo(cx, cy + 52); g.lineTo(cx - 78, cy); g.fill();
  g.fillStyle = '#e2b04a'; g.beginPath(); g.moveTo(cx, cy - 34); g.lineTo(cx + 50, cy); g.lineTo(cx, cy + 34); g.lineTo(cx - 50, cy); g.fill();
  g.fillStyle = '#9b1d2a'; g.beginPath(); g.arc(cx, cy, 14, 0, 7); g.fill();
  for (const [x, y] of [[48, 44], [W - 48, 44], [48, H - 44], [W - 48, H - 44]]) { g.fillStyle = '#e2b04a'; g.beginPath(); g.arc(x, y, 9, 0, 7); g.fill(); g.fillStyle = '#1d2c5e'; g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
function makeCarpet() {
  const g = new THREE.Group();
  const geo = new THREE.PlaneGeometry(3.4, 2.2, 20, 12); geo.rotateX(-Math.PI / 2);
  g.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: rugTex, side: THREE.DoubleSide, roughness: 0.9 })));
  for (const s of [-1, 1]) for (let i = 0; i < 7; i++) g.add(box(GOLD, 0.16, 0.03, 0.05, s * 1.78, 0, -0.95 + i * 0.32));
  const zh = makePerson({ sit: true, shirt: '#1f8a70', pants: '#2b2b33', hair: '#2a1a14', long: true, skin: '#e8b996' }); zh.position.set(-0.7, 0.03, 0.3); zh.rotation.y = 0.35; g.add(zh);
  zh.userData.armB.rotation.set(-0.9, 0, 0.5);
  const an = makePerson({ sit: true, shirt: '#56606e', pants: '#1f2937', hair: '#3b2a20', beard: true }); an.position.set(0.7, 0.03, 0.3); an.rotation.y = -0.35; g.add(an);
  an.userData.armA.rotation.set(-2.1, 0, -0.35);
  const hk = new THREE.Group(); hk.position.set(0, 0.03, -0.45); g.add(hk);
  hk.add(sph(new THREE.MeshStandardMaterial({ color: '#3a7bd5', transparent: true, opacity: 0.8, roughness: 0.1 }), 0.2, 0.22, 0.2, 0, 0.2, 0));
  hk.add(mesh(CYL16, GOLD, 0.035, 0.55, 0.035, 0, 0.62, 0)); hk.add(mesh(CYL16, GOLD, 0.16, 0.02, 0.16, 0, 0.88, 0));
  hk.add(mesh(new THREE.CylinderGeometry(0.09, 0.05, 0.12, 12), mc('#9a4b2c'), 1, 1, 1, 0, 0.96, 0));
  hk.add(sph(mc('#ff6a2a', { emissive: '#ff4a10', emissiveIntensity: 1.2 }), 0.06, 0.03, 0.06, 0, 1.03, 0));
  const hose = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0.06, 0.45, -0.45), new THREE.Vector3(0.45, 0.12, -0.15), new THREE.Vector3(0.62, 0.55, 0.32), new THREE.Vector3(0.6, 0.98, 0.45)]), 24, 0.022, 6), mc('#3b2b4a'));
  g.add(hose);
  const sp = makeSpeech('С днюхой, Оля! 💨', '— Жанна и Андрей'); sp.position.set(0, 2.1, 0); sp.visible = false; g.add(sp);
  g.userData = { geo, base: geo.attributes.position.array.slice(), sp, bowl: new THREE.Vector3(0, 1.08, -0.45), mouth: new THREE.Vector3(0.6, 1.0, 0.45), puff: 0 };
  return g;
}
// Every visit is different: lines, arrivals and behaviour are drawn from decks that don't repeat
// until everything was shown (persisted across runs).
const FEDOR_LINES = [
  'Оля, привет! 👋', 'С днём рождения, Оль! 🎂', 'Классно катаешь! 🤙', 'Привет из Сыктывкара! 👋', 'Как тебе мой оранжевый борд? 🧡',
  'Держи волну, я догоню', 'Оль, пиццу будешь? 🍕', 'Красиво идёшь!', 'Всё по плану? 😉', 'Ну я в тундру, пока',
  'А помнишь, как на скейтах катались…',
];
const CARPET_LINES = [
  'С днюхой, Оля! 💨', 'Оля, залетай на кальян! 💨', 'Мы проездом, на минутку 🧞', 'Сверху видно лучше! 👀', 'Оль, ты огонь! 🔥',
  'Летим в Томск, что привезти?', 'Не отвлекайся, там Паша!', 'Желаем попутной волны! 🌊', 'Угли кончаются, полетели за новыми', 'Курим за твоё здоровье 😅',
];
const FEDOR_ARRIVE = ['behind', 'ahead', 'lip'], FEDOR_ACT = ['ride', 'overtake', 'jump', 'wipeout'];
const CARPET_ARRIVE = ['swoop', 'behind', 'spiral', 'drop'], CARPET_ACT = ['calm', 'fall', 'loop', 'embers'], CARPET_EXIT = ['up', 'zoom', 'back'];
function draw(key, arr) {
  let d = store.get('deck.' + key, null);
  if (!Array.isArray(d) || !d.length || d.some((i) => i >= arr.length)) d = [...arr.keys()].sort(() => Math.random() - 0.5);
  const i = d.shift(); store.set('deck.' + key, d);
  return arr[i];
}
const bounceOut = (k) => { const n = 7.5625, d = 2.75; if (k < 1 / d) return n * k * k; if (k < 2 / d) return n * (k -= 1.5 / d) * k + 0.75; if (k < 2.5 / d) return n * (k -= 2.25 / d) * k + 0.9375; return n * (k -= 2.625 / d) * k + 0.984375; };
function disposeSprites(g) { g.traverse((o) => { if (o.isSprite) { o.material.map.dispose(); o.material.dispose(); } }); }
function swapSpeech(c, title, sub, y) { c.sp.visible = false; const s = makeSpeech(title, sub); s.position.set(0, y, 0); c.g.add(s); c.sp = s; }

function spawnFedor() {
  const g = new THREE.Group(), board = makeBoard(mc('#ff6a13', { roughness: 0.35 })); g.add(board);
  const p = makePerson({ shirt: '#f4f4f2', pants: '#2a3550', hair: '#5a4330', skin: '#e7b493' }); p.position.y = 0.1; p.rotation.y = -0.55; g.add(p);
  const line = draw('fedorLine', FEDOR_LINES);
  const act = line.startsWith('Ну я в тундру') ? 'tundra' : line.includes('скейт') ? 'kickflip' : draw('fedorAct', FEDOR_ACT);
  const sp = makeSpeech(line, '— Фёдор Овчинников'); sp.position.set(0, 2.9, 0); sp.visible = false; g.add(sp);
  const portrait = camera.aspect < 0.9;
  g.position.set(9, -6, 16); scene.add(g);
  cameos.push({ kind: 'fedor', g, p, board, sp, t: 0, x: portrait ? 3.7 : 5.6, zt: portrait ? -6 : -2, line, act, arrive: draw('fedorArrive', FEDOR_ARRIVE), A: 1.5, M: act === 'overtake' ? 3.4 : 4.6 });
}
function spawnCarpet() {
  const g = makeCarpet(); g.scale.setScalar(1.4); scene.add(g);
  const portrait = camera.aspect < 0.9;
  const line = draw('carpetLine', CARPET_LINES), act = draw('carpetAct', CARPET_ACT);
  swapSpeech({ g, sp: g.userData.sp }, line, '— Жанна и Андрей', 2.1);
  const sp = g.children[g.children.length - 1]; sp.visible = false; g.userData.sp = sp;
  cameos.push({ kind: 'carpet', g, t: 0, A: 2.8, H: 6.8, line, act, arrive: draw('carpetArrive', CARPET_ARRIVE), exit: draw('carpetExit', CARPET_EXIT),
    embersOn: act === 'embers' || Math.random() < 0.3, emberAt: rand(1.2, 3.5), embers: [],
    p1: new THREE.Vector3(portrait ? 1.6 : 5.0, portrait ? 7.6 : 6.4, portrait ? -9 : -8) });
}
const _w = new THREE.Vector3(), _cp = new THREE.Vector3(), _ca = new THREE.Vector3();
const emberGeo = new THREE.SphereGeometry(0.07, 8, 6), emberMat = new THREE.MeshBasicMaterial({ color: '#ff7a2a' });
function updateFedor(c, dt, t, dz) {
  const A = c.A, E = A + c.M; let x = c.x, z = c.zt, y = 0;
  if (c.fell) {
    c.fz += dz; c.fallT += dt; z = c.fz;
    c.p.rotation.x = Math.min(c.fallT * 4, Math.PI / 2); c.p.position.y = 0.1 - Math.min(c.fallT, 0.5);
    c.board.rotation.z = Math.min(c.fallT * 6, Math.PI); c.board.position.x = Math.min(c.fallT, 0.6);
    if (c.fallT > 1.6) c.sp.visible = false;
    c.g.position.set(x, waveH(x, z - G.dist, G.t) - Math.min(c.fallT * 0.2, 0.3), z);
    return z > 22;
  }
  if (c.t < A) {
    const k = c.t / A;
    if (c.arrive === 'behind') z = lerp(16, c.zt, easeOut(k));
    else if (c.arrive === 'ahead') z = lerp(-45, c.zt, easeOut(k));
    else { // leaps off the crest of the wave
      x = lerp(-8.5, c.x, k); z = lerp(c.zt - 8, c.zt, k); y = lerp(8.4, 0, k) + Math.sin(Math.PI * k) * 3;
      c.g.rotation.y = -k * Math.PI * 2;
      if (k > 0.97 && !c.landed) { c.landed = true; burst(c.x, 0.3, c.zt, 40, { spread: 3, up: 6, life: 0.9, size: 0.4 }); Sound.splash(); }
    }
  } else if (c.t < E) {
    const m = c.t - A;
    if (!c.said) { c.said = true; c.sp.visible = true; Sound.hello(); notice(c.arrive === 'lip' ? '🌊 Фёдор спрыгнул с гребня волны' : '👋 Фёдор Овчинников рядом'); }
    if (c.act === 'overtake') z = c.zt - m * 2.6;
    if ((c.act === 'jump' || c.act === 'kickflip') && m > 1.3 && m < 2.3) {
      const k = m - 1.3; y = Math.sin(Math.PI * k) * (c.act === 'jump' ? 2.6 : 1.4);
      if (c.act === 'jump') c.g.rotation.y = k * Math.PI * 2; else c.board.rotation.z = k * Math.PI * 2;
      if (!c.trickSaid) { c.trickSaid = true; if (c.act === 'jump') notice('🤙 Фёдор крутит 360'); }
    } else { c.g.rotation.y = damp(c.g.rotation.y % (Math.PI * 2), 0, 10, dt); c.board.rotation.z = 0; }
    if (c.act === 'wipeout' && m > 3.0) {
      c.fell = true; c.fallT = 0; c.fz = z;
      swapSpeech(c, 'Ой! Всё норм 😅', '— Фёдор Овчинников', 2.9);
      burst(x, 0.4, z, 50, { spread: 3, up: 6, life: 1, size: 0.4 }); Sound.splash(); notice('😅 Фёдор упал, но не сдаётся');
    }
    z += Math.sin(c.t * 1.3) * 0.4;
  } else {
    const e = c.t - E;
    if (c.act === 'tundra') {
      if (!c.gone) { c.gone = true; notice('🏔️ Фёдор уехал в тундру'); }
      x = c.x + e * 6 + e * e * 8; z = c.zt + e * 3; c.g.rotation.y = -Math.min(e * 2, 1.25);
      if (e > 1.6) c.sp.visible = false;
    } else {
      z = c.zt - (c.act === 'overtake' ? c.M * 2.6 : 0) - e * e * 16;
      if (e > 0.3) c.sp.visible = false;
    }
  }
  c.p.userData.armB.rotation.z = c.t > A && c.t < E ? 2.55 + Math.sin(t * 12) * 0.4 : 0.2;
  c.g.position.set(x, waveH(x, z - G.dist, G.t) + y, z);
  c.g.rotation.z = Math.sin(t * 1.6) * 0.05;
  if (y < 0.3 && c.t > 0.2 && Math.random() < 0.7) emit(x + rand(-0.3, 0.3), c.g.position.y + 0.1, z + 1.2, rand(-1, 1), rand(1, 3), rand(0.5, 2), 0.5, rand(0.15, 0.3), '#ffffff');
  return c.t > E + 3.2;
}
function updateCarpet(c, dt, t, dz) {
  const g = c.g, u = g.userData, A = c.A, E = A + c.H;
  let roll = 0;
  if (c.t < A) {
    const k = c.t / A;
    if (c.arrive === 'swoop') _cp.lerpVectors(_ca.set(40, 16, -80), c.p1, easeOut(k));
    else if (c.arrive === 'behind') _cp.lerpVectors(_ca.set(c.p1.x - 1, 13, 26), c.p1, easeOut(k));
    else if (c.arrive === 'spiral') { const r = (1 - easeOut(k)) * 14, a = k * Math.PI * 4; _cp.set(c.p1.x + Math.cos(a) * r, c.p1.y + (1 - k) * 14, c.p1.z + Math.sin(a) * r - (1 - k) * 10); roll = 0.3 * (1 - k); }
    else _cp.set(c.p1.x, lerp(c.p1.y + 26, c.p1.y, bounceOut(k)), c.p1.z);
  } else if (c.t < E) {
    const m = c.t - A; _cp.copy(c.p1);
    if (!c.said) { c.said = true; u.sp.visible = true; Sound.chime(); notice(`🧞 Жанна и Андрей ${pick(['прилетели на ковре-самолёте', 'заглянули на огонёк', 'пролетают мимо', 'спустились с облаков'])}`); }
    if (c.act === 'fall' && m > 1.4 && m < 4.4) {
      const f = (m - 1.4) / 3; _cp.y = lerp(c.p1.y, 1.3, Math.sin(Math.PI * f)); roll = Math.sin(m * 12) * 0.3 * (1 - f);
      if (!c.dipped && f > 0.15) { c.dipped = true; notice('😱 Ковёр теряет высоту!'); Sound.splash(); }
      if (!c.splashed && f > 0.45) { c.splashed = true; swapSpeech({ g, sp: u.sp }, 'Мы в порядке! 😅', '— Жанна и Андрей', 2.1); u.sp = g.children[g.children.length - 1]; burst(_cp.x, 0.4, _cp.z, 60, { spread: 3, up: 5, life: 1, size: 0.4, scroll: 0 }); }
    }
    if (c.act === 'loop' && m > 2 && m < 3.3) { roll = ((m - 2) / 1.3) * Math.PI * 2; if (!c.looped) { c.looped = true; notice('🌀 Мёртвая петля на ковре!'); } }
    if (c.embersOn && !c.embered && m > c.emberAt) {
      c.embered = true; notice('🔥 У Жанны и Андрея упали угли!');
      _w.copy(u.bowl); g.localToWorld(_w);
      for (let k = 0; k < randi(6, 10); k++) { const e = new THREE.Mesh(emberGeo, emberMat); e.position.copy(_w); scene.add(e); c.embers.push({ m: e, v: new THREE.Vector3(rand(-1.2, 1.2), rand(0, 1.5), rand(-0.5, 1.5)) }); }
    }
    if (m > c.H - 0.3) u.sp.visible = false;
  } else {
    const k = easeIn((c.t - E) / 3);
    if (c.exit === 'up') _ca.set(-40, 22, -100); else if (c.exit === 'zoom') _ca.set(c.p1.x, c.p1.y + 4, -220); else _ca.set(c.p1.x + 2, 12, 30);
    _cp.lerpVectors(c.p1, _ca, k);
    if (c.exit === 'zoom') roll = -0.15;
  }
  g.position.copy(_cp); g.position.y += Math.sin(t * 1.8) * 0.18;
  g.rotation.set(Math.sin(t * 1.3) * 0.05, -0.3 + Math.sin(t * 0.7) * 0.08, roll + Math.sin(t * 1.1) * 0.04);
  const pos = u.geo.attributes.position;
  for (let k = 0; k < pos.count; k++) { const bx = u.base[k * 3], bz = u.base[k * 3 + 2]; pos.setY(k, Math.sin(bx * 2.2 + t * 5) * 0.05 + Math.sin(bz * 2.8 + t * 3.3) * 0.03); }
  pos.needsUpdate = true;
  if (Math.random() < 0.4) { _w.copy(u.bowl); g.localToWorld(_w); emit(_w.x, _w.y, _w.z, rand(-0.2, 0.2), rand(0.4, 0.9), rand(0.2, 0.8), 1.6, rand(0.25, 0.45), '#efeaf3', -0.5, 0); }
  u.puff -= dt;
  if (u.puff <= 0) { u.puff = 1.7; _w.copy(u.mouth); g.localToWorld(_w); for (let k = 0; k < 14; k++) emit(_w.x, _w.y, _w.z, rand(-0.5, 0.5), rand(0.2, 0.9), rand(0.4, 1.6), rand(1.4, 2.2), rand(0.3, 0.6), '#f4f1f7', -0.4, 0); }
  for (let i = c.embers.length - 1; i >= 0; i--) { // coals fall and hiss in the water
    const e = c.embers[i]; e.v.y -= 12 * dt; e.m.position.addScaledVector(e.v, dt);
    if (Math.random() < 0.6) emit(e.m.position.x, e.m.position.y, e.m.position.z, 0, 0.3, 0, 0.3, 0.12, pick(['#ff9a3a', '#ffd06a']), 0, 0);
    if (e.m.position.y < waveH(e.m.position.x, e.m.position.z - G.dist, G.t)) {
      burst(e.m.position.x, e.m.position.y + 0.1, e.m.position.z, 8, { spread: 0.6, up: 2, life: 0.9, size: 0.35, colors: ['#f2f2f2', '#dcdcdc'], grav: -1 });
      if (!c.hissed) { c.hissed = true; Sound.sizzle(); }
      scene.remove(e.m); c.embers.splice(i, 1);
    }
  }
  return c.t > E + 3 && !c.embers.length;
}
function updateCameos(dt, t, dz) {
  for (let i = cameos.length - 1; i >= 0; i--) {
    const c = cameos[i]; c.t += dt;
    const done = c.kind === 'fedor' ? updateFedor(c, dt, t, dz) : updateCarpet(c, dt, t, dz);
    if (done) { disposeSprites(c.g); scene.remove(c.g); cameos.splice(i, 1); }
  }
}
function clearCameos() { for (const c of cameos) { disposeSprites(c.g); scene.remove(c.g); for (const e of c.embers || []) scene.remove(e.m); } cameos.length = 0; }

// Olya's ride extras: coffee jet under the board, a husky to sit on
const jet = new THREE.Group(); jet.visible = false; olya.model.add(jet);
jet.add(mesh(new THREE.CylinderGeometry(0.13, 0.42, 0.42, 20, 1, true), mc('#f7f4ee', { roughness: 0.35, side: THREE.DoubleSide }), 1, 1, 1, 0, -0.2, 0.15));
const jetStream = mesh(CYL16, new THREE.MeshBasicMaterial({ color: '#6b3b1f', transparent: true, opacity: 0.8 }), 0.1, 1.4, 0.1, 0, -1.1, 0.15); jet.add(jetStream);
const rideHusky = makeHusky(); rideHusky.visible = false; olya.model.add(rideHusky);

// ───────────────────────── DOM / UI
const ui = {
  hud: $('hud'), score: $('score'), melons: $('melons'), boost: $('boost'), boostBar: $('boostBar'), boostLabel: $('boostLabel'), toast: $('toast'), toastWish: $('toastWish'), toastFrom: $('toastFrom'),
  speedo: $('speedo'), title: $('title'), over: $('over'), pause: $('pause'), card: $('card'), floats: $('floats'), flash: $('flash'), notice: $('notice'),
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
const restartAnim = (el) => { el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; };
let toastTimer = 0;
function showToast(w) {
  ui.toastWish.textContent = w.text; ui.toastFrom.textContent = w.name ? `— ${w.name}` : ''; ui.toastFrom.hidden = !w.name;
  ui.toast.hidden = false; ui.toast.classList.remove('out'); restartAnim(ui.toast);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { ui.toast.classList.add('out'); setTimeout(() => { ui.toast.hidden = true; }, 350); }, 3000);
}
let noticeTimer = 0;
function notice(text) {
  ui.notice.textContent = text; ui.notice.hidden = false; ui.notice.classList.remove('out'); restartAnim(ui.notice);
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { ui.notice.classList.add('out'); setTimeout(() => { ui.notice.hidden = true; }, 350); }, 2800);
}
function flash() { ui.flash.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => ui.flash.classList.remove('on'))); }
function show(el) { for (const s of [ui.title, ui.over, ui.pause, ui.card]) s.hidden = s !== el; }
function rankFor(score) { let r = RANKS[0], next = null; for (let i = 0; i < RANKS.length; i++) { if (score >= RANKS[i][0]) { r = RANKS[i]; next = RANKS[i + 1] || null; } } return { r, next }; }
const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
$('bestTitle').textContent = G.best;
$('btnSound').textContent = Sound.muted ? '🔇' : '🔊';

function renderCollected() {
  const list = Wishes.collected;
  $('collectedCount').textContent = `${list.length} из ${Wishes.pool.length}`;
  $('collected').innerHTML = list.length
    ? list.slice().reverse().map((w) => `<li>${escapeHtml(w.text)}${w.name ? `<small>— ${escapeHtml(w.name)}</small>` : ''}</li>`).join('')
    : '<li class="empty">Лови 🎁 в игре — в каждом подарке поздравление</li>';
}
// game over is a short flow: result → name (first time) → wish → board with the rating and all wishes
const GO_STEPS = ['result', 'name', 'wish', 'board'];
const myWishes = new Set(store.get('myWishes', []));
let wishAsked = false, scorePosted = null, nameReturn = null;
function overStep(name) {
  for (const s of document.querySelectorAll('#over .go-step')) s.hidden = s.dataset.step !== name;
  $('goCard').classList.toggle('wide', name === 'board');
  const i = GO_STEPS.indexOf(name); [...$('goDots').children].forEach((d, k) => d.classList.toggle('on', k === i));
  $('goDots').hidden = !Online.on;
  if (name === 'name') setTimeout(() => $('nameInput').focus(), 80);
  if (name === 'wish') { $('wishErr').hidden = true; setTimeout(() => $('wishText').focus(), 80); }
  if (name === 'board') renderBoard();
}
const afterName = () => overStep(!store.get('wished', false) && !wishAsked ? 'wish' : 'board');
function postScore() {
  const name = store.get('name', '');
  if (!Online.on || !name) return;
  scorePosted = Online.call('score', { player: playerId, name, score: G.best, melons: G.melons }).catch(() => {});
}
async function renderBoard() {
  const el = $('leaders'), wl = $('wishesList'), name = store.get('name', '');
  $('goMe').innerHTML = !Online.on ? '' : name
    ? `Играешь как <b>${escapeHtml(name)}</b> · <button id="changeName">сменить имя</button> · <button id="moreWish">ещё пожелание</button>`
    : '<button id="changeName">Попасть в рейтинг</button> · <button id="moreWish">оставить пожелание</button>';
  if ($('changeName')) $('changeName').onclick = () => { nameReturn = 'board'; $('nameInput').value = name; overStep('name'); };
  if ($('moreWish')) $('moreWish').onclick = () => overStep('wish');
  const local = () => {
    el.innerHTML = store.get('runs', []).map((x) => `<li><span>${new Date(x.d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</span><b>${x.s}</b></li>`).join('') || '<li class="empty">Пока пусто</li>';
  };
  if (!Online.on) { local(); wl.innerHTML = '<li class="empty">Пожелания появятся, когда подключится сервер</li>'; return; }
  el.innerHTML = '<li class="empty">загружаем…</li>'; wl.innerHTML = '<li class="empty">загружаем…</li>';
  const leaders = (async () => {
    try {
      await scorePosted;
      const r = await Online.call('leaderboard', null, { player: playerId });
      el.innerHTML = r.top.map((x, i) => `<li class="${r.me && r.me.rank === i + 1 ? 'me' : ''}"><span>${escapeHtml(x.name)}</span><b>${x.score}</b></li>`).join('')
        + (r.me && r.me.rank > r.top.length ? `<li class="me gap"><span>${r.me.rank}. ты</span><b>${r.me.score}</b></li>` : '');
      if (!r.top.length) el.innerHTML = '<li class="empty">Пока пусто — будь первым</li>';
    } catch { local(); }
  })();
  try {
    const list = await Online.call('wishes');
    Wishes.merge(list);
    $('wishesCount').textContent = list.length ? `· ${list.length}` : '';
    wl.innerHTML = list.length
      ? list.slice().reverse().map((w) => `<li class="${myWishes.has(w.id) ? 'mine' : ''}"><small>${escapeHtml(w.name || 'Без имени')}</small>${escapeHtml(w.text)}</li>`).join('')
      : '<li class="empty">Пока никто не написал — будь первым 💌</li>';
  } catch { wl.innerHTML = '<li class="empty">Не загрузилось 😕 попробуй ещё раз позже</li>'; }
  await leaders;
}
$('goNext').onclick = () => { if (!Online.on) overStep('board'); else if (!store.get('name', '')) overStep('name'); else afterName(); };
$('nameForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const n = $('nameInput').value.trim().slice(0, 24);
  if (!n) { $('nameInput').focus(); return; }
  store.set('name', n); postScore();
  if (nameReturn) { nameReturn = null; overStep('board'); } else afterName();
});
$('wishText').addEventListener('input', () => { $('wishCount').textContent = $('wishText').value.length; });
$('wishSkip').onclick = () => { wishAsked = true; overStep('board'); };
$('wishForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = $('wishText').value.trim();
  if (text.length < 2) { $('wishText').focus(); return; }
  const btn = $('wishSend'); btn.disabled = true; $('wishErr').hidden = true;
  try {
    const r = await Online.call('wish', { text, name: store.get('name', ''), player: playerId });
    myWishes.add(r.id); store.set('myWishes', [...myWishes]); store.set('wished', true); wishAsked = true;
    $('wishText').value = ''; $('wishCount').textContent = '0';
    overStep('board');
  } catch { $('wishErr').hidden = false; }
  btn.disabled = false;
});

// ───────────────────────── flow
function resetRide() {
  olya.rider.position.set(0, 0.1, 0); olya.rider.rotation.set(0, -Math.PI / 2, 0);
  olya.board.position.set(0, 0, 0); olya.board.rotation.set(0, 0, 0); olya.board.visible = true;
  olya.model.rotation.set(0, 0, 0); jet.visible = false; rideHusky.visible = false;
}
function startRun() {
  Sound.init();
  clearEntities(); clearCameos(); resetRide();
  Object.assign(G, { state: 'play', run: 0, runDist: 0, speed: 15, score: 0, scoreF: 0, melons: 0, boost: 0, fly: 0, husky: 0, nextRowZ: -55, sincePower: 5, streak: 0, slowmo: 1, stumbleT: 0, biome: -1, nextCameo: rand(10, 14), lastHit: null, speedLvl: 0, lives: START_LIVES, order: shuffledOrder(), barrel: null, nextBarrel: rand(14, 22) });
  Object.assign(player, { lane: 1, prevLane: 1, h: 0, vy: 0, air: false, duckT: 0, invuln: 0, trick: 0 });
  resetScenery();
  camMode = 'chase';
  show(null); ui.hud.hidden = false; ui.boost.hidden = true; ui.toast.hidden = true;
  Sound.setMusic(0.2);
  Wishes.load();
}
function gameOver() {
  G.state = 'over'; G.slowmo = 1;
  const score = G.score, isRecord = score > G.best;
  if (isRecord) { G.best = score; store.set('best', score); }
  const runs = store.get('runs', []); runs.push({ s: score, d: Date.now() }); runs.sort((a, b) => b.s - a.s); store.set('runs', runs.slice(0, 5));
  $('overScore').textContent = score; $('overMelons').textContent = G.melons; $('overBest').textContent = G.best; $('bestTitle').textContent = G.best;
  $('newRecord').hidden = !isRecord;
  const hit = G.lastHit || {};
  if (hit.kind === 'shark') {
    $('overTitle').textContent = 'Акула оказалась быстрее 🦈';
    $('overMsg').innerHTML = '<span class="ava">🦈</span><span><small>Акула</small>Ам!</span>';
  } else {
    $('overTitle').textContent = pick(OVER_TITLES);
    $('overMsg').innerHTML = `<span class="ava">ПП</span><span><small>Паша Притчин</small>${escapeHtml(hit.msg || 'Оль?')}</span>`;
  }
  $('overPhoto').src = `img/${pick(PHOTOS)}.jpg`;
  const { r, next } = rankFor(score);
  $('rankEmoji').textContent = r[1]; $('rankName').textContent = r[2];
  $('rankNext').textContent = next ? `до «${next[2]}» — ${next[0] - score} очков` : 'выше только звёзды';
  nameReturn = null; scorePosted = null; postScore();
  overStep('result');
  ui.hud.hidden = true; show(ui.over);
  clearEntities(); clearCameos(); resetRide(); camMode = 'title';
  Object.assign(player, { lane: 1, h: 0, air: false }); G.fly = 0; G.husky = 0; G.boost = 0; G.runDist = 0; G.barrel = null; G.nextBarrel = rand(10, 18);
  resetScenery();
  Sound.setMusic(0.12);
}
function wipeout(e) {
  G.state = 'dying'; G.dyingT = 0; G.lastHit = e; G.shake = 1; flash();
  Sound.crash(); Sound.setWind(0);
  burst(player.x, player.h + 0.6, 0, 70, { spread: 4, up: 8, life: 1.1, size: 0.35, colors: ['#ffffff', '#dff7f2', '#bfeee6'] });
  olya.riderVel = new THREE.Vector3(rand(-1, 1), 6.5, -5); olya.boardVel = new THREE.Vector3(rand(-2, 2), 5, 3);
}
function startPower(type) {
  if (type === 'gift') {
    G.boost = G.boostMax; Sound.birthday(); flash();
    showToast(Wishes.next());
    burst(player.x, player.h + 1.4, 0, 120, { spread: 5, up: 9, life: 1.6, size: 0.18, colors: ['#ff4f7b', '#ffc93c', '#4fd1c5', '#ff8a3d', '#ffffff', '#8b6cff'], grav: 9, scroll: 0 });
    floatText('🎂 С днём рождения!', player.x, player.h + 2.4, 0, 'smash');
  } else if (type === 'coffee') {
    G.fly = FLY_T; G.speed *= 1.25; jet.visible = true; player.air = false; player.trick = 0;
    Sound.coffee(); notice('☕ Летим на кофейной тяге!');
    for (let z = -12; z > -200; z -= 2.6) addMelon([1, 0, 1, 2][Math.floor(-z / 24) % 4], z, FLY_H + 0.9);
  } else if (type === 'heart') {
    G.lives = Math.min(MAX_LIVES, G.lives + 1); Sound.chime(); floatText('❤️', player.x, player.h + 2.2, 0, 'smash');
    burst(player.x, player.h + 1.2, 0, 40, { spread: 3, up: 5, life: 1, size: 0.25, colors: ['#ff4f7b', '#ff8aa8', '#ffffff'], grav: 6, scroll: 0 });
  } else if (type === 'husky') {
    G.husky = HUSKY_T; G.speed *= 1.6; player.air = false; player.trick = 0;
    olya.board.visible = false; rideHusky.visible = true; olya.rider.position.y = 0.42;
    Sound.woof(); flash(); notice('🐺 Хаски уносит Олю!');
    for (let tau = 0.3; tau < HUSKY_T - 0.2; tau += 0.13) addMelon(player.lane, -G.speed * tau, HUSKY_H * Math.sin(Math.PI * tau / HUSKY_T) + 0.9);
  }
}
function endHusky() {
  rideHusky.visible = false; olya.board.visible = true; olya.rider.position.y = 0.1;
  burst(player.x, player.h + 0.6, 0, 30, { spread: 2.5, up: 3, life: 0.8, size: 0.4, colors: ['#ffffff', '#d7dde4', '#9fdcff'], grav: 2, scroll: 0 });
  Sound.woof();
}

function move(dir) {
  if (G.state !== 'play') return;
  const nl = clamp(player.lane + dir, 0, 2);
  if (nl === player.lane) return;
  player.prevLane = player.lane; player.lane = nl; Sound.lane();
}
function jump() {
  if (G.state !== 'play' || player.air || flying()) return;
  player.air = true; player.vy = 10.6; player.jumpT = 0; player.duckT = 0;
  player.trick = Math.random() < 0.4 ? (Math.random() < 0.5 ? 1 : -1) : 0;
  Sound.jump();
  burst(player.x, 0.3, 0.8, 18, { spread: 1.5, up: 4, life: 0.6, size: 0.25 });
}
function duck() {
  if (G.state !== 'play' || flying()) return;
  if (player.air) { player.vy = -18; player.duckT = 0.55; } else { player.duckT = 0.85; Sound.duck(); }
}
function togglePause() {
  if (G.state === 'play') { G.state = 'paused'; show(ui.pause); Sound.setMusic(0.05); }
  else if (G.state === 'paused') { G.state = 'play'; show(null); Sound.setMusic(0.2); clock.getDelta(); }
}

// input
addEventListener('keydown', (e) => {
  if (e.target.closest && e.target.closest('input, textarea')) return;
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
$('btnPlay').onclick = startRun; $('btnAgain').onclick = startRun; $('btnAgain2').onclick = startRun; $('btnCardPlay').onclick = startRun;
$('btnResume').onclick = togglePause; $('btnPause').onclick = togglePause;
$('btnSound').onclick = () => { Sound.init(); Sound.setMuted(!Sound.muted); $('btnSound').textContent = Sound.muted ? '🔇' : '🔊'; };
let cardReturn = null;
const openCard = () => { cardReturn = G.state === 'over' ? ui.over : ui.title; renderCollected(); show(ui.card); };
$('btnCard1').onclick = openCard; $('btnCard2').onclick = openCard;
$('btnCloseCard').onclick = () => show(cardReturn || ui.title);
$('btnShare').onclick = async () => {
  const text = `Мой рекорд в Arbuz Surfer — ${G.best} 🍉🏄‍♀️ Сможешь больше?`;
  const url = location.href.split('#')[0];
  try { if (navigator.share) { await navigator.share({ title: 'Arbuz Surfer', text, url }); return; } } catch { return; }
  try { await navigator.clipboard.writeText(`${text} ${url}`); $('btnShare').textContent = 'Ссылка скопирована ✓'; } catch {}
};
addEventListener('pointerdown', () => Sound.init(), { once: true });
document.addEventListener('visibilitychange', () => { if (document.hidden && G.state === 'play') togglePause(); });

// ───────────────────────── resize
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

// ───────────────────────── main loop
const clock = new THREE.Clock();
const camPos = new THREE.Vector3(5, 2.4, -4), camLook = new THREE.Vector3(0, 1.2, 0), _tp = new THREE.Vector3(), _tl = new THREE.Vector3();
let fov = 62;

function collides(e, prevZ) {
  return prevZ - e.hz <= PHZ && e.z + e.hz >= -PHZ && Math.abs(player.x - e.x) < e.hx * 0.86 + PHX
    && player.h < e.yMax && player.h + (player.duck > 0.5 ? 0.95 : 1.72) > e.yMin;
}

// fish (and sometimes dolphins, penguins on the ice) jump at the side — pure decoration, no collisions
const critters = [];
function makeFish(color) {
  const g = new THREE.Group(), m = mc(color, { roughness: 0.3, metalness: 0.35 });
  g.add(sph(m, 0.12, 0.15, 0.36)); const tail = mesh(CONE4, m, 0.16, 0.22, 0.06, 0, 0, -0.42); tail.rotation.x = -Math.PI / 2; g.add(tail);
  g.add(sph(mc('#111'), 0.025, 0.025, 0.025, 0.09, 0.04, 0.22)); g.add(sph(mc('#111'), 0.025, 0.025, 0.025, -0.09, 0.04, 0.22));
  return g;
}
function makeDolphin() {
  const g = new THREE.Group(), m = mc('#7d8fa0', { roughness: 0.35 });
  g.add(sph(m, 0.35, 0.38, 1.1)); g.add(sph(mc('#dfe6ea'), 0.28, 0.25, 0.9, 0, -0.12, 0.05)); g.add(sph(m, 0.1, 0.1, 0.35, 0, -0.05, 1.2));
  const fin = mesh(new THREE.ConeGeometry(0.25, 0.5, 3), m, 0.3, 1, 1, 0, 0.45, -0.1); fin.rotation.x = -0.4; g.add(fin);
  const tail = mesh(CONE4, m, 0.45, 0.4, 0.08, 0, 0, -1.2); tail.rotation.x = -Math.PI / 2; g.add(tail);
  return g;
}
function spawnCritters(biomeId) {
  const kind = biomeId === 'glacier' && Math.random() < 0.6 ? 'penguin' : Math.random() < 0.18 ? 'dolphin' : 'fish';
  const n = kind === 'fish' ? randi(3, 6) : randi(2, 3), x0 = rand(6.5, 14), z0 = rand(-55, -25), dir = Math.random() < 0.5 ? 1 : -1;
  const color = pick(['#9fc3d6', '#ff9a3c', '#ffd24a', '#7fd6c8', '#c9d6e8']);
  for (let i = 0; i < n; i++) {
    const m = kind === 'fish' ? makeFish(color) : kind === 'dolphin' ? makeDolphin() : makePenguin();
    m.scale.setScalar(kind === 'penguin' ? 0.8 : kind === 'fish' ? rand(1.5, 2) : 1);
    m.rotation.order = 'YXZ'; m.visible = false; scene.add(m);
    const big = kind !== 'fish';
    critters.push({ m, x: x0 + rand(-0.8, 0.8), z: z0 - i * (big ? 2.6 : 1.1), delay: i * (big ? 0.35 : 0.16), t: 0, dur: big ? 1.3 : rand(0.7, 0.95), h: big ? 2.4 : rand(1, 1.8), dx: dir * rand(1.5, 3), dz: rand(-6, -2), size: big ? 0.45 : 0.25, penguin: kind === 'penguin' });
  }
}
function updateCritters(dt, dz, t, biomeId) {
  G.nextCritter -= dt;
  if (G.nextCritter <= 0 && G.state !== 'loading') { spawnCritters(biomeId); G.nextCritter = rand(2.2, 5); }
  for (let i = critters.length - 1; i >= 0; i--) {
    const c = critters[i]; c.z += dz; c.t += dt;
    if (c.t < c.delay) continue;
    const k = (c.t - c.delay) / c.dur;
    if (!c.m.visible) { c.m.visible = true; burst(c.x, 0.2, c.z, 10, { spread: 1, up: 3, life: 0.6, size: c.size }); }
    c.x += c.dx * dt; c.z += c.dz * dt;
    c.m.position.set(c.x, waveH(c.x, c.z - G.dist, G.t) - 0.3 + c.h * Math.sin(Math.PI * Math.min(k, 1)), c.z);
    c.m.rotation.set(c.penguin ? -0.6 - Math.cos(Math.PI * k) * 0.5 : -Math.cos(Math.PI * k) * 0.9, Math.atan2(c.dx, c.dz), c.penguin ? 0 : Math.sin(t * 20) * 0.15);
    if (k >= 1) { burst(c.x, 0.2, c.z, 12, { spread: 1.2, up: 3, life: 0.6, size: c.size }); scene.remove(c.m); critters.splice(i, 1); }
    else if (c.z > 20) { scene.remove(c.m); critters.splice(i, 1); }
  }
}

function update(rawDt) {
  const dt = rawDt * G.slowmo;
  G.t += rawDt;
  const t = G.t;
  const playing = G.state === 'play';
  const dying = G.state === 'dying';

  if (playing) {
    G.run += dt; G.sincePower += dt;
    const target = Math.min(16 + G.run * 0.32, 48) * (G.boost > 0 ? 1.3 : 1) * (G.fly > 0 ? 1.25 : 1) * (G.husky > 0 ? 1.6 : 1);
    G.speed = damp(G.speed, target, 2, dt);
  } else if (dying) G.speed = damp(G.speed, 0, 2.5, dt);
  else if (G.state !== 'paused') G.speed = damp(G.speed, 11, 1, dt);
  const dz = G.speed * dt;
  G.dist += dz;
  if (playing || dying) G.runDist += dz;
  waterUniforms.uTime.value = t; waterUniforms.uDist.value = G.dist; skyMat.uniforms.uTime.value = t;
  applyTOD(G.state === 'title' ? 0 : (G.runDist / TOD_LEN) % 1);

  // the tube: a closed section of the wave rolls towards Olya, she rides inside and gets spat out
  if (playing || G.state === 'title') {
    G.nextBarrel -= dt;
    if (G.nextBarrel <= 0 && !G.barrel) { const L = clamp(G.speed * rand(4, 6), 90, 260); G.barrel = { near: -240, far: -240 - L }; }
  }
  if (G.barrel) {
    const b = G.barrel; b.near += dz; b.far += dz;
    if (b.far < -1 && b.near > 1 && !b.in) { b.in = true; if (playing) notice('🌀 Волна закрутилась — едем в трубе!'); }
    if (b.in && b.far >= -1 && !b.out) {
      b.out = true;
      burst(player.x, 2, -6, 90, { spread: 5, up: 6, life: 1.1, size: 0.26, colors: ['#ffffff', '#dff7f2', '#bfeee6'] });
      if (playing) { G.scoreF += 100; floatText('🌀 Труба! +100', player.x, player.h + 2.4, 0, 'smash'); notice('💦 Выплюнуло из трубы! +100'); Sound.splash(); }
    }
    if (b.far > 40) { G.barrel = null; G.nextBarrel = rand(22, 38); }
  }
  barrelUniforms.uBarrel.value.set(G.barrel ? G.barrel.near : -1e4, G.barrel ? G.barrel.far : -1e4);
  G.tubeIn = damp(G.tubeIn, G.barrel && G.barrel.far < 0 && G.barrel.near > 0 ? 1 : 0, 3, rawDt);
  hemi.intensity *= 1 - 0.2 * G.tubeIn; sunLight.intensity *= 1 - 0.35 * G.tubeIn;
  // the wave breathes: grows and shrinks just for the picture
  const wallTarget = 1 + 0.18 * Math.sin(t * 0.11) + 0.08 * Math.sin(t * 0.29 + 1.3) + (G.barrel ? 0.12 : 0);
  waterUniforms.uWall.value = damp(waterUniforms.uWall.value, wallTarget, 1.5, rawDt);

  // biome name + skylines
  const cur = biomeAt(G.runDist);
  if (playing && cur !== G.biome) { G.biome = cur; notice(BIOMES[cur].name); }
  skylines.forEach((s, i) => { const u = s.userData; u.o = damp(u.o, i === cur ? 1 : 0, 0.9, rawDt); s.visible = u.o > 0.01; u.near.opacity = u.far.opacity = u.o; for (const [m, k] of u.extra || []) m.opacity = u.o * k * (0.8 + 0.2 * Math.sin(t * 3)); });

  // player
  if (playing) {
    player.x = damp(player.x, LANES[player.lane], 12 + G.speed * 0.12, dt);
    if (G.fly > 0) {
      G.fly -= dt; player.h = damp(player.h, FLY_H + Math.sin(t * 3) * 0.15, 3, dt);
      if (G.fly <= 0) { jet.visible = false; player.air = true; player.vy = 0; player.invuln = Math.max(player.invuln, 1.3); }
    } else if (G.husky > 0) {
      G.husky -= dt; player.h = Math.sin(Math.PI * clamp(1 - G.husky / HUSKY_T, 0, 1)) * HUSKY_H;
      if (G.husky <= 0) { endHusky(); player.h = 0.2; player.air = true; player.vy = -3; player.invuln = Math.max(player.invuln, 1.3); }
    } else if (player.air) {
      player.jumpT += dt; player.h += player.vy * dt; player.vy -= 30 * dt;
      if (player.h <= 0) { player.h = 0; player.air = false; player.trick = 0; Sound.land(); burst(player.x, 0.2, 0.3, 26, { spread: 2.2, up: 4.5, life: 0.7, size: 0.28 }); }
    }
    player.duckT = Math.max(0, player.duckT - dt);
    player.invuln = Math.max(0, player.invuln - dt);
    G.stumbleT = Math.max(0, G.stumbleT - dt);
  } else if (!dying) {
    player.x = damp(player.x, Math.sin(t * 0.35) * 0.9, 2, dt);
  }
  const ducking = (player.duckT > 0 && !player.air) || G.husky > 0;
  player.duck = damp(player.duck, ducking ? 1 : 0, 16, dt);
  player.carve = damp(player.carve, (playing ? LANES[player.lane] : Math.sin(t * 0.35) * 0.9) - player.x, 10, dt);
  const waterY = waveH(player.x, -G.dist, t);
  const slope = (waveH(player.x, -G.dist - 0.8, t) - waveH(player.x, -G.dist + 0.8, t)) / 1.6;
  olya.root.position.set(player.x, waterY + player.h, 0);
  if (!dying) {
    olya.root.rotation.set(slope * 0.9 + (player.air ? -0.12 : 0) + (G.husky > 0 ? -0.25 * Math.cos(Math.PI * (1 - G.husky / HUSKY_T)) : 0), -player.carve * 0.12, -player.carve * 0.16 + Math.sin(t * 1.7) * 0.03);
    poseOlya(t, player.duck * (G.husky > 0 ? 0.85 : 1), player.air || G.fly > 0 ? 1 : 0, player.carve, clamp((G.speed - 8) / 26, 0, 1) + (player.air || flying() ? 0.3 : 0));
    if (player.trick) olya.model.rotation.y = player.trick * Math.PI * 2 * clamp(player.jumpT / 0.68, 0, 1);
    else olya.model.rotation.y = damp(olya.model.rotation.y, 0, 10, dt);
    if (rideHusky.visible) animHusky(rideHusky, t, true);
    if (jet.visible) { jetStream.scale.y = 1.4 + Math.sin(t * 40) * 0.2; jetStream.position.y = -0.4 - jetStream.scale.y / 2; }
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
  olya.shadow.material.opacity = clamp(1 - player.h / 2.5, 0.12, 1);
  olya.shadow.scale.setScalar(1 + Math.min(player.h, 3) * 0.25);

  // spray from the board / coffee jet
  if (!player.air && !dying && G.speed > 4 && player.h < 0.3) {
    const n = G.speed > 20 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const side = Math.random() < 0.5 ? -1 : 1;
      emit(player.x + side * 0.3 + rand(-0.1, 0.1), waterY + 0.1, 1.1 + rand(0, 0.4), side * rand(0.6, 2.2) - player.carve * 2, rand(1.2, 3.4), rand(0.5, 2.5), rand(0.35, 0.7), rand(0.16, 0.32), Math.random() < 0.8 ? '#ffffff' : '#c9f2ea');
    }
  }
  if (G.fly > 0 && playing) {
    for (let i = 0; i < 4; i++) emit(player.x + rand(-0.15, 0.15), waterY + player.h - 0.9, 0.3, rand(-0.5, 0.5), rand(-7, -4), rand(1, 3), rand(0.3, 0.6), rand(0.18, 0.32), pick(['#6b3b1f', '#8a5a3a', '#c8a27a']), -2);
    emit(player.x + rand(-0.4, 0.4), waterY + player.h - 0.5, 0.6, rand(-0.3, 0.3), rand(0.5, 1.5), rand(1, 2), 0.9, rand(0.3, 0.5), '#f6f1ea', -1);
  }
  if (G.husky > 0 && playing) emit(player.x + rand(-0.4, 0.4), waterY + player.h + 0.4, 0.8, rand(-0.5, 0.5), rand(-0.5, 0.5), rand(2, 4), 0.6, rand(0.15, 0.3), pick(['#9fdcff', '#ffffff']), 0);
  for (let i = 0; i < 3; i++) {
    const z = rand(-80, 15), a = LIP.a1 + rand(-0.05, 0.1);
    emit(LIP.cx + Math.cos(a) * LIP.r, LIP.cy + Math.sin(a) * LIP.r + (waterUniforms.uWall.value - 1) * WALL_H, z, rand(0.5, 2.2), rand(-1, 0.6), rand(-0.5, 0.5), rand(0.6, 1.1), rand(0.3, 0.7), '#ffffff', 6);
  }
  if (G.boost > 0 && !dying) {
    for (let i = 0; i < 2; i++) emit(player.x + rand(-0.5, 0.5), player.h + waterY + rand(0.2, 1.8), 0.6, rand(-0.5, 0.5), rand(0, 1), rand(1, 3), rand(0.4, 0.8), rand(0.12, 0.24), pick(['#ffd34a', '#ff7aa2', '#7fe3d4', '#ffffff']), 1);
  }

  // power-up bar
  const boosted = G.boost > 0 && (playing || dying);
  if (playing && G.boost > 0) { G.boost -= dt; if (G.boost <= 0) player.invuln = Math.max(player.invuln, 1.0); }
  const bar = G.fly > 0 ? ['☕ кофейная тяга', G.fly / FLY_T] : G.husky > 0 ? ['🐺 хаски-полёт', G.husky / HUSKY_T] : G.boost > 0 ? ['🎂 буст ×2', G.boost / G.boostMax] : null;
  ui.boost.hidden = !(bar && playing);
  if (bar) { ui.boostLabel.textContent = bar[0]; ui.boostBar.style.transform = `scaleX(${clamp(bar[1], 0, 1)})`; }
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
  olya.model.visible = !(player.invuln > 0 && G.boost <= 0 && !flying() && Math.floor(t * 14) % 2 === 0);

  // world objects
  if (playing) {
    G.nextRowZ += dz;
    while (G.nextRowZ > -150) { spawnRow(G.nextRowZ); G.nextRowZ -= rowGap(); }
    G.nextCameo -= dt;
    if (G.nextCameo <= 0 && !cameos.length) { (G.cameoIdx++ % 2 ? spawnCarpet : spawnFedor)(); G.nextCameo = rand(15, 22); }
  }
  for (let i = entities.length - 1; i >= 0; i--) {
    const e = entities[i];
    const prevZ = e.z;
    e.z += dz;
    e.mesh.position.z = e.z;
    const wy = waveH(e.x, e.z - G.dist, t);
    if (e.kind === 'obs') {
      if (!e.risen && e.z > -62) { e.risen = true; e.mesh.visible = true; burst(e.x, 0.3, e.z, 30, { spread: 2.5, up: 6, life: 0.9, size: 0.35 }); if (e.z > -70 && !e.fragile) Sound.ding(); }
      if (e.risen) e.rise = Math.min(1, e.rise + dt * 2.6);
      const k = e.rise, back = 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2);
      e.mesh.position.y = lerp(-4, wy, clamp(back, 0, 1.15));
      e.mesh.rotation.z = Math.sin(t * (e.fragile ? 7 : 2) + e.seed) * (e.fragile ? 0.06 : 0.03);
      e.mesh.rotation.y = Math.sin(t * 1.4 + e.seed) * 0.06;
      if (e.fragile && !e.dead) e.mesh.scale.set(1 + Math.sin(t * 11 + e.seed) * 0.03, 1 + Math.cos(t * 9 + e.seed) * 0.04, 1);
      if (e.mesh.userData.drip) e.mesh.userData.drip.position.y = 1.45 - ((t * 1.3 + e.seed) % 1) * 1.2;
      if (e.dead) { e.mesh.scale.multiplyScalar(1 - Math.min(1, dt * 6)); e.mesh.position.y += dt * 6; }
      if (playing && !e.dead && e.rise > 0.55 && collides(e, prevZ)) hitObstacle(e);
    } else if (e.kind === 'shark') {
      if (e.phase === 'fin') {
        e.mesh.position.y = wy - 0.62; e.mesh.rotation.x = 0; e.yMin = 0; e.yMax = 0.4;
        if (e.z > -(G.speed * 0.55 + 3)) { e.phase = 'leap'; e.t = 0; burst(e.x, 0.3, e.z, 40, { spread: 2.5, up: 7, life: 1, size: 0.4 }); Sound.splash(); }
      } else if (e.phase === 'leap') {
        e.t += dt; const k = Math.min(e.t / 1.05, 1);
        e.z += dt * 5; e.mesh.position.z = e.z;
        e.mesh.position.y = wy - 0.6 + 2.7 * Math.sin(Math.PI * k); e.mesh.rotation.x = -Math.cos(Math.PI * k) * 0.85;
        e.yMax = k < 0.95 ? 3.2 : 0;
        if (k >= 1) { e.phase = 'gone'; burst(e.x, 0.3, e.z, 30, { spread: 2, up: 5, life: 0.8, size: 0.35 }); }
      } else e.mesh.position.y = -6;
      e.mesh.userData.tail.rotation.y = Math.sin(t * 10 + e.seed) * 0.35;
      if (playing && !e.dead && e.yMax > 0 && collides(e, prevZ)) hitObstacle(e);
    } else if (e.kind === 'melon') {
      e.mesh.rotation.y += dt * 3.2;
      let y = e.y + Math.sin(t * 3 + e.seed) * 0.08;
      if (G.boost > 0 && playing && e.z > -16 && e.z < 2) e.magnet = true;
      if (e.magnet) { e.x = damp(e.x, player.x, 10, dt); e.y = damp(e.y, player.h + 1.0, 10, dt); e.z = damp(e.z, 0, 6, dt); e.mesh.position.z = e.z; y = e.y; }
      e.mesh.position.set(e.x, y + wy * 0.5, e.z);
      if (playing && Math.abs(e.z) < 0.95 && Math.abs(e.x - player.x) < 0.95 && y > player.h - 0.3 && y < player.h + 2.1) { collectMelon(e); removeEntity(i); continue; }
    } else if (e.kind === 'power') {
      if (e.type === 'husky') { animHusky(e.mesh, t, false); e.mesh.rotation.y = Math.PI + Math.sin(t * 2) * 0.4; } else e.mesh.rotation.y += dt * 2;
      e.mesh.position.y = (e.type === 'husky' ? 0.15 : 1.0) + wy * 0.5 + Math.sin(t * 3) * 0.12;
      const ring = e.mesh.userData.ring; ring.rotation.z += dt * 3; ring.scale.setScalar(1 + Math.sin(t * 6) * 0.08); ring.position.y = e.type === 'husky' ? 0.7 : 0;
      if (Math.random() < 0.5) emit(e.x + rand(-0.6, 0.6), e.mesh.position.y + rand(-0.4, 0.8), e.z, 0, rand(0.5, 1.5), 0, 0.6, rand(0.12, 0.22), pick(POWERS[e.type].spark), 0);
      if (playing && !flying() && Math.abs(e.z) < 1.1 && Math.abs(e.x - player.x) < 1.1 && player.h < 1.8) { removeEntity(i); startPower(e.type); continue; }
    }
    if (e.z > 14) removeEntity(i);
  }
  updateScenery(dz);
  updateCameos(dt, t, dz);
  const biomeId = BIOMES[cur].id;
  updateCritters(dt, dz, t, biomeId);
  if (biomeId === 'glacier' && (playing || G.state === 'title')) for (let i = 0; i < 2; i++) emit(rand(-10, 14), rand(5, 10), rand(-45, 6), rand(-0.3, 0.3), -rand(0.8, 1.8), 0, 4, rand(0.06, 0.12), '#ffffff', 0, 1);

  if (playing) {
    G.scoreF += dz * 0.5 * (G.boost > 0 ? 2 : 1);
    G.score = Math.floor(G.scoreF);
    ui.score.textContent = G.score; ui.melons.textContent = G.melons;
    const kmh = Math.round(G.speed * 3.6); ui.speedo.textContent = `🌊 ${kmh} км/ч`;
    if (Math.floor(G.run / 20) > G.speedLvl) { G.speedLvl = Math.floor(G.run / 20); notice(`⚡ Волна разгоняется — ${kmh} км/ч`); }
    if (G.speed > 26) for (let i = 0; i < Math.floor((G.speed - 26) / 7) + 1; i++) emit(rand(-8, 8), rand(0.4, 6), -24, 0, 0, 0, 0.55, 0.1, '#ffffff', 0, 1);
  }
  Sound.setWind(playing ? clamp((G.speed - 12) / 24, 0, 1) * 0.07 + (flying() ? 0.05 : 0) : 0);

  updateParticles(dt, dz);
  updateFloats(rawDt);
  updateCamera(rawDt, waterY);
}

function hitObstacle(e) {
  if (flying()) return;
  if (e.fragile) {
    e.dead = true; G.scoreF += 30; Sound.glass();
    burst(e.x, 1.0, e.z, 45, { spread: 3.5, up: 5, life: 0.8, size: 0.22, colors: ['#ffffff', '#cfe0ff', '#9ec1ff', '#6a5cff'] });
    floatText(pick(['Кирилл, останься!', 'Не уходи 🥺', 'Заявление порвано', 'Кирилл, ну куда ты']) + ' +30', e.x, 2.2, e.z, 'smash');
    return;
  }
  if (G.boost > 0 || player.invuln > 0) {
    if (G.boost > 0 && e.kind === 'obs') {
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
    if (G.stumbleT > 0) { loseLife(e); return; }
    G.stumbleT = 5;
    floatText('Ой!', player.x, 2.2, 0);
    return;
  }
  loseLife(e);
}
function loseLife(e) {
  G.lives--;
  if (G.lives <= 0) { wipeout(e); return; }
  e.dead = true; player.invuln = 2.2; player.duckT = 0.35; G.speed *= 0.8; G.shake = 0.8; G.stumbleT = 0; flash(); Sound.bump();
  burst(e.x, 1.2, e.z, 45, { spread: 3.5, up: 6, life: 0.9, size: 0.32, colors: ['#ffffff', '#ff8aa8', '#ff4f7b'] });
  floatText('💔', player.x, player.h + 2.2, 0, 'smash');
}

function collectMelon(e) {
  if (G.t - G.lastMelonT > 0.7) G.streak = 0;
  G.lastMelonT = G.t; Sound.melon(G.streak++);
  G.melons++; G.scoreF += G.boost > 0 ? 20 : 10;
  burst(e.x, e.mesh.position.y, e.z, 10, { spread: 1.5, up: 3, life: 0.5, size: 0.2, colors: ['#ff3b4e', '#8bc34a', '#ffffff'], grav: 6, scroll: 0 });
  if (G.melons % 25 === 0) floatText(`🍉 ×${G.melons}`, player.x, player.h + 2.4, 0, 'melon');
}

function updateCamera(dt, waterY) {
  const portrait = camera.aspect < 0.9;
  if (camMode === 'chase') {
    const hk = flying() || player.h > 2.5 ? 0.8 : 0.35;
    if (portrait) { _tp.set(player.x * 0.62, 3.7 + player.h * hk, 7.3); _tl.set(player.x * 0.7, 1.45 + player.h * hk, -6); }
    else { _tp.set(player.x * 0.55, 3.15 + player.h * hk, 6.7); _tl.set(player.x * 0.75, 1.35 + player.h * hk, -7); }
    const k = G.state === 'dying' ? 2 : 6;
    camPos.x = damp(camPos.x, _tp.x, k, dt); camPos.y = damp(camPos.y, _tp.y, k * 0.8, dt); camPos.z = damp(camPos.z, _tp.z, k * 0.6, dt);
    camLook.lerp(_tl, 1 - Math.exp(-k * dt));
    const targetFov = (portrait ? 74 : 62) + clamp((G.speed - 15) * 0.32, 0, 9) + (G.boost > 0 ? 6 : 0);
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
  for (const m of KIRILL) bubbleTexture(m, 'kirill');
  resetScenery();
  applyTOD(0);
  G.state = 'title';
  poseOlya(0, 0, 0, 0, 0.5);
  renderer.compile(scene, camera);
  frame();
  setTimeout(() => $('loading').classList.add('done'), 150);
  Wishes.load();
  // debug handle: deterministic stepping for testing in a hidden tab
  window.__arbuz = { G, player, entities, cameos, startRun, startPower, addPower, addObstacle, spawnFedor, spawnCarpet, resetScenery, jump, duck, move, Wishes,
    step(sec) { for (let i = 0; i < Math.round(sec * 60); i++) update(1 / 60); renderer.render(scene, camera); },
    setView(w, h) { renderer.setPixelRatio(1); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); } };
})();
