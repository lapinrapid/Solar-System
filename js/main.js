import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { AU, bodies, roadster, bodyById, TEXTURES } from "./data.js";

// ─────────────────────────────────────────────
// Constants & state
// ─────────────────────────────────────────────

const HOURS_PER_DAY = 24;
/** Slider maps 0–100 → days-per-second (log scale). */
const SPEED_MIN = 0.00001; // days / sec (~ real-time floor)
const SPEED_MAX = 100; // days / sec

const state = {
  paused: false,
  daysPerSecond: 1,
  simDays: 0,
  showOrbits: true,
  showLabels: true,
  showTrails: false,
  showAsteroids: true,
  focusId: "sun",
  hoverId: null,
  focusLerp: 1,
  targetFocusPos: new THREE.Vector3(),
  currentFocusPos: new THREE.Vector3(),
};

// ─────────────────────────────────────────────
// DOM
// ─────────────────────────────────────────────

const container = document.getElementById("canvas-container");
const loadingEl = document.getElementById("loading");
const simDateEl = document.getElementById("sim-date");
const speedDisplayEl = document.getElementById("speed-display");
const timeScaleInput = document.getElementById("time-scale");
const timeScaleLabel = document.getElementById("time-scale-label");
const bodyNameEl = document.getElementById("body-name");
const bodyTypeEl = document.getElementById("body-type");
const bodyBlurbEl = document.getElementById("body-blurb");
const infoRadius = document.getElementById("info-radius");
const infoDay = document.getElementById("info-day");
const infoPeriod = document.getElementById("info-period");
const infoDistance = document.getElementById("info-distance");
const planetChips = document.getElementById("planet-chips");
const btnPlay = document.getElementById("btn-play");
const iconPause = document.getElementById("icon-pause");
const iconPlay = document.getElementById("icon-play");
const btnSlower = document.getElementById("btn-slower");
const btnFaster = document.getElementById("btn-faster");
const btnRealtime = document.getElementById("btn-realtime");
const btnResetView = document.getElementById("btn-reset-view");
const presets = document.querySelectorAll(".preset");
const floatLabel = document.getElementById("float-label");
const floatLabelName = document.getElementById("float-label-name");
const floatLabelType = document.getElementById("float-label-type");

// ─────────────────────────────────────────────
// Renderer / scene / camera
// ─────────────────────────────────────────────

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance",
  alpha: false,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x03040a);
scene.fog = new THREE.FogExp2(0x03040a, 0.00045);

const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  5000
);
camera.position.set(0, 45, 95);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 2;
controls.maxDistance = 900;
controls.maxPolarAngle = Math.PI * 0.95;
controls.target.set(0, 0, 0);
controls.update();

scene.add(new THREE.AmbientLight(0x1a1e2e, 0.45));
scene.add(new THREE.HemisphereLight(0x9bb8ff, 0x08060a, 0.22));

// ─────────────────────────────────────────────
// Post-processing (bloom for stars / sun)
// ─────────────────────────────────────────────

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.72,
  0.48,
  0.78
);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ─────────────────────────────────────────────
// Texture loading
// ─────────────────────────────────────────────

const textureLoader = new THREE.TextureLoader();
const textureCache = new Map();

function loadTexture(key) {
  return new Promise((resolve) => {
    if (!key || !TEXTURES[key]) {
      resolve(null);
      return;
    }
    if (textureCache.has(key)) {
      resolve(textureCache.get(key));
      return;
    }
    const path = TEXTURES[key];
    textureLoader.load(
      path,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        textureCache.set(key, tex);
        resolve(tex);
      },
      undefined,
      () => {
        console.warn(`Texture failed: ${path}`);
        textureCache.set(key, null);
        resolve(null);
      }
    );
  });
}

async function preloadTextures() {
  const keys = Object.keys(TEXTURES);
  await Promise.all(keys.map((k) => loadTexture(k)));
}

// ─────────────────────────────────────────────
// Starfield
// ─────────────────────────────────────────────

function createStarfield() {
  const count = 12000;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const color = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const r = 400 + Math.random() * 1400;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);

    const t = Math.random();
    if (t < 0.15) color.setHSL(0.6, 0.4, 0.85);
    else if (t < 0.3) color.setHSL(0.08, 0.5, 0.9);
    else color.setHSL(0.55, 0.05, 0.75 + Math.random() * 0.25);

    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
    sizes[i] = 0.4 + Math.random() * 1.8;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

  const mat = new THREE.PointsMaterial({
    size: 1.1,
    vertexColors: true,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const stars = new THREE.Points(geo, mat);
  stars.name = "starfield";
  scene.add(stars);

  const bandCount = 4000;
  const bandPos = new Float32Array(bandCount * 3);
  for (let i = 0; i < bandCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 600 + Math.random() * 900;
    const y = (Math.random() - 0.5) * 40 * (0.3 + Math.random());
    bandPos[i * 3] = Math.cos(angle) * radius;
    bandPos[i * 3 + 1] = y;
    bandPos[i * 3 + 2] = Math.sin(angle) * radius;
  }
  const bandGeo = new THREE.BufferGeometry();
  bandGeo.setAttribute("position", new THREE.BufferAttribute(bandPos, 3));
  const band = new THREE.Points(
    bandGeo,
    new THREE.PointsMaterial({
      color: 0xaabbff,
      size: 0.9,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  band.rotation.z = 0.35;
  scene.add(band);

  return stars;
}

// ─────────────────────────────────────────────
// Procedural fallbacks
// ─────────────────────────────────────────────

function makePlanetTexture(baseHex, options = {}) {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const base = new THREE.Color(baseHex);
  ctx.fillStyle = `#${base.getHexString()}`;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 1800; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 2 + Math.random() * 18;
    const shade = (Math.random() - 0.5) * 0.35;
    const c = base.clone().offsetHSL(0, 0, shade);
    ctx.fillStyle = `rgba(${(c.r * 255) | 0},${(c.g * 255) | 0},${(c.b * 255) | 0},${0.15 + Math.random() * 0.35})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  if (options.bands) {
    for (let y = 0; y < size; y += 6 + Math.random() * 14) {
      const h = 3 + Math.random() * 10;
      const c = base.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.2);
      ctx.fillStyle = `rgba(${(c.r * 255) | 0},${(c.g * 255) | 0},${(c.b * 255) | 0},0.35)`;
      ctx.fillRect(0, y, size, h);
    }
  }

  if (options.landHex) {
    const land = new THREE.Color(options.landHex);
    for (let i = 0; i < 40; i++) {
      const cx = Math.random() * size;
      const cy = Math.random() * size;
      const rw = 20 + Math.random() * 60;
      const rh = 15 + Math.random() * 40;
      ctx.fillStyle = `rgba(${(land.r * 255) | 0},${(land.g * 255) | 0},${(land.b * 255) | 0},0.75)`;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rw, rh, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(230,240,255,0.55)";
    ctx.fillRect(0, 0, size, 28);
    ctx.fillRect(0, size - 28, size, 28);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeRingTexture() {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const cx = size / 2;
  const cy = size / 2;

  ctx.clearRect(0, 0, size, size);
  for (let i = 0; i < 80; i++) {
    const t = i / 80;
    const r0 = size * 0.28 + t * size * 0.2;
    const alpha = 0.05 + Math.sin(t * 40) * 0.04 + (1 - t) * 0.12;
    ctx.beginPath();
    ctx.arc(cx, cy, r0, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(220, 200, 160, ${Math.max(0.02, alpha)})`;
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.4, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(0,0,0,0.85)";
  ctx.lineWidth = 6;
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeSunGlowSprite() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const g = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2
  );
  g.addColorStop(0, "rgba(255, 250, 220, 1)");
  g.addColorStop(0.12, "rgba(255, 210, 80, 0.85)");
  g.addColorStop(0.35, "rgba(255, 140, 30, 0.35)");
  g.addColorStop(0.6, "rgba(255, 80, 0, 0.12)");
  g.addColorStop(1, "rgba(255, 40, 0, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ─────────────────────────────────────────────
// Orbit helpers
// ─────────────────────────────────────────────

function keplerPosition(a, e, M) {
  M = ((M % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  let E = e < 0.8 ? M : Math.PI;
  for (let i = 0; i < 8; i++) {
    E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  }
  const cosE = Math.cos(E);
  const sinE = Math.sin(E);
  const x = a * (cosE - e);
  const z = a * Math.sqrt(1 - e * e) * sinE;
  return { x, z, r: Math.sqrt(x * x + z * z) };
}

function createOrbitLine(a, e, inclinationDeg, color = 0x6b8cae, opacity = 0.28) {
  const pts = [];
  const segments = 256;
  const inc = THREE.MathUtils.degToRad(inclinationDeg || 0);
  for (let i = 0; i <= segments; i++) {
    const M = (i / segments) * Math.PI * 2;
    const { x, z } = keplerPosition(a, e, M);
    const y = z * Math.sin(inc);
    const zz = z * Math.cos(inc);
    pts.push(new THREE.Vector3(x, y, zz));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  const line = new THREE.LineLoop(geo, mat);
  line.userData.isOrbit = true;
  return line;
}

/** Remap RingGeometry UVs so a radial strip / ring map spreads correctly. */
function fixRingUVs(geometry, innerRadius, outerRadius) {
  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  const v3 = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v3.fromBufferAttribute(pos, i);
    const r = Math.sqrt(v3.x * v3.x + v3.y * v3.y);
    const u = (r - innerRadius) / (outerRadius - innerRadius);
    uv.setXY(i, u, 0.5);
  }
  uv.needsUpdate = true;
}

// ─────────────────────────────────────────────
// Build solar system
// ─────────────────────────────────────────────

const systemRoot = new THREE.Group();
scene.add(systemRoot);

const entityMap = new Map();
const labelSprites = [];
const clickables = [];
const orbitLines = [];
const trailPositions = new Map();
let roadsterEntity = null;

function createLabelSprite(text, options = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, 512, 96);
  ctx.font = `600 ${options.fontSize || 30}px DM Sans, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const tw = Math.min(ctx.measureText(text).width, 480);
  const padX = 18;
  const boxW = tw + padX * 2;
  const boxH = 40;
  const bx = 256 - boxW / 2;
  const by = 28;

  // Soft shadow pill
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  roundRect(ctx, bx, by, boxW, boxH, 12);
  ctx.fill();

  // Accent edge
  ctx.strokeStyle = options.accent || "rgba(125, 211, 252, 0.45)";
  ctx.lineWidth = 1.5;
  roundRect(ctx, bx, by, boxW, boxH, 12);
  ctx.stroke();

  ctx.fillStyle = options.color || "rgba(242,244,248,0.95)";
  ctx.fillText(text, 256, by + boxH / 2 + 1, 480);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    depthTest: true,
  });
  const sprite = new THREE.Sprite(mat);
  const scale = options.scale || 6;
  sprite.scale.set(scale, scale * 0.188, 1);
  sprite.userData.isLabel = true;
  sprite.userData.labelText = text;
  return sprite;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function buildSun(data) {
  const group = new THREE.Group();
  group.name = data.id;

  const map = textureCache.get(data.texture);
  const geo = new THREE.SphereGeometry(data.size, 64, 64);
  const mat = new THREE.MeshBasicMaterial({
    map: map || null,
    color: map ? 0xffffff : data.color,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.bodyId = data.id;
  mesh.rotation.z = THREE.MathUtils.degToRad(data.axialTilt || 0);
  group.add(mesh);

  // Inner corona shell
  const glow1 = new THREE.Mesh(
    new THREE.SphereGeometry(data.size * 1.08, 48, 48),
    new THREE.MeshBasicMaterial({
      color: 0xffcc55,
      transparent: true,
      opacity: 0.22,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  group.add(glow1);

  // Mid glow
  const glow2 = new THREE.Mesh(
    new THREE.SphereGeometry(data.size * 1.28, 40, 40),
    new THREE.MeshBasicMaterial({
      color: 0xff9922,
      transparent: true,
      opacity: 0.12,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  group.add(glow2);

  // Outer halo
  const glow3 = new THREE.Mesh(
    new THREE.SphereGeometry(data.size * 1.7, 32, 32),
    new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.055,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  group.add(glow3);

  // Soft billboard glow
  const glowSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: makeSunGlowSprite(),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.9,
    })
  );
  glowSprite.scale.set(data.size * 6.5, data.size * 6.5, 1);
  group.add(glowSprite);

  const light = new THREE.PointLight(0xfff2d0, 3.4, 0, 0.32);
  light.position.set(0, 0, 0);
  group.add(light);

  // Corona particles
  const coronaCount = 1000;
  const cPos = new Float32Array(coronaCount * 3);
  for (let i = 0; i < coronaCount; i++) {
    const r = data.size * (1.02 + Math.random() * 1.1);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    cPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    cPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    cPos[i * 3 + 2] = r * Math.cos(phi);
  }
  const corona = new THREE.Points(
    new THREE.BufferGeometry().setAttribute(
      "position",
      new THREE.BufferAttribute(cPos, 3)
    ),
    new THREE.PointsMaterial({
      color: 0xffcc66,
      size: 0.14,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  group.add(corona);

  systemRoot.add(group);
  clickables.push(mesh);

  const label = createLabelSprite(data.name, {
    accent: "rgba(251, 191, 36, 0.55)",
    scale: 8,
  });
  label.position.set(0, data.size + 2.6, 0);
  group.add(label);
  labelSprites.push(label);

  entityMap.set(data.id, {
    group,
    mesh,
    data,
    moons: [],
    label,
    a: 0,
    meanMotion: 0,
    meanAnomaly0: 0,
    glowSprite,
    corona,
  });
}

function buildPlanet(data) {
  const a = data.distanceAU * AU;
  const group = new THREE.Group();
  group.name = data.id;

  const isGas =
    data.id === "jupiter" ||
    data.id === "saturn" ||
    data.id === "uranus" ||
    data.id === "neptune";

  const map = textureCache.get(data.texture);
  const fallback = map
    ? null
    : makePlanetTexture(data.color, {
        bands: isGas,
        landHex: data.landColor,
      });

  const geo = new THREE.SphereGeometry(data.size, 64, 64);
  const mat = new THREE.MeshStandardMaterial({
    map: map || fallback,
    roughness: isGas ? 0.85 : 0.55,
    metalness: 0.02,
    color: map ? 0xffffff : 0xcccccc,
    emissive: data.color,
    emissiveIntensity: 0.025,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.bodyId = data.id;
  mesh.rotation.z = THREE.MathUtils.degToRad(data.axialTilt || 0);
  group.add(mesh);

  // Earth clouds
  if (data.cloudTexture) {
    const cloudMap = textureCache.get(data.cloudTexture);
    if (cloudMap) {
      const clouds = new THREE.Mesh(
        new THREE.SphereGeometry(data.size * 1.018, 48, 48),
        new THREE.MeshStandardMaterial({
          map: cloudMap,
          transparent: true,
          opacity: 0.45,
          depthWrite: false,
          roughness: 1,
          metalness: 0,
        })
      );
      clouds.rotation.z = THREE.MathUtils.degToRad(data.axialTilt || 0);
      group.add(clouds);
      mesh.userData.clouds = clouds;
    }
  }

  if (data.hasAtmosphere) {
    const atm = new THREE.Mesh(
      new THREE.SphereGeometry(data.size * 1.05, 32, 32),
      new THREE.MeshBasicMaterial({
        color: 0x7dd3fc,
        transparent: true,
        opacity: 0.1,
        side: THREE.BackSide,
        depthWrite: false,
      })
    );
    group.add(atm);
  }

  // Saturn rings (NASA / Solar System Scope alpha map)
  if (data.hasRings) {
    const innerR = data.size * 1.35;
    const outerR = data.size * 2.45;
    const ringGeo = new THREE.RingGeometry(innerR, outerR, 128);
    fixRingUVs(ringGeo, innerR, outerR);

    const ringMap = textureCache.get(data.ringTexture);
    let ringMat;
    if (ringMap) {
      // Strip map (radial U): Solar System Scope 2k_saturn_ring_alpha
      ringMap.colorSpace = THREE.SRGBColorSpace;
      ringMap.wrapS = THREE.ClampToEdgeWrapping;
      ringMap.wrapT = THREE.ClampToEdgeWrapping;
      ringMat = new THREE.MeshBasicMaterial({
        map: ringMap,
        color: 0xe8dcc0,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        alphaTest: 0.04,
      });
    } else {
      ringMat = new THREE.MeshBasicMaterial({
        map: makeRingTexture(),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      });
    }
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.rotation.z = THREE.MathUtils.degToRad(data.axialTilt || 0);
    group.add(ring);
  }

  // Moons
  const moonEntities = [];
  if (data.moons) {
    for (const m of data.moons) {
      const moonGroup = new THREE.Group();
      const moonMap = m.texture ? textureCache.get(m.texture) : null;
      const moonMesh = new THREE.Mesh(
        new THREE.SphereGeometry(m.size, 32, 32),
        new THREE.MeshStandardMaterial({
          map: moonMap || null,
          color: moonMap ? 0xffffff : m.color,
          roughness: 0.92,
          metalness: 0.02,
        })
      );
      moonMesh.userData.bodyId = m.id;
      moonGroup.add(moonMesh);

      const moonOrbit = createOrbitLine(m.distance, 0.055, 5.1, 0x8899aa, 0.2);
      group.add(moonOrbit);
      orbitLines.push(moonOrbit);

      const moonLabel = createLabelSprite(m.name, {
        scale: 2.8,
        fontSize: 26,
        accent: "rgba(200,210,230,0.4)",
      });
      moonLabel.position.set(0, m.size + 0.55, 0);
      moonGroup.add(moonLabel);
      labelSprites.push(moonLabel);

      group.add(moonGroup);
      moonEntities.push({
        group: moonGroup,
        mesh: moonMesh,
        data: m,
        label: moonLabel,
        distance: m.distance,
        periodDays: m.periodDays,
        meanAnomaly0: Math.random() * Math.PI * 2,
        e: 0.055,
      });
      clickables.push(moonMesh);
    }
  }

  const meanAnomaly0 = Math.random() * Math.PI * 2;
  const meanMotion = (Math.PI * 2) / data.periodDays;
  const { x, z } = keplerPosition(a, data.eccentricity, meanAnomaly0);
  const inc = THREE.MathUtils.degToRad(data.inclination || 0);
  group.position.set(x, z * Math.sin(inc), z * Math.cos(inc));

  systemRoot.add(group);
  clickables.push(mesh);

  const orbit = createOrbitLine(a, data.eccentricity, data.inclination);
  systemRoot.add(orbit);
  orbitLines.push(orbit);

  const label = createLabelSprite(data.name);
  label.position.set(0, data.size + 1.4, 0);
  const labelScale = 4 + data.distanceAU * 0.15;
  label.scale.set(labelScale, labelScale * 0.188, 1);
  group.add(label);
  labelSprites.push(label);

  entityMap.set(data.id, {
    group,
    mesh,
    data,
    moons: moonEntities,
    label,
    a,
    e: data.eccentricity,
    inclination: data.inclination || 0,
    meanMotion,
    meanAnomaly0,
  });

  trailPositions.set(data.id, []);
}

/**
 * Elon Musk's red Tesla Roadster + Starman, in a slightly elliptical orbit of Mars.
 */
function buildRoadster() {
  const mars = entityMap.get("mars");
  if (!mars) return;

  const group = new THREE.Group();
  group.name = roadster.id;

  // Hit sphere (invisible but large for picking)
  const hit = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 12, 12),
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
  );
  hit.userData.bodyId = roadster.id;
  group.add(hit);

  // Car body (cherry red Tesla-ish wedge)
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.055, 0.1),
    new THREE.MeshStandardMaterial({
      color: 0xe10600,
      roughness: 0.35,
      metalness: 0.55,
      emissive: 0x880000,
      emissiveIntensity: 0.35,
    })
  );
  body.position.y = 0.02;
  body.userData.bodyId = roadster.id;
  group.add(body);

  // Cabin / windshield
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.04, 0.085),
    new THREE.MeshStandardMaterial({
      color: 0x1a1a22,
      roughness: 0.2,
      metalness: 0.7,
      emissive: 0x111122,
      emissiveIntensity: 0.15,
    })
  );
  cabin.position.set(-0.02, 0.055, 0);
  cabin.userData.bodyId = roadster.id;
  group.add(cabin);

  // Starman (spacesuit mannequin)
  const starman = new THREE.Mesh(
    new THREE.SphereGeometry(0.028, 12, 12),
    new THREE.MeshStandardMaterial({
      color: 0xf0f0f5,
      roughness: 0.6,
      metalness: 0.1,
      emissive: 0x8888aa,
      emissiveIntensity: 0.25,
    })
  );
  starman.position.set(-0.01, 0.09, 0);
  starman.userData.bodyId = roadster.id;
  group.add(starman);

  // Wheels
  const wheelMat = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.9,
    metalness: 0.2,
  });
  const wheelGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.02, 12);
  const wheelOffsets = [
    [0.07, 0.0, 0.055],
    [0.07, 0.0, -0.055],
    [-0.07, 0.0, 0.055],
    [-0.07, 0.0, -0.055],
  ];
  for (const [wx, wy, wz] of wheelOffsets) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.x = Math.PI / 2;
    w.position.set(wx, wy, wz);
    group.add(w);
  }

  // Visibility beacon — bright red glow sprite so it's easy to spot near Mars
  const beaconCanvas = document.createElement("canvas");
  beaconCanvas.width = 64;
  beaconCanvas.height = 64;
  const bctx = beaconCanvas.getContext("2d");
  const bg = bctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  bg.addColorStop(0, "rgba(255, 80, 60, 1)");
  bg.addColorStop(0.35, "rgba(220, 20, 20, 0.55)");
  bg.addColorStop(1, "rgba(180, 0, 0, 0)");
  bctx.fillStyle = bg;
  bctx.fillRect(0, 0, 64, 64);
  const beaconTex = new THREE.CanvasTexture(beaconCanvas);
  const beacon = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: beaconTex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.95,
    })
  );
  beacon.scale.set(0.55, 0.55, 1);
  group.add(beacon);

  // Tiny point light so Roadster pops when zoomed on Mars
  const carLight = new THREE.PointLight(0xff3333, 0.55, 4, 2);
  group.add(carLight);

  // Orbit path around Mars
  const orbit = createOrbitLine(
    roadster.distance,
    roadster.eccentricity,
    roadster.inclination,
    0xff4444,
    0.4
  );
  mars.group.add(orbit);
  orbitLines.push(orbit);

  const label = createLabelSprite("Tesla Roadster (Starman)", {
    scale: 3.6,
    fontSize: 22,
    accent: "rgba(255, 80, 60, 0.65)",
    color: "rgba(255, 220, 210, 0.98)",
  });
  label.position.set(0, 0.35, 0);
  group.add(label);
  labelSprites.push(label);

  mars.group.add(group);
  clickables.push(hit, body, cabin, starman);

  const meanAnomaly0 = Math.random() * Math.PI * 2;
  const meanMotion = (Math.PI * 2) / roadster.periodDays;

  roadsterEntity = {
    group,
    mesh: body,
    hit,
    beacon,
    data: roadster,
    label,
    a: roadster.distance,
    e: roadster.eccentricity,
    inclination: roadster.inclination,
    meanMotion,
    meanAnomaly0,
    parentId: "mars",
  };

  entityMap.set(roadster.id, roadsterEntity);
  trailPositions.set(roadster.id, []);

  // Initial place
  updateRoadster(0);
}

function updateRoadster(dtDays) {
  if (!roadsterEntity) return;
  roadsterEntity.meanAnomaly0 += roadsterEntity.meanMotion * dtDays;
  const { x, z } = keplerPosition(
    roadsterEntity.a,
    roadsterEntity.e,
    roadsterEntity.meanAnomaly0
  );
  const inc = THREE.MathUtils.degToRad(roadsterEntity.inclination);
  roadsterEntity.group.position.set(x, z * Math.sin(inc), z * Math.cos(inc));

  // Spin / tumble slowly
  roadsterEntity.group.rotation.y += dtDays * 4;
  roadsterEntity.group.rotation.z = Math.sin(roadsterEntity.meanAnomaly0) * 0.15;

  // Scale beacon with camera distance so it stays visible when focused on Mars
  const worldPos = new THREE.Vector3();
  roadsterEntity.group.getWorldPosition(worldPos);
  const dist = camera.position.distanceTo(worldPos);
  const s = THREE.MathUtils.clamp(dist * 0.045, 0.35, 1.8);
  roadsterEntity.beacon.scale.set(s, s, 1);

}

function buildAsteroidBelt() {
  const count = 3500;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const inner = 2.2 * AU;
  const outer = 3.2 * AU;
  const c = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const a = inner + Math.random() * (outer - inner);
    const e = Math.random() * 0.12;
    const M = Math.random() * Math.PI * 2;
    const { x, z } = keplerPosition(a, e, M);
    const y = (Math.random() - 0.5) * 2.2;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    c.setHSL(0.08, 0.15, 0.35 + Math.random() * 0.35);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.18,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  const belt = new THREE.Points(geo, mat);
  belt.name = "asteroid-belt";
  systemRoot.add(belt);
  return belt;
}

// ─────────────────────────────────────────────
// Trail lines
// ─────────────────────────────────────────────

const trailGroup = new THREE.Group();
systemRoot.add(trailGroup);
const trailMeshes = new Map();
const TRAIL_MAX = 180;

function updateTrails() {
  if (!state.showTrails) {
    trailGroup.visible = false;
    return;
  }
  trailGroup.visible = true;

  for (const [id, entity] of entityMap) {
    if (entity.data.isStar) continue;
    const arr = trailPositions.get(id);
    if (!arr) continue;

    const worldPos = new THREE.Vector3();
    entity.group.getWorldPosition(worldPos);
    arr.push(worldPos.clone());
    if (arr.length > TRAIL_MAX) arr.shift();
    if (arr.length < 2) continue;

    let line = trailMeshes.get(id);
    if (!line) {
      const geo = new THREE.BufferGeometry();
      const mat = new THREE.LineBasicMaterial({
        color: entity.data.color,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      });
      line = new THREE.Line(geo, mat);
      trailMeshes.set(id, line);
      trailGroup.add(line);
    }
    line.geometry.setFromPoints(arr);
  }
}

// ─────────────────────────────────────────────
// Simulation step
// ─────────────────────────────────────────────

function updateBodies(dtDays) {
  for (const [, entity] of entityMap) {
    const { data, mesh, moons } = entity;

    if (data.id === "roadster") continue;

    if (data.spinHours) {
      const revolutionsPerDay = HOURS_PER_DAY / Math.abs(data.spinHours);
      const spin = revolutionsPerDay * Math.PI * 2 * dtDays;
      mesh.rotation.y += data.spinHours < 0 ? -spin : spin;
      if (mesh.userData.clouds) {
        mesh.userData.clouds.rotation.y += spin * 1.15;
      }
    }

    if (data.isStar) continue;

    entity.meanAnomaly0 += entity.meanMotion * dtDays;
    const { x, z } = keplerPosition(entity.a, entity.e, entity.meanAnomaly0);
    const inc = THREE.MathUtils.degToRad(entity.inclination);
    entity.group.position.set(x, z * Math.sin(inc), z * Math.cos(inc));

    for (const moon of moons || []) {
      const n = (Math.PI * 2) / moon.periodDays;
      moon.meanAnomaly0 += n * dtDays;
      const mp = keplerPosition(moon.distance, moon.e || 0.05, moon.meanAnomaly0);
      const minc = 0.09;
      moon.group.position.set(mp.x, mp.z * Math.sin(minc), mp.z * Math.cos(minc));
      if (moon.data.spinHours) {
        const rev = HOURS_PER_DAY / Math.abs(moon.data.spinHours);
        moon.mesh.rotation.y += rev * Math.PI * 2 * dtDays;
      }
    }
  }

  updateRoadster(dtDays);
}

// ─────────────────────────────────────────────
// Camera focus
// ─────────────────────────────────────────────

const focusOffset = new THREE.Vector3(0, 0, 0);
const _world = new THREE.Vector3();

function getBodyWorldPosition(id) {
  if (id === "moon") {
    const earth = entityMap.get("earth");
    if (earth?.moons?.[0]) {
      earth.moons[0].mesh.getWorldPosition(_world);
      return _world.clone();
    }
  }
  if (id === "roadster" && roadsterEntity) {
    roadsterEntity.group.getWorldPosition(_world);
    return _world.clone();
  }
  const entity = entityMap.get(id);
  if (!entity) return new THREE.Vector3();
  entity.mesh.getWorldPosition(_world);
  return _world.clone();
}

function getFocusDistance(id) {
  if (id === "moon") return 6;
  if (id === "roadster") return 4.5;
  const entity = entityMap.get(id);
  if (!entity) return 40;
  if (entity.data.isStar) return 55;
  if (id === "mars") return Math.max(entity.data.size * 14, 12);
  return Math.max(entity.data.size * 9, 10) + (entity.data.distanceAU || 0) * 0.4;
}

function focusOn(id) {
  const data = bodyById(id);
  if (!data) return;

  state.focusId = id;
  updateInfoPanel(data);
  setActiveChip(id);
  frameCameraOn(id);
  showFloatLabel(id, true);
}

function frameCameraOn(id) {
  const target = getBodyWorldPosition(id);
  if (!target) return;

  const dist = getFocusDistance(id);
  let dir = new THREE.Vector3().subVectors(camera.position, controls.target);
  if (dir.lengthSq() < 0.0001) dir.set(0.55, 0.4, 0.75);
  dir.normalize();
  dir.y = Math.max(dir.y, 0.25);
  dir.normalize();

  focusOffset.copy(dir.multiplyScalar(dist));
  controls.target.copy(target);
  state.currentFocusPos.copy(target);
  state.targetFocusPos.copy(target);
  camera.position.copy(target).add(focusOffset);
  controls.minDistance = id === "roadster" || id === "moon" ? 1.2 : 2;
  controls.update();
}

function updateInfoPanel(data) {
  bodyNameEl.textContent = data.name;
  bodyTypeEl.textContent = data.type || "";
  bodyBlurbEl.textContent = data.blurb || "";
  infoRadius.textContent = data.radiusKm || "—";
  infoDay.textContent = data.dayLength || "—";
  infoPeriod.textContent =
    data.periodDays != null
      ? data.periodDays >= 365
        ? `${(data.periodDays / 365.25).toFixed(2)} yr`
        : data.periodDays >= 1
          ? `${data.periodDays.toFixed(data.periodDays < 10 ? 2 : 1)} d`
          : `${(data.periodDays * 24).toFixed(1)} h`
      : "—";
  infoDistance.textContent = data.distanceLabel || "—";
}

function setActiveChip(id) {
  planetChips.querySelectorAll(".chip").forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.id === id);
  });
}

function buildChips() {
  planetChips.innerHTML = "";
  for (const b of bodies) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip" + (b.id === "sun" ? " active" : "");
    btn.dataset.id = b.id;
    btn.textContent = b.name;
    btn.addEventListener("click", () => focusOn(b.id));
    planetChips.appendChild(btn);

    // Moon chip after Earth
    if (b.id === "earth") {
      const moonBtn = document.createElement("button");
      moonBtn.type = "button";
      moonBtn.className = "chip chip-moon";
      moonBtn.dataset.id = "moon";
      moonBtn.textContent = "Moon";
      moonBtn.addEventListener("click", () => focusOn("moon"));
      planetChips.appendChild(moonBtn);
    }
    // Roadster chip after Mars
    if (b.id === "mars") {
      const rBtn = document.createElement("button");
      rBtn.type = "button";
      rBtn.className = "chip chip-roadster";
      rBtn.dataset.id = "roadster";
      rBtn.textContent = "Roadster";
      rBtn.title = "Tesla Roadster (Starman)";
      rBtn.addEventListener("click", () => focusOn("roadster"));
      planetChips.appendChild(rBtn);
    }
  }
}

// ─────────────────────────────────────────────
// Floating HTML labels (hover + selection)
// ─────────────────────────────────────────────

function resolveLabelData(id) {
  return bodyById(id);
}

function showFloatLabel(id, pinned = false) {
  const data = resolveLabelData(id);
  if (!data || !floatLabel) return;
  floatLabelName.textContent = data.name;
  floatLabelType.textContent = data.type || "";
  floatLabel.dataset.id = id;
  floatLabel.dataset.pinned = pinned ? "1" : "0";
  floatLabel.classList.add("visible");
  floatLabel.classList.toggle("pinned", pinned);
  floatLabel.classList.toggle("roadster", id === "roadster");
}

function hideFloatLabel(force = false) {
  if (!floatLabel) return;
  if (!force && floatLabel.dataset.pinned === "1") return;
  floatLabel.classList.remove("visible", "pinned", "roadster");
  floatLabel.dataset.pinned = "0";
  floatLabel.dataset.id = "";
}

function updateFloatLabelPosition() {
  if (!floatLabel || !floatLabel.classList.contains("visible")) return;
  const id = floatLabel.dataset.id || state.focusId;
  if (!id) return;
  const world = getBodyWorldPosition(id);
  if (!world) return;

  // Offset above the body
  const entity = entityMap.get(id);
  let lift = 1.2;
  if (id === "roadster") lift = 0.45;
  else if (id === "moon") lift = 0.5;
  else if (entity?.data?.size) lift = entity.data.size * 1.35 + 0.6;

  world.y += lift;
  world.project(camera);

  const x = (world.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-world.y * 0.5 + 0.5) * window.innerHeight;

  // Hide if behind camera
  if (world.z > 1) {
    floatLabel.style.opacity = "0";
    return;
  }
  floatLabel.style.opacity = "";
  floatLabel.style.transform = `translate(-50%, -100%) translate(${x}px, ${y - 12}px)`;
}

// ─────────────────────────────────────────────
// Time scale mapping
// ─────────────────────────────────────────────

function sliderToDaysPerSecond(v) {
  const t = Number(v) / 100;
  return SPEED_MIN * Math.pow(SPEED_MAX / SPEED_MIN, t);
}

function daysPerSecondToSlider(dps) {
  const t = Math.log(dps / SPEED_MIN) / Math.log(SPEED_MAX / SPEED_MIN);
  return Math.max(0, Math.min(100, t * 100));
}

function formatSpeed(dps) {
  if (dps < 0.001) return `${(dps * 86400).toFixed(1)} s/s`;
  if (dps < 0.01) return `${(dps * 24).toFixed(2)} h/s`;
  if (dps < 1) return `${(dps * 24).toFixed(1)} h/s`;
  if (dps < 7) return `${dps.toFixed(dps < 10 ? 1 : 0)} d/s`;
  if (dps < 30) return `${(dps / 7).toFixed(1)} wk/s`;
  if (dps < 365) return `${(dps / 30.44).toFixed(1)} mo/s`;
  return `${(dps / 365.25).toFixed(2)} yr/s`;
}

function formatSimDate(days) {
  const year = Math.floor(days / 365.25);
  const dayOfYear = Math.floor(days % 365.25);
  return `Day ${dayOfYear} · Year ${year}`;
}

function formatMultiplier(dps) {
  // Relative to real time: 1 real second = dps days → factor = dps * 86400
  const realFactor = dps * 86400;
  if (realFactor >= 1e6) return `${(realFactor / 1e6).toFixed(1)}M×`;
  if (realFactor >= 1e3) return `${(realFactor / 1e3).toFixed(0)}k×`;
  if (realFactor >= 10) return `${Math.round(realFactor)}×`;
  if (dps >= 1) return `${dps < 10 ? dps.toFixed(1) : Math.round(dps)} d/s`;
  return `${dps.toFixed(3)} d/s`;
}

function setDaysPerSecond(dps, { syncSlider = true, syncPresets = true } = {}) {
  state.daysPerSecond = THREE.MathUtils.clamp(dps, SPEED_MIN, SPEED_MAX);
  speedDisplayEl.textContent = formatMultiplier(state.daysPerSecond);
  timeScaleLabel.textContent = formatSpeed(state.daysPerSecond);
  if (syncSlider) {
    timeScaleInput.value = String(daysPerSecondToSlider(state.daysPerSecond));
  }
  if (syncPresets) {
    let best = null;
    let bestDiff = Infinity;
    presets.forEach((p) => {
      const s = Number(p.dataset.speed);
      const diff = Math.abs(Math.log((s + 1e-9) / (state.daysPerSecond + 1e-9)));
      if (diff < bestDiff) {
        bestDiff = diff;
        best = p;
      }
    });
    presets.forEach((p) => {
      const s = Number(p.dataset.speed);
      const close =
        p === best &&
        Math.abs(Math.log((s + 1e-9) / (state.daysPerSecond + 1e-9))) < 0.45;
      p.classList.toggle("active", close);
    });
  }
}

// ─────────────────────────────────────────────
// Raycasting (click + hover)
// ─────────────────────────────────────────────

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let pointerDownPos = null;

function setPointerFromEvent(event) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

function pickBodyId() {
  raycaster.setFromCamera(pointer, camera);
  // Prefer closer / smaller objects — roadster has a generous hit sphere
  const hits = raycaster.intersectObjects(clickables, false);
  if (!hits.length) return null;
  return hits[0].object.userData.bodyId || null;
}

function onPointerDown(event) {
  if (event.target !== renderer.domElement) return;
  pointerDownPos = { x: event.clientX, y: event.clientY };
}

function onPointerUp(event) {
  if (event.target !== renderer.domElement) return;
  if (!pointerDownPos) return;
  const dx = event.clientX - pointerDownPos.x;
  const dy = event.clientY - pointerDownPos.y;
  pointerDownPos = null;
  // Ignore drag (orbit)
  if (dx * dx + dy * dy > 36) return;

  setPointerFromEvent(event);
  const id = pickBodyId();
  if (id) focusOn(id);
}

function onPointerMove(event) {
  if (event.target !== renderer.domElement) {
    if (state.hoverId) {
      state.hoverId = null;
      // Restore pinned focus label when leaving canvas
      if (state.showLabels) showFloatLabel(state.focusId, true);
      renderer.domElement.style.cursor = "default";
      renderer.domElement.title = "";
    }
    return;
  }
  setPointerFromEvent(event);
  const id = pickBodyId();
  if (id === state.hoverId) return;

  state.hoverId = id;
  if (id) {
    renderer.domElement.style.cursor = "pointer";
    renderer.domElement.title = resolveLabelData(id)?.name || "";
    // Hover always surfaces the label (Roadster included)
    showFloatLabel(id, id === state.focusId);
  } else {
    renderer.domElement.style.cursor = "default";
    renderer.domElement.title = "";
    if (state.showLabels) showFloatLabel(state.focusId, true);
    else hideFloatLabel(true);
  }
}

// ─────────────────────────────────────────────
// UI wiring
// ─────────────────────────────────────────────

function setPaused(p) {
  state.paused = p;
  iconPause.classList.toggle("hidden", p);
  iconPlay.classList.toggle("hidden", !p);
}

function wireUI() {
  buildChips();
  updateInfoPanel(bodies[0]);
  showFloatLabel("sun", true);

  setDaysPerSecond(1);

  timeScaleInput.addEventListener("input", () => {
    const dps = sliderToDaysPerSecond(timeScaleInput.value);
    setDaysPerSecond(dps, { syncSlider: false });
  });

  presets.forEach((btn) => {
    btn.addEventListener("click", () => {
      const dps = Number(btn.dataset.speed);
      setDaysPerSecond(dps);
      presets.forEach((p) => p.classList.toggle("active", p === btn));
    });
  });

  btnPlay.addEventListener("click", () => setPaused(!state.paused));
  btnSlower.addEventListener("click", () =>
    setDaysPerSecond(state.daysPerSecond / 2)
  );
  btnFaster.addEventListener("click", () =>
    setDaysPerSecond(state.daysPerSecond * 2)
  );
  btnRealtime.addEventListener("click", () => setDaysPerSecond(1));

  btnResetView.addEventListener("click", () => {
    focusOn("sun");
    camera.position.set(0, 45, 95);
    controls.target.set(0, 0, 0);
    controls.minDistance = 2;
    controls.update();
  });

  document.getElementById("toggle-orbits").addEventListener("change", (e) => {
    state.showOrbits = e.target.checked;
    orbitLines.forEach((l) => (l.visible = state.showOrbits));
  });
  document.getElementById("toggle-labels").addEventListener("change", (e) => {
    state.showLabels = e.target.checked;
    labelSprites.forEach((s) => (s.visible = state.showLabels));
    if (!state.showLabels) hideFloatLabel(true);
    else showFloatLabel(state.focusId, true);
  });
  document.getElementById("toggle-trails").addEventListener("change", (e) => {
    state.showTrails = e.target.checked;
    if (!state.showTrails) {
      for (const [, arr] of trailPositions) arr.length = 0;
      for (const [, line] of trailMeshes) {
        line.geometry.setFromPoints([]);
      }
    }
  });
  document.getElementById("toggle-asteroids").addEventListener("change", (e) => {
    state.showAsteroids = e.target.checked;
    if (asteroidBelt) asteroidBelt.visible = state.showAsteroids;
  });

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" && e.target === document.body) {
      e.preventDefault();
      setPaused(!state.paused);
    }
  });

  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  renderer.domElement.addEventListener("pointerup", onPointerUp);
  renderer.domElement.addEventListener("pointermove", onPointerMove);
}

// ─────────────────────────────────────────────
// Resize
// ─────────────────────────────────────────────

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  bloom.setSize(w, h);
}
window.addEventListener("resize", onResize);

// ─────────────────────────────────────────────
// Boot
// ─────────────────────────────────────────────

let asteroidBelt = null;

async function boot() {
  createStarfield();
  await preloadTextures();

  for (const b of bodies) {
    if (b.isStar) buildSun(b);
    else buildPlanet(b);
  }
  buildRoadster();
  asteroidBelt = buildAsteroidBelt();
  wireUI();

  // Default showcase: Month
  setDaysPerSecond(30);
  presets.forEach((p) =>
    p.classList.toggle("active", Number(p.dataset.speed) === 30)
  );

  requestAnimationFrame(() => {
    loadingEl.classList.add("done");
  });

  animate();
}

// ─────────────────────────────────────────────
// Animation loop
// ─────────────────────────────────────────────

const clock = new THREE.Clock();
let trailAccum = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (!state.paused) {
    const dtDays = state.daysPerSecond * dt;
    state.simDays += dtDays;
    updateBodies(dtDays);
    simDateEl.textContent = formatSimDate(state.simDays);

    trailAccum += dt;
    if (trailAccum > 0.05) {
      trailAccum = 0;
      updateTrails();
    }
  } else {
    updateTrails();
    // Still update roadster beacon scale when paused
    if (roadsterEntity) updateRoadster(0);
  }

  // Focus tracking
  const focusPos = getBodyWorldPosition(state.focusId);

  if (focusPos) {
    state.targetFocusPos.copy(focusPos);
    state.currentFocusPos.lerp(state.targetFocusPos, 1 - Math.pow(0.001, dt));
    const prev = controls.target.clone();
    controls.target.lerp(state.currentFocusPos, 1 - Math.pow(0.0008, dt));
    const delta = controls.target.clone().sub(prev);
    camera.position.add(delta);
  }

  // Emphasize focused body's sprite label
  for (const [, entity] of entityMap) {
    if (!entity.label) continue;
    const focused =
      entity.data.id === state.focusId ||
      (state.focusId === "moon" && entity.data.id === "earth");
    entity.label.material.opacity = focused ? 1 : state.showLabels ? 0.75 : 0;
    if (entity.moons) {
      for (const m of entity.moons) {
        if (m.label) {
          m.label.material.opacity =
            state.focusId === m.data.id ? 1 : state.showLabels ? 0.65 : 0;
          m.label.visible = state.showLabels || state.focusId === m.data.id;
        }
      }
    }
    entity.label.visible =
      state.showLabels || entity.data.id === state.focusId;
  }
  if (roadsterEntity?.label) {
    const rFocus = state.focusId === "roadster" || state.focusId === "mars";
    roadsterEntity.label.visible = state.showLabels || rFocus;
    roadsterEntity.label.material.opacity =
      state.focusId === "roadster" ? 1 : rFocus ? 0.9 : 0.7;
  }

  // Starfield drift
  const stars = scene.getObjectByName("starfield");
  if (stars) stars.rotation.y += dt * 0.002;

  // Sun corona spin + pulse
  const sun = entityMap.get("sun");
  if (sun) {
    sun.mesh.rotation.y += dt * 0.04;
    if (sun.corona) sun.corona.rotation.y -= dt * 0.02;
    if (sun.glowSprite) {
      const pulse = 1 + Math.sin(performance.now() * 0.0015) * 0.04;
      const base = sun.data.size * 6.5;
      sun.glowSprite.scale.set(base * pulse, base * pulse, 1);
    }
  }

  updateFloatLabelPosition();

  controls.update();
  composer.render();
}

boot();
