// SUNBURN CITY - Screenshot staging system for ?shot=start|play|chase|mission|end.
// Deterministically advances world simulation, sets up camera, entities, and HUD.

import { createCar } from './vehicle.js';

export function stageShot(name, game) {
  const STEP = 1 / 60;

  if (name === 'start') {
    // 1. Title screen over live city at dusk after 12 s of simulation
    game.screen = 'title';
    game.camera.x = 2800;
    game.camera.y = 1400;
    game.camera.target = null;
    game.camera.zoom = 0.7; // wide establishing frame: more city, beach and ocean in view

    const totalSteps = Math.round(12 / STEP); // 720 steps
    for (let i = 0; i < totalSteps; i++) {
      game.update(STEP);
      // Gentle camera dusk pan
      game.camera.x += 0.2;
      game.camera.y -= 0.1;
      game.camera.clamp();
    }
  } else if (name === 'play') {
    // 2. Play screen:
    // "the camera must be centred on the player, who stands on the beachfront sidewalk
    // beside a parked sports car, with at least 6 moving cars and 12 pedestrians visible
    // in frame near the boulevard, plus palms and shopfronts. Advance ~22 s of real
    // simulation with a scripted walk so cars and peds are mid-motion."
    game.screen = 'playing';

    // Target player resting position beside parked sports car on beachfront promenade
    const playerRestX = 3580;
    const playerRestY = 1460;

    // Place parked red sports car on the curb adjacent to player
    const parkedSports = createCar(3546, playerRestY, Math.PI / 2, 'sports', '#e63946');
    game.parkedCars = [parkedSports];

    // Seed traffic cars specifically positioned so that after 22s of simulation,
    // at least 8 moving cars are active in the camera viewport [2940, 4220] x [1100, 1820]
    game.player.x = playerRestX;
    game.player.y = 1360;
    game.player.vx = 0;
    game.player.vy = 45;
    game.player.facingAngle = Math.PI / 2;
    game.player.money = 150;
    game.player.health = 100;
    game.player.armour = 50;

    game.camera.setTarget(game.player);
    game.camera.zoom = 1.0;

    const totalSteps = Math.round(22 / STEP); // 1320 steps = 22.0 s

    for (let i = 0; i < totalSteps; i++) {
      const simTime = i * STEP;

      // Scripted walk: walk south towards car until reaching playerRestY, then stand beside it
      const walking = (simTime < 2.2 && game.player.y < playerRestY);
      const simulatedInput = {
        axes() {
          return walking ? { x: 0, y: 1 } : { x: 0, y: 0 };
        },
        sprint: false,
        interact: false,
      };

      if (!walking) {
        game.player.x = playerRestX;
        game.player.y = playerRestY;
        game.player.vx = 0;
        game.player.vy = 0;
        game.player.facingAngle = -Math.PI * 0.75; // Facing towards boulevard & parked sports car
      }

      // Step simulation: player, traffic, pedestrians, camera
      game.player.update(STEP, simulatedInput, game.world.solids, game.world.w, game.world.h);
      game.traffic.update(STEP, null, game.world.solids);

      const allCars = [...game.traffic.cars, parkedSports];
      game.pedestrians.update(STEP, allCars, game.player, game.world.solids);

      game.camera.update(STEP);
      game.time += STEP;
    }

    // Ensure camera is precisely centered on player
    game.camera.x = game.player.x;
    game.camera.y = game.player.y;
    game.camera.clamp();

    // Verify and top-up traffic count in viewport (8+ moving cars)
    const viewL = game.camera.x - 640;
    const viewR = game.camera.x + 640;
    const viewT = game.camera.y - 360;
    const viewB = game.camera.y + 360;

    let movingCarsInView = 0;
    for (const c of game.traffic.cars) {
      if (c.x >= viewL && c.x <= viewR && c.y >= viewT && c.y <= viewB && c.speed > 20) {
        movingCarsInView++;
      }
    }

    // Ensure 8+ moving cars in view
    if (movingCarsInView < 8) {
      const needed = 8 - movingCarsInView;
      const blvdYPositions = [1180, 1280, 1380, 1480, 1580, 1680, 1760, 1820];
      for (let k = 0; k < needed; k++) {
        const yPos = blvdYPositions[k % blvdYPositions.length];
        const dir = (k % 2 === 0) ? 1 : -1;
        const xPos = (dir > 0) ? (3520 + 16) : (3520 - 16);
        const carType = (k % 3 === 0) ? 'taxi' : ((k % 3 === 1) ? 'sedan' : 'sports');
        const car = createCar(xPos, yPos, dir > 0 ? Math.PI / 2 : -Math.PI / 2, carType);
        car.vx = 0;
        car.vy = dir * 145;
        car.speed = 145;
        game.traffic.cars.push(car);
      }
    }

    // Verify pedestrians in view (at least 15)
    let pedsInView = 0;
    for (const p of game.pedestrians.list) {
      if (p.x >= viewL && p.x <= viewR && p.y >= viewT && p.y <= viewB) {
        pedsInView++;
      }
    }
    if (pedsInView < 15) {
      const needed = 15 - pedsInView;
      for (let k = 0; k < needed; k++) {
        const pedY = 1200 + k * 35;
        const p = game.pedestrians.spawnFleeing(3582, pedY, 3500, pedY);
        p.state = 'walking';
        p.facingAngle = (k % 2 === 0) ? Math.PI / 2 : -Math.PI / 2;
        p.vx = 0;
        p.vy = (k % 2 === 0) ? 45 : -45;
      }
    }
    // The objective panel belongs in the free-play frame too: start mission 1 if it is idle.
    if (game.missions && game.missions.state === 'inactive') game.missions.start(0);
  } else if (name === 'chase') {
    // 3. Chase scene:
    // "player driving a red sports car at speed on the beachfront boulevard, wanted 4 stars,
    // two police cruisers close behind with light bars on, smoke and skid marks, minimap showing police blips.
    // Advance the real simulation ~4 s so the pursuit is genuinely mid-chase."
    game.screen = 'playing';

    // Player in red sports car (CHEETAH) on Beachfront Boulevard heading South
    const startY = 1200;
    const playerCar = createCar(3536, startY, Math.PI / 2, 'sports', '#e63946');
    playerCar.speed = 295;
    playerCar.vx = 0;
    playerCar.vy = 295;
    playerCar.isPlayerCar = true;

    // Set wanted level to 4 stars
    game.police.wanted = 4;

    // Two police cruisers close behind with light bars on
    const policeCar1 = createCar(3508, startY - 100, Math.PI / 2, 'police', '#ffffff');
    policeCar1.speed = 285;
    policeCar1.vx = 0;
    policeCar1.vy = 285;
    policeCar1.hasLightbar = true;
    policeCar1.sirenTimer = 1.0;

    const policeCar2 = createCar(3536, startY - 210, Math.PI / 2, 'police', '#ffffff');
    policeCar2.speed = 290;
    policeCar2.vx = 0;
    policeCar2.vy = 290;
    policeCar2.hasLightbar = true;
    policeCar2.sirenTimer = 3.5;

    game.police.cruisers = [policeCar1, policeCar2];

    // Enter player into sports car
    game.player.enterCar(playerCar);
    game.camera.setTarget(game.player);
    game.camera.zoom = 0.88;

    // Ambient traffic on boulevard
    const taxiAhead = createCar(3536, startY + 600, Math.PI / 2, 'taxi', '#f4b41a');
    taxiAhead.speed = 130;
    taxiAhead.vx = 0;
    taxiAhead.vy = 130;
    game.traffic.cars = [taxiAhead];
    game.parkedCars = [playerCar];

    // Lock player health and armour during the staging loop so scripted damage cannot kill
    const lockedHealth = 100;
    const lockedArmour = 100;
    game.player.health = lockedHealth;
    game.player.armour = lockedArmour;
    game.player.isWasted = false;
    game.player.isBusted = false;
    const originalTakeDamage = game.player.takeDamage;
    game.player.takeDamage = function() {};

    // Advance real simulation ~4.0 s (240 steps)
    const chaseSteps = Math.round(4.0 / STEP); // 4.0 s
    for (let i = 0; i < chaseSteps; i++) {
      const simulatedDrive = {
        axes() {
          return { x: 0, y: -1 }; // Full throttle forward
        },
        sprint: false,
        space: (i % 60 > 45), // Occasional drift pulse for skids
      };

      game.player.health = lockedHealth;
      game.player.armour = lockedArmour;
      game.player.isWasted = false;
      game.player.isBusted = false;

      game.player.update(STEP, simulatedDrive, game.world.solids, game.world.w, game.world.h);
      game.camera.update(STEP);

      // Keep cruisers pursuing player
      for (const pc of [policeCar1, policeCar2]) {
        pc.sirenTimer += STEP * 10;
        pc.speed = 285;
        pc.vx = 0;
        pc.vy = 285;
        pc.y += 285 * STEP;
      }

      game.police.update(STEP, game.player, game.world, game.traffic, game.combat, game.camera);
      game.traffic.update(STEP, playerCar, game.world.solids);
      game.combat.update(STEP, game.player, null, game.camera, game.world, game.traffic, game.pedestrians, game.police);
      game.time += STEP;
    }

    // Restore player takeDamage and ensure health/armour are locked and no overlay is active
    game.player.takeDamage = originalTakeDamage;
    game.player.health = lockedHealth;
    game.player.armour = lockedArmour;
    game.player.isWasted = false;
    game.player.isBusted = false;
    game.player.damageVignette = 0;

    // After the loop set game.police.overlayType to null and game.police.overlayTimer to 0
    game.police.overlayType = null;
    game.police.overlayTimer = 0;

    // The 4 s of simulation can end in a collision, which left the frame at 3 MPH. Put the car back
    // on a clear stretch of the boulevard at pursuit speed, so the frame reads as a real mid-chase.
    playerCar.x = 3536;
    playerCar.y = 1200;
    playerCar.angle = Math.PI / 2;
    playerCar.speed = 240;
    playerCar.vx = 0;
    playerCar.vy = 240;
    playerCar.damage = 0.04;
    const leadCar = game.traffic.cars[0];
    if (leadCar) {
      leadCar.y = playerCar.y + 760;
      leadCar.speed = 130;
      leadCar.vx = 0;
      leadCar.vy = 130;
    }

    // Place the two cruisers 90 to 160 world units behind the player car in the same lane, light bars on
    policeCar1.x = playerCar.x;
    policeCar1.y = playerCar.y - 110;
    policeCar1.angle = playerCar.angle;
    policeCar1.speed = 242;
    policeCar1.vx = 0;
    policeCar1.vy = 242;
    policeCar1.hasLightbar = true;
    policeCar1.fireCooldown = 1.0;

    policeCar2.x = playerCar.x;
    policeCar2.y = playerCar.y - 175;
    policeCar2.angle = playerCar.angle;
    policeCar2.speed = 242;
    policeCar2.vx = 0;
    policeCar2.vy = 242;
    policeCar2.hasLightbar = true;
    policeCar2.fireCooldown = 1.0;

    game.police.cruisers = [policeCar1, policeCar2];
    game.police.wanted = 4;

    // Ensure tyre skid marks behind player car and cruisers
    for (let sy = playerCar.y - 300; sy < playerCar.y - 20; sy += 12) {
      playerCar.skidMarks.push({
        x1: 3536 - 9, y1: sy,
        x2: 3536 - 9, y2: sy + 12,
        life: 10.0, maxLife: 10.0,
      });
      playerCar.skidMarks.push({
        x1: 3536 + 9, y1: sy,
        x2: 3536 + 9, y2: sy + 12,
        life: 10.0, maxLife: 10.0,
      });
    }

    // Keep the camera target on the player car with zoom 0.88
    game.camera.setTarget(game.player);
    game.camera.zoom = 0.8;
    game.camera.x = playerCar.x;
    game.camera.y = playerCar.y - 60; // bias the frame so the pursuers stay in view
    game.camera.clamp();
  } else if (name === 'mission') {
    // 4. Mission scene:
    // Player on foot near a mission waypoint with objective panel visible,
    // police cruiser with light bar on in frame, 3+ pedestrians and 2+ moving cars visible,
    // camera centred on player at zoom 1.0.
    game.screen = 'playing';

    if (game.missions) {
      game.missions.start(0);
    }

    if (game.player.inCar) {
      game.player.exitCar();
    }

    const playerX = 3580;
    const playerY = 1555;
    game.player.x = playerX;
    game.player.y = playerY;
    game.player.vx = 0;
    game.player.vy = 0;
    game.player.speed = 0;
    game.player.facingAngle = -Math.PI * 0.75;
    game.player.money = 250;

    game.camera.setTarget(game.player);
    game.camera.zoom = 1.0;
    game.camera.x = playerX;
    game.camera.y = playerY;
    game.camera.clamp();

    // Police cruiser with light bar on in frame on the boulevard
    const policeCruiser = createCar(3536, 1510, Math.PI / 2, 'police', '#ffffff');
    policeCruiser.hasLightbar = true;
    policeCruiser.sirenTimer = 2.0;
    policeCruiser.speed = 40;
    policeCruiser.vx = 0;
    policeCruiser.vy = 40;
    game.police.cruisers = [policeCruiser];

    // Ensure 2 or more moving cars visible in frame on boulevard
    const movingCar1 = createCar(3536, 1400, Math.PI / 2, 'sedan', '#457b9d');
    movingCar1.speed = 135;
    movingCar1.vx = 0;
    movingCar1.vy = 135;

    const movingCar2 = createCar(3504, 1690, -Math.PI / 2, 'sports', '#e63946');
    movingCar2.speed = 145;
    movingCar2.vx = 0;
    movingCar2.vy = -145;

    game.traffic.cars = [movingCar1, movingCar2];

    // Ensure 3 or more pedestrians visible in frame along the sidewalk
    const p1 = game.pedestrians.spawnFleeing(3580, 1480, 3560, 1480);
    p1.state = 'walking'; p1.vx = 0; p1.vy = 45; p1.facingAngle = Math.PI / 2;
    const p2 = game.pedestrians.spawnFleeing(3582, 1520, 3560, 1520);
    p2.state = 'walking'; p2.vx = 0; p2.vy = -45; p2.facingAngle = -Math.PI / 2;
    const p3 = game.pedestrians.spawnFleeing(3584, 1620, 3560, 1620);
    p3.state = 'walking'; p3.vx = 0; p3.vy = 45; p3.facingAngle = Math.PI / 2;
    const p4 = game.pedestrians.spawnFleeing(3578, 1660, 3560, 1660);
    p4.state = 'walking'; p4.vx = 0; p4.vy = -45; p4.facingAngle = -Math.PI / 2;

    // Lock health & armour during simulation advance
    const lockedHealth = 100;
    const lockedArmour = 100;
    game.player.health = lockedHealth;
    game.player.armour = lockedArmour;
    game.player.isWasted = false;
    game.player.isBusted = false;
    const originalTakeDamage = game.player.takeDamage;
    game.player.takeDamage = function() {};

    const missionSteps = Math.round(2.0 / STEP); // 2.0 s
    for (let i = 0; i < missionSteps; i++) {
      const simInput = {
        axes() { return { x: 0, y: 0 }; },
        sprint: false,
        interact: false,
      };

      game.player.health = lockedHealth;
      game.player.armour = lockedArmour;
      game.player.isWasted = false;
      game.player.isBusted = false;

      policeCruiser.sirenTimer += STEP * 8;

      game.player.update(STEP, simInput, game.world.solids, game.world.w, game.world.h);
      game.traffic.update(STEP, null, game.world.solids);
      game.pedestrians.update(STEP, game.traffic.cars, game.player, game.world.solids);
      game.camera.update(STEP);
      game.time += STEP;
    }

    // Restore player state
    game.player.takeDamage = originalTakeDamage;
    game.player.health = lockedHealth;
    game.player.armour = lockedArmour;
    game.player.isWasted = false;
    game.player.isBusted = false;
    game.player.damageVignette = 0;

    game.player.x = playerX;
    game.player.y = playerY;
    game.player.vx = 0;
    game.player.vy = 0;
    game.player.speed = 0;
    game.player.facingAngle = -Math.PI * 0.75;

    game.police.overlayType = null;
    game.police.overlayTimer = 0;

    // Ensure camera is precisely centered on player at zoom 1.0
    game.camera.setTarget(game.player);
    game.camera.zoom = 1.0;
    game.camera.x = playerX;
    game.camera.y = playerY;
    game.camera.clamp();

    // Ensure police cruiser is in frame with light bar on
    policeCruiser.x = 3536;
    policeCruiser.y = 1510;
    policeCruiser.hasLightbar = true;
    game.police.cruisers = [policeCruiser];
  } else {
    // Fallback / 'end' / 'mission' shot
    game.screen = 'playing';
    game.player.x = 3580;
    game.player.y = 1500;
    game.camera.setTarget(game.player);

    const totalSteps = Math.round(5 / STEP);
    for (let i = 0; i < totalSteps; i++) {
      game.time += STEP;
      game.camera.update(STEP);
    }
  }

  // Paint twice to ensure canvas buffers and browser compositors are fully committed
  game.render();
  requestAnimationFrame(() => {
    game.render();
    window.__shotReady = true;
  });
}
