// SUNBURN CITY - Combat System
// Implements weapons (Fists, Colt .45 Pistol, Uzi 9mm SMG), weapon cycling (1/2/3/Q),
// ammo & reload (R), firing mechanics (muzzle flash, tracer lines, ejected brass casings,
// recoil, screen shake, sparks on solids, blood puffs on peds/officers, bullet holes),
// vehicle bullet damage, vehicle explosions (fireball, smoke plume, burning wrecks),
// and 360-degree drive-by shooting while in a vehicle.

export const WEAPON_CONFIGS = [
  {
    id: 'fists',
    name: 'FISTS',
    damage: 25,
    range: 38,
    fireRate: 0.32,
    automatic: false,
    clipSize: Infinity,
    maxReserve: Infinity,
    reloadTime: 0,
    spread: 0,
    speed: 0,
  },
  {
    id: 'pistol',
    name: 'COLT .45',
    damage: 34,
    range: 440,
    fireRate: 0.22,
    automatic: false,
    clipSize: 15,
    maxReserve: 90,
    reloadTime: 1.2,
    spread: 0.045,
    speed: 1200,
  },
  {
    id: 'smg',
    name: 'UZI 9MM',
    damage: 22,
    range: 390,
    fireRate: 0.09, // ~11 rounds/sec
    automatic: true,
    clipSize: 30,
    maxReserve: 150,
    reloadTime: 1.5,
    spread: 0.11,
    speed: 1100,
  },
];

export function createCombatSystem() {
  let weaponIndex = 0; // 0 = FISTS, 1 = PISTOL, 2 = SMG

  const weaponStates = WEAPON_CONFIGS.map(cfg => ({
    ...cfg,
    clip: cfg.clipSize,
    reserve: cfg.id === 'fists' ? Infinity : (cfg.id === 'pistol' ? 60 : 120),
  }));

  let fireCooldown = 0;
  let reloadTimer = 0;
  let isReloading = false;

  // Visual effects
  const tracers = [];
  const muzzleFlashes = [];
  const casings = [];
  const sparks = [];
  const bloodPuffs = [];
  const bulletHoles = [];
  const explosions = [];
  const wrecks = [];
  const fireParticles = [];
  const smokeParticles = [];

  function currentWeapon() {
    return weaponStates[weaponIndex];
  }

  function selectWeapon(index) {
    if (index < 0 || index >= weaponStates.length) return;
    if (weaponIndex === index) return;
    weaponIndex = index;
    isReloading = false;
    reloadTimer = 0;
  }

  function cycleWeapon() {
    selectWeapon((weaponIndex + 1) % weaponStates.length);
  }

  function startReload() {
    const w = currentWeapon();
    if (w.id === 'fists') return;
    if (isReloading) return;
    if (w.clip >= w.clipSize) return;
    if (w.reserve <= 0) return;

    isReloading = true;
    reloadTimer = w.reloadTime;
  }

  function triggerExplosion(x, y, camera = null, radius = 55) {
    explosions.push({
      x,
      y,
      r: 6,
      maxR: radius,
      shockR: 10,
      maxShockR: radius * 1.5,
      life: 0.65,
      maxLife: 0.65,
    });

    if (camera) {
      camera.screenShake(16);
    }

    // Spawn burst of initial smoke and fire particles
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = Math.random() * 140 + 30;
      fireParticles.push({
        x: x + (Math.random() - 0.5) * 16,
        y: y + (Math.random() - 0.5) * 16,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - 30,
        r: Math.random() * 9 + 6,
        life: Math.random() * 0.4 + 0.3,
        maxLife: 0.7,
        color: Math.random() > 0.5 ? '#ff3a00' : '#ffea00',
      });
    }

    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = Math.random() * 80 + 10;
      smokeParticles.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - 40,
        r: Math.random() * 12 + 10,
        life: Math.random() * 0.8 + 0.5,
        maxLife: 1.3,
      });
    }
  }

  function spawnWreck(car, camera = null) {
    car.isWreck = true;
    car.health = 0;
    car.damage = 1;
    car.color = '#181a20';
    car.speed = 0;
    car.vx = 0;
    car.vy = 0;

    triggerExplosion(car.x, car.y, camera, 60);

    wrecks.push({
      car,
      x: car.x,
      y: car.y,
      angle: car.angle,
      w: car.w,
      l: car.l,
      life: 25.0, // burning wreck remains for 25s
      smokeTimer: 0,
      fireTimer: 0,
    });
  }

  // Ray-box intersection helper for building solids
  function raycastSolids(x1, y1, x2, y2, solids) {
    if (!solids) return null;
    let closestDist = Infinity;
    let hitX = 0;
    let hitY = 0;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.001) return null;
    const ndx = dx / dist;
    const ndy = dy / dist;

    // Check line segment against solid boxes
    for (let i = 0; i < solids.length; i++) {
      const s = solids[i];
      // AABB ray test
      let tmin = 0;
      let tmax = dist;

      if (Math.abs(ndx) < 0.0001) {
        if (x1 < s.x || x1 > s.x + s.w) continue;
      } else {
        const t1 = (s.x - x1) / ndx;
        const t2 = (s.x + s.w - x1) / ndx;
        const near = Math.min(t1, t2);
        const far = Math.max(t1, t2);
        tmin = Math.max(tmin, near);
        tmax = Math.min(tmax, far);
        if (tmin > tmax) continue;
      }

      if (Math.abs(ndy) < 0.0001) {
        if (y1 < s.y || y1 > s.y + s.h) continue;
      } else {
        const t1 = (s.y - y1) / ndy;
        const t2 = (s.y + s.h - y1) / ndy;
        const near = Math.min(t1, t2);
        const far = Math.max(t1, t2);
        tmin = Math.max(tmin, near);
        tmax = Math.min(tmax, far);
        if (tmin > tmax) continue;
      }

      if (tmin >= 0 && tmin < closestDist) {
        closestDist = tmin;
        hitX = x1 + ndx * tmin;
        hitY = y1 + ndy * tmin;
      }
    }

    if (closestDist < Infinity) {
      return { dist: closestDist, x: hitX, y: hitY };
    }
    return null;
  }

  // Point to segment distance helper
  function distToSegment(px, py, x1, y1, x2, y2) {
    const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    const projX = x1 + t * (x2 - x1);
    const projY = y1 + t * (y2 - y1);
    return {
      dist: Math.hypot(px - projX, py - projY),
      t,
      projX,
      projY,
    };
  }

  return {
    currentWeapon,
    selectWeapon,
    cycleWeapon,
    startReload,
    triggerExplosion,
    spawnWreck,

    get weaponName() {
      return currentWeapon().name;
    },
    get ammoString() {
      const w = currentWeapon();
      if (w.id === 'fists') return '∞';
      return `${w.clip} / ${w.reserve}`;
    },
    get isReloading() {
      return isReloading;
    },

    update(dt, player, input, camera, world, traffic, pedestrians, police) {
      // 1. Process hotkeys
      if (input) {
        if (input.takePressed('weapon_1')) selectWeapon(0);
        if (input.takePressed('weapon_2')) selectWeapon(1);
        if (input.takePressed('weapon_3')) selectWeapon(2);
        if (input.takePressed('cycle_weapon')) cycleWeapon();
        if (input.takePressed('reload')) startReload();
      }

      // Sync player weapon text
      const cw = currentWeapon();
      player.weapon = cw.name;
      player.ammo = (cw.id === 'fists') ? '∞' : `${cw.clip} / ${cw.reserve}`;

      // 2. Reload progress
      if (isReloading) {
        reloadTimer -= dt;
        if (reloadTimer <= 0) {
          isReloading = false;
          const needed = cw.clipSize - cw.clip;
          const toAdd = Math.min(needed, cw.reserve);
          cw.clip += toAdd;
          cw.reserve -= toAdd;
        }
      }

      if (fireCooldown > 0) fireCooldown -= dt;

      // 3. Firing Input (Click or Hold)
      let wantsFire = false;
      if (input && !player.isWasted && !player.isBusted) {
        wantsFire = cw.automatic ? input.isMouseDown : input.takeMousePressed();
      }

      // Calculate aiming angle
      let aimAngle = player.facingAngle;
      if (input && camera) {
        // Convert screen mouse coordinates to world coordinates
        const mouseX = input.mousePos.x;
        const mouseY = input.mousePos.y;
        const camW = camera.viewW || camera.w || 1280;
        const camH = camera.viewH || camera.h || 720;
        const worldMouseX = camera.x - (camW / 2) / camera.zoom + mouseX / camera.zoom;
        const worldMouseY = camera.y - (camH / 2) / camera.zoom + mouseY / camera.zoom;

        const originX = player.inCar ? player.inCar.x : player.x;
        const originY = player.inCar ? player.inCar.y : player.y;
        aimAngle = Math.atan2(worldMouseY - originY, worldMouseX - originX);
        player.aimAngle = aimAngle;

        // If player is on foot and aiming/firing, align player facing angle
        if (!player.inCar && (wantsFire || input.isMouseDown)) {
          let diff = aimAngle - player.facingAngle;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          player.facingAngle += diff * Math.min(1, 24 * dt);
        }
      }

      // Execute firing
      if (wantsFire && fireCooldown <= 0 && !isReloading) {
        if (cw.id !== 'fists' && cw.clip <= 0) {
          // Empty clip: auto trigger reload
          startReload();
        } else {
          // Perform attack / shot
          fireCooldown = cw.fireRate;
          if (cw.id !== 'fists') {
            cw.clip -= 1;
          }

          // Bullet trajectory calculation with spread
          const spreadAngle = (Math.random() - 0.5) * cw.spread;
          const shotAngle = aimAngle + spreadAngle;

          // Origin of shot
          let originX = player.x;
          let originY = player.y;

          if (player.inCar) {
            // Drive-by: originates from car window / side
            originX = player.inCar.x + Math.cos(shotAngle) * (player.inCar.w / 2 + 8);
            originY = player.inCar.y + Math.sin(shotAngle) * (player.inCar.w / 2 + 8);
          } else {
            // Foot: originates from player weapon barrel
            originX = player.x + Math.cos(shotAngle) * 16;
            originY = player.y + Math.sin(shotAngle) * 16;
          }

          const targetX = originX + Math.cos(shotAngle) * cw.range;
          const targetY = originY + Math.sin(shotAngle) * cw.range;

          // Muzzle flash
          if (cw.id !== 'fists') {
            muzzleFlashes.push({
              x: originX,
              y: originY,
              angle: shotAngle,
              life: 0.04,
              maxLife: 0.04,
            });

            // Ejected casing (brass)
            const casingAngle = shotAngle + Math.PI / 2 + (Math.random() - 0.5) * 0.3;
            const casingSpd = Math.random() * 80 + 50;
            casings.push({
              x: originX,
              y: originY,
              vx: Math.cos(casingAngle) * casingSpd,
              vy: Math.sin(casingAngle) * casingSpd,
              angle: Math.random() * Math.PI * 2,
              vRot: (Math.random() - 0.5) * 18,
              life: 4.0,
              maxLife: 4.0,
            });

            // Recoil & Screen shake
            if (!player.inCar) {
              player.vx -= Math.cos(shotAngle) * 30;
              player.vy -= Math.sin(shotAngle) * 30;
            }
            if (camera) {
              camera.screenShake(cw.id === 'smg' ? 2.5 : 4.0);
            }
          } else {
            // Fists punch screen shake
            if (camera) camera.screenShake(1.5);
          }

          // Raycast against world entities to find closest hit point
          let hitDist = cw.range;
          let hitPoint = { x: targetX, y: targetY };
          let hitType = null;
          let hitEntity = null;

          // A. Solids / Buildings
          const solidHit = raycastSolids(originX, originY, targetX, targetY, world.solids);
          if (solidHit && solidHit.dist < hitDist) {
            hitDist = solidHit.dist;
            hitPoint = { x: solidHit.x, y: solidHit.y };
            hitType = 'solid';
          }

          // B. Pedestrians
          if (pedestrians && pedestrians.list) {
            for (let i = 0; i < pedestrians.list.length; i++) {
              const p = pedestrians.list[i];
              if (p.isDead) continue;
              const seg = distToSegment(p.x, p.y, originX, originY, targetX, targetY);
              const distAlong = seg.t * cw.range;
              if (seg.dist < p.radius + 3 && distAlong < hitDist) {
                hitDist = distAlong;
                hitPoint = { x: seg.projX, y: seg.projY };
                hitType = 'ped';
                hitEntity = p;
              }
            }
          }

          // C. Police Officers (on foot)
          if (police && police.officers) {
            for (let i = 0; i < police.officers.length; i++) {
              const off = police.officers[i];
              if (off.isDead) continue;
              const seg = distToSegment(off.x, off.y, originX, originY, targetX, targetY);
              const distAlong = seg.t * cw.range;
              if (seg.dist < 14 && distAlong < hitDist) {
                hitDist = distAlong;
                hitPoint = { x: seg.projX, y: seg.projY };
                hitType = 'officer';
                hitEntity = off;
              }
            }
          }

          // D. Vehicles
          const allCars = [...(traffic ? traffic.cars : [])];
          if (police && police.cruisers) allCars.push(...police.cruisers);

          for (let i = 0; i < allCars.length; i++) {
            const car = allCars[i];
            if (car === player.inCar || car.isWreck) continue;
            const seg = distToSegment(car.x, car.y, originX, originY, targetX, targetY);
            const distAlong = seg.t * cw.range;
            if (seg.dist < car.radius * 0.8 && distAlong < hitDist) {
              hitDist = distAlong;
              hitPoint = { x: seg.projX, y: seg.projY };
              hitType = 'car';
              hitEntity = car;
            }
          }

          // Tracer line for gunfire
          if (cw.id !== 'fists') {
            tracers.push({
              x1: originX,
              y1: originY,
              x2: hitPoint.x,
              y2: hitPoint.y,
              life: 0.06,
              maxLife: 0.06,
            });
          }

          // Process Hit Outcomes
          if (hitType === 'solid') {
            // Impact sparks (orange/yellow bounce)
            for (let s = 0; s < 6; s++) {
              const spd = Math.random() * 80 + 30;
              const bounceAngle = shotAngle + Math.PI + (Math.random() - 0.5) * 1.5;
              sparks.push({
                x: hitPoint.x,
                y: hitPoint.y,
                vx: Math.cos(bounceAngle) * spd,
                vy: Math.sin(bounceAngle) * spd,
                life: Math.random() * 0.18 + 0.08,
                maxLife: 0.26,
                color: Math.random() > 0.4 ? '#ffbe0b' : '#ff5a1f',
              });
            }
            // Bullet hole decal
            bulletHoles.push({
              x: hitPoint.x,
              y: hitPoint.y,
              angle: shotAngle,
              life: 8.0,
              maxLife: 8.0,
            });
          } else if (hitType === 'ped' && hitEntity) {
            // Blood puff
            for (let b = 0; b < 6; b++) {
              const spd = Math.random() * 55 + 20;
              const bloodAngle = shotAngle + (Math.random() - 0.5) * 1.2;
              bloodPuffs.push({
                x: hitPoint.x,
                y: hitPoint.y,
                vx: Math.cos(bloodAngle) * spd,
                vy: Math.sin(bloodAngle) * spd,
                r: Math.random() * 3 + 2,
                life: Math.random() * 0.22 + 0.1,
                maxLife: 0.32,
              });
            }

            // Damage pedestrian
            if (hitEntity.damage) {
              hitEntity.damage(cw.damage, this, police);
            } else {
              hitEntity.state = 'dead';
              hitEntity.isDead = true;
              if (police && police.addWanted) police.addWanted(1);
            }
          } else if (hitType === 'officer' && hitEntity) {
            // Blood puff
            for (let b = 0; b < 7; b++) {
              const spd = Math.random() * 60 + 20;
              const bloodAngle = shotAngle + (Math.random() - 0.5) * 1.2;
              bloodPuffs.push({
                x: hitPoint.x,
                y: hitPoint.y,
                vx: Math.cos(bloodAngle) * spd,
                vy: Math.sin(bloodAngle) * spd,
                r: Math.random() * 3.5 + 2,
                life: Math.random() * 0.22 + 0.1,
                maxLife: 0.32,
              });
            }

            // Damage officer
            hitEntity.health -= cw.damage;
            if (hitEntity.health <= 0 && !hitEntity.isDead) {
              hitEntity.isDead = true;
              hitEntity.state = 'dead';
              // Killing an officer adds 2 wanted stars!
              if (police && police.addWanted) police.addWanted(2);
              // Drop money
              player.money += 40;
            }
          } else if (hitType === 'car' && hitEntity) {
            // Sparks on car metal
            for (let s = 0; s < 5; s++) {
              const spd = Math.random() * 70 + 25;
              const bounceAngle = shotAngle + Math.PI + (Math.random() - 0.5) * 1.4;
              sparks.push({
                x: hitPoint.x,
                y: hitPoint.y,
                vx: Math.cos(bounceAngle) * spd,
                vy: Math.sin(bounceAngle) * spd,
                life: Math.random() * 0.15 + 0.08,
                maxLife: 0.23,
                color: '#fff3b0',
              });
            }

            // Damage vehicle directly
            hitEntity.takeDamage(cw.damage * 0.85);
            hitEntity.health -= cw.damage * 0.85;

            // Vehicle explosion at 0 health
            if (hitEntity.health <= 0 && !hitEntity.isWreck) {
              spawnWreck(hitEntity, camera);
              // Blast damages nearby entities
              if (pedestrians && pedestrians.list) {
                for (const p of pedestrians.list) {
                  if (Math.hypot(p.x - hitEntity.x, p.y - hitEntity.y) < 85) {
                    if (p.damage) p.damage(100, this, police);
                    else { p.state = 'dead'; p.isDead = true; }
                  }
                }
              }
              if (police && police.officers) {
                for (const off of police.officers) {
                  if (Math.hypot(off.x - hitEntity.x, off.y - hitEntity.y) < 85) {
                    off.health = 0;
                    off.isDead = true;
                  }
                }
              }
              if (Math.hypot(player.x - hitEntity.x, player.y - hitEntity.y) < 85) {
                player.takeDamage(75);
              }
            }
          }
        }
      }

      // 4. Update Visual Effects Lifetimes
      // Tracers
      for (let i = tracers.length - 1; i >= 0; i--) {
        tracers[i].life -= dt;
        if (tracers[i].life <= 0) tracers.splice(i, 1);
      }

      // Muzzle flashes
      for (let i = muzzleFlashes.length - 1; i >= 0; i--) {
        muzzleFlashes[i].life -= dt;
        if (muzzleFlashes[i].life <= 0) muzzleFlashes.splice(i, 1);
      }

      // Casings
      for (let i = casings.length - 1; i >= 0; i--) {
        const c = casings[i];
        c.life -= dt;
        if (c.life <= 0) {
          casings.splice(i, 1);
        } else {
          c.x += c.vx * dt;
          c.y += c.vy * dt;
          c.vx *= Math.exp(-6 * dt);
          c.vy *= Math.exp(-6 * dt);
          c.angle += c.vRot * dt;
          c.vRot *= Math.exp(-5 * dt);
        }
      }

      // Sparks
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.life -= dt;
        if (s.life <= 0) {
          sparks.splice(i, 1);
        } else {
          s.x += s.vx * dt;
          s.y += s.vy * dt;
          s.vx *= Math.exp(-8 * dt);
          s.vy *= Math.exp(-8 * dt);
        }
      }

      // Blood puffs
      for (let i = bloodPuffs.length - 1; i >= 0; i--) {
        const b = bloodPuffs[i];
        b.life -= dt;
        if (b.life <= 0) {
          bloodPuffs.splice(i, 1);
        } else {
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          b.r += dt * 8;
        }
      }

      // Bullet holes
      for (let i = bulletHoles.length - 1; i >= 0; i--) {
        bulletHoles[i].life -= dt;
        if (bulletHoles[i].life <= 0) bulletHoles.splice(i, 1);
      }

      // Explosions
      for (let i = explosions.length - 1; i >= 0; i--) {
        const ex = explosions[i];
        ex.life -= dt;
        if (ex.life <= 0) {
          explosions.splice(i, 1);
        } else {
          const progress = 1 - (ex.life / ex.maxLife);
          ex.r = progress * ex.maxR;
          ex.shockR = progress * ex.maxShockR;
        }
      }

      // Burning wrecks
      for (let i = wrecks.length - 1; i >= 0; i--) {
        const wr = wrecks[i];
        wr.life -= dt;
        if (wr.life <= 0) {
          wrecks.splice(i, 1);
          continue;
        }

        // Damage entities that touch the burning wreck
        if (Math.hypot(player.x - wr.x, player.y - wr.y) < 32) {
          player.takeDamage(15 * dt);
        }

        // Emit fire & smoke
        wr.fireTimer += dt;
        if (wr.fireTimer > 0.08) {
          wr.fireTimer = 0;
          fireParticles.push({
            x: wr.x + (Math.random() - 0.5) * wr.w * 0.7,
            y: wr.y + (Math.random() - 0.5) * wr.l * 0.7,
            vx: (Math.random() - 0.5) * 20,
            vy: -Math.random() * 45 - 20,
            r: Math.random() * 6 + 4,
            life: 0.45,
            maxLife: 0.45,
            color: Math.random() > 0.5 ? '#ff3300' : '#ffcc00',
          });
        }

        wr.smokeTimer += dt;
        if (wr.smokeTimer > 0.12) {
          wr.smokeTimer = 0;
          smokeParticles.push({
            x: wr.x + (Math.random() - 0.5) * wr.w * 0.8,
            y: wr.y + (Math.random() - 0.5) * wr.l * 0.8,
            vx: (Math.random() - 0.5) * 25,
            vy: -Math.random() * 50 - 30,
            r: Math.random() * 8 + 8,
            life: 1.1,
            maxLife: 1.1,
          });
        }
      }

      // Fire particles
      for (let i = fireParticles.length - 1; i >= 0; i--) {
        const fp = fireParticles[i];
        fp.life -= dt;
        if (fp.life <= 0) {
          fireParticles.splice(i, 1);
        } else {
          fp.x += fp.vx * dt;
          fp.y += fp.vy * dt;
          fp.r = Math.max(1, fp.r - dt * 6);
        }
      }

      // Smoke particles
      for (let i = smokeParticles.length - 1; i >= 0; i--) {
        const sp = smokeParticles[i];
        sp.life -= dt;
        if (sp.life <= 0) {
          smokeParticles.splice(i, 1);
        } else {
          sp.x += sp.vx * dt;
          sp.y += sp.vy * dt;
          sp.r += dt * 10;
        }
      }
    },

    // Render world combat effects (called during world rendering before post-processing)
    drawWorld(ctx) {
      // 1. Bullet holes on solids/ground
      ctx.save();
      ctx.fillStyle = '#11151a';
      for (const bh of bulletHoles) {
        ctx.beginPath();
        ctx.arc(bh.x, bh.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. Spent brass casings
      ctx.fillStyle = '#d4af37';
      ctx.strokeStyle = '#996515';
      ctx.lineWidth = 0.5;
      for (const c of casings) {
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.angle);
        ctx.fillRect(-2, -1, 4, 2);
        ctx.strokeRect(-2, -1, 4, 2);
        ctx.restore();
      }

      // 3. Smoke plumes from burning wrecks
      for (const sp of smokeParticles) {
        const alpha = (sp.life / sp.maxLife) * 0.45;
        ctx.fillStyle = `rgba(32, 36, 44, ${alpha})`;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // 4. Fire particles from wrecks
      for (const fp of fireParticles) {
        const alpha = (fp.life / fp.maxLife) * 0.8;
        ctx.fillStyle = fp.color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(fp.x, fp.y, fp.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }

      // 5. Blood puffs
      for (const bp of bloodPuffs) {
        const alpha = (bp.life / bp.maxLife) * 0.75;
        ctx.fillStyle = `rgba(180, 15, 30, ${alpha})`;
        ctx.beginPath();
        ctx.arc(bp.x, bp.y, bp.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // 6. Impact sparks
      for (const sp of sparks) {
        const alpha = sp.life / sp.maxLife;
        ctx.fillStyle = sp.color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }

      // 7. Bullet Tracers (high-velocity luminous line)
      for (const tr of tracers) {
        const alpha = (tr.life / tr.maxLife);
        ctx.strokeStyle = `rgba(255, 235, 120, ${alpha})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(tr.x1, tr.y1);
        ctx.lineTo(tr.x2, tr.y2);
        ctx.stroke();

        // Inner white core
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(tr.x1, tr.y1);
        ctx.lineTo(tr.x2, tr.y2);
        ctx.stroke();
      }

      // 8. Muzzle flashes
      for (const mf of muzzleFlashes) {
        ctx.save();
        ctx.translate(mf.x, mf.y);
        ctx.rotate(mf.angle);
        ctx.fillStyle = '#fffae0';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(14, -6);
        ctx.lineTo(22, 0);
        ctx.lineTo(14, 6);
        ctx.closePath();
        ctx.fill();

        // Yellow glow aura
        ctx.fillStyle = 'rgba(255, 200, 50, 0.5)';
        ctx.beginPath();
        ctx.arc(10, 0, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 9. Explosions
      for (const ex of explosions) {
        const progress = 1 - (ex.life / ex.maxLife);

        // Shockwave ring
        ctx.strokeStyle = `rgba(255, 255, 255, ${(1 - progress) * 0.5})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(ex.x, ex.y, ex.shockR, 0, Math.PI * 2);
        ctx.stroke();

        // Layered fireball
        const grad = ctx.createRadialGradient(ex.x, ex.y, 0, ex.x, ex.y, ex.r);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.3, '#ffea00');
        grad.addColorStop(0.65, '#ff4800');
        grad.addColorStop(1, 'rgba(40, 10, 10, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(ex.x, ex.y, ex.r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    },
  };
}