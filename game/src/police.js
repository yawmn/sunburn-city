// SUNBURN CITY - Police, Wanted Level & Pursuit AI
// Handles:
// - Wanted level 0-5 with decay after 20s out of sight
// - Cruiser spawning off-screen (cap 6 active cruisers)
// - Cruiser pursuit AI: steer toward player, ram, PIT maneuver at 2+ stars, officers shoot at 3+
// - Roadblocks at 4+ stars (two cruisers + cones ahead of travel direction)
// - Officers on foot: chase and melee below 3 stars; BUSTED when touching stopped player for 1.5s
// - At 3+ stars: officers draw pistols and shoot at player
// - BUSTED and WASTED full-screen banners, fine deduction, and respawn at nearest station/hospital.

import { createCar } from './vehicle.js';

export const POLICE_STATIONS = [
  { name: 'Downtown Police HQ', x: 1560, y: 1420 },
  { name: 'Vice Beach Precinct', x: 3440, y: 2300 },
];

export const HOSPITALS = [
  { name: 'Ocean View Hospital', x: 2520, y: 1080 },
  { name: 'Central City Medical', x: 1080, y: 2300 },
];

export function getNearestPoliceStation(pos) {
  let best = POLICE_STATIONS[0];
  let minDist = Infinity;
  for (const s of POLICE_STATIONS) {
    const d = Math.hypot(s.x - pos.x, s.y - pos.y);
    if (d < minDist) { minDist = d; best = s; }
  }
  return best;
}

export function getNearestHospital(pos) {
  let best = HOSPITALS[0];
  let minDist = Infinity;
  for (const h of HOSPITALS) {
    const d = Math.hypot(h.x - pos.x, h.y - pos.y);
    if (d < minDist) { minDist = d; best = h; }
  }
  return best;
}

export function createPoliceSystem(world) {
  let wanted = 0; // 0 to 5
  let outOfSightTimer = 0;
  let playerInSight = false;

  const cruisers = [];
  const officers = [];
  const roadblocks = [];
  const cones = [];

  let spawnTimer = 0;
  let roadblockCooldown = 0;
  let bustedContactTimer = 0; // touching stopped player on foot

  // Busted / Wasted screen state
  let overlayType = null; // 'BUSTED' | 'WASTED' | null
  let overlayTimer = 0;
  let overlayMessage = '';

  function addWanted(n = 1) {
    wanted = Math.min(5, Math.max(0, wanted + n));
    outOfSightTimer = 0;
    playerInSight = true;
  }

  function clearWanted() {
    wanted = 0;
    outOfSightTimer = 0;
    playerInSight = false;
  }

  // Check line of sight from a police unit to player
  function hasLineOfSight(x1, y1, x2, y2, solids) {
    const dist = Math.hypot(x2 - x1, y2 - y1);
    if (dist > 520) return false;
    if (!solids) return true;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const steps = Math.ceil(dist / 30);
    const stepX = dx / steps;
    const stepY = dy / steps;

    for (let s = 1; s < steps; s++) {
      const px = x1 + stepX * s;
      const py = y1 + stepY * s;
      for (let i = 0; i < solids.length; i++) {
        const box = solids[i];
        if (px >= box.x && px <= box.x + box.w &&
            py >= box.y && py <= box.y + box.h) {
          return false; // Obstructed by building
        }
      }
    }
    return true;
  }

  // Spawn an officer on foot
  function spawnOfficer(x, y, angle = 0) {
    const officer = {
      x,
      y,
      vx: 0,
      vy: 0,
      speed: 155,
      facingAngle: angle,
      health: 65,
      isDead: false,
      state: 'chasing', // 'chasing', 'shooting', 'dead'
      shootCooldown: Math.random() * 0.8 + 0.4,
      draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        // Ground shadow
        ctx.fillStyle = 'rgba(10, 14, 22, 0.4)';
        ctx.beginPath();
        ctx.ellipse(6, 8, 12, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        if (this.isDead) {
          // Dead officer ragdoll on ground
          ctx.rotate(this.facingAngle);
          ctx.fillStyle = '#1d2d50'; // VCPD navy uniform
          ctx.fillRect(-8, -6, 16, 12);
          ctx.fillStyle = '#e8ab7b';
          ctx.beginPath();
          ctx.arc(10, 0, 5, 0, Math.PI * 2);
          ctx.fill();
          // Pool of blood
          ctx.fillStyle = 'rgba(180, 15, 30, 0.65)';
          ctx.beginPath();
          ctx.ellipse(-2, 0, 14, 9, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          return;
        }

        ctx.rotate(this.facingAngle);

        // Dark outline
        ctx.strokeStyle = '#0e131d';
        ctx.lineWidth = 1.6;

        // Legs / trousers (navy)
        ctx.fillStyle = '#16223b';
        ctx.beginPath();
        ctx.roundRect(-8, -8, 14, 4.5, 2);
        ctx.roundRect(-8, 3.5, 14, 4.5, 2);
        ctx.fill();
        ctx.stroke();

        // Torso / VCPD uniform shirt (navy blue with badge)
        ctx.fillStyle = '#1d2d50';
        ctx.beginPath();
        ctx.roundRect(-7, -8, 14, 16, 3.5);
        ctx.fill();
        ctx.stroke();

        // Gold police badge shield
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(0, -5, 3, 3);

        // Arms holding nightstick or pistol
        ctx.fillStyle = '#1d2d50';
        ctx.fillRect(-3, -10, 10, 3.5);
        ctx.fillRect(-3, 6.5, 10, 3.5);

        // Hands
        ctx.fillStyle = '#e8ab7b';
        ctx.beginPath();
        ctx.arc(7, -8, 2.5, 0, Math.PI * 2);
        ctx.arc(7, 8, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Pistol or nightstick in hand
        if (wanted >= 3) {
          ctx.fillStyle = '#1b1f24';
          ctx.fillRect(6, -2, 8, 3.5);
        } else {
          // Nightstick
          ctx.fillStyle = '#11151a';
          ctx.fillRect(5, -9, 10, 2);
        }

        // Head
        ctx.fillStyle = '#e8ab7b';
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Police peaked service cap (navy with gold band and black visor)
        ctx.fillStyle = '#16223b';
        ctx.beginPath();
        ctx.arc(-1, 0, 5.5, -Math.PI / 2, Math.PI / 2);
        ctx.fill();
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(2, -4, 1.5, 8);
        ctx.fillStyle = '#111111';
        ctx.fillRect(3.5, -5, 2, 10); // Visor

        ctx.restore();
      },
    };
    officers.push(officer);
    return officer;
  }

  // Spawn an off-screen cruiser headed towards player
  function spawnCruiser(player, world) {
    if (cruisers.length >= 6) return null;

    // Pick a spawn point ~650-850 px away from player along a road
    const angleToSpawn = Math.random() * Math.PI * 2;
    const spawnDist = 720;
    let spawnX = player.x + Math.cos(angleToSpawn) * spawnDist;
    let spawnY = player.y + Math.sin(angleToSpawn) * spawnDist;

    // Clamp inside city world
    spawnX = Math.max(100, Math.min(world.w - 100, spawnX));
    spawnY = Math.max(100, Math.min(world.h - 100, spawnY));

    const facingPlayer = Math.atan2(player.y - spawnY, player.x - spawnX);
    const cruiser = createCar(spawnX, spawnY, facingPlayer, 'police', '#ffffff');
    cruiser.hasLightbar = true;
    cruiser.sirenTimer = Math.random() * 10;
    cruiser.speed = 280;
    cruiser.aiState = 'pursuing';
    cruiser.fireCooldown = 1.0;
    cruisers.push(cruiser);
    return cruiser;
  }

  // Spawn roadblock ahead of player (at 4+ stars)
  function spawnRoadblock(playerCar, world) {
    if (roadblocks.length >= 2) return;
    if (!playerCar || playerCar.speed < 70) return;

    // Project 440 px ahead in heading
    const fwdX = Math.cos(playerCar.angle);
    const fwdY = Math.sin(playerCar.angle);
    const targetX = playerCar.x + fwdX * 450;
    const targetY = playerCar.y + fwdY * 450;

    // Barricade: 2 cruisers angled across road
    const perpX = -fwdY;
    const perpY = fwdX;

    const c1 = createCar(targetX + perpX * 22, targetY + perpY * 22, playerCar.angle + Math.PI * 0.75, 'police', '#ffffff');
    c1.hasLightbar = true;
    c1.speed = 0;
    c1.isRoadblock = true;
    c1.fireCooldown = 1.0;

    const c2 = createCar(targetX - perpX * 22, targetY - perpY * 22, playerCar.angle - Math.PI * 0.75, 'police', '#ffffff');
    c2.hasLightbar = true;
    c2.speed = 0;
    c2.isRoadblock = true;
    c2.fireCooldown = 1.0;

    cruisers.push(c1);
    cruisers.push(c2);

    // 4 Traffic cones between and beside cruisers
    for (let i = -2; i <= 2; i++) {
      if (i === 0) continue;
      cones.push({
        x: targetX + perpX * (i * 14),
        y: targetY + perpY * (i * 14),
        r: 6,
        life: 30.0,
      });
    }

    roadblocks.push({ x: targetX, y: targetY, c1, c2 });
  }

  return {
    get wanted() {
      return wanted;
    },
    set wanted(val) {
      wanted = Math.max(0, Math.min(5, Math.round(val)));
      outOfSightTimer = 0;
    },
    addWanted,
    clearWanted,
    get cruisers() {
      return cruisers;
    },
    set cruisers(arr) {
      cruisers.length = 0;
      if (arr) cruisers.push(...arr);
    },
    get officers() {
      return officers;
    },
    set officers(arr) {
      officers.length = 0;
      if (arr) officers.push(...arr);
    },
    get cones() {
      return cones;
    },
    set cones(arr) {
      cones.length = 0;
      if (arr) cones.push(...arr);
    },
    get playerInSight() {
      return playerInSight;
    },
    get overlayType() {
      return overlayType;
    },
    set overlayType(val) {
      overlayType = val;
    },
    get overlayTimer() {
      return overlayTimer;
    },
    set overlayTimer(val) {
      overlayTimer = val;
    },
    get overlayMessage() {
      return overlayMessage;
    },

    update(dt, player, world, traffic, combat, camera) {
      // 1. Process Overlays (BUSTED / WASTED)
      if (overlayType) {
        overlayTimer -= dt;
        if (overlayTimer <= 0) {
          // Time to respawn!
          if (overlayType === 'BUSTED') {
            const station = getNearestPoliceStation(player);
            // Deduct fine
            const fine = Math.min(player.money, 100);
            player.money -= fine;
            clearWanted();
            player.respawn(station.x, station.y);
          } else if (overlayType === 'WASTED') {
            const hospital = getNearestHospital(player);
            // Deduct hospital fee
            const fee = Math.min(player.money, 100);
            player.money -= fee;
            clearWanted();
            player.respawn(hospital.x, hospital.y);
          }
          overlayType = null;
        }
        return;
      }

      // Check player health for WASTED trigger
      if (player.health <= 0 && !player.isWasted) {
        player.isWasted = true;
      }
      if (player.isWasted && !overlayType) {
        overlayType = 'WASTED';
        overlayTimer = 2.8;
        overlayMessage = 'HOSPITAL ADMISSION - $100';
        return;
      }

      // 2. Wanted Level Decay Logic
      if (wanted > 0) {
        // Line of sight check to all active cruisers and officers
        let canSeePlayer = false;

        for (let i = 0; i < cruisers.length; i++) {
          const c = cruisers[i];
          if (c.isWreck) continue;
          if (hasLineOfSight(c.x, c.y, player.x, player.y, world.solids)) {
            canSeePlayer = true;
            break;
          }
        }

        if (!canSeePlayer) {
          for (let i = 0; i < officers.length; i++) {
            const off = officers[i];
            if (off.isDead) continue;
            if (hasLineOfSight(off.x, off.y, player.x, player.y, world.solids)) {
              canSeePlayer = true;
              break;
            }
          }
        }

        playerInSight = canSeePlayer;

        if (!playerInSight) {
          // Out of sight: decay timer counts up
          outOfSightTimer += dt;
          if (outOfSightTimer >= 20.0) {
            outOfSightTimer = 0;
            wanted = Math.max(0, wanted - 1);
          }
        } else {
          outOfSightTimer = 0;
        }
      } else {
        outOfSightTimer = 0;
        playerInSight = false;
      }

      // 3. Cruiser Spawning & Target Capacity
      const targetCruisers = wanted === 0 ? 0 : (wanted === 1 ? 1 : (wanted === 2 ? 2 : (wanted === 3 ? 3 : (wanted === 4 ? 4 : 6))));

      // Clean up destroyed wrecks or far-away cruisers when wanted is 0
      for (let i = cruisers.length - 1; i >= 0; i--) {
        const c = cruisers[i];
        if (c.isWreck && c.health <= 0) {
          // Let wreck stay handled by combat
          continue;
        }
        if (wanted === 0) {
          const d = Math.hypot(c.x - player.x, c.y - player.y);
          if (d > 750) {
            cruisers.splice(i, 1);
          }
        }
      }

      if (wanted > 0 && cruisers.length < targetCruisers) {
        spawnTimer += dt;
        if (spawnTimer > 1.8) {
          spawnTimer = 0;
          spawnCruiser(player, world);
        }
      }

      // Roadblock generation at 4+ stars
      if (wanted >= 4 && player.inCar) {
        roadblockCooldown += dt;
        if (roadblockCooldown > 12.0) {
          roadblockCooldown = 0;
          spawnRoadblock(player.inCar, world);
        }
      }

      // 4. Cruiser AI Updates
      for (let i = 0; i < cruisers.length; i++) {
        const c = cruisers[i];
        if (c.isWreck) continue;

        c.sirenTimer += dt * 10;
        if (c.fireCooldown === undefined) {
          c.fireCooldown = 1.0;
        } else if (c.fireCooldown > 0) {
          c.fireCooldown -= dt;
        }

        // Skip AI for parked roadblock cruisers
        if (c.isRoadblock) {
          c.update(dt, null, world.solids);
          continue;
        }

        // Distance & Angle to player
        const dx = player.x - c.x;
        const dy = player.y - c.y;
        const distToPlayer = Math.hypot(dx, dy);

        // Steering input toward target
        let targetAngle = Math.atan2(dy, dx);

        if (player.inCar) {
          // Player is driving
          if (wanted >= 2 && distToPlayer < 120 && distToPlayer > 30) {
            // PIT Maneuver at 2+ stars! Aim for rear left or rear right quarter of player car
            const playerCar = player.inCar;
            const pitSide = (Math.sin(playerCar.angle - c.angle) > 0) ? 1 : -1;
            const rearX = playerCar.x - Math.cos(playerCar.angle) * (playerCar.l * 0.4) + Math.sin(playerCar.angle) * (playerCar.w * 0.5 * pitSide);
            const rearY = playerCar.y - Math.sin(playerCar.angle) * (playerCar.l * 0.4) - Math.cos(playerCar.angle) * (playerCar.w * 0.5 * pitSide);
            targetAngle = Math.atan2(rearY - c.y, rearX - c.x);

            // Execute PIT impulse if contacting
            if (distToPlayer < 40) {
              playerCar.angle += pitSide * 1.8 * dt;
              playerCar.vx += Math.cos(c.angle) * 120 * dt;
              playerCar.vy += Math.sin(c.angle) * 120 * dt;
            }
          }

          // At 3+ stars: officer inside shoots pistol from cruiser
          if (wanted >= 3 && distToPlayer < 350 && c.fireCooldown <= 0 && combat) {
            c.fireCooldown = 1.0;
            const shotAngle = Math.atan2(player.y - c.y, player.x - c.x);
            // Bullet fired towards player
            player.takeDamage(6);
          }
        } else {
          // Player is on foot
          if (distToPlayer < 75 && c.speed < 60) {
            // Cruiser pulls over and officers exit to chase on foot!
            if (officers.filter(o => !o.isDead).length < wanted * 2) {
              spawnOfficer(c.x - Math.sin(c.angle) * 20, c.y + Math.cos(c.angle) * 20, c.angle);
            }
          }
        }

        // Steer cruiser toward targetAngle
        let angleDiff = targetAngle - c.angle;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

        const steerVal = Math.max(-1, Math.min(1, angleDiff * 2.2));
        const throttleVal = (distToPlayer > 35) ? 1.0 : (distToPlayer < 20 ? -0.5 : 0.2);

        const simulatedInput = {
          axes() {
            return { x: steerVal, y: -throttleVal };
          },
          sprint: false,
          space: false,
        };

        c.update(dt, simulatedInput, world.solids, world.w, world.h);

        // Ram into player car if near
        if (player.inCar && distToPlayer < (c.radius + player.inCar.radius) * 0.8) {
          c.collideCar(player.inCar);
        }
      }

      // 5. On-Foot Police Officers AI
      let touchingStoppedPlayer = false;

      for (let i = officers.length - 1; i >= 0; i--) {
        const off = officers[i];
        if (off.isDead) continue;

        const dx = player.x - off.x;
        const dy = player.y - off.y;
        const dist = Math.hypot(dx, dy);

        off.facingAngle = Math.atan2(dy, dx);

        if (wanted < 3) {
          // Below 3 stars: officers chase on foot and try to melee / arrest
          if (dist > 18) {
            off.vx = Math.cos(off.facingAngle) * off.speed;
            off.vy = Math.sin(off.facingAngle) * off.speed;
            off.x += off.vx * dt;
            off.y += off.vy * dt;
          } else {
            off.vx = 0;
            off.vy = 0;
          }

          // BUSTED check: touching a stopped or slow player on foot
          if (!player.inCar && dist < 26 && player.speed < 35) {
            touchingStoppedPlayer = true;
          }
        } else {
          // 3+ stars: officers keep distance, take cover / shoot
          if (dist > 160) {
            off.vx = Math.cos(off.facingAngle) * off.speed;
            off.vy = Math.sin(off.facingAngle) * off.speed;
            off.x += off.vx * dt;
            off.y += off.vy * dt;
          } else if (dist < 80) {
            // Back away slightly while firing
            off.vx = -Math.cos(off.facingAngle) * (off.speed * 0.5);
            off.vy = -Math.sin(off.facingAngle) * (off.speed * 0.5);
            off.x += off.vx * dt;
            off.y += off.vy * dt;
          }

          // Shoot pistol at player
          off.shootCooldown -= dt;
          if (off.shootCooldown <= 0 && dist < 380 && hasLineOfSight(off.x, off.y, player.x, player.y, world.solids)) {
            off.shootCooldown = Math.random() * 0.8 + 0.6;
            // Fire at player
            player.takeDamage(16);
            if (camera) camera.screenShake(3.0);
          }
        }
      }

      // 6. BUSTED Progress Check (1.5 s touching stopped player)
      if (touchingStoppedPlayer && wanted > 0 && wanted < 3) {
        bustedContactTimer += dt;
        if (bustedContactTimer >= 1.5 && !overlayType) {
          overlayType = 'BUSTED';
          overlayTimer = 2.8;
          overlayMessage = 'FINE PAID - $100';
          player.isBusted = true;
        }
      } else {
        bustedContactTimer = Math.max(0, bustedContactTimer - dt * 1.5);
      }
    },

    // Draw police officers and traffic cones into world
    drawWorld(ctx, time) {
      // 1. Cones
      for (const cone of cones) {
        ctx.save();
        ctx.translate(cone.x, cone.y);

        // Ground shadow
        ctx.fillStyle = 'rgba(10, 14, 20, 0.4)';
        ctx.beginPath();
        ctx.ellipse(3, 4, 7, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Orange body
        ctx.fillStyle = '#ff6b35';
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#c84411';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Reflective white ring
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 2. Officers
      for (const off of officers) {
        off.draw(ctx);
      }
    },
  };
}