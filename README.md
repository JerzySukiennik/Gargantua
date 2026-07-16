# GARGANTUA

Co-op zero-G EVA sandbox in the browser. Crawl hand-over-hand across a derelict deep-field station orbiting an Interstellar-style black hole. Explore, discover its secrets, and try not to drift away.

**Play:** https://jerzysukiennik.github.io/Gargantua/

## Features

- First-person zero-G movement: grab the hull, reel your tether, hand-swing, push off and drift
- Analytic gravitational-lensing black hole shader (no raymarching, no post-processing)
- Co-op multiplayer for up to 4 players via room codes (Firebase Realtime Database)
- Suit systems: oxygen, power, suit integrity, hull temperature — with refill stations on the hull
- 12 points of interest and secrets, discoveries shared with your crew
- Streamed ambient soundtrack and CC0 sound effects

## Controls

| Key | Action |
| --- | --- |
| Mouse | Look (pointer lock) |
| LMB (hold) | Grab hull / crawl |
| W / S | Reel tether in / out (while grabbing) |
| A / D | Hand-swing (while grabbing) |
| Space | Push off (while grabbing) |
| Shift + WASD / Space / C | RCS thrusters |
| Q / E | Roll |
| F | Use station (refill / repair) |
| L | Headlamp |
| R (hold) | Auto-return when adrift |
| Tab | Suit log |

## Tech

three.js (ES modules from CDN, no build step), custom GLSL black hole, custom sphere-vs-AABB collision with a spatial hash, Firebase RTDB netcode with snapshot interpolation. Runs as static files — `python3 Niepotrzebne/devserver.py` for local dev.

## Credits

- 3D models & SFX: [Kenney](https://kenney.nl) (CC0) — see [LICENSES.md](LICENSES.md)
- Music: "Frozen Star" by Kevin MacLeod ([incompetech.com](https://incompetech.com)), CC BY 4.0
