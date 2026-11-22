# SUNBURN CITY

[![make.fun gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/yawmn/sunburn-city/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/yawmn/sunburn-city/reward.svg)](https://make.fun/bounty/gta6-01)

An original open-world crime game set in a sun-soaked 1980s coastal city, built as a
single-page, fully offline Canvas 2D game. No engine, no libraries, no assets: the city,
the people, the cars and the light are all drawn from code.

## The city

A procedurally generated 4400 x 3200 coastal city: a beachfront boulevard of palms and
art-deco hotels, a downtown of coral and mint towers with rooftop plant, a marina, a park,
low-rise shop blocks with neon signs, and a turquoise ocean with moving surf. The same seed
always builds the same city.

## What you can do

- **On foot** — walk, sprint, shove and fight through crowds of pedestrians who chat, cross
  at the kerb and panic when shots are fired.
- **Driving** — take any car in the city. Arcade handling with a handbrake drift, tyre
  marks, damage and engine smoke. Traffic keeps its lane, brakes for the car ahead and
  honks when you cut it off. Pull a driver out and the car is yours.
- **Heat** — a five-star wanted level brings cruisers that ram and PIT, officers who get out
  and shoot, and roadblocks at four stars. Lose them out of sight and the stars cool down.
- **Combat** — fists, a pistol and an SMG with tracers, muzzle flash, casings, impacts and
  exploding cars, plus drive-by fire from the driver's window.
- **Missions** — four story jobs (SUNSET VICE, HEAT ON OCEAN DRIVE, SYNDICATE TAKEDOWN,
  SUNBURN ESCAPE) with briefings, ordered objectives, pulsing world waypoints, a screen-edge
  guidance arrow, an objective panel, cash rewards and a completion banner. Beat one and the
  next starts; the city remembers your money.
- **The city keeps living** — day-to-night light, a minimap with traffic and police blips,
  health, armour, money, weapon and radio HUD.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move, drive, steer |
| Shift | Sprint (on foot) |
| E | Enter or leave the nearest car |
| Space | Handbrake drift |
| Mouse / click | Aim and fire |
| 1 / 2 / 3 or Q | Fists / pistol / SMG |
| R | Reload |
| P | Pause |
| Esc | Back to the title |

## Run it

The game is plain static files; any static server works:

```
node serve.ts          # http://localhost:8080
```

For the competition's own packaging:

```
MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` (Node 22+, standard library only) copies `game/` and `screenshots/` into the
output directory and writes `dossier.json` with the vendored make.fun helper.
