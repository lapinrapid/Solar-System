# Cosmos — Solar System Simulation

A beautiful Three.js simulation of the solar system with adjustable time scale, Keplerian orbits, starfield, asteroid belt, and a modern glass HUD.

## Location

`C:\Users\nicvo\Projects\GROK PROJECTS\universe-simulation`

## How to run

Browsers block ES modules from `file://`. Serve the folder with any static server:

### Option A — Python

```powershell
cd "C:\Users\nicvo\Projects\GROK PROJECTS\universe-simulation"
python -m http.server 5173
```

Open [http://localhost:5173](http://localhost:5173)

### Option B — Node (if installed)

```powershell
npx --yes serve .
```

### Option C — VS Code / Cursor

Use the “Live Server” extension and open `index.html`.

## Controls

| Action | How |
|--------|-----|
| Orbit camera | Drag |
| Zoom | Scroll |
| Focus body | Click planet or chip |
| Pause | Space or ▶ button |
| Time scale | Slider or Hour / Day / Month / Year / Decade |
| Toggles | Orbits · Labels · Trails · Asteroid belt |

## Features

- Sun + 8 planets with NASA-sourced 2K textures (Solar System Scope maps)
- Glowing Sun with corona, bloom, and soft billboard halo
- Earth’s Moon with texture and orbit
- Saturn’s rings with alpha ring map
- **Tesla Roadster (Starman)** in a slightly elliptical orbit around Mars
- Hover / click floating labels (incl. Roadster name)
- 12k+ procedural starfield + milky band
- Asteroid belt between Mars and Jupiter
- Bloom post-processing
- Time scale slider + presets: Real · Hour · Day · Week · Month · Year · Decade
- Focus camera tracking via chips or click

## Notes

Distances and sizes are **visually scaled** so the system stays readable. Orbital periods and day lengths use realistic values so relative motion feels right.

Planet maps are free textures from [Solar System Scope](https://www.solarsystemscope.com/textures/) (based on NASA / USGS imagery), stored under `textures/`.
