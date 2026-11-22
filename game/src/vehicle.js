// SUNBURN CITY - Vehicle Simulation & Rendering
// Arcade vehicle physics: acceleration, braking, reverse, speed-scaled steering,
// lateral grip, handbrake drifting on Space with skid marks, mass-based collisions,
// exhaust smoke puffs, body deformation/damage tint, headlights/taillights glow.

export const CAR_TYPES = {
  sports: {
    name: 'CHEETAH',
    w: 24,
    l: 48,
    mass: 1100,
    maxSpeed: 340,
    reverseSpeed: -90,
    engineForce: 950,
    brakeForce: 1300,
    lateralGrip: 17.0,
    driftGrip: 4.2,
    turnSpeed: 3.1,
    colors: ['#e63946', '#ffffff', '#ffd166', '#06d6a0', '#ff007f', '#3a86ff'],
  },
  sedan: {
    name: 'STALLION',
    w: 22,
    l: 45,
    mass: 1350,
    maxSpeed: 260,
    reverseSpeed: -75,
    engineForce: 720,
    brakeForce: 1050,
    lateralGrip: 16.0,
    driftGrip: 3.8,
    turnSpeed: 2.7,
    colors: ['#457b9d', '#2b2d42', '#a8dadc', '#d90429', '#f4a261', '#588157', '#e29578'],
  },
  taxi: {
    name: 'VICE CAB',
    w: 22,
    l: 45,
    mass: 1380,
    maxSpeed: 250,
    reverseSpeed: -70,
    engineForce: 700,
    brakeForce: 1000,
    lateralGrip: 16.0,
    driftGrip: 3.8,
    turnSpeed: 2.7,
    colors: ['#f4b41a'],
    hasTaxiSign: true,
  },
  van: {
    name: 'RUMPO',
    w: 26,
    l: 50,
    mass: 1900,
    maxSpeed: 205,
    reverseSpeed: -60,
    engineForce: 640,
    brakeForce: 920,
    lateralGrip: 14.0,
    driftGrip: 3.0,
    turnSpeed: 2.3,
    colors: ['#6c757d', '#495057', '#343a40', '#adb5bd', '#5c677d', '#8d99ae'],
  },
  pickup: {
    name: 'BOBCAT',
    w: 25,
    l: 49,
    mass: 1680,
    maxSpeed: 230,
    reverseSpeed: -65,
    engineForce: 700,
    brakeForce: 980,
    lateralGrip: 15.0,
    driftGrip: 3.4,
    turnSpeed: 2.5,
    colors: ['#8b5a2b', '#2f4f4f', '#a0522d', '#708090', '#b22222', '#334155'],
    hasOpenBed: true,
  },
  police: {
    name: 'VCPD CRUISER',
    w: 23,
    l: 46,
    mass: 1420,
    maxSpeed: 295,
    reverseSpeed: -80,
    engineForce: 840,
    brakeForce: 1150,
    lateralGrip: 17.0,
    driftGrip: 4.0,
    turnSpeed: 2.9,
    colors: ['#ffffff'],
    hasLightbar: true,
  },
};

export function createCar(x = 0, y = 0, angle = 0, type = 'sedan', color = null) {
  const config = CAR_TYPES[type] || CAR_TYPES.sedan;
  const carColor = color || config.colors[0];

  return {
    x,
    y,
    angle, // in radians, 0 = facing East, Math.PI/2 = South
    type,
    name: config.name,
    color: carColor,
    w: config.w,
    l: config.l,
    mass: config.mass,
    maxSpeed: config.maxSpeed,
    reverseSpeed: config.reverseSpeed,
    engineForce: config.engineForce,
    brakeForce: config.brakeForce,
    lateralGrip: config.lateralGrip,
    driftGrip: config.driftGrip,
    turnSpeed: config.turnSpeed,
    hasTaxiSign: !!config.hasTaxiSign,
    hasOpenBed: !!config.hasOpenBed,
    hasLightbar: !!config.hasLightbar,

    // Dynamics
    vx: 0,
    vy: 0,
    steerAngle: 0,
    speed: 0,
    isBraking: false,
    isReversing: false,
    isDrifting: false,
    throttle: 0,

    // State & Visuals
    health: 100,
    damage: 0, // 0 to 1
    honkTimer: 0,
    driver: null,
    isPlayerCar: false,
    indicator: null, // 'left' | 'right' | null
    indicatorTimer: 0,
    sirenTimer: 0,

    // Particles & marks
    exhaustTimer: 0,
    exhaustPuffs: [],
    skidTimer: 0,
    skidMarks: [],
    prevRlX: null,
    prevRlY: null,
    prevRrX: null,
    prevRrY: null,

    // Bounding circle radius for quick collision checks
    radius: Math.hypot(config.w, config.l) * 0.48,

    rect() {
      return {
        x: this.x - this.w / 2,
        y: this.y - this.l / 2,
        w: this.w,
        h: this.l,
      };
    },

    // Oriented 4 corners
    getCorners() {
      const cos = Math.cos(this.angle);
      const sin = Math.sin(this.angle);
      const hw = this.w * 0.48;
      const hl = this.l * 0.48;

      return [
        { x: this.x + cos * hl - sin * hw, y: this.y + sin * hl + cos * hw }, // Front-Right
        { x: this.x + cos * hl + sin * hw, y: this.y + sin * hl - cos * hw }, // Front-Left
        { x: this.x - cos * hl + sin * hw, y: this.y - sin * hl - cos * hw }, // Rear-Left
        { x: this.x - cos * hl - sin * hw, y: this.y - sin * hl + cos * hw }, // Rear-Right
      ];
    },

    update(dt, input, solids, worldW = 4400, worldH = 3200) {
      // 1. Process Input
      let throttle = 0;
      let steer = 0;
      let handbrake = false;

      if (input) {
        if (typeof input.axes === 'function') {
          const axes = input.axes();
          steer = axes.x;
          // In top-down arcade: W / Up is throttle forward (-y in screen axes = forward for player)
          if (axes.y < -0.2) throttle = 1;
          else if (axes.y > 0.2) throttle = -1;
        } else {
          if (input.up) throttle += 1;
          if (input.down) throttle -= 1;
          if (input.left) steer -= 1;
          if (input.right) steer += 1;
        }
        handbrake = !!input.space || !!input.handbrake || (typeof input.isHeld === 'function' && input.isHeld('space'));
      }

      this.throttle = throttle;

      // 2. Local coordinate vectors
      const fwdX = Math.cos(this.angle);
      const fwdY = Math.sin(this.angle);
      const rightX = -Math.sin(this.angle);
      const rightY = Math.cos(this.angle);

      // Current forward and lateral speeds
      let fwdSpeed = this.vx * fwdX + this.vy * fwdY;
      let latSpeed = this.vx * rightX + this.vy * rightY;

      this.isBraking = false;
      this.isReversing = false;

      // 3. Engine Force & Braking
      if (throttle > 0) {
        if (fwdSpeed < -10) {
          // Braking while rolling backwards
          fwdSpeed += this.brakeForce * dt;
          this.isBraking = true;
        } else {
          // Normal forward drive
          const maxSpd = this.maxSpeed * (1 - this.damage * 0.35);
          if (fwdSpeed < maxSpd) {
            fwdSpeed += this.engineForce * dt;
          }
        }
      } else if (throttle < 0) {
        if (fwdSpeed > 15) {
          // Braking while moving forward
          fwdSpeed -= this.brakeForce * dt;
          this.isBraking = true;
        } else {
          // Reverse
          if (fwdSpeed > this.reverseSpeed) {
            fwdSpeed -= this.engineForce * 0.75 * dt;
          }
          this.isReversing = true;
        }
      } else {
        // Rolling resistance / coasting drag
        fwdSpeed *= Math.exp(-0.75 * dt);
        if (Math.abs(fwdSpeed) < 1.5) fwdSpeed = 0;
      }

      // 4. Steering (Speed-scaled)
      const absFwd = Math.abs(fwdSpeed);
      const speedScale = 1 / (1 + absFwd * 0.0035);
      const targetSteer = steer * speedScale;
      this.steerAngle += (targetSteer - this.steerAngle) * Math.min(1, 14 * dt);

      // 5. Lateral Grip & Handbrake Drift
      const grip = handbrake ? this.driftGrip : this.lateralGrip;
      const latDamp = Math.exp(-grip * dt);
      latSpeed *= latDamp;

      this.isDrifting = handbrake && absFwd > 40 && Math.abs(steer) > 0.1;

      // Yaw rotation (turning the car)
      const moveDir = fwdSpeed >= 0 ? 1 : -0.7;
      let yawRate = this.steerAngle * this.turnSpeed * moveDir * Math.min(1, absFwd / 70);
      if (handbrake && absFwd > 30) {
        // Extra drift yaw kick
        yawRate *= 1.45;
      }
      this.angle += yawRate * dt;

      // Recompose velocity vector
      this.vx = fwdSpeed * fwdX + latSpeed * rightX;
      this.vy = fwdSpeed * fwdY + latSpeed * rightY;
      this.speed = Math.hypot(this.vx, this.vy);

      // 6. Tyre Skid Marks Generation (Dual longitudinal tracks)
      const slipSpeed = Math.abs(latSpeed);
      const rearOffset = this.l * 0.36;
      const halfTrack = this.w * 0.38;

      const isSlipping = (this.isDrifting || slipSpeed > 50 || (this.isBraking && absFwd > 100)) && this.speed > 25;

      // Rear wheel world positions
      const rlX = this.x - fwdX * rearOffset - rightX * halfTrack;
      const rlY = this.y - fwdY * rearOffset - rightY * halfTrack;
      const rrX = this.x - fwdX * rearOffset + rightX * halfTrack;
      const rrY = this.y - fwdY * rearOffset + rightY * halfTrack;

      if (isSlipping) {
        this.skidTimer += dt;
        if (this.skidTimer > 0.03) {
          this.skidTimer = 0;
          if (this.prevRlX !== null) {
            this.skidMarks.push({
              x1: this.prevRlX, y1: this.prevRlY,
              x2: rlX, y2: rlY,
              life: 8.0, maxLife: 8.0,
            });
            this.skidMarks.push({
              x1: this.prevRrX, y1: this.prevRrY,
              x2: rrX, y2: rrY,
              life: 8.0, maxLife: 8.0,
            });
            if (this.skidMarks.length > 140) {
              this.skidMarks.splice(0, 2);
            }
          }
        }
      }

      this.prevRlX = rlX;
      this.prevRlY = rlY;
      this.prevRrX = rrX;
      this.prevRrY = rrY;

      // Update skid marks lifetimes
      for (let i = this.skidMarks.length - 1; i >= 0; i--) {
        this.skidMarks[i].life -= dt;
        if (this.skidMarks[i].life <= 0) {
          this.skidMarks.splice(i, 1);
        }
      }

      // 7. Exhaust Puffs while accelerating
      if (throttle > 0 && absFwd > 15) {
        this.exhaustTimer += dt;
        if (this.exhaustTimer > 0.08) {
          this.exhaustTimer = 0;
          const tailX = this.x - fwdX * (this.l * 0.48) - rightX * (this.w * 0.28);
          const tailY = this.y - fwdY * (this.l * 0.48) - rightY * (this.w * 0.28);
          this.exhaustPuffs.push({
            x: tailX,
            y: tailY,
            vx: -fwdX * 25 + (Math.random() - 0.5) * 15,
            vy: -fwdY * 25 + (Math.random() - 0.5) * 15,
            r: 3,
            maxR: 9,
            life: 0.32,
            maxLife: 0.32,
          });
          if (this.exhaustPuffs.length > 25) this.exhaustPuffs.shift();
        }
      }

      // Update exhaust puffs
      for (let i = this.exhaustPuffs.length - 1; i >= 0; i--) {
        const p = this.exhaustPuffs[i];
        p.life -= dt;
        if (p.life <= 0) {
          this.exhaustPuffs.splice(i, 1);
        } else {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.r += dt * 14;
        }
      }

      // 8. Timers: honk, indicators, siren
      if (this.honkTimer > 0) this.honkTimer -= dt;
      this.indicatorTimer += dt;
      this.sirenTimer += dt * 8;

      // 9. Position update and Solid Collisions
      const prevX = this.x;
      const prevY = this.y;
      this.x += this.vx * dt;
      this.y += this.vy * dt;

      // Collision with solid buildings
      if (solids) {
        const r = this.radius * 0.85;
        for (let i = 0; i < solids.length; i++) {
          const s = solids[i];
          // Quick AABB circle check
          if (this.x + r > s.x && this.x - r < s.x + s.w &&
              this.y + r > s.y && this.y - r < s.y + s.h) {
            // Find closest point on solid box
            const nearestX = Math.max(s.x, Math.min(s.x + s.w, this.x));
            const nearestY = Math.max(s.y, Math.min(s.y + s.h, this.y));
            const diffX = this.x - nearestX;
            const diffY = this.y - nearestY;
            const dist = Math.hypot(diffX, diffY);

            if (dist < r) {
              const overlap = r - dist;
              let nx = dist > 0.001 ? diffX / dist : 0;
              let ny = dist > 0.001 ? diffY / dist : 1;

              // Push car back
              this.x += nx * overlap;
              this.y += ny * overlap;

              // Impact response
              const impactDot = this.vx * nx + this.vy * ny;
              if (impactDot < 0) {
                // Hard impact
                const impactSpeed = Math.abs(impactDot);
                if (impactSpeed > 45) {
                  this.takeDamage(impactSpeed * 0.08);
                  if (this.onImpact) this.onImpact(impactSpeed);
                }
                // Deflect with restitution
                this.vx -= 1.35 * impactDot * nx;
                this.vy -= 1.35 * impactDot * ny;
                this.vx *= 0.55;
                this.vy *= 0.55;
              }
            }
          }
        }
      }

      // World boundary clamping
      if (worldW && worldH) {
        const r = this.radius;
        if (this.x < r) { this.x = r; this.vx = 0; }
        if (this.x > worldW - r) { this.x = worldW - r; this.vx = 0; }
        if (this.y < r) { this.y = r; this.vy = 0; }
        if (this.y > worldH - r) { this.y = worldH - r; this.vy = 0; }
      }
    },

    takeDamage(amount) {
      if (this.isWreck) return;
      this.damage = Math.min(1, this.damage + amount * 0.015);
      this.health = Math.max(0, this.health - amount);
      if (this.health <= 0) {
        this.isWreck = true;
        this.health = 0;
        this.damage = 1;
        this.color = '#181a20';
        this.speed = 0;
        this.vx = 0;
        this.vy = 0;
      }
    },

    // Collide with another car
    collideCar(other) {
      const dx = other.x - this.x;
      const dy = other.y - this.y;
      const dist = Math.hypot(dx, dy);
      const minDist = (this.radius + other.radius) * 0.72;

      if (dist < minDist && dist > 0.001) {
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = minDist - dist;

        // Mass-based separation
        const totalMass = this.mass + other.mass;
        const ratioThis = other.mass / totalMass;
        const ratioOther = this.mass / totalMass;

        this.x -= nx * overlap * ratioThis;
        this.y -= ny * overlap * ratioThis;
        other.x += nx * overlap * ratioOther;
        other.y += ny * overlap * ratioOther;

        // Exchange momentum along collision normal
        const kx = this.vx - other.vx;
        const ky = this.vy - other.vy;
        const impact = kx * nx + ky * ny;

        if (impact > 0) {
          const impulse = (1.3 * impact) / (1 / this.mass + 1 / other.mass);
          this.vx -= (impulse / this.mass) * nx;
          this.vy -= (impulse / this.mass) * ny;
          other.vx += (impulse / other.mass) * nx;
          other.vy += (impulse / other.mass) * ny;

          const relSpeed = Math.abs(impact);
          if (relSpeed > 40) {
            this.takeDamage(relSpeed * 0.06);
            other.takeDamage(relSpeed * 0.06);
            other.honkTimer = 1.8;
            if (this.onImpact) this.onImpact(relSpeed);
            if (other.onImpact) other.onImpact(relSpeed);
          }
          return relSpeed;
        }
      }
      return 0;
    },

    drawSkids(ctx) {
      if (this.skidMarks.length === 0) return;
      ctx.save();
      for (const s of this.skidMarks) {
        const alpha = Math.max(0, Math.min(0.65, (s.life / s.maxLife) * 0.65));
        ctx.strokeStyle = `rgba(18, 20, 26, ${alpha})`;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(s.x1, s.y1);
        ctx.lineTo(s.x2, s.y2);
        ctx.stroke();
      }
      ctx.restore();
    },

    draw(ctx, time = 0) {
      // 1. Draw exhaust smoke puffs first (under body)
      if (this.exhaustPuffs.length > 0) {
        ctx.save();
        for (const p of this.exhaustPuffs) {
          const alpha = (p.life / p.maxLife) * 0.45;
          ctx.fillStyle = `rgba(180, 190, 205, ${alpha})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);

      const hw = this.w / 2;
      const hl = this.l / 2;

      // 2. Soft Ground Shadow under car (cast lower-right for 1980s sun angle)
      ctx.fillStyle = 'rgba(10, 14, 22, 0.42)';
      ctx.beginPath();
      ctx.roundRect(-hl + 5, -hw + 5, this.l, this.w, 5);
      ctx.fill();

      // 3. Headlight / Taillight Glow onto Ground at dusk
      // Front headlights glow cone
      const glowGrad = ctx.createRadialGradient(hl + 8, 0, 4, hl + 45, 0, 60);
      glowGrad.addColorStop(0, 'rgba(255, 248, 200, 0.35)');
      glowGrad.addColorStop(0.5, 'rgba(255, 230, 140, 0.15)');
      glowGrad.addColorStop(1, 'rgba(255, 220, 100, 0)');
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.moveTo(hl, -hw);
      ctx.lineTo(hl + 65, -hw - 22);
      ctx.lineTo(hl + 65, hw + 22);
      ctx.lineTo(hl, hw);
      ctx.closePath();
      ctx.fill();

      // Rear taillight red glow
      const brakeGlow = this.isBraking ? 0.45 : 0.2;
      const tailGlow = ctx.createRadialGradient(-hl - 6, 0, 2, -hl - 22, 0, 30);
      tailGlow.addColorStop(0, `rgba(255, 30, 30, ${brakeGlow})`);
      tailGlow.addColorStop(1, 'rgba(255, 0, 0, 0)');
      ctx.fillStyle = tailGlow;
      ctx.beginPath();
      ctx.arc(-hl - 8, 0, 26, 0, Math.PI * 2);
      ctx.fill();

      // 4. Wheels / Tyres (black rubber peeking slightly out)
      ctx.fillStyle = '#11151c';
      const wheelL = 9;
      const wheelW = 4;
      // Front-left
      ctx.fillRect(hl - 12 - wheelL / 2, -hw - 1, wheelL, wheelW);
      // Front-right
      ctx.fillRect(hl - 12 - wheelL / 2, hw - 3, wheelL, wheelW);
      // Rear-left
      ctx.fillRect(-hl + 10 - wheelL / 2, -hw - 1, wheelL, wheelW);
      // Rear-right
      ctx.fillRect(-hl + 10 - wheelL / 2, hw - 3, wheelL, wheelW);

      // 5. Main Car Body Base
      ctx.fillStyle = this.color;
      ctx.beginPath();
      if (this.type === 'sports') {
        // Tapered wedge front, wider rear
        ctx.moveTo(hl, -hw + 4);
        ctx.lineTo(hl - 6, -hw);
        ctx.lineTo(-hl, -hw - 1);
        ctx.lineTo(-hl, hw + 1);
        ctx.lineTo(hl - 6, hw);
        ctx.lineTo(hl, hw - 4);
        ctx.closePath();
      } else {
        ctx.roundRect(-hl, -hw, this.l, this.w, 4);
      }
      ctx.fill();

      // Police Livery: black hood & trunk, white roof & doors
      if (this.type === 'police') {
        ctx.fillStyle = '#151922';
        // Front hood black
        ctx.fillRect(hl - 14, -hw, 14, this.w);
        // Rear trunk black
        ctx.fillRect(-hl, -hw, 12, this.w);
      }

      // Taxi side checker stripes
      if (this.type === 'taxi') {
        ctx.fillStyle = '#11151c';
        for (let xCheck = -hl + 8; xCheck < hl - 8; xCheck += 8) {
          ctx.fillRect(xCheck, -hw, 4, 2);
          ctx.fillRect(xCheck + 4, hw - 2, 4, 2);
        }
      }

      // 6. Bumpers
      ctx.fillStyle = '#1c222b';
      ctx.fillRect(hl - 3, -hw + 1, 3, this.w - 2); // Front bumper
      ctx.fillRect(-hl, -hw + 1, 3, this.w - 2); // Rear bumper

      // 7. Windscreen & Windows
      ctx.fillStyle = '#5c87a2';
      if (this.type === 'sports') {
        // Raked low-profile sports windshield
        ctx.beginPath();
        ctx.moveTo(hl - 14, -hw + 3);
        ctx.lineTo(hl - 7, 0);
        ctx.lineTo(hl - 14, hw - 3);
        ctx.lineTo(hl - 19, hw - 3);
        ctx.lineTo(hl - 19, -hw + 3);
        ctx.closePath();
        ctx.fill();

        // Rear sports glass hatch
        ctx.fillRect(-hl + 8, -hw + 3, 7, this.w - 6);
      } else if (this.type === 'van') {
        // Cab-over flat windshield
        ctx.fillRect(hl - 10, -hw + 2, 6, this.w - 4);
        // Side front windows
        ctx.fillRect(hl - 22, -hw + 1, 10, 2);
        ctx.fillRect(hl - 22, hw - 3, 10, 2);
      } else if (this.type === 'pickup') {
        // Pickup cab windshield
        ctx.fillRect(hl - 14, -hw + 2.5, 6, this.w - 5);
        ctx.fillRect(-hl + 20, -hw + 2.5, 3, this.w - 5);
      } else {
        // Sedan / Taxi / Police windshields
        ctx.fillRect(hl - 14, -hw + 2.5, 6, this.w - 5);
        ctx.fillRect(-hl + 8, -hw + 2.5, 5, this.w - 5);
        // Side windows
        ctx.fillRect(-hl + 14, -hw + 1, hl + 4, 2);
        ctx.fillRect(-hl + 14, hw - 3, hl + 4, 2);
      }

      // Windshield glint sheen
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.fillRect(hl - 13, -hw + 4, 2, this.w - 8);

      // 8. Roof Deck
      if (this.type === 'pickup') {
        // Pickup cab roof
        ctx.fillStyle = this.color;
        ctx.fillRect(-hl + 20, -hw + 2.5, 14, this.w - 5);
        // Open cargo bed
        ctx.fillStyle = '#212529';
        ctx.fillRect(-hl + 3, -hw + 3, 16, this.w - 6);
        // Bed grooves
        ctx.strokeStyle = '#343a40';
        ctx.lineWidth = 1;
        for (let gx = -hl + 5; gx < -hl + 17; gx += 4) {
          ctx.beginPath();
          ctx.moveTo(gx, -hw + 4);
          ctx.lineTo(gx, hw - 4);
          ctx.stroke();
        }
      } else if (this.type === 'van') {
        // Van ribbed long roof
        ctx.fillStyle = this.color;
        ctx.fillRect(-hl + 4, -hw + 2, this.l - 15, this.w - 4);
        // Roof ribs
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
        ctx.lineWidth = 1;
        for (let rx = -hl + 8; rx < hl - 14; rx += 6) {
          ctx.beginPath();
          ctx.moveTo(rx, -hw + 4);
          ctx.lineTo(rx, hw - 4);
          ctx.stroke();
        }
      } else {
        // Standard roof
        ctx.fillStyle = (this.type === 'police') ? '#ffffff' : this.color;
        const roofLen = this.type === 'sports' ? this.l * 0.38 : this.l * 0.44;
        ctx.fillRect(-hl + 14, -hw + 2.5, roofLen, this.w - 5);

        // Roof highlight sheen line
        ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.fillRect(-hl + 15, -hw + 3.5, roofLen - 2, 2);
      }

      // Sports rear spoiler
      if (this.type === 'sports') {
        ctx.fillStyle = '#1c222b';
        ctx.fillRect(-hl - 1, -hw + 2, 3, this.w - 4);
      }

      // 9. Taxi Roof Sign
      if (this.hasTaxiSign) {
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(-2, -7, 6, 14);
        ctx.strokeStyle = '#2b2d42';
        ctx.lineWidth = 1;
        ctx.strokeRect(-2, -7, 6, 14);
        ctx.fillStyle = '#111111';
        ctx.font = 'bold 5px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('TAXI', 1, 0);
      }

      // 10. Police Lightbar (Flashing Red and Blue with roof light bar alternating red/blue glow)
      if (this.hasLightbar && !this.isWreck) {
        const flash = Math.sin(this.sirenTimer) > 0;

        // Alternating red/blue glow radiating from roof lightbar
        ctx.save();
        ctx.fillStyle = flash ? 'rgba(255, 0, 80, 0.28)' : 'rgba(0, 220, 255, 0.28)';
        ctx.beginPath();
        ctx.arc(0, 0, 52, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#1c222b';
        ctx.fillRect(-1, -hw + 4, 4, this.w - 8);

        // Left beacon (Red)
        ctx.fillStyle = flash ? '#ff0055' : '#880020';
        ctx.beginPath();
        ctx.arc(1, -5, 4, 0, Math.PI * 2);
        ctx.fill();

        // Right beacon (Blue)
        ctx.fillStyle = !flash ? '#00e5ff' : '#003366';
        ctx.beginPath();
        ctx.arc(1, 5, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 11. Headlights (Warm white, front edge)
      ctx.fillStyle = '#fff4cc';
      ctx.fillRect(hl - 2, -hw + 2, 2, 4);
      ctx.fillRect(hl - 2, hw - 6, 2, 4);

      // 12. Taillights (Red, rear edge, brighter when braking)
      ctx.fillStyle = this.isBraking ? '#ff1e1e' : '#c9184a';
      ctx.fillRect(-hl, -hw + 2, 2, 4);
      ctx.fillRect(-hl, hw - 6, 2, 4);

      // 13. Turn indicators flashing
      if (this.indicator && Math.sin(this.indicatorTimer * 10) > 0) {
        ctx.fillStyle = '#ffb703';
        const indY = (this.indicator === 'left') ? -hw + 2 : hw - 4;
        ctx.fillRect(hl - 2, indY, 3, 3);
        ctx.fillRect(-hl - 1, indY, 3, 3);
      }

      // 14. Damage tint and scratches
      if (this.damage > 0.15) {
        ctx.fillStyle = `rgba(30, 20, 15, ${this.damage * 0.45})`;
        ctx.fillRect(-hl + 2, -hw + 2, this.l - 4, this.w - 4);

        // Cracks / scratch marks
        ctx.strokeStyle = '#181b22';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(hl - 8, -hw + 6);
        ctx.lineTo(hl - 18, -hw + 10);
        ctx.lineTo(hl - 12, -hw + 14);
        ctx.stroke();
      }

      ctx.restore();

      // 15. Comic Visual "HONK!" speech bubble if recently collided
      if (this.honkTimer > 0) {
        ctx.save();
        ctx.translate(this.x, this.y - 28);
        const scale = Math.min(1, this.honkTimer * 2);
        ctx.scale(scale, scale);

        // Speech bubble backing
        ctx.fillStyle = '#ffd166';
        ctx.strokeStyle = '#11151c';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-24, -12, 48, 20, 6);
        ctx.fill();
        ctx.stroke();

        // Bubble pointer
        ctx.beginPath();
        ctx.moveTo(-4, 8);
        ctx.lineTo(0, 14);
        ctx.lineTo(4, 8);
        ctx.fill();
        ctx.stroke();

        // Text
        ctx.font = '900 11px "Arial Black", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#11151c';
        ctx.fillText('HONK!', 0, -2);
        ctx.restore();
      }
    },
  };
}
