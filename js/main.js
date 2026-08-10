import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { AU, bodies } from "./data.js";

// ─────────────────────────────────────────────
// Constants & state
// ─────────────────────────────────────────────

const HOURS_PER_DAY = 24;
/** Slider maps 0–100 → days-per-second (log scale). */
const SPEED_MIN = 0.001; // days / sec
const SPEED_MAX = 50; // days / sec

const state = {
  paused: false,
  /** Simulated days advanced per real second. */
  daysPerSecond: 1,
  simDays: 0,
  showOrbits: true,
  showLabels: true,
  showTrails: false,
  showAsteroids: true,
  focusId: "sun",
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
renderer.toneMappingExposure = 1.05;
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
controls.minDistance = 4;
controls.maxDistance = 900;
controls.maxPolarAngle = Math.PI * 0.95;
controls.target.set(0, 0, 0);
controls.update();

// Soft ambient so dark sides of planets stay readable
scene.add(new THREE.AmbientLight(0x1a1e2e, 0.55));
scene.add(new THREE.HemisphereLight(0x9bb8ff, 0x08060a, 0.25));

// ─────────────────────────────────────────────
// Post-processing (bloom for stars / sun)
// ─────────────────────────────────────────────

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.55,
  0.55,
  0.82
);
composer.addPass(bloom);
composer.addPass(new OutputPass());

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
    // Spherical shell distribution
    const r = 400 + Math.random() * 1400;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);

    // Subtle color temperature variation
    const t = Math.random();
    if (t < 0.15) color.setHSL(0.6, 0.4, 0.85); // blue-white
    else if (t < 0.3) color.setHSL(0.08, 0.5, 0.9); // warm
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

  // Distant milky-way-ish dust band
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
// Procedural planet textures (canvas)
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

  // Noise blotches
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

  // Horizontal bands (gas giants)
  if (options.bands) {
    for (let y = 0; y < size; y += 6 + Math.random() * 14) {
      const h = 3 + Math.random() * 10;
      const c = base.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.2);
      ctx.fillStyle = `rgba(${(c.r * 255) | 0},${(c.g * 255) | 0},${(c.b * 255) | 0},0.35)`;
      ctx.fillRect(0, y, size, h);
    }
  }

  // Earth-like continents
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
    // Polar ice
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
  // Cassini division
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.4, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(0,0,0,0.85)";
  ctx.lineWidth = 6;
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ─────────────────────────────────────────────
// Orbit helpers (Kepler-ish elliptical path)
// ─────────────────────────────────────────────

/**
 * Mean anomaly → eccentric anomaly (Newton) → true anomaly + radius.
 * a = semi-major axis (scene units), e = eccentricity, M = mean anomaly rad.
 */
function keplerPosition(a, e, M) {
  // Normalize M
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

function createOrbitLine(a, e, inclinationDeg, color = 0x6b8cae) {
  const pts = [];
  const segments = 256;
  const inc = THREE.MathUtils.degToRad(inclinationDeg || 0);
  for (let i = 0; i <= segments; i++) {
    const M = (i / segments) * Math.PI * 2;
    const { x, z } = keplerPosition(a, e, M);
    // Inclination about x
    const y = z * Math.sin(inc);
    const zz = z * Math.cos(inc);
    pts.push(new THREE.Vector3(x, y, zz));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });
  const line = new THREE.LineLoop(geo, mat);
  line.userData.isOrbit = true;
  return line;
}

// ─────────────────────────────────────────────
// Build solar system
// ─────────────────────────────────────────────

const systemRoot = new THREE.Group();
scene.add(systemRoot);

const entityMap = new Map(); // id → { group, mesh, data, moons, trail }
const labelSprites = [];
const clickables = []; // meshes for raycasting
const orbitLines = [];
const trailPositions = new Map(); // id → Vector3[]

function createLabelSprite(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, 256, 64);
  ctx.font = "600 28px DM Sans, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  const tw = ctx.measureText(text).width;
  roundRect(ctx, 128 - tw / 2 - 14, 14, tw + 28, 36, 10);
  ctx.fill();
  ctx.fillStyle = "rgba(242,244,248,0.92)";
  ctx.fillText(text, 128, 32);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    depthTest: true,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(6, 1.5, 1);
  sprite.userData.isLabel = true;
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

  const geo = new THREE.SphereGeometry(data.size, 64, 64);
  const mat = new THREE.MeshBasicMaterial({ color: data.color });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.bodyId = data.id;
  group.add(mesh);

  // Glow shells
  const glowGeo = new THREE.SphereGeometry(data.size * 1.15, 32, 32);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xffaa33,
    transparent: true,
    opacity: 0.18,
    side: THREE.BackSide,
    depthWrite: false,
  });
  group.add(new THREE.Mesh(glowGeo, glowMat));

  const outerGlow = new THREE.Mesh(
    new THREE.SphereGeometry(data.size * 1.55, 32, 32),
    new THREE.MeshBasicMaterial({
      color: 0xff8800,
      transparent: true,
      opacity: 0.07,
      side: THREE.BackSide,
      depthWrite: false,
    })
  );
  group.add(outerGlow);

  const light = new THREE.PointLight(0xfff0d0, 2.8, 0, 0.35);
  light.position.set(0, 0, 0);
  group.add(light);

  // Corona particles
  const coronaCount = 800;
  const cPos = new Float32Array(coronaCount * 3);
  for (let i = 0; i < coronaCount; i++) {
    const r = data.size * (1.05 + Math.random() * 0.9);
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
      size: 0.12,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  group.add(corona);

  systemRoot.add(group);
  clickables.push(mesh);

  const label = createLabelSprite(data.name);
  label.position.set(0, data.size + 2.2, 0);
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
  });
}

function buildPlanet(data) {
  const a = data.distanceAU * AU;
  const group = new THREE.Group();
  group.name = data.id;

  const isGas = data.id === "jupiter" || data.id === "saturn";
  const tex = makePlanetTexture(data.color, {
    bands: isGas || data.id === "uranus" || data.id === "neptune",
    landHex: data.landColor,
  });

  const geo = new THREE.SphereGeometry(data.size, 48, 48);
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: isGas ? 0.75 : 0.55,
    metalness: 0.05,
    emissive: data.color,
    emissiveIntensity: 0.03,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.bodyId = data.id;
  mesh.rotation.z = THREE.MathUtils.degToRad(data.axialTilt || 0);
  group.add(mesh);

  if (data.hasAtmosphere) {
    const atm = new THREE.Mesh(
      new THREE.SphereGeometry(data.size * 1.045, 32, 32),
      new THREE.MeshBasicMaterial({
        color: 0x7dd3fc,
        transparent: true,
        opacity: 0.12,
        side: THREE.BackSide,
        depthWrite: false,
      })
    );
    group.add(atm);
  }

  if (data.hasRings) {
    const ringTex = makeRingTexture();
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(data.size * 1.4, data.size * 2.35, 96),
      new THREE.MeshBasicMaterial({
        map: ringTex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      })
    );
    ring.rotation.x = Math.PI / 2;
    ring.rotation.z = THREE.MathUtils.degToRad(data.axialTilt || 0);
    group.add(ring);
  }

  // Moons
  const moonEntities = [];
  if (data.moons) {
    for (const m of data.moons) {
      const moonGroup = new THREE.Group();
      const moonMesh = new THREE.Mesh(
        new THREE.SphereGeometry(m.size, 24, 24),
        new THREE.MeshStandardMaterial({
          color: m.color,
          roughness: 0.9,
          metalness: 0.05,
        })
      );
      moonMesh.userData.bodyId = m.id;
      moonGroup.add(moonMesh);

      const moonOrbit = createOrbitLine(m.distance, 0.05, 5.1, 0x8899aa);
      moonOrbit.material.opacity = 0.18;
      group.add(moonOrbit);
      orbitLines.push(moonOrbit);

      group.add(moonGroup);
      moonEntities.push({
        group: moonGroup,
        mesh: moonMesh,
        data: m,
        distance: m.distance,
        periodDays: m.periodDays,
        meanAnomaly0: Math.random() * Math.PI * 2,
      });
      clickables.push(moonMesh);
    }
  }

  // Place on orbit
  const meanAnomaly0 = Math.random() * Math.PI * 2;
  const meanMotion = (Math.PI * 2) / data.periodDays; // rad per day
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
  // Scale labels by distance a bit
  const labelScale = 4 + data.distanceAU * 0.15;
  label.scale.set(labelScale, labelScale * 0.25, 1);
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

  // Trail buffer
  trailPositions.set(data.id, []);
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
    arr.push(entity.group.position.clone());
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

    // Spin
    if (data.spinHours) {
      const revolutionsPerDay = HOURS_PER_DAY / Math.abs(data.spinHours);
      const spin = revolutionsPerDay * Math.PI * 2 * dtDays;
      mesh.rotation.y += data.spinHours < 0 ? -spin : spin;
    }

    if (data.isStar) continue;

    // Orbit: advance mean anomaly
    entity.meanAnomaly0 += entity.meanMotion * dtDays;
    const { x, z } = keplerPosition(entity.a, entity.e, entity.meanAnomaly0);
    const inc = THREE.MathUtils.degToRad(entity.inclination);
    entity.group.position.set(x, z * Math.sin(inc), z * Math.cos(inc));

    // Moons
    for (const moon of moons) {
      const n = (Math.PI * 2) / moon.periodDays;
      moon.meanAnomaly0 += n * dtDays;
      const mp = keplerPosition(moon.distance, 0.05, moon.meanAnomaly0);
      const minc = 0.09;
      moon.group.position.set(mp.x, mp.z * Math.sin(minc), mp.z * Math.cos(minc));
      if (moon.data.spinHours) {
        const rev = HOURS_PER_DAY / Math.abs(moon.data.spinHours);
        moon.mesh.rotation.y += rev * Math.PI * 2 * dtDays;
      }
    }
  }
}

// ─────────────────────────────────────────────
// Camera focus
// ─────────────────────────────────────────────

const focusOffset = new THREE.Vector3(0, 0, 0);

function getFocusWorldPosition(id) {
  const entity = entityMap.get(id);
  if (!entity) return new THREE.Vector3();
  const v = new THREE.Vector3();
  entity.mesh.getWorldPosition(v);
  return v;
}

function getBodyWorldPosition(id) {
  if (id === "moon") {
    const earth = entityMap.get("earth");
    if (earth?.moons?.[0]) {
      const v = new THREE.Vector3();
      earth.moons[0].mesh.getWorldPosition(v);
      return v;
    }
  }
  return getFocusWorldPosition(id);
}

function getFocusDistance(id) {
  if (id === "moon") return 8;
  const entity = entityMap.get(id);
  if (!entity) return 40;
  if (entity.data.isStar) return 55;
  return Math.max(entity.data.size * 9, 10) + entity.data.distanceAU * 0.4;
}

function focusOn(id) {
  // Resolve moon via earth
  if (id === "moon") {
    const earth = entityMap.get("earth");
    if (earth?.moons?.[0]) {
      state.focusId = "moon";
      updateInfoPanel({
        id: "moon",
        name: "Moon",
        type: "Natural satellite of Earth",
        blurb: "Tidally locked companion — one face always toward Earth.",
        radiusKm: "1,737 km",
        dayLength: "27.3 d",
        periodDays: 27.3,
        distanceLabel: "0.0026 AU",
      });
      setActiveChip(null);
      frameCameraOn(id);
      return;
    }
  }

  const data = bodies.find((b) => b.id === id);
  if (!data) return;
  state.focusId = id;
  updateInfoPanel(data);
  setActiveChip(id);
  frameCameraOn(id);
}

function frameCameraOn(id) {
  const target = getBodyWorldPosition(id);
  if (!target) return;

  const dist = getFocusDistance(id);
  let dir = new THREE.Vector3().subVectors(camera.position, controls.target);
  if (dir.lengthSq() < 0.0001) dir.set(0.55, 0.4, 0.75);
  dir.normalize();

  // Prefer a slightly elevated view
  dir.y = Math.max(dir.y, 0.25);
  dir.normalize();

  focusOffset.copy(dir.multiplyScalar(dist));
  controls.target.copy(target);
  state.currentFocusPos.copy(target);
  state.targetFocusPos.copy(target);
  camera.position.copy(target).add(focusOffset);
  controls.update();
}

function updateInfoPanel(data) {
  bodyNameEl.textContent = data.name;
  bodyTypeEl.textContent = data.type;
  bodyBlurbEl.textContent = data.blurb || "";
  infoRadius.textContent = data.radiusKm || "—";
  infoDay.textContent = data.dayLength || "—";
  infoPeriod.textContent =
    data.periodDays != null
      ? data.periodDays >= 365
        ? `${(data.periodDays / 365.25).toFixed(2)} yr`
        : `${data.periodDays.toFixed(1)} d`
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
  }
}

// ─────────────────────────────────────────────
// Time scale mapping
// ─────────────────────────────────────────────

function sliderToDaysPerSecond(v) {
  // log scale from SPEED_MIN to SPEED_MAX
  const t = Number(v) / 100;
  return SPEED_MIN * Math.pow(SPEED_MAX / SPEED_MIN, t);
}

function daysPerSecondToSlider(dps) {
  const t =
    Math.log(dps / SPEED_MIN) / Math.log(SPEED_MAX / SPEED_MIN);
  return Math.max(0, Math.min(100, t * 100));
}

function formatSpeed(dps) {
  if (dps < 0.01) return `${(dps * 24).toFixed(2)} h/s`;
  if (dps < 1) return `${(dps * 24).toFixed(1)} h/s`;
  if (dps < 30) return `${dps.toFixed(dps < 10 ? 1 : 0)} d/s`;
  if (dps < 365) return `${(dps / 30.44).toFixed(1)} mo/s`;
  return `${(dps / 365.25).toFixed(2)} yr/s`;
}

function formatSimDate(days) {
  const year = Math.floor(days / 365.25);
  const dayOfYear = Math.floor(days % 365.25);
  return `Day ${dayOfYear} · Year ${year}`;
}

function setDaysPerSecond(dps, { syncSlider = true, syncPresets = true } = {}) {
  state.daysPerSecond = THREE.MathUtils.clamp(dps, SPEED_MIN, SPEED_MAX);
  speedDisplayEl.textContent = `${formatMultiplier(state.daysPerSecond)}`;
  timeScaleLabel.textContent = formatSpeed(state.daysPerSecond);
  if (syncSlider) {
    timeScaleInput.value = String(daysPerSecondToSlider(state.daysPerSecond));
  }
  if (syncPresets) {
    const nearest = [...presets].reduce((best, p) => {
      const s = Number(p.dataset.speed);
      return Math.abs(s - state.daysPerSecond) <
        Math.abs(Number(best.dataset.speed) - state.daysPerSecond)
        ? p
        : best;
    });
    presets.forEach((p) =>
      p.classList.toggle("active", p === nearest && Math.abs(Number(p.dataset.speed) - state.daysPerSecond) < state.daysPerSecond * 0.35 + 0.5)
    );
  }
}

function formatMultiplier(dps) {
  // Relative to 1 day/sec baseline for display
  if (dps >= 1) return `${dps < 10 ? dps.toFixed(1) : Math.round(dps)}×`;
  return `${dps.toFixed(2)}×`;
}

// ─────────────────────────────────────────────
// Raycasting
// ─────────────────────────────────────────────

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function onPointerDown(event) {
  // Ignore UI clicks
  if (event.target !== renderer.domElement) return;
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(clickables, false);
  if (hits.length) {
    const id = hits[0].object.userData.bodyId;
    if (id) focusOn(id);
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

  // Default: ~1 day per second via preset "Day" is 1, Month is 30
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
    controls.update();
  });

  document.getElementById("toggle-orbits").addEventListener("change", (e) => {
    state.showOrbits = e.target.checked;
    orbitLines.forEach((l) => (l.visible = state.showOrbits));
  });
  document.getElementById("toggle-labels").addEventListener("change", (e) => {
    state.showLabels = e.target.checked;
    labelSprites.forEach((s) => (s.visible = state.showLabels));
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

createStarfield();

for (const b of bodies) {
  if (b.isStar) buildSun(b);
  else buildPlanet(b);
}

const asteroidBelt = buildAsteroidBelt();
wireUI();

// Activate Month preset as a nice default showcase
setDaysPerSecond(30);
presets.forEach((p) =>
  p.classList.toggle("active", Number(p.dataset.speed) === 30)
);

// Fade out loader
requestAnimationFrame(() => {
  loadingEl.classList.add("done");
});

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
  }

  // Focus tracking
  let focusPos;
  if (state.focusId === "moon") {
    const earth = entityMap.get("earth");
    if (earth?.moons?.[0]) {
      focusPos = new THREE.Vector3();
      earth.moons[0].mesh.getWorldPosition(focusPos);
    }
  } else {
    focusPos = getFocusWorldPosition(state.focusId);
  }

  if (focusPos) {
    state.targetFocusPos.copy(focusPos);
    state.currentFocusPos.lerp(state.targetFocusPos, 1 - Math.pow(0.001, dt));
    const prev = controls.target.clone();
    controls.target.lerp(state.currentFocusPos, 1 - Math.pow(0.0008, dt));
    const delta = controls.target.clone().sub(prev);
    camera.position.add(delta);
  }

  // Slow starfield drift
  const stars = scene.getObjectByName("starfield");
  if (stars) stars.rotation.y += dt * 0.002;

  // Gentle sun corona spin
  const sun = entityMap.get("sun");
  if (sun) {
    sun.mesh.rotation.y += dt * 0.05;
  }

  controls.update();
  composer.render();
}

animate();
