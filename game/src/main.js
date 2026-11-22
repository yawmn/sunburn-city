// SUNBURN CITY - Main Entry Point
// Sets up 1280x720 canvas, PRNG seed, input, city world, player, camera, minimap, HUD,
// fixed-timestep game loop (1/60s, max 4 catch-up), screen state management, and error capture.

import { setSeed } from './rng.js';
import { createInput } from './input.js';
import { createCity } from './city.js';
import { createPlayer } from './player.js';
import { createCamera } from './camera.js';
import { createMinimap } from './minimap.js';
import { createHud } from './hud.js';
import { createRenderer } from './render.js';
import { createCar } from './vehicle.js';
import { createTraffic } from './traffic.js';
import { createPedestrians } from './pedestrians.js';
import { createCombatSystem } from './combat.js';
import { createPoliceSystem } from './police.js';
import { createMissions } from './missions.js';
import { stageShot } from './shots.js';

// Global error capture initialization
if (!window.__errors) window.__errors = [];
function logError(err) {
  const msg = (err && (err.message || err.reason?.message || String(err))) || 'Unknown error';
  window.__errors.push(msg);
  const statusEl = document.getElementById('status');
  if (statusEl) statusEl.textContent = msg;
  document.body.dataset.errors = window.__errors.join(' | ');
}
window.addEventListener('error', (e) => logError(e.error || e.message));
window.addEventListener('unhandledrejection', (e) => logError(e.reason));
document.body.dataset.errors = '';

function boot() {
  const canvas = document.getElementById('game');
  if (!canvas) throw new Error('Canvas #game element not found');

  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d', { alpha: false });

  // Read URL query parameters
  const params = new URLSearchParams(window.location.search);
  const seedParam = parseInt(params.get('seed') || '1', 10);
  const seed = Number.isFinite(seedParam) ? seedParam : 1;
  const shot = params.get('shot');

  // Seed the PRNG
  setSeed(seed);

  // Initialize game systems
  const input = createInput(canvas);
  const world = createCity(seed);
  // Default player position: Ocean Drive beachfront promenade
  const player = createPlayer(3580, 1200);
  const camera = createCamera(1280, 720, world.w, world.h);
  camera.setTarget(player);

  const pedestrians = createPedestrians(world, seed);
  const traffic = createTraffic(world, seed, pedestrians);
  pedestrians.update(0.01, traffic.cars, player, world.solids);

  const combat = createCombatSystem();
  const police = createPoliceSystem(world);
  const missions = createMissions(world, player, police);

  // Parked sports car beside player on beachfront sidewalk kerb
  const parkedCar = createCar(3546, 1200, Math.PI / 2, 'sports', '#e63946');
  const parkedCars = [parkedCar];

  const minimap = createMinimap(world, player);
  const hud = createHud();
  const renderer = createRenderer(canvas, ctx, world);

  const game = {
    screen: 'title', // 'title', 'playing', 'paused'
    time: 0,
    seed,
    world,
    player,
    camera,
    minimap,
    hud,
    renderer,
    input,
    traffic,
    pedestrians,
    parkedCars,
    combat,
    police,
    missions,

    update(dt) {
      this.time += dt;

      if (this.screen === 'title') {
        // Live city simulation at dusk: slowly pan camera along boulevard
        this.camera.x += 12 * dt;
        if (this.camera.x > 3300) this.camera.x = 2400;
        this.camera.y = 1400 + Math.sin(this.time * 0.4) * 80;
        this.camera.clamp();

        // Update live traffic and pedestrians
        this.traffic.update(dt, null, this.world.solids);
        this.pedestrians.update(dt, this.traffic.cars, null, this.world.solids);

        // Check for start
        if (this.input.takePressed('enter') || this.input.takePressed('space')) {
          this.screen = 'playing';
          this.camera.setTarget(this.player);
          if (this.missions && this.missions.state === 'inactive') {
            this.missions.start(0);
          }
        }
      } else if (this.screen === 'playing') {
        // Pause check
        if (this.input.takePressed('pause')) {
          this.screen = 'paused';
          return;
        }

        // Quit to title check
        if (this.input.takePressed('escape')) {
          this.screen = 'title';
          this.camera.target = null;
          return;
        }

        // Vehicle Entry / Exit on E key
        if (this.input.takePressed('interact')) {
          if (this.player.inCar) {
            this.player.exitCar(this.world.solids);
          } else {
            // Find nearest traffic car or parked car
            const car = this.traffic.nearestCar(this.player, 55) ||
              this.parkedCars.find(c => !c.driver && Math.hypot(c.x - this.player.x, c.y - this.player.y) < 55);

            if (car) {
              if (this.traffic.cars.includes(car)) {
                this.traffic.hijack(car);
              }
              this.player.enterCar(car);
              car.onImpact = (spd) => {
                this.camera.screenShake(Math.min(24, spd * 0.22));
              };
            }
          }
        }

        // Update player & camera
        this.player.update(dt, this.input, this.world.solids, this.world.w, this.world.h);
        this.camera.update(dt);

        // Update traffic AI
        this.traffic.update(dt, this.player.inCar, this.world.solids);

        // Update pedestrians (panic, run-over, chat, walk)
        const activeCars = [...this.traffic.cars, ...this.parkedCars];
        if (this.player.inCar && !activeCars.includes(this.player.inCar)) {
          activeCars.push(this.player.inCar);
        }
        this.pedestrians.update(dt, activeCars, this.player, this.world.solids);

        // Update combat (weapons, firing, tracers, bullet damage, explosions)
        this.combat.update(dt, this.player, this.input, this.camera, this.world, this.traffic, this.pedestrians, this.police);

        // Update police pursuit AI & wanted decay
        this.police.update(dt, this.player, this.world, this.traffic, this.combat, this.camera);

        // Update story missions
        if (this.missions) {
          this.missions.update(dt);
        }
      } else if (this.screen === 'paused') {
        // Resume check
        if (this.input.takePressed('pause')) {
          this.screen = 'playing';
          return;
        }
        // Quit to title
        if (this.input.takePressed('escape')) {
          this.screen = 'title';
          this.camera.target = null;
          return;
        }
      }
    },

    render() {
      // 1. Collect entities for depth-sorted rendering
      const entities = [
        ...this.traffic.cars,
        ...this.parkedCars,
        ...this.pedestrians.list,
        ...(this.police ? this.police.cruisers : []),
        ...(this.police ? this.police.officers : []),
        ...(this.police ? this.police.cones : []),
      ];
      this.renderer.render(this.player, this.camera, entities, this.time, this.combat, this.police, this.missions);

      // 2. Draw Screen Overlays
      if (this.screen === 'title') {
        this.hud.drawTitle(ctx, this.time);
      } else if (this.screen === 'playing') {
        this.hud.drawPlaying(ctx, this.player, this.world, this.minimap, '18:42', this.traffic.cars, this.police, this.combat, this.time, this.missions, this.camera);
      } else if (this.screen === 'paused') {
        this.hud.drawPlaying(ctx, this.player, this.world, this.minimap, '18:42', this.traffic.cars, this.police, this.combat, this.time, this.missions, this.camera);
        this.hud.drawPaused(ctx);
      }
    },
  };

  window.__game = game;
  window.game = game;

  // If a screenshot shot is requested, stage it
  if (shot) {
    stageShot(shot, game);
  }

  // Fixed-timestep game loop (1/60s step, max 4 catch-up updates per frame)
  const STEP = 1 / 60;
  let lastTime = performance.now();
  let accumulator = 0;

  function loop(currentTime) {
    let dt = (currentTime - lastTime) / 1000;
    lastTime = currentTime;
    if (dt > 0.25) dt = 0.25; // Clamp spiral of death
    accumulator += dt;

    let updates = 0;
    while (accumulator >= STEP && updates < 4) {
      game.update(STEP);
      accumulator -= STEP;
      updates++;
    }

    game.render();
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}

// Boot game when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
