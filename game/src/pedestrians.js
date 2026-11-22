// SUNBURN CITY - Pedestrian Simulation & Rendering
// ~130 pedestrians on sidewalks:
// - Walk along sidewalks with 2-frame animated walk cycle
// - Pause and chat in pairs with subtle gestures
// - Cross at crosswalks in small groups
// - Varied skin tones, 80s hairstyles, vibrant pastel clothing, beachwear
// - Panic state: arms raised over head, running away from fast cars, gunfire, collisions
// - Knockdown state: get hit by cars, knocked flat, recover and flee
// - Provides peds.nearest(pos, radius) and peds.spawnFleeing(x, y, fromX, fromY)

import { createRng } from './rng.js';

export function createPedestrians(world, seed = 77) {
  const rng = createRng(seed);

  const avenues = [140, 600, 1080, 1560, 2040, 2520, 3000, 3520];
  const streets = [120, 540, 980, 1420, 1860, 2300, 2740, 3100];
  const PROMENADE_X = 3580; // Beachfront Promenade sidewalk center

  const SKIN_TONES = ['#e8ab7b', '#fcd0a1', '#6f4e37', '#c68642', '#4a2c11', '#dab08c'];
  const HAIR_COLORS = ['#2c1810', '#ffd166', '#111111', '#b23a22', '#a0a0a0', '#4a3728'];
  const HAIR_STYLES = ['slick', 'afro', 'long', 'short', 'bob', 'mullet'];
  const SHIRT_COLORS = [
    '#ff5964', // Coral
    '#4fd3cf', // Pastel teal
    '#ffea00', // Neon yellow
    '#f7ede2', // Cream
    '#ff70a6', // Hot pink
    '#3a86ff', // Azure
    '#8338ec', // Violet
    '#fb5607', // Tangerine
    '#06d6a0', // Mint
  ];
  const PANTS_COLORS = [
    '#f8f9fa', // White pants / shorts
    '#1d3557', // Navy denim
    '#457b9d', // Pastel blue jeans
    '#ffbe0b', // Yellow shorts
    '#ff006e', // Pink shorts
    '#2b2d42', // Charcoal trousers
    '#d90429', // Red swim trunks
  ];

  const peds = [];

  function createPed(x, y, facingAngle = 0, isBeach = false) {
    const skin = rng.pick(SKIN_TONES);
    const hair = rng.pick(HAIR_COLORS);
    const hairStyle = rng.pick(HAIR_STYLES);
    const shirt = rng.pick(SHIRT_COLORS);
    const pants = rng.pick(PANTS_COLORS);
    const isSwimwear = isBeach && rng.chance(0.65);

    return {
      x,
      y,
      vx: 0,
      vy: 0,
      speed: rng.range(38, 54),
      facingAngle,
      targetAngle: facingAngle,
      walkCycle: rng.range(0, Math.PI * 2),
      radius: 9,
      isBeach,
      isSwimwear,
      health: 40,
      isDead: false,

      // Appearance
      skin,
      hair,
      hairStyle,
      shirt,
      pants,

      // State machine
      state: 'walking', // 'walking', 'chatting', 'crossing', 'panicking', 'knocked_down', 'dead'
      stateTimer: rng.range(5, 18),
      chatPartner: null,
      panicTimer: 0,
      knockdownTimer: 0,
      crossTarget: null,

      damage(amount, combat, police) {
        if (this.isDead) return;
        this.health -= amount;
        if (this.health <= 0) {
          this.health = 0;
          this.isDead = true;
          this.state = 'dead';
          this.vx = 0;
          this.vy = 0;
          if (police && police.addWanted) {
            police.addWanted(1);
          }
        } else {
          this.triggerPanic(this.x - Math.cos(this.facingAngle) * 60, this.y - Math.sin(this.facingAngle) * 60);
        }
      },

      update(dt, cars, player, solids) {
        // Dead ragdoll state
        if (this.state === 'dead' || this.isDead) {
          this.vx = 0;
          this.vy = 0;
          return;
        }

        // 1. Knocked down state (hit by car)
        if (this.state === 'knocked_down') {
          this.knockdownTimer -= dt;
          this.vx *= Math.exp(-6 * dt);
          this.vy *= Math.exp(-6 * dt);
          this.x += this.vx * dt;
          this.y += this.vy * dt;

          if (this.knockdownTimer <= 0) {
            // Stand up into panic!
            this.state = 'panicking';
            this.panicTimer = rng.range(5, 8);
            this.targetAngle = rng.range(0, Math.PI * 2);
          }
          return;
        }

        // 2. Panic state (running away with arms raised)
        if (this.state === 'panicking') {
          this.panicTimer -= dt;
          const sprintSpeed = 175;
          this.vx = Math.cos(this.facingAngle) * sprintSpeed;
          this.vy = Math.sin(this.facingAngle) * sprintSpeed;
          this.walkCycle += sprintSpeed * dt * 0.12;

          this.x += this.vx * dt;
          this.y += this.vy * dt;

          // Clamping to world bounds
          this.x = Math.max(30, Math.min(world.w - 30, this.x));
          this.y = Math.max(30, Math.min(world.h - 30, this.y));

          if (this.panicTimer <= 0) {
            this.state = 'walking';
            this.stateTimer = rng.range(6, 15);
          }
          return;
        }

        // 3. Chatting in pairs
        if (this.state === 'chatting') {
          this.stateTimer -= dt;
          this.vx = 0;
          this.vy = 0;
          if (this.stateTimer <= 0) {
            this.state = 'walking';
            this.stateTimer = rng.range(8, 20);
            this.targetAngle = rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
            if (this.chatPartner) {
              this.chatPartner.state = 'walking';
              this.chatPartner.stateTimer = rng.range(8, 20);
              this.chatPartner = null;
            }
          }
          return;
        }

        // 4. Crossing crosswalk
        if (this.state === 'crossing') {
          if (this.crossTarget) {
            const dx = this.crossTarget.x - this.x;
            const dy = this.crossTarget.y - this.y;
            const dist = Math.hypot(dx, dy);

            if (dist < 12) {
              // Finished crossing street
              this.state = 'walking';
              this.stateTimer = rng.range(10, 25);
              this.crossTarget = null;
            } else {
              this.targetAngle = Math.atan2(dy, dx);
              const crossSpeed = this.speed * 1.15;
              this.vx = Math.cos(this.targetAngle) * crossSpeed;
              this.vy = Math.sin(this.targetAngle) * crossSpeed;
              this.walkCycle += crossSpeed * dt * 0.08;
              this.x += this.vx * dt;
              this.y += this.vy * dt;
            }
          } else {
            this.state = 'walking';
          }
          return;
        }

        // 5. Standard walking along sidewalk
        this.stateTimer -= dt;

        // Turn around or change direction periodically
        if (this.stateTimer <= 0) {
          this.stateTimer = rng.range(8, 20);
          if (this.isBeach) {
            // Beach promenade: walk mostly North or South
            this.targetAngle = (this.facingAngle > 0) ? -Math.PI / 2 : Math.PI / 2;
          } else {
            this.targetAngle = rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
          }
        }

        // Smooth facing angle
        let diff = this.targetAngle - this.facingAngle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        this.facingAngle += diff * Math.min(1, 8 * dt);

        this.vx = Math.cos(this.facingAngle) * this.speed;
        this.vy = Math.sin(this.facingAngle) * this.speed;
        this.walkCycle += this.speed * dt * 0.08;

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Keep within world boundaries
        if (this.isBeach) {
          // Promenade sidewalk range: X = 3564 to 3596
          if (this.x < 3564) { this.x = 3564; this.targetAngle = Math.PI / 2; }
          if (this.x > 3596) { this.x = 3596; this.targetAngle = -Math.PI / 2; }
          if (this.y < 80) { this.y = 80; this.targetAngle = Math.PI / 2; }
          if (this.y > world.h - 80) { this.y = world.h - 80; this.targetAngle = -Math.PI / 2; }
        } else {
          if (this.x < 40) { this.x = 40; this.targetAngle = 0; }
          if (this.x > world.w - 40) { this.x = world.w - 40; this.targetAngle = Math.PI; }
          if (this.y < 40) { this.y = 40; this.targetAngle = Math.PI / 2; }
          if (this.y > world.h - 40) { this.y = world.h - 40; this.targetAngle = -Math.PI / 2; }
        }

        // Sidewalk building collision
        if (solids) {
          const r = this.radius;
          for (let i = 0; i < solids.length; i++) {
            const s = solids[i];
            if (this.x + r > s.x && this.x - r < s.x + s.w &&
                this.y + r > s.y && this.y - r < s.y + s.h) {
              // Bumped building: reverse direction
              this.targetAngle += Math.PI;
              this.facingAngle = this.targetAngle;
              this.x += Math.cos(this.targetAngle) * 6;
              this.y += Math.sin(this.targetAngle) * 6;
              break;
            }
          }
        }
      },

      triggerPanic(fromX, fromY) {
        this.state = 'panicking';
        this.panicTimer = rng.range(5, 8);
        const awayAngle = Math.atan2(this.y - fromY, this.x - fromX);
        this.facingAngle = awayAngle + (Math.random() - 0.5) * 0.5;
        this.targetAngle = this.facingAngle;
      },

      draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        // Ground shadow
        ctx.fillStyle = 'rgba(12, 16, 24, 0.35)';
        ctx.beginPath();
        ctx.ellipse(6, 7, 10, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        if (this.state === 'dead' || this.isDead) {
          // Dead civilian ragdoll on ground with blood pool
          ctx.rotate(this.facingAngle);
          // Blood pool
          ctx.fillStyle = 'rgba(170, 16, 28, 0.6)';
          ctx.beginPath();
          ctx.ellipse(0, 0, 13, 8, 0, 0, Math.PI * 2);
          ctx.fill();

          // Splayed body
          ctx.fillStyle = this.shirt;
          ctx.fillRect(-8, -6, 16, 12);
          ctx.fillStyle = this.skin;
          ctx.beginPath();
          ctx.arc(10, 0, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = this.hair;
          ctx.beginPath();
          ctx.arc(12, 0, 4.5, -Math.PI / 2, Math.PI / 2);
          ctx.fill();
          ctx.fillStyle = this.pants;
          ctx.fillRect(-14, -7, 7, 4);
          ctx.fillRect(-14, 3, 7, 4);

          ctx.restore();
          return;
        }

        if (this.state === 'knocked_down') {
          // Lying flat on ground
          ctx.rotate(this.facingAngle);
          // Torso
          ctx.fillStyle = this.shirt;
          ctx.fillRect(-8, -6, 16, 12);
          // Head
          ctx.fillStyle = this.skin;
          ctx.beginPath();
          ctx.arc(12, 0, 5.5, 0, Math.PI * 2);
          ctx.fill();
          // Hair
          ctx.fillStyle = this.hair;
          ctx.beginPath();
          ctx.arc(14, 0, 5, -Math.PI / 2, Math.PI / 2);
          ctx.fill();
          // Legs splayed
          ctx.fillStyle = this.pants;
          ctx.fillRect(-15, -7, 8, 4);
          ctx.fillRect(-15, 3, 8, 4);

          // Cartoon dazed stars circling head
          const starAngle = (Date.now() * 0.006) % (Math.PI * 2);
          ctx.fillStyle = '#ffea00';
          for (let st = 0; st < 3; st++) {
            const a = starAngle + st * (Math.PI * 2 / 3);
            const sx = 12 + Math.cos(a) * 9;
            const sy = Math.sin(a) * 6;
            ctx.beginPath();
            ctx.arc(sx, sy, 2, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.restore();
          return;
        }

        ctx.rotate(this.facingAngle);

        const isMoving = Math.hypot(this.vx, this.vy) > 3;
        // 2-frame walk cycle swing
        const legSwing = isMoving ? Math.sin(this.walkCycle) * 5 : 0;
        const armSwing = isMoving ? Math.sin(this.walkCycle) * 4 : 0;
        const isPanic = (this.state === 'panicking');

        // Legs / Pants
        ctx.fillStyle = this.isSwimwear ? this.skin : this.pants;
        // Left leg
        ctx.beginPath();
        ctx.roundRect(-6 + legSwing, -7, 12, 4.5, 2);
        ctx.fill();
        // Right leg
        ctx.beginPath();
        ctx.roundRect(-6 - legSwing, 2.5, 12, 4.5, 2);
        ctx.fill();

        // Torso
        ctx.fillStyle = this.shirt;
        ctx.beginPath();
        ctx.roundRect(-5, -6, 11, 12, 3);
        ctx.fill();

        // Arms
        if (isPanic) {
          // Both arms raised high over head in panic!
          ctx.fillStyle = this.isSwimwear ? this.skin : this.shirt;
          // Left arm up
          ctx.fillRect(4, -8, 7, 3);
          // Right arm up
          ctx.fillRect(4, 5, 7, 3);
          // Hands
          ctx.fillStyle = this.skin;
          ctx.beginPath();
          ctx.arc(11, -7, 2, 0, Math.PI * 2);
          ctx.arc(11, 7, 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Normal arm swing
          ctx.fillStyle = this.isSwimwear ? this.skin : this.shirt;
          // Left arm
          ctx.fillRect(-3 - armSwing, -9, 8, 3);
          // Right arm
          ctx.fillRect(-3 + armSwing, 6, 8, 3);
          // Hands
          ctx.fillStyle = this.skin;
          ctx.beginPath();
          ctx.arc(5 - armSwing, -7.5, 2, 0, Math.PI * 2);
          ctx.arc(5 + armSwing, 7.5, 2, 0, Math.PI * 2);
          ctx.fill();
        }

        // Head
        ctx.fillStyle = this.skin;
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fill();

        // Hair
        ctx.fillStyle = this.hair;
        ctx.beginPath();
        if (this.hairStyle === 'afro') {
          ctx.arc(-1, 0, 6.5, 0, Math.PI * 2);
        } else if (this.hairStyle === 'slick') {
          ctx.arc(-2, 0, 5, Math.PI * 0.4, Math.PI * 1.6);
        } else if (this.hairStyle === 'long') {
          ctx.arc(-2, 0, 6, Math.PI * 0.3, Math.PI * 1.7);
        } else {
          ctx.arc(-1.5, 0, 5, Math.PI * 0.4, Math.PI * 1.6);
        }
        ctx.fill();

        // Sunglasses on beachgoers
        if (this.isBeach || rng.chance(0.35)) {
          ctx.fillStyle = '#11161d';
          ctx.fillRect(2.5, -3.5, 2.5, 2.5);
          ctx.fillRect(2.5, 1, 2.5, 2.5);
        }

        ctx.restore();
      },
    };
  }

  // Populate ~130 pedestrians
  // 1. Beachfront Promenade (Ocean Drive east sidewalk): X = 3580, high density ~45 peds
  for (let y = 100; y < world.h - 100; y += 70) {
    const angle = rng.pick([Math.PI / 2, -Math.PI / 2]); // Walking South or North
    peds.push(createPed(PROMENADE_X + rng.range(-12, 12), y, angle, true));
  }

  // 2. West sidewalk along Ocean Drive Boulevard: X = 3465
  for (let y = 140; y < world.h - 140; y += 120) {
    const angle = rng.pick([Math.PI / 2, -Math.PI / 2]);
    peds.push(createPed(3465 + rng.range(-6, 6), y, angle, false));
  }

  // 3. Central Park: ~25 peds
  if (world.park) {
    for (let k = 0; k < 25; k++) {
      const px = rng.range(world.park.x + 30, world.park.x + world.park.w - 30);
      const py = rng.range(world.park.y + 30, world.park.y + world.park.h - 30);
      peds.push(createPed(px, py, rng.range(0, Math.PI * 2), false));
    }
  }

  // 4. Sidewalks along other Avenues & Streets: ~45 peds
  for (let a = 1; a < 6; a++) {
    const avX = avenues[a];
    for (let y = 200; y < world.h - 200; y += 380) {
      const sideX = rng.chance(0.5) ? avX - 42 : avX + 42;
      peds.push(createPed(sideX, y, rng.pick([Math.PI / 2, -Math.PI / 2]), false));
    }
  }

  for (let s = 1; s < streets.length - 1; s++) {
    const stY = streets[s];
    for (let x = 200; x < 3200; x += 400) {
      const sideY = rng.chance(0.5) ? stY - 42 : stY + 42;
      peds.push(createPed(x, sideY, rng.pick([0, Math.PI]), false));
    }
  }

  // Trim or adjust to ~130 pedestrians
  while (peds.length > 135) {
    peds.pop();
  }

  return {
    list: peds,

    nearest(pos, radius = 60) {
      let closest = null;
      let closestDist = radius;
      for (let i = 0; i < peds.length; i++) {
        const p = peds[i];
        const d = Math.hypot(p.x - pos.x, p.y - pos.y);
        if (d < closestDist) {
          closestDist = d;
          closest = p;
        }
      }
      return closest;
    },

    spawnFleeing(x, y, fromX, fromY) {
      const ped = createPed(x, y, 0, false);
      ped.triggerPanic(fromX, fromY);
      peds.push(ped);
      return ped;
    },

    triggerPanic(pos, radius = 120) {
      for (let i = 0; i < peds.length; i++) {
        const p = peds[i];
        const dist = Math.hypot(p.x - pos.x, p.y - pos.y);
        if (dist < radius) {
          p.triggerPanic(pos.x, pos.y);
        }
      }
    },

    update(dt, cars, player, solids) {
      // 1. Update each pedestrian
      for (let i = 0; i < peds.length; i++) {
        const p = peds[i];
        p.update(dt, cars, player, solids);

        // 2. Pair chatting check (if walking near another walking ped)
        if (p.state === 'walking' && rng.chance(0.015)) {
          for (let j = i + 1; j < peds.length; j++) {
            const other = peds[j];
            if (other.state === 'walking' && Math.hypot(p.x - other.x, p.y - other.y) < 24) {
              p.state = 'chatting';
              p.stateTimer = rng.range(8, 16);
              p.chatPartner = other;
              p.facingAngle = Math.atan2(other.y - p.y, other.x - p.x);

              other.state = 'chatting';
              other.stateTimer = p.stateTimer;
              other.chatPartner = p;
              other.facingAngle = Math.atan2(p.y - other.y, p.x - other.x);
              break;
            }
          }
        }

        // 3. Collision with moving cars (run-over mechanic & panic)
        for (let c = 0; c < cars.length; c++) {
          const car = cars[c];
          const dist = Math.hypot(p.x - car.x, p.y - car.y);

          // Fast car approaching panic
          if (dist < 70 && car.speed > 80 && p.state !== 'knocked_down' && p.state !== 'panicking') {
            p.triggerPanic(car.x, car.y);
          }

          // Direct car hit / run-over
          if (dist < car.radius + p.radius) {
            if (car.speed > 40 && p.state !== 'knocked_down') {
              p.state = 'knocked_down';
              p.knockdownTimer = 2.5;
              // Impulse from car
              const normX = car.vx / car.speed;
              const normY = car.vy / car.speed;
              p.vx = normX * (car.speed * 0.65);
              p.vy = normY * (car.speed * 0.65);
              p.facingAngle = Math.atan2(p.vy, p.vx);
            }
          }
        }

        // Player on foot attack/panic
        if (player && !player.inCar) {
          const pDist = Math.hypot(p.x - player.x, p.y - player.y);
          if (pDist < 25 && player.speed > 180 && p.state !== 'knocked_down') {
            p.triggerPanic(player.x, player.y);
          }
        }
      }
    },
  };
}
