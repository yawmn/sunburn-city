// Camera system: smooth target tracking, velocity lookahead, bounds clamping, driving zoom, and screen shake.

export function createCamera(viewW = 1280, viewH = 720, worldW = 4400, worldH = 3200) {
  return {
    x: worldW / 2,
    y: worldH / 2,
    viewW,
    viewH,
    w: viewW,
    h: viewH,
    worldW,
    worldH,
    shake: 0,
    target: null,
    lookAhead: 0.35,
    zoom: 1.0,
    targetZoom: 1.0,
    lerpSpeed: 6.0,

    setTarget(entity) {
      this.target = entity;
      if (entity) {
        const entX = entity.inCar ? entity.inCar.x : entity.x;
        const entY = entity.inCar ? entity.inCar.y : entity.y;
        this.x = entX;
        this.y = entY;
        this.clamp();
      }
    },

    clamp() {
      const halfW = (this.viewW / 2) / this.zoom;
      const halfH = (this.viewH / 2) / this.zoom;
      this.x = Math.max(halfW, Math.min(this.worldW - halfW, this.x));
      this.y = Math.max(halfH, Math.min(this.worldH - halfH, this.y));
    },

    screenShake(amount) {
      this.shake = Math.min(28, this.shake + amount);
    },

    update(dt) {
      if (this.target) {
        const isDriving = !!(this.target.inCar);
        const targetLookAhead = isDriving ? 0.65 : 0.35;
        this.targetZoom = isDriving ? 0.88 : 1.0;

        // Smooth zoom transition
        this.zoom += (this.targetZoom - this.zoom) * Math.min(1, 4 * dt);
        this.lookAhead += (targetLookAhead - this.lookAhead) * Math.min(1, 4 * dt);

        const entity = this.target.inCar || this.target;
        const targetVx = entity.vx || 0;
        const targetVy = entity.vy || 0;
        const targetX = entity.x + targetVx * this.lookAhead;
        const targetY = entity.y + targetVy * this.lookAhead;

        const factor = 1 - Math.exp(-this.lerpSpeed * dt);
        this.x += (targetX - this.x) * factor;
        this.y += (targetY - this.y) * factor;
        this.clamp();
      }

      if (this.shake > 0) {
        this.shake = Math.max(0, this.shake - dt * 25);
      }
    },

    apply(ctx) {
      let sx = 0;
      let sy = 0;
      if (this.shake > 0.1) {
        sx = (Math.random() - 0.5) * 2 * this.shake;
        sy = (Math.random() - 0.5) * 2 * this.shake;
      }
      ctx.translate(Math.round(this.viewW / 2 + sx), Math.round(this.viewH / 2 + sy));
      ctx.scale(this.zoom, this.zoom);
      ctx.translate(Math.round(-this.x), Math.round(-this.y));
    },

    bounds() {
      const halfW = (this.viewW / 2) / this.zoom;
      const halfH = (this.viewH / 2) / this.zoom;
      const margin = 120;
      return {
        left: this.x - halfW - margin,
        top: this.y - halfH - margin,
        right: this.x + halfW + margin,
        bottom: this.y + halfH + margin,
      };
    },

    worldToScreen(wx, wy) {
      return {
        x: (wx - this.x) * this.zoom + this.viewW / 2,
        y: (wy - this.y) * this.zoom + this.viewH / 2,
      };
    },
  };
}
