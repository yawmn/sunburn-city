// SUNBURN CITY - Traffic AI System
// Simulates ~45 AI cars driving on the road grid:
// - Drive on the right side of roads, keep lanes
// - Follow vehicle ahead, slow down and stop safely
// - Stop at intersections when occupied or turning
// - Turn indicators (blinking amber lights)
// - Never leave the road grid
// - Stop, honk ("HONK" pop), and flee when rammed by the player
// - Provides traffic.nearestCar(pos, radius) and traffic.hijack(car)

import { createCar } from './vehicle.js';
import { createRng } from './rng.js';

export function createTraffic(world, seed = 42, pedestrianManager = null) {
  const rng = createRng(seed);

  const avenues = [140, 600, 1080, 1560, 2040, 2520, 3000, 3520];
  const streets = [120, 540, 980, 1420, 1860, 2300, 2740, 3100];
  const BOULEVARD_X = 3520;

  const cars = [];
  let peds = pedestrianManager;

  const CAR_TYPES_LIST = ['sports', 'sedan', 'sedan', 'taxi', 'taxi', 'van', 'pickup', 'police'];

  // Helper to determine right-hand lane X for an Avenue
  function getAvenueLaneX(avX, dir, laneChoice = 0) {
    const isBlvd = (avX === BOULEVARD_X);
    if (dir > 0) {
      // Southbound (facing +Y): right side of road (+X)
      return isBlvd ? (avX + (laneChoice === 0 ? 14 : 28)) : (avX + 16);
    } else {
      // Northbound (facing -Y): right side of road (-X)
      return isBlvd ? (avX - (laneChoice === 0 ? 14 : 28)) : (avX - 16);
    }
  }

  // Helper to determine right-hand lane Y for a Street
  function getStreetLaneY(stY, dir) {
    if (dir > 0) {
      // Eastbound (facing +X): right side of road (+Y)
      return stY + 16;
    } else {
      // Westbound (facing -X): right side of road (-Y)
      return stY - 16;
    }
  }

  // Spawn a traffic car on an avenue
  function spawnOnAvenue(avIndex, y, dir, laneChoice = 0) {
    const avX = avenues[avIndex];
    const x = getAvenueLaneX(avX, dir, laneChoice);
    const angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    const type = rng.pick(CAR_TYPES_LIST);
    const car = createCar(x, y, angle, type);

    car.ai = {
      roadType: 'avenue',
      roadIndex: avIndex,
      dir,
      laneChoice,
      state: 'driving', // 'driving', 'stopping', 'turning', 'stopped'
      targetSpeed: rng.range(130, 175),
      turnState: 'none',
      turnTimer: 0,
      turnTargetAngle: 0,
      newRoadType: null,
      newRoadIndex: 0,
      newDir: 0,
    };
    car.vx = 0;
    car.vy = dir * car.ai.targetSpeed;
    car.speed = car.ai.targetSpeed;
    car.driver = { type: 'civilian' };
    return car;
  }

  // Spawn a traffic car on a street
  function spawnOnStreet(stIndex, x, dir) {
    const stY = streets[stIndex];
    const y = getStreetLaneY(stY, dir);
    const angle = dir > 0 ? 0 : Math.PI;
    const type = rng.pick(CAR_TYPES_LIST);
    const car = createCar(x, y, angle, type);

    car.ai = {
      roadType: 'street',
      roadIndex: stIndex,
      dir,
      laneChoice: 0,
      state: 'driving',
      targetSpeed: rng.range(125, 170),
      turnState: 'none',
      turnTimer: 0,
      turnTargetAngle: 0,
      newRoadType: null,
      newRoadIndex: 0,
      newDir: 0,
    };
    car.vx = dir * car.ai.targetSpeed;
    car.vy = 0;
    car.speed = car.ai.targetSpeed;
    car.driver = { type: 'civilian' };
    return car;
  }

  // Populate ~45 traffic cars evenly across the grid
  // Focus good density on Beachfront Boulevard and central avenues
  // 1. Boulevard cars (at least 10 cars moving North and South on Boulevard)
  const blvdIdx = avenues.length - 1;
  const blvdSpacing = [300, 650, 1000, 1350, 1700, 2050, 2400, 2750];
  for (let i = 0; i < blvdSpacing.length; i++) {
    const dir = (i % 2 === 0) ? 1 : -1;
    const lane = (i % 4 < 2) ? 0 : 1;
    cars.push(spawnOnAvenue(blvdIdx, blvdSpacing[i], dir, lane));
  }

  // 2. Avenue 3000 cars (adjacent to Boulevard)
  const av6Idx = 6;
  for (let y = 400; y < 2900; y += 450) {
    const dir = (y % 900 === 400) ? 1 : -1;
    cars.push(spawnOnAvenue(av6Idx, y, dir, 0));
  }

  // 3. Other Avenues
  for (let a = 0; a < 6; a++) {
    for (let y = 350; y < 2800; y += 750) {
      if (rng.chance(0.75)) {
        const dir = (y % 2 === 0) ? 1 : -1;
        cars.push(spawnOnAvenue(a, y, dir, 0));
      }
    }
  }

  // 4. Streets (East-West)
  for (let s = 0; s < streets.length; s++) {
    for (let x = 300; x < BOULEVARD_X - 100; x += 650) {
      if (rng.chance(0.65)) {
        const dir = (x % 2 === 0) ? 1 : -1;
        cars.push(spawnOnStreet(s, x, dir));
      }
    }
  }

  // Ensure total traffic is around ~45 cars
  while (cars.length > 48) {
    cars.pop();
  }

  return {
    cars,

    setPedestrianManager(mgr) {
      peds = mgr;
    },

    nearestCar(pos, radius = 60) {
      let closest = null;
      let closestDist = radius;

      for (let i = 0; i < cars.length; i++) {
        const c = cars[i];
        if (c.isPlayerCar) continue;
        const d = Math.hypot(c.x - pos.x, c.y - pos.y);
        if (d < closestDist) {
          closestDist = d;
          closest = c;
        }
      }
      return closest;
    },

    hijack(car) {
      // Find car in traffic
      const idx = cars.indexOf(car);
      if (idx !== -1) {
        cars.splice(idx, 1);
      }

      // Spawn fleeing pedestrian from driver's door
      if (peds && peds.spawnFleeing) {
        const doorX = car.x - Math.sin(car.angle) * 20;
        const doorY = car.y + Math.cos(car.angle) * 20;
        peds.spawnFleeing(doorX, doorY, car.x, car.y);
      }

      car.driver = null;
      car.ai = null;
      car.isPlayerCar = true;
      car.indicator = null;
      return car;
    },

    update(dt, playerCar, solids) {
      // 1. Update each AI car
      for (let i = 0; i < cars.length; i++) {
        const car = cars[i];
        const ai = car.ai;
        if (!ai) continue;

        // If stopped by collision or panic
        if (ai.state === 'stopped') {
          // Slow to a stop
          car.vx *= Math.exp(-4 * dt);
          car.vy *= Math.exp(-4 * dt);
          car.speed = Math.hypot(car.vx, car.vy);
          car.update(dt, null, solids);
          continue;
        }

        // Turning execution
        if (ai.turnState === 'turning') {
          ai.turnTimer += dt * 2.8;
          // Smoothly interpolate angle towards turnTargetAngle
          let diff = ai.turnTargetAngle - car.angle;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          car.angle += diff * Math.min(1, 6 * dt);

          const turnSpeed = ai.targetSpeed * 0.65;
          car.vx = Math.cos(car.angle) * turnSpeed;
          car.vy = Math.sin(car.angle) * turnSpeed;
          car.speed = turnSpeed;

          if (ai.turnTimer >= 1.0 || Math.abs(diff) < 0.08) {
            // Turn completed!
            car.angle = ai.turnTargetAngle;
            ai.roadType = ai.newRoadType;
            ai.roadIndex = ai.newRoadIndex;
            ai.dir = ai.newDir;
            ai.turnState = 'none';
            car.indicator = null;
          }

          car.update(dt, null, solids);
          continue;
        }

        // Standard driving along lane
        let desiredSpeed = ai.targetSpeed;
        const fwdX = Math.cos(car.angle);
        const fwdY = Math.sin(car.angle);

        // A. Check for vehicle directly ahead in same lane
        let carAheadDist = 9999;
        for (let j = 0; j < cars.length; j++) {
          if (i === j) continue;
          const other = cars[j];
          const dx = other.x - car.x;
          const dy = other.y - car.y;
          const forwardProj = dx * fwdX + dy * fwdY;
          const lateralProj = Math.abs(-dx * fwdY + dy * fwdX);

          // In front within 18 px lateral corridor
          if (forwardProj > 0 && forwardProj < 95 && lateralProj < 20) {
            if (forwardProj < carAheadDist) {
              carAheadDist = forwardProj;
            }
          }
        }

        // Also check if player's car is ahead
        if (playerCar && playerCar !== car) {
          const dx = playerCar.x - car.x;
          const dy = playerCar.y - car.y;
          const forwardProj = dx * fwdX + dy * fwdY;
          const lateralProj = Math.abs(-dx * fwdY + dy * fwdX);
          if (forwardProj > 0 && forwardProj < 95 && lateralProj < 24) {
            if (forwardProj < carAheadDist) {
              carAheadDist = forwardProj;
            }
          }
        }

        if (carAheadDist < 45) {
          // Brake immediately
          desiredSpeed = 0;
          car.isBraking = true;
        } else if (carAheadDist < 85) {
          // Slow down
          desiredSpeed = Math.min(desiredSpeed, (carAheadDist - 40) * 2.5);
          car.isBraking = true;
        }

        // B. Intersection detection and turning decision
        if (ai.roadType === 'avenue') {
          const currentY = car.y;
          const dir = ai.dir;
          const avX = avenues[ai.roadIndex];
          const targetX = getAvenueLaneX(avX, dir, ai.laneChoice);

          // Lane keeping nudge on X
          car.x += (targetX - car.x) * Math.min(1, 5 * dt);

          // Find next upcoming street
          for (let s = 0; s < streets.length; s++) {
            const stY = streets[s];
            const distToSt = (stY - currentY) * dir; // positive if upcoming ahead

            if (distToSt > 0 && distToSt < 50) {
              // Approaching intersection!
              // Boundary turn check: at end of avenue (top or bottom of city), MUST turn
              const isNorthBoundary = (dir < 0 && s === 0);
              const isSouthBoundary = (dir > 0 && s === streets.length - 1);

              if (distToSt < 28 && (isNorthBoundary || isSouthBoundary || rng.chance(0.25))) {
                // Decide turn direction: left or right
                // Can only turn where streets exist (X from 100 to 3520)
                let turnChoice = 'straight';
                const canTurnWest = (avX > avenues[0]);
                const canTurnEast = (avX < BOULEVARD_X);

                if (isNorthBoundary || isSouthBoundary) {
                  // Must turn!
                  if (canTurnWest && canTurnEast) {
                    turnChoice = rng.chance(0.5) ? 'west' : 'east';
                  } else if (canTurnWest) {
                    turnChoice = 'west';
                  } else {
                    turnChoice = 'east';
                  }
                } else if (rng.chance(0.5) && canTurnWest) {
                  turnChoice = 'west';
                } else if (canTurnEast) {
                  turnChoice = 'east';
                }

                if (turnChoice !== 'straight') {
                  const newDir = (turnChoice === 'east') ? 1 : -1;
                  const newAngle = (newDir > 0) ? 0 : Math.PI;

                  ai.turnState = 'turning';
                  ai.turnTimer = 0;
                  ai.turnTargetAngle = newAngle;
                  ai.newRoadType = 'street';
                  ai.newRoadIndex = s;
                  ai.newDir = newDir;
                  car.indicator = (dir > 0) ? (turnChoice === 'east' ? 'left' : 'right') : (turnChoice === 'east' ? 'right' : 'left');
                  break;
                }
              }
            }
          }

          // Loop/wrap if car goes past world boundaries
          if (car.y < 60 && dir < 0) {
            car.y = 3140;
          } else if (car.y > 3150 && dir > 0) {
            car.y = 80;
          }
        } else {
          // Street (East-West)
          const currentX = car.x;
          const dir = ai.dir;
          const stY = streets[ai.roadIndex];
          const targetY = getStreetLaneY(stY, dir);

          // Lane keeping nudge on Y
          car.y += (targetY - car.y) * Math.min(1, 5 * dt);

          // Find next upcoming avenue
          for (let a = 0; a < avenues.length; a++) {
            const avX = avenues[a];
            const distToAv = (avX - currentX) * dir;

            if (distToAv > 0 && distToAv < 50) {
              // Boundary turn check: at Boulevard (east end) or west avenue
              const isEastEnd = (dir > 0 && a === avenues.length - 1);
              const isWestEnd = (dir < 0 && a === 0);

              if (distToAv < 28 && (isEastEnd || isWestEnd || rng.chance(0.25))) {
                let turnDir = 'straight';
                const canTurnNorth = (stY > streets[0]);
                const canTurnSouth = (stY < streets[streets.length - 1]);

                if (isEastEnd || isWestEnd) {
                  if (canTurnNorth && canTurnSouth) {
                    turnDir = rng.chance(0.5) ? 'north' : 'south';
                  } else if (canTurnNorth) {
                    turnDir = 'north';
                  } else {
                    turnDir = 'south';
                  }
                } else if (rng.chance(0.5) && canTurnNorth) {
                  turnDir = 'north';
                } else if (canTurnSouth) {
                  turnDir = 'south';
                }

                if (turnDir !== 'straight') {
                  const newDir = (turnDir === 'south') ? 1 : -1;
                  const newAngle = (newDir > 0) ? Math.PI / 2 : -Math.PI / 2;

                  ai.turnState = 'turning';
                  ai.turnTimer = 0;
                  ai.turnTargetAngle = newAngle;
                  ai.newRoadType = 'avenue';
                  ai.newRoadIndex = a;
                  ai.newDir = newDir;
                  car.indicator = (dir > 0) ? (turnDir === 'south' ? 'right' : 'left') : (turnDir === 'south' ? 'left' : 'right');
                  break;
                }
              }
            }
          }

          // Loop/wrap if goes past street bounds
          if (car.x < 50 && dir < 0) {
            car.x = BOULEVARD_X - 40;
          } else if (car.x > BOULEVARD_X + 20 && dir > 0) {
            car.x = 80;
          }
        }

        // Apply acceleration or braking to reach desiredSpeed
        const targetVx = Math.cos(car.angle) * desiredSpeed;
        const targetVy = Math.sin(car.angle) * desiredSpeed;
        const accelRate = (desiredSpeed < car.speed) ? 14 : 7;
        car.vx += (targetVx - car.vx) * Math.min(1, accelRate * dt);
        car.vy += (targetVy - car.vy) * Math.min(1, accelRate * dt);
        car.speed = Math.hypot(car.vx, car.vy);

        car.update(dt, null, solids);
      }

      // 2. Inter-car collision checks (traffic cars with each other and player's car)
      for (let i = 0; i < cars.length; i++) {
        const c1 = cars[i];
        for (let j = i + 1; j < cars.length; j++) {
          const c2 = cars[j];
          c1.collideCar(c2);
        }
        if (playerCar && playerCar !== c1) {
          const impact = playerCar.collideCar(c1);
          if (impact > 30) {
            // Player rammed traffic car!
            c1.honkTimer = 2.0;
            if (c1.ai) {
              c1.ai.state = 'stopped';
            }
            // 50% chance driver flees
            if (c1.driver && Math.random() < 0.55 && peds && peds.spawnFleeing) {
              const doorX = c1.x - Math.sin(c1.angle) * 22;
              const doorY = c1.y + Math.cos(c1.angle) * 22;
              peds.spawnFleeing(doorX, doorY, playerCar.x, playerCar.y);
              c1.driver = null;
            }
          }
        }
      }
    },
  };
}
