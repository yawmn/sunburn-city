// Deterministic 1980s Sunburn City generator (~4400x3200 world).
// Builds street grid, art-deco downtown, beachfront boulevard, beach, ocean, marina,
// park, industrial warehouse district, strip malls, props, solids, and prerendered ground layer.

import { createRng, intRange } from './rng.js';

export const WORLD_W = 4400;
export const WORLD_H = 3200;

export function createCity(seed = 1) {
  const rng = createRng(seed);

  // 1. Geography definitions
  // East edge (~700 px total):
  // Beachfront Boulevard (Ocean Drive): X = 3480 to 3560 (80 px wide)
  // Beach promenade sidewalk: X = 3560 to 3600 (40 px wide)
  // Sandy Beach: X = 3600 to 3980 (380 px wide)
  // Ocean: X = 3980 to 4400 (420 px wide)
  const OCEAN_X = 3980;
  const BEACH_X = 3600;
  const PROMENADE_X = 3560;
  const BOULEVARD_X = 3520;

  // Street Grid Coordinates
  // Avenues (North-South): 8 avenues
  const avenues = [140, 600, 1080, 1560, 2040, 2520, 3000, BOULEVARD_X];
  // Streets (East-West): 8 streets
  const streets = [120, 540, 980, 1420, 1860, 2300, 2740, 3100];

  const ROAD_W = 64;
  const BLVD_W = 80;
  const SIDEWALK_W = 20;

  // Roads list for renderer & minimap
  const roads = [];
  // Avenues (vertical)
  for (let i = 0; i < avenues.length; i++) {
    const cx = avenues[i];
    const w = (i === avenues.length - 1) ? BLVD_W : ROAD_W;
    roads.push({
      x: cx - w / 2,
      y: 0,
      w,
      h: WORLD_H,
      dir: 'v',
      isBlvd: i === avenues.length - 1,
    });
  }
  // Streets (horizontal)
  for (let j = 0; j < streets.length; j++) {
    const cy = streets[j];
    roads.push({
      x: 0,
      y: cy - ROAD_W / 2,
      w: PROMENADE_X,
      h: ROAD_W,
      dir: 'h',
      isBlvd: false,
    });
  }

  // Marina definition (North-East: inside block col 5-6, row 0-1)
  const marina = {
    x: 3060,
    y: 160,
    w: 420,
    h: 340,
    piers: [
      { x: 3120, y: 160, w: 24, h: 260 },
      { x: 3240, y: 160, w: 24, h: 260 },
      { x: 3360, y: 160, w: 24, h: 260 },
    ],
    boats: [],
  };

  // Populate marina boats
  const boatColors = ['#f8f9fa', '#e63946', '#1d3557', '#457b9d', '#ffb703', '#2a9d8f'];
  for (const pier of marina.piers) {
    // 2 boats per pier
    marina.boats.push({
      x: pier.x - 30,
      y: pier.y + 60,
      w: 22,
      h: 46,
      color: rng.pick(boatColors),
      accent: rng.pick(boatColors),
    });
    marina.boats.push({
      x: pier.x + 32,
      y: pier.y + 140,
      w: 22,
      h: 46,
      color: rng.pick(boatColors),
      accent: rng.pick(boatColors),
    });
  }

  // Park definition (Central park at Col 2, Row 3)
  const park = {
    col: 2,
    row: 3,
    x: avenues[2] + ROAD_W / 2 + SIDEWALK_W + 4,
    y: streets[3] + ROAD_W / 2 + SIDEWALK_W + 4,
    w: (avenues[3] - ROAD_W / 2 - SIDEWALK_W - 4) - (avenues[2] + ROAD_W / 2 + SIDEWALK_W + 4),
    h: (streets[4] - ROAD_W / 2 - SIDEWALK_W - 4) - (streets[3] + ROAD_W / 2 + SIDEWALK_W + 4),
    fountain: {
      x: 0,
      y: 0,
      radius: 36,
    },
  };
  park.fountain.x = park.x + park.w / 2;
  park.fountain.y = park.y + park.h / 2;

  // City Blocks and Buildings
  const buildings = [];
  const solids = []; // Collision bounding boxes
  const parkingLots = [];

  const artDecoColors = [
    '#ff6f61', // Coral
    '#ff4d94', // Hot pink
    '#5fd1b2', // Mint turquoise
    '#f7efe0', // Cream
    '#fbb084', // Peach
    '#74c0fc', // Pastel blue
    '#d8b4e2', // Lavender
  ];

  const industrialColors = ['#8a8f98', '#9d9489', '#788086', '#6c757d', '#b0a498'];

  const neonNames = [
    'HOTEL DEL SOL',
    'THE FLAMINGO',
    'STARLITE',
    'VICE PALMS',
    'THE MARLIN',
    'CABANA CLUB',
    'SUNSET CASINO',
    'OCEAN BREEZE',
    'NEON DREAMS',
    'CORAL SANDS',
  ];

  const shopNames = [
    'VICE LIQUOR',
    'QUICK STOP',
    'GUNS & AMMO',
    'SURF & SUN',
    'DINER 24H',
    'MOTEL 8',
    'AUTO REPAIR',
  ];

  // Helper for solids collision
  function addSolid(x, y, w, h) {
    solids.push({ x, y, w, h });
  }

  // Generate blocks
  for (let c = 0; c < avenues.length - 1; c++) {
    for (let r = 0; r < streets.length - 1; r++) {
      // Skip marina block (col 5-6, row 0)
      if ((c === 5 || c === 6) && r === 0) continue;
      // Skip park block
      if (c === park.col && r === park.row) continue;

      const left = avenues[c] + ((c === avenues.length - 2) ? BLVD_W / 2 : ROAD_W / 2) + SIDEWALK_W + 4;
      const right = avenues[c + 1] - ((c + 1 === avenues.length - 1) ? BLVD_W / 2 : ROAD_W / 2) - SIDEWALK_W - 4;
      const top = streets[r] + ROAD_W / 2 + SIDEWALK_W + 4;
      const bottom = streets[r + 1] - ROAD_W / 2 - SIDEWALK_W - 4;

      const blockW = right - left;
      const blockH = bottom - top;
      if (blockW < 80 || blockH < 80) continue;

      const isDowntown = (c >= 3 && c <= 6 && r >= 2 && r <= 5);
      const isOceanDriveFront = (c === 6);
      const isIndustrial = (c <= 1 && r >= 1 && r <= 4);
      const isStripMall = (r >= 5 || (c <= 2 && r >= 4));

      // Industrial / Warehouses / Parking lots
      if (isIndustrial && rng.chance(0.45)) {
        // Parking lot + warehouse
        parkingLots.push({ x: left, y: top, w: blockW, h: blockH * 0.45 });
        const bH = blockH * 0.48;
        const bW = blockW;
        const by = top + blockH * 0.52;
        const building = {
          x: left,
          y: by,
          w: bW,
          h: bH,
          height: rng.range(35, 55),
          color: rng.pick(industrialColors),
          trimColor: '#495057',
          roofColor: '#4f555e',
          type: 'warehouse',
          neon: null,
          roofClutter: [
            { type: 'ac', rx: 20, ry: 15, rw: 24, rh: 16 },
            { type: 'vent', rx: bW - 40, ry: 20, rw: 16, rh: 16 },
          ],
        };
        buildings.push(building);
        addSolid(building.x, building.y, building.w, building.h);
        continue;
      }

      // Divide block into 2 to 4 buildings
      const splitCols = (blockW > 280) ? (isDowntown ? 3 : 2) : 2;
      const splitRows = (blockH > 260) ? 2 : 1;
      const subW = blockW / splitCols;
      const subH = blockH / splitRows;

      for (let sc = 0; sc < splitCols; sc++) {
        for (let sr = 0; sr < splitRows; sr++) {
          const pad = 6;
          const bx = left + sc * subW + pad;
          const by = top + sr * subH + pad;
          const bw = subW - pad * 2;
          const bh = subH - pad * 2;

          let bElevation = isDowntown ? rng.range(75, 140) : rng.range(40, 70);
          if (isOceanDriveFront) bElevation = rng.range(90, 150);

          let bColor = isDowntown ? rng.pick(artDecoColors) : (isIndustrial ? rng.pick(industrialColors) : rng.pick(artDecoColors));
          let bTrim = rng.pick(artDecoColors);

          let neonText = null;
          let neonColor = null;
          if (isOceanDriveFront || (isDowntown && rng.chance(0.65))) {
            neonText = rng.pick(neonNames);
            neonColor = rng.pick(['#ff007f', '#00f0ff', '#ffe600', '#39ff14', '#ff5722']);
          } else if (isStripMall && rng.chance(0.5)) {
            neonText = rng.pick(shopNames);
            neonColor = rng.pick(['#ffea00', '#ff3366', '#00e5ff']);
          }

          // Rooftop clutter: AC units, vents, water tanks, stairwell boxes
          const clutter = [];
          // Stairwell access box (penthouse bulkhead door to roof)
          clutter.push({
            type: 'stairwell',
            rx: rng.range(10, Math.max(12, bw - 38)),
            ry: rng.range(10, Math.max(12, bh - 32)),
            rw: rng.range(22, 30),
            rh: rng.range(18, 24),
          });

          // AC compressor boxes
          const numAc = rng.rangeInt(1, 3);
          for (let k = 0; k < numAc; k++) {
            clutter.push({
              type: 'ac',
              rx: rng.range(12, Math.max(14, bw - 32)),
              ry: rng.range(12, Math.max(14, bh - 32)),
              rw: rng.range(16, 26),
              rh: rng.range(14, 20),
            });
          }

          // Rooftop turbine exhaust vents
          const numVents = rng.rangeInt(1, 2);
          for (let k = 0; k < numVents; k++) {
            clutter.push({
              type: 'vent',
              rx: rng.range(12, Math.max(14, bw - 24)),
              ry: rng.range(12, Math.max(14, bh - 24)),
              radius: rng.range(6, 9),
            });
          }

          // Water tank on roof for tall buildings
          if (bElevation > 85 && rng.chance(0.65)) {
            clutter.push({
              type: 'water_tank',
              rx: rng.range(18, Math.max(20, bw - 36)),
              ry: rng.range(18, Math.max(20, bh - 36)),
              radius: rng.range(12, 16),
            });
          }
          // Antenna mast
          if (bElevation > 105 && rng.chance(0.55)) {
            clutter.push({
              type: 'antenna',
              rx: rng.range(15, bw - 20),
              ry: rng.range(15, bh - 20),
              h: rng.range(28, 48),
            });
          }

          // Distinct rooftop gravel and tile shades (never flat pink slabs)
          const roofTextures = ['#8d8c89', '#788189', '#9b958b', '#686f78', '#a39c90', '#747c84'];
          const bRoofColor = rng.pick(roofTextures);

          const building = {
            x: bx,
            y: by,
            w: bw,
            h: bh,
            height: bElevation,
            color: bColor,
            trimColor: bTrim,
            roofColor: bRoofColor,
            parapetColor: '#2b2c30', // Darker parapet edge
            type: isDowntown ? 'art-deco' : (isIndustrial ? 'warehouse' : 'shop'),
            neon: neonText ? { text: neonText, color: neonColor } : null,
            awnings: (isDowntown || isOceanDriveFront || isStripMall) && rng.chance(0.8),
            awningColor: rng.pick(['#ff4d94', '#2ec4b6', '#ff9f1c', '#e71d36', '#3a86ff']),
            roofClutter: clutter,
          };

          buildings.push(building);
          addSolid(building.x, building.y, building.w, building.h);
        }
      }
    }
  }

  // Props list: Palms, Streetlights, Parked Cars, Hydrants, Benches, Bins, Beach Umbrellas/Towels
  const props = [];

  // 1. Streetlights along avenues and streets
  for (let i = 0; i < avenues.length; i++) {
    const ax = avenues[i];
    const w = (i === avenues.length - 1) ? BLVD_W : ROAD_W;
    const leftX = ax - w / 2 - 8;
    const rightX = ax + w / 2 + 8;
    for (let y = 140; y < WORLD_H - 100; y += 180) {
      props.push({ type: 'streetlight', x: leftX, y, arm: 'right' });
      props.push({ type: 'streetlight', x: rightX, y, arm: 'left' });
    }
  }

  // 2. Palms along Beachfront Promenade (Ocean Drive east sidewalk)
  for (let y = 80; y < WORLD_H - 80; y += 75) {
    props.push({
      type: 'palm',
      x: PROMENADE_X + 18,
      y,
      height: 48,
      trunkR: 4,
      seed: rng.rand() * 100,
    });
  }

  // 3. Central Park props: Palms, trees, benches, bins
  // Add solid for central fountain
  addSolid(park.fountain.x - park.fountain.radius, park.fountain.y - park.fountain.radius, park.fountain.radius * 2, park.fountain.radius * 2);

  for (let k = 0; k < 28; k++) {
    const px = rng.range(park.x + 20, park.x + park.w - 20);
    const py = rng.range(park.y + 20, park.y + park.h - 20);
    // Keep clear of fountain
    if (Math.hypot(px - park.fountain.x, py - park.fountain.y) > park.fountain.radius + 20) {
      props.push({
        type: 'palm',
        x: px,
        y: py,
        height: rng.range(42, 58),
        trunkR: 4.5,
        seed: rng.rand() * 100,
      });
    }
  }

  // Park benches
  for (let k = 0; k < 12; k++) {
    const bx = rng.range(park.x + 40, park.x + park.w - 40);
    const by = rng.range(park.y + 40, park.y + park.h - 40);
    if (Math.hypot(bx - park.fountain.x, by - park.fountain.y) > park.fountain.radius + 15) {
      props.push({ type: 'bench', x: bx, y: by, rot: rng.pick([0, Math.PI / 2]) });
    }
  }

  // 4. Palms in downtown tree wells
  for (let i = 2; i < 6; i++) {
    const ax = avenues[i];
    for (let y = 400; y < 2800; y += 320) {
      if (rng.chance(0.7)) {
        props.push({
          type: 'palm',
          x: ax - ROAD_W / 2 - SIDEWALK_W / 2,
          y,
          height: 38,
          trunkR: 3.5,
          seed: rng.rand() * 100,
        });
      }
      if (rng.chance(0.7)) {
        props.push({
          type: 'palm',
          x: ax + ROAD_W / 2 + SIDEWALK_W / 2,
          y: y + 80,
          height: 38,
          trunkR: 3.5,
          seed: rng.rand() * 100,
        });
      }
    }
  }

  // 5. Fire Hydrants, Benches, Trash Bins, Newspaper Racks & Street Clutter on sidewalks
  for (const stY of streets) {
    for (const avX of avenues) {
      // Hydrant near intersection corner
      props.push({
        type: 'hydrant',
        x: avX - ROAD_W / 2 - 12,
        y: stY - ROAD_W / 2 - 12,
      });
      // Trash bin
      props.push({
        type: 'bin',
        x: avX + ROAD_W / 2 + 12,
        y: stY + ROAD_W / 2 + 12,
      });
      // 80s Newspaper vending box (blue USA Today style)
      props.push({
        type: 'newspaper',
        x: avX + ROAD_W / 2 + 12,
        y: stY - ROAD_W / 2 - 12,
        color: '#1d3557',
      });
      // Red public mailbox or payphone
      props.push({
        type: 'mailbox',
        x: avX - ROAD_W / 2 - 12,
        y: stY + ROAD_W / 2 + 12,
      });
    }
  }

  // Sidewalk planter boxes with tropical greenery
  for (let c = 2; c < avenues.length - 1; c++) {
    const ax = avenues[c];
    for (let r = 1; r < streets.length - 1; r++) {
      const sy = streets[r];
      props.push({
        type: 'planter',
        x: ax + ROAD_W / 2 + 8,
        y: sy + 70,
        w: 12,
        h: 22,
      });
    }
  }

  // 6. Parked Cars in Parking Lots & Curbside Bays
  const carColors = [
    '#e63946', // Red
    '#f8f9fa', // White
    '#ffd166', // Canary Yellow
    '#118ab2', // Blue
    '#073b4c', // Midnight
    '#ff70a6', // Pink
    '#06d6a0', // Teal
    '#f4a261', // Sand
    '#588157', // Olive
  ];
  const carModels = ['sports', 'sedan', 'convertible', 'wagon', 'pickup', 'van'];

  // Parked cars in parking lots
  for (const lot of parkingLots) {
    const rows = 2;
    const cols = Math.floor(lot.w / 45);
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (rng.chance(0.7)) {
          const cx = lot.x + 25 + c * 42;
          const cy = lot.y + 24 + r * 50;
          const car = {
            type: 'car',
            x: cx,
            y: cy,
            w: 22,
            h: 44,
            rot: 0,
            model: rng.pick(carModels),
            color: rng.pick(carColors),
          };
          props.push(car);
          addSolid(car.x - 11, car.y - 22, 22, 44);
        }
      }
    }
  }

  // Dense Curbside parked cars along streets (North & South curbs)
  for (let r = 1; r < streets.length - 1; r++) {
    const sy = streets[r];
    for (let c = 0; c < avenues.length - 1; c++) {
      const startX = avenues[c] + ROAD_W / 2 + 35;
      const endX = avenues[c + 1] - ROAD_W / 2 - 35;
      for (let cx = startX; cx < endX; cx += 58) {
        // North curbside
        if (rng.chance(0.65)) {
          const car = {
            type: 'car',
            x: cx,
            y: sy - ROAD_W / 2 + 13,
            w: 44,
            h: 22,
            rot: Math.PI / 2,
            model: rng.pick(carModels),
            color: rng.pick(carColors),
          };
          props.push(car);
          addSolid(car.x - 22, car.y - 11, 44, 22);
        }
        // South curbside
        if (rng.chance(0.55)) {
          const car = {
            type: 'car',
            x: cx + 25,
            y: sy + ROAD_W / 2 - 13,
            w: 44,
            h: 22,
            rot: -Math.PI / 2,
            model: rng.pick(carModels),
            color: rng.pick(carColors),
          };
          props.push(car);
          addSolid(car.x - 22, car.y - 11, 44, 22);
        }
      }
    }
  }

  // Curbside parked cars along Avenues
  for (let c = 1; c < avenues.length - 2; c++) {
    const ax = avenues[c];
    for (let r = 1; r < streets.length - 1; r++) {
      const startY = streets[r] + ROAD_W / 2 + 35;
      const endY = streets[r + 1] - ROAD_W / 2 - 35;
      for (let cy = startY; cy < endY; cy += 62) {
        if (rng.chance(0.5)) {
          const car = {
            type: 'car',
            x: ax - ROAD_W / 2 + 13,
            y: cy,
            w: 22,
            h: 44,
            rot: 0,
            model: rng.pick(carModels),
            color: rng.pick(carColors),
          };
          props.push(car);
          addSolid(car.x - 11, car.y - 22, 22, 44);
        }
      }
    }
  }

  // 7. Beach Props: Umbrellas, Towels, Lifeguard Towers, Beach Palms
  const umbrellaColors = [
    ['#ff4d94', '#f8f9fa'],
    ['#00b4d8', '#ffd166'],
    ['#ff6f61', '#4fd3cf'],
    ['#7209b7', '#f72585'],
    ['#ff5964', '#ffffff'],
    ['#06d6a0', '#ffd166'],
  ];

  for (let by = 300; by < WORLD_H - 200; by += 160) {
    // Cluster of umbrellas (~30 px diameter) and towels
    for (let k = 0; k < 3; k++) {
      const ux = rng.range(BEACH_X + 40, OCEAN_X - 60);
      const uy = by + rng.range(-60, 60);
      const pair = rng.pick(umbrellaColors);
      props.push({
        type: 'umbrella',
        x: ux,
        y: uy,
        radius: 15, // exactly 30 px diameter
        color1: pair[0],
        color2: pair[1],
      });
      // Towel nearby
      props.push({
        type: 'towel',
        x: ux + rng.range(-20, 20),
        y: uy + rng.range(16, 26),
        w: 14,
        h: 24,
        rot: rng.range(-0.4, 0.4),
        color: pair[0],
      });
    }
  }

  // Beach lifeguard towers
  for (let ly = 600; ly < WORLD_H - 400; ly += 750) {
    const tower = {
      type: 'lifeguard_tower',
      x: OCEAN_X - 45,
      y: ly,
      w: 28,
      h: 28,
    };
    props.push(tower);
    addSolid(tower.x - 14, tower.y - 14, 28, 28);
  }

  // Docks solids
  for (const pier of marina.piers) {
    addSolid(pier.x, pier.y, pier.w, pier.h);
  }

  // Extra street props: benches along Ocean Drive promenade and hydrants at sidewalk corners
  const benchSpacing = intRange(160, 200);
  for (let py = 280; py < WORLD_H - 250; py += benchSpacing) {
    props.push({
      type: 'bench',
      x: 3584,
      y: py,
      rot: -Math.PI / 2, // Facing west toward the beachfront sidewalk
    });
  }

  for (let c = 0; c < avenues.length - 1; c++) {
    const avX = avenues[c];
    for (let r = 0; r < streets.length - 1; r++) {
      const stY = streets[r];
      props.push({
        type: 'hydrant',
        x: avX + ROAD_W / 2 + 12,
        y: stY + ROAD_W / 2 + 12,
      });
    }
  }

  // 8. Prerender function for static ground layer
  function prerender(ctx) {
    // A. Base Terrain
    // City block turf / soil
    ctx.fillStyle = '#394635';
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);

    // Sandy beach
    ctx.fillStyle = '#f6e7cd';
    ctx.fillRect(BEACH_X, 0, OCEAN_X - BEACH_X + 40, WORLD_H);

    // Wet sand tide line
    const wetSandGrad = ctx.createLinearGradient(OCEAN_X - 50, 0, OCEAN_X + 20, 0);
    wetSandGrad.addColorStop(0, '#f6e7cd');
    wetSandGrad.addColorStop(0.5, '#dfc49f');
    wetSandGrad.addColorStop(1, '#a88d6b');
    ctx.fillStyle = wetSandGrad;
    ctx.fillRect(OCEAN_X - 50, 0, 70, WORLD_H);

    // Ocean deep water
    const oceanGrad = ctx.createLinearGradient(OCEAN_X, 0, WORLD_W, 0);
    oceanGrad.addColorStop(0, '#1b8f9c');
    oceanGrad.addColorStop(0.35, '#177c88');
    oceanGrad.addColorStop(1, '#115b63');
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(OCEAN_X, 0, WORLD_W - OCEAN_X, WORLD_H);

    // Marina water basin
    ctx.fillStyle = '#187f8c';
    ctx.fillRect(marina.x, marina.y, marina.w, marina.h);

    // Marina perimeter boardwalk
    ctx.fillStyle = '#99734d';
    ctx.fillRect(marina.x - 12, marina.y - 12, marina.w + 24, 14);
    ctx.fillRect(marina.x - 12, marina.y + marina.h - 2, marina.w + 24, 14);
    ctx.fillRect(marina.x - 12, marina.y, 14, marina.h);
    // Wooden piers
    for (const pier of marina.piers) {
      ctx.fillStyle = '#8b653e';
      ctx.fillRect(pier.x, pier.y, pier.w, pier.h);
      // Wood plank divider lines
      ctx.strokeStyle = '#6e4c27';
      ctx.lineWidth = 1;
      for (let py = pier.y; py < pier.y + pier.h; py += 10) {
        ctx.beginPath();
        ctx.moveTo(pier.x, py);
        ctx.lineTo(pier.x + pier.w, py);
        ctx.stroke();
      }
    }

    // B. Sidewalks & Curbs
    // Fill all city area inside bounds with concrete sidewalk base
    ctx.fillStyle = '#cec7ba';
    for (let c = 0; c < avenues.length - 1; c++) {
      for (let r = 0; r < streets.length - 1; r++) {
        // Skip marina
        if ((c === 5 || c === 6) && r === 0) continue;
        const left = avenues[c] + ((c === avenues.length - 2) ? BLVD_W / 2 : ROAD_W / 2);
        const right = avenues[c + 1] - ((c + 1 === avenues.length - 1) ? BLVD_W / 2 : ROAD_W / 2);
        const top = streets[r] + ROAD_W / 2;
        const bottom = streets[r + 1] - ROAD_W / 2;
        ctx.fillRect(left, top, right - left, bottom - top);

        // Darker curb edge
        ctx.strokeStyle = '#9c9587';
        ctx.lineWidth = 3;
        ctx.strokeRect(left + 1.5, top + 1.5, right - left - 3, bottom - top - 3);
      }
    }

    // Central Park green lawn inside sidewalk
    ctx.fillStyle = '#497e55';
    ctx.fillRect(park.x, park.y, park.w, park.h);

    // Park winding stone paths
    ctx.strokeStyle = '#ded5c5';
    ctx.lineWidth = 18;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(park.x, park.fountain.y);
    ctx.lineTo(park.fountain.x, park.fountain.y);
    ctx.lineTo(park.x + park.w, park.fountain.y);
    ctx.moveTo(park.fountain.x, park.y);
    ctx.lineTo(park.fountain.x, park.fountain.y);
    ctx.lineTo(park.fountain.x, park.y + park.h);
    ctx.stroke();

    // Fountain plaza & base
    ctx.fillStyle = '#d1c7b7';
    ctx.beginPath();
    ctx.arc(park.fountain.x, park.fountain.y, park.fountain.radius + 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3eb5c0'; // Fountain water
    ctx.beginPath();
    ctx.arc(park.fountain.x, park.fountain.y, park.fountain.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#857e72';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Beachfront Promenade sidewalk (Ocean Drive east side)
    ctx.fillStyle = '#e2ded5';
    ctx.fillRect(PROMENADE_X, 0, BEACH_X - PROMENADE_X, WORLD_H);
    ctx.strokeStyle = '#a8a092';
    ctx.lineWidth = 2;
    ctx.strokeRect(PROMENADE_X, 0, BEACH_X - PROMENADE_X, WORLD_H);

    // Decorative promenade paver score lines
    ctx.strokeStyle = '#d0cac0';
    ctx.lineWidth = 1;
    for (let py = 0; py < WORLD_H; py += 30) {
      ctx.beginPath();
      ctx.moveTo(PROMENADE_X, py);
      ctx.lineTo(BEACH_X, py);
      ctx.stroke();
    }

    // C. Parking lots asphalt
    for (const lot of parkingLots) {
      ctx.fillStyle = '#2c3039';
      ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
      // Stall lines
      ctx.strokeStyle = '#e9ecef';
      ctx.lineWidth = 2;
      const cols = Math.floor(lot.w / 45);
      for (let c = 0; c <= cols; c++) {
        const lx = lot.x + 12 + c * 42;
        ctx.beginPath();
        ctx.moveTo(lx, lot.y + 4);
        ctx.lineTo(lx, lot.y + 42);
        ctx.moveTo(lx, lot.y + 50);
        ctx.lineTo(lx, lot.y + 88);
        ctx.stroke();
      }
    }

    // D. Roads & Markings
    // 1. Asphalt fill
    ctx.fillStyle = '#343844';
    for (const r of roads) {
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }

    // 2. Intersections clean asphalt
    for (const stY of streets) {
      for (let i = 0; i < avenues.length; i++) {
        const ax = avenues[i];
        const rw = (i === avenues.length - 1) ? BLVD_W : ROAD_W;
        ctx.fillRect(ax - rw / 2, stY - ROAD_W / 2, rw, ROAD_W);
      }
    }

    // 3. Road Markings: Double-yellow center lines
    ctx.strokeStyle = '#f4c430';
    ctx.lineWidth = 2;

    // Vertical avenues yellow lines
    for (let i = 0; i < avenues.length; i++) {
      const ax = avenues[i];
      for (let r = 0; r < streets.length - 1; r++) {
        const yStart = streets[r] + ROAD_W / 2 + 28; // past crosswalk
        const yEnd = streets[r + 1] - ROAD_W / 2 - 28;
        if (yEnd > yStart) {
          // Double yellow lines (2px wide, 3px apart)
          ctx.beginPath();
          ctx.moveTo(ax - 2.5, yStart);
          ctx.lineTo(ax - 2.5, yEnd);
          ctx.moveTo(ax + 2.5, yStart);
          ctx.lineTo(ax + 2.5, yEnd);
          ctx.stroke();
        }
      }
    }

    // Horizontal streets yellow lines
    for (let r = 0; r < streets.length; r++) {
      const sy = streets[r];
      for (let c = 0; c < avenues.length - 1; c++) {
        const w1 = (c === avenues.length - 1) ? BLVD_W : ROAD_W;
        const w2 = (c + 1 === avenues.length - 1) ? BLVD_W : ROAD_W;
        const xStart = avenues[c] + w1 / 2 + 28;
        const xEnd = avenues[c + 1] - w2 / 2 - 28;
        if (xEnd > xStart) {
          ctx.beginPath();
          ctx.moveTo(xStart, sy - 2.5);
          ctx.lineTo(xEnd, sy - 2.5);
          ctx.moveTo(xStart, sy + 2.5);
          ctx.lineTo(xEnd, sy + 2.5);
          ctx.stroke();
        }
      }
    }

    // 4. Dashed White Lane Lines for 4-lane Beachfront Boulevard
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.setLineDash([14, 16]);
    for (let r = 0; r < streets.length - 1; r++) {
      const yStart = streets[r] + ROAD_W / 2 + 28;
      const yEnd = streets[r + 1] - ROAD_W / 2 - 28;
      if (yEnd > yStart) {
        // Left lane divider
        ctx.beginPath();
        ctx.moveTo(BOULEVARD_X - 22, yStart);
        ctx.lineTo(BOULEVARD_X - 22, yEnd);
        // Right lane divider
        ctx.moveTo(BOULEVARD_X + 22, yStart);
        ctx.lineTo(BOULEVARD_X + 22, yEnd);
        ctx.stroke();
      }
    }
    ctx.setLineDash([]); // Reset dash

    // 5. Crosswalks at all intersections (Zebra stripes)
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < avenues.length; i++) {
      const ax = avenues[i];
      const rw = (i === avenues.length - 1) ? BLVD_W : ROAD_W;
      for (let r = 0; r < streets.length; r++) {
        const sy = streets[r];

        // North crosswalk across avenue
        const ny = sy - ROAD_W / 2 - 18;
        for (let stripeX = ax - rw / 2 + 4; stripeX < ax + rw / 2 - 4; stripeX += 8) {
          ctx.fillRect(stripeX, ny, 4.5, 16);
        }

        // South crosswalk across avenue
        const souY = sy + ROAD_W / 2 + 2;
        for (let stripeX = ax - rw / 2 + 4; stripeX < ax + rw / 2 - 4; stripeX += 8) {
          ctx.fillRect(stripeX, souY, 4.5, 16);
        }

        // West crosswalk across street
        const wx = ax - rw / 2 - 18;
        for (let stripeY = sy - ROAD_W / 2 + 4; stripeY < sy + ROAD_W / 2 - 4; stripeY += 8) {
          ctx.fillRect(wx, stripeY, 16, 4.5);
        }

        // East crosswalk across street
        const ex = ax + rw / 2 + 2;
        for (let stripeY = sy - ROAD_W / 2 + 4; stripeY < sy + ROAD_W / 2 - 4; stripeY += 8) {
          ctx.fillRect(ex, stripeY, 16, 4.5);
        }
      }
    }

    // E. Static Ground Shadows for Buildings
    // Deep, soft shadows cast towards lower-right: dx = height * 0.4, dy = height * 0.25
    ctx.fillStyle = 'rgba(10, 16, 26, 0.38)';
    for (const b of buildings) {
      const dx = b.height * 0.42;
      const dy = b.height * 0.28;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y + b.h);
      ctx.lineTo(b.x + dx, b.y + b.h + dy);
      ctx.lineTo(b.x + b.w + dx, b.y + b.h + dy);
      ctx.lineTo(b.x + b.w + dx, b.y + dy);
      ctx.lineTo(b.x + b.w, b.y);
      ctx.closePath();
      ctx.fill();
    }
  }

  return {
    w: WORLD_W,
    h: WORLD_H,
    roads,
    buildings,
    solids,
    props,
    park,
    marina,
    parkingLots,
    beach: { x: BEACH_X, w: OCEAN_X - BEACH_X },
    ocean: { x: OCEAN_X, w: WORLD_W - OCEAN_X },
    prerender,
  };
}
