/**
 * Solar system body data.
 * Distances & sizes are visual (not true-to-scale) so orbits remain readable.
 * Orbital periods (days) and spin (hours) are realistic.
 * Textures: Solar System Scope maps (based on NASA / USGS imagery).
 */

export const AU = 28; // scene units per AU (Mercury ~0.39 → ~11 units)

/** Local texture paths (Solar System Scope 2K, NASA-sourced maps). */
export const TEXTURES = {
  sun: "./textures/2k_sun.jpg",
  mercury: "./textures/2k_mercury.jpg",
  venus: "./textures/2k_venus_atmosphere.jpg",
  earth: "./textures/2k_earth_daymap.jpg",
  earthClouds: "./textures/2k_earth_clouds.jpg",
  moon: "./textures/2k_moon.jpg",
  mars: "./textures/2k_mars.jpg",
  jupiter: "./textures/2k_jupiter.jpg",
  saturn: "./textures/2k_saturn.jpg",
  saturnRing: "./textures/2k_saturn_ring_alpha.png",
  uranus: "./textures/2k_uranus.jpg",
  neptune: "./textures/2k_neptune.jpg",
};

export const bodies = [
  {
    id: "sun",
    name: "Sol",
    type: "G-type main-sequence star",
    blurb:
      "The Sun holds 99.8% of the solar system’s mass and drives the orbits of every planet.",
    radiusKm: "695,700 km",
    dayLength: "25.4 d",
    periodDays: null,
    distanceAU: 0,
    distanceLabel: "—",
    size: 5.2,
    color: 0xffc14a,
    emissive: 0xffaa22,
    spinHours: 609.12,
    inclination: 0,
    eccentricity: 0,
    axialTilt: 7.25,
    isStar: true,
    texture: "sun",
  },
  {
    id: "mercury",
    name: "Mercury",
    type: "Terrestrial planet",
    blurb:
      "Smallest planet, extreme temperature swings, and a slow day longer than its year.",
    radiusKm: "2,440 km",
    dayLength: "58.6 d",
    periodDays: 87.97,
    distanceAU: 0.39,
    distanceLabel: "0.39 AU",
    size: 0.55,
    color: 0xb5b5b5,
    spinHours: 1407.6,
    inclination: 7.0,
    eccentricity: 0.206,
    axialTilt: 0.03,
    texture: "mercury",
  },
  {
    id: "venus",
    name: "Venus",
    type: "Terrestrial planet",
    blurb:
      "Earth’s twin in size, shrouded in a toxic atmosphere with runaway greenhouse heat.",
    radiusKm: "6,052 km",
    dayLength: "243 d (retrograde)",
    periodDays: 224.7,
    distanceAU: 0.72,
    distanceLabel: "0.72 AU",
    size: 0.95,
    color: 0xe8cda0,
    spinHours: -5832.5,
    inclination: 3.4,
    eccentricity: 0.007,
    axialTilt: 177.4,
    texture: "venus",
  },
  {
    id: "earth",
    name: "Earth",
    type: "Terrestrial planet · habitable",
    blurb:
      "Our blue marble — liquid water, life, and a single large moon that stabilizes our tilt.",
    radiusKm: "6,371 km",
    dayLength: "23.9 h",
    periodDays: 365.25,
    distanceAU: 1.0,
    distanceLabel: "1.00 AU",
    size: 1.0,
    color: 0x3b82f6,
    landColor: 0x22c55e,
    spinHours: 23.93,
    inclination: 0,
    eccentricity: 0.017,
    axialTilt: 23.44,
    hasAtmosphere: true,
    texture: "earth",
    cloudTexture: "earthClouds",
    moons: [
      {
        id: "moon",
        name: "Moon",
        type: "Natural satellite of Earth",
        blurb:
          "Tidally locked companion — one face always toward Earth. Formed from a giant impact ~4.5 billion years ago.",
        radiusKm: "1,737 km",
        dayLength: "27.3 d",
        periodDays: 27.3,
        distanceLabel: "384,400 km · 0.0026 AU",
        size: 0.27,
        distance: 2.4,
        color: 0xc8c8c8,
        spinHours: 655.7,
        texture: "moon",
      },
    ],
  },
  {
    id: "mars",
    name: "Mars",
    type: "Terrestrial planet",
    blurb:
      "The red planet — thin air, polar ice, and the tallest volcano in the solar system. Home to a red Roadster.",
    radiusKm: "3,390 km",
    dayLength: "24.6 h",
    periodDays: 686.98,
    distanceAU: 1.52,
    distanceLabel: "1.52 AU",
    size: 0.7,
    color: 0xc45c3e,
    spinHours: 24.62,
    inclination: 1.85,
    eccentricity: 0.094,
    axialTilt: 25.19,
    texture: "mars",
  },
  {
    id: "jupiter",
    name: "Jupiter",
    type: "Gas giant",
    blurb:
      "King of planets — a failed star’s mass of hydrogen and helium with a raging Great Red Spot.",
    radiusKm: "69,911 km",
    dayLength: "9.9 h",
    periodDays: 4332.59,
    distanceAU: 5.2,
    distanceLabel: "5.20 AU",
    size: 2.8,
    color: 0xd4a574,
    bandColor: 0xc49a6c,
    spinHours: 9.93,
    inclination: 1.3,
    eccentricity: 0.049,
    axialTilt: 3.13,
    texture: "jupiter",
  },
  {
    id: "saturn",
    name: "Saturn",
    type: "Gas giant · ringed",
    blurb:
      "Iconic rings of ice and rock encircle a low-density world that could float in water.",
    radiusKm: "58,232 km",
    dayLength: "10.7 h",
    periodDays: 10759.22,
    distanceAU: 9.58,
    distanceLabel: "9.58 AU",
    size: 2.4,
    color: 0xe8d5a3,
    spinHours: 10.66,
    inclination: 2.49,
    eccentricity: 0.057,
    axialTilt: 26.73,
    hasRings: true,
    texture: "saturn",
    ringTexture: "saturnRing",
  },
  {
    id: "uranus",
    name: "Uranus",
    type: "Ice giant",
    blurb:
      "An ice giant tipped on its side — seasons last for decades under a pale cyan haze.",
    radiusKm: "25,362 km",
    dayLength: "17.2 h",
    periodDays: 30688.5,
    distanceAU: 19.2,
    distanceLabel: "19.2 AU",
    size: 1.55,
    color: 0x7dd3c0,
    spinHours: -17.24,
    inclination: 0.77,
    eccentricity: 0.046,
    axialTilt: 97.77,
    texture: "uranus",
  },
  {
    id: "neptune",
    name: "Neptune",
    type: "Ice giant",
    blurb:
      "Farthest known major planet — deep blue, fierce winds, and a dark storm system.",
    radiusKm: "24,622 km",
    dayLength: "16.1 h",
    periodDays: 60182,
    distanceAU: 30.05,
    distanceLabel: "30.05 AU",
    size: 1.5,
    color: 0x3b6fd4,
    spinHours: 16.11,
    inclination: 1.77,
    eccentricity: 0.011,
    axialTilt: 28.32,
    texture: "neptune",
  },
];

/**
 * Fake satellite of Mars: Elon Musk's Tesla Roadster with Starman.
 * Slightly elliptical orbit around Mars for the simulation.
 */
export const roadster = {
  id: "roadster",
  name: "Tesla Roadster (Starman)",
  shortName: "Roadster",
  type: "Spacecraft · Falcon Heavy payload",
  blurb:
    "A cherry-red Tesla Roadster launched by SpaceX in 2018, with a spacesuit mannequin “Starman” at the wheel. In this sim it cruises a gentle ellipse around Mars.",
  radiusKm: "4 m (car)",
  dayLength: "—",
  periodDays: 0.85,
  distanceLabel: "Mars orbit · elliptical",
  // Relative to Mars
  distance: 1.85,
  eccentricity: 0.22,
  inclination: 12,
  size: 0.12,
  color: 0xcc0000,
  spinHours: 2.5,
  parentId: "mars",
};

export function bodyById(id) {
  if (id === "roadster") return roadster;
  if (id === "moon") {
    const earth = bodies.find((b) => b.id === "earth");
    return earth?.moons?.[0] ?? null;
  }
  return bodies.find((b) => b.id === id);
}
