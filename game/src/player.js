// Player entity: on-foot movement, 8-direction acceleration, run, collision with solids,
// facing angle, walk animation (capsule limbs), health/armour/money stats, combat damage,
// dark outline, prominent facing indicator, and hospital/police respawns.

export function createPlayer(x = 3580, y = 1400) {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    speed: 0,
    radius: 13,
    facingAngle: Math.PI / 2, // Facing south by default
    aimAngle: Math.PI / 2,
    walkCycle: 0,
    health: 100,
    maxHealth: 100,
    armour: 0,
    maxArmour: 100,
    money: 100,
    weapon: 'FISTS',
    ammo: '∞',
    inCar: null,
    isWasted: false,
    wastedTimer: 0,
    isBusted: false,
    bustedTimer: 0,
    damageVignette: 0,

    enterCar(car) {
      this.inCar = car;
      car.driver = this;
      car.isPlayerCar = true;
      this.x = car.x;
      this.y = car.y;
      this.vx = car.vx;
      this.vy = car.vy;
    },

    exitCar(solids = null) {
      if (!this.inCar) return;
      const car = this.inCar;
      // Driver side door exit (left of car heading)
      let exitX = car.x - Math.sin(car.angle) * (car.w / 2 + 16);
      let exitY = car.y + Math.cos(car.angle) * (car.w / 2 + 16);

      // Check collision with solids at exit position
      if (solids) {
        for (let i = 0; i < solids.length; i++) {
          const s = solids[i];
          if (exitX + 12 > s.x && exitX - 12 < s.x + s.w &&
              exitY + 12 > s.y && exitY - 12 < s.y + s.h) {
            // Exit on passenger side instead
            exitX = car.x + Math.sin(car.angle) * (car.w / 2 + 16);
            exitY = car.y - Math.cos(car.angle) * (car.w / 2 + 16);
            break;
          }
        }
      }

      this.x = exitX;
      this.y = exitY;
      this.vx = 0;
      this.vy = 0;
      this.speed = 0;
      car.driver = null;
      this.inCar = null;
    },

    takeDamage(amount) {
      if (this.isWasted || this.isBusted) return;
      let remaining = amount;
      // Armour absorbs first
      if (this.armour > 0) {
        const absorbed = Math.min(this.armour, remaining);
        this.armour -= absorbed;
        remaining -= absorbed;
      }
      if (remaining > 0) {
        this.health = Math.max(0, this.health - remaining);
      }
      this.damageVignette = 0.5;

      if (this.health <= 0 && !this.isWasted) {
        this.isWasted = true;
        this.wastedTimer = 2.8;
      }
    },

    respawn(rx, ry) {
      if (this.inCar) {
        this.inCar.driver = null;
        this.inCar.isPlayerCar = false;
        this.inCar = null;
      }
      this.x = rx;
      this.y = ry;
      this.vx = 0;
      this.vy = 0;
      this.speed = 0;
      this.health = 100;
      this.armour = 0;
      this.isWasted = false;
      this.wastedTimer = 0;
      this.isBusted = false;
      this.bustedTimer = 0;
      this.damageVignette = 0;
    },

    rect() {
      return {
        x: this.x - 16,
        y: this.y - 16,
        w: 32,
        h: 32,
      };
    },

    update(dt, input, solids, worldW, worldH) {
      if (this.damageVignette > 0) {
        this.damageVignette = Math.max(0, this.damageVignette - dt * 2.2);
      }

      if (this.isWasted) {
        this.wastedTimer -= dt;
        return;
      }
      if (this.isBusted) {
        this.bustedTimer -= dt;
        return;
      }

      if (this.inCar) {
        // Player is driving
        this.inCar.update(dt, input, solids, worldW, worldH);
        this.x = this.inCar.x;
        this.y = this.inCar.y;
        this.vx = this.inCar.vx;
        this.vy = this.inCar.vy;
        this.speed = this.inCar.speed;
        this.facingAngle = this.inCar.angle;
        return;
      }

      const axes = input ? input.axes() : { x: 0, y: 0 };
      const sprint = input ? input.sprint : false;
      const maxSpeed = sprint ? 270 : 155;
      const accel = sprint ? 1600 : 1200;
      const friction = 14.0;

      const hasInput = axes.x !== 0 || axes.y !== 0;

      if (hasInput) {
        const targetVx = axes.x * maxSpeed;
        const targetVy = axes.y * maxSpeed;
        const stepRate = Math.min(1, accel * dt / maxSpeed);
        this.vx += (targetVx - this.vx) * stepRate;
        this.vy += (targetVy - this.vy) * stepRate;

        // Smooth facing angle toward movement
        const targetAngle = Math.atan2(this.vy, this.vx);
        let diff = targetAngle - this.facingAngle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        this.facingAngle += diff * Math.min(1, 16 * dt);
      } else {
        const damp = Math.exp(-friction * dt);
        this.vx *= damp;
        this.vy *= damp;
        if (Math.abs(this.vx) < 1) this.vx = 0;
        if (Math.abs(this.vy) < 1) this.vy = 0;
      }

      const speed = Math.hypot(this.vx, this.vy);
      this.speed = speed;
      if (speed > 5) {
        this.walkCycle += speed * dt * 0.08;
      }

      // Axis-separated collision against solids
      const r = this.radius;

      // X-axis collision
      this.x += this.vx * dt;
      if (solids) {
        for (let i = 0; i < solids.length; i++) {
          const s = solids[i];
          if (this.x + r > s.x && this.x - r < s.x + s.w &&
              this.y + r > s.y && this.y - r < s.y + s.h) {
            if (this.vx > 0) this.x = s.x - r;
            else if (this.vx < 0) this.x = s.x + s.w + r;
            this.vx = 0;
            break;
          }
        }
      }

      // Y-axis collision
      this.y += this.vy * dt;
      if (solids) {
        for (let i = 0; i < solids.length; i++) {
          const s = solids[i];
          if (this.x + r > s.x && this.x - r < s.x + s.w &&
              this.y + r > s.y && this.y - r < s.y + s.h) {
            if (this.vy > 0) this.y = s.y - r;
            else if (this.vy < 0) this.y = s.y + s.h + r;
            this.vy = 0;
            break;
          }
        }
      }

      // World boundary clamping
      if (worldW && worldH) {
        this.x = Math.max(r, Math.min(worldW - r, this.x));
        this.y = Math.max(r, Math.min(worldH - r, this.y));
      }
    },

    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);

      // Ground shadow (soft dark oval shifted lower-right)
      ctx.fillStyle = 'rgba(10, 14, 22, 0.45)';
      ctx.beginPath();
      ctx.ellipse(8, 10, 16, 10, Math.PI / 6, 0, Math.PI * 2);
      ctx.fill();

      // If wasted, draw fallen player on ground
      if (this.isWasted) {
        ctx.rotate(this.facingAngle);
        ctx.fillStyle = '#ff5964';
        ctx.fillRect(-10, -8, 20, 16);
        ctx.fillStyle = '#f0ebe1';
        ctx.fillRect(-16, -9, 8, 5);
        ctx.fillRect(-16, 4, 8, 5);
        ctx.fillStyle = '#e8ab7b';
        ctx.beginPath();
        ctx.arc(8, 0, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return;
      }

      // Rotate player to facing angle
      ctx.rotate(this.facingAngle);

      const speed = Math.hypot(this.vx, this.vy);
      const isWalking = speed > 5;
      const legSwing = isWalking ? Math.sin(this.walkCycle) * 7 : 0;
      const armSwing = isWalking ? Math.sin(this.walkCycle) * 6 : 0;

      // Dark outline styling helper
      ctx.strokeStyle = '#0e131d';
      ctx.lineWidth = 1.8;
      ctx.lineJoin = 'round';

      // 1. Two legs (white trousers/pants capsules) - scaled to ~18x22 px total profile
      ctx.fillStyle = '#f0ebe1';
      // Left leg
      ctx.beginPath();
      ctx.roundRect(-9 + legSwing, -10, 16, 5.5, 2.7);
      ctx.fill();
      ctx.stroke();

      // Right leg
      ctx.beginPath();
      ctx.roundRect(-9 - legSwing, 4.5, 16, 5.5, 2.7);
      ctx.fill();
      ctx.stroke();

      // Shoes (black sneakers with teal trim)
      ctx.fillStyle = '#1b232a';
      ctx.fillRect(4 + legSwing, -10, 5, 5.5);
      ctx.fillRect(4 - legSwing, 4.5, 5, 5.5);
      ctx.fillStyle = '#20dfb8';
      ctx.fillRect(7 + legSwing, -10, 2, 5.5);
      ctx.fillRect(7 - legSwing, 4.5, 2, 5.5);

      // 2. Torso / Hawaiian floral shirt (coral #ff5964 with pastel teal accents, 18px wide x 18px long)
      ctx.fillStyle = '#ff5964';
      ctx.beginPath();
      ctx.roundRect(-8, -9, 16, 18, 4);
      ctx.fill();
      ctx.stroke();

      // White undershirt V-neck & collar
      ctx.fillStyle = '#f7f4ee';
      ctx.beginPath();
      ctx.moveTo(-4, -2.5);
      ctx.lineTo(2.5, 0);
      ctx.lineTo(-4, 2.5);
      ctx.closePath();
      ctx.fill();

      // Tropical floral shirt pattern dots
      ctx.fillStyle = '#4fd3cf';
      ctx.fillRect(-5, -6, 2.5, 2.5);
      ctx.fillRect(-2, 5, 2.5, 2.5);
      ctx.fillRect(2, -5, 2.5, 2.5);
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(-4, 0, 2, 2);

      // 3. Arms & Hands
      const isArmed = this.weapon && this.weapon !== 'FISTS';

      if (isArmed) {
        // Holding weapon forward in two-handed stance
        ctx.fillStyle = '#ff5964';
        // Left arm angled forward
        ctx.beginPath();
        ctx.roundRect(-4, -12, 12, 4.5, 2.2);
        ctx.fill();
        ctx.stroke();
        // Right arm angled forward
        ctx.beginPath();
        ctx.roundRect(-4, 7.5, 12, 4.5, 2.2);
        ctx.fill();
        ctx.stroke();

        // Hands
        ctx.fillStyle = '#e8ab7b';
        ctx.beginPath();
        ctx.arc(8, -9.5, 3, 0, Math.PI * 2);
        ctx.arc(8, 9.5, 3, 0, Math.PI * 2);
        ctx.fill();

        // Weapon in hands
        if (this.weapon === 'COLT .45') {
          // Black pistol
          ctx.fillStyle = '#1c2128';
          ctx.fillRect(7, -2.5, 11, 4.5);
          ctx.fillStyle = '#silver';
          ctx.fillRect(14, -2, 4, 1.5);
        } else if (this.weapon === 'UZI 9MM') {
          // Submachine gun
          ctx.fillStyle = '#181d24';
          ctx.fillRect(6, -3, 14, 6);
          // Magazine
          ctx.fillStyle = '#2d333b';
          ctx.fillRect(9, 3, 3.5, 6);
          // Barrel
          ctx.fillStyle = '#484f58';
          ctx.fillRect(19, -1.5, 4, 3);
        }
      } else {
        // Fists / swinging arms
        ctx.fillStyle = '#ff5964';
        // Left arm
        ctx.beginPath();
        ctx.roundRect(-6 - armSwing, -12.5, 11, 4.5, 2.2);
        ctx.fill();
        ctx.stroke();
        // Left hand
        ctx.fillStyle = '#e8ab7b';
        ctx.beginPath();
        ctx.arc(6 - armSwing, -10.5, 3, 0, Math.PI * 2);
        ctx.fill();

        // Right arm
        ctx.fillStyle = '#ff5964';
        ctx.beginPath();
        ctx.roundRect(-6 + armSwing, 8, 11, 4.5, 2.2);
        ctx.fill();
        ctx.stroke();
        // Right hand
        ctx.fillStyle = '#e8ab7b';
        ctx.beginPath();
        ctx.arc(6 + armSwing, 10, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // 4. Head (tan skin tone)
      ctx.fillStyle = '#e8ab7b';
      ctx.beginPath();
      ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 80s slicked back hair (dark brown)
      ctx.fillStyle = '#2c1810';
      ctx.beginPath();
      ctx.arc(-2.5, 0, 7, Math.PI * 0.45, Math.PI * 1.55);
      ctx.fill();

      // Aviator sunglasses (gold rims, dark lenses)
      ctx.fillStyle = '#11161d';
      ctx.fillRect(3.5, -5, 3.5, 4);
      ctx.fillRect(3.5, 1, 3.5, 4);
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 1.0;
      ctx.strokeRect(3.5, -5, 3.5, 4);
      ctx.strokeRect(3.5, 1, 3.5, 4);

      // 5. Small sharp facing indicator chevron at player front
      ctx.fillStyle = '#00f0ff';
      ctx.strokeStyle = '#0e131d';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(8.5, -4.5);
      ctx.lineTo(10.5, 0);
      ctx.lineTo(8.5, 4.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    },
  };
}
