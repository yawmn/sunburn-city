// Sunburn City rendering pipeline:
// - Prerendered static ground layer blitting
// - Animated sea foam on beach and park fountain water
// - Depth-sorted entity rendering (buildings, props, palms with swaying fronds, streetlights, parked cars, player)
// - Streetlight illumination halos at dusk
// - Warm golden-hour/dusk atmospheric grading and film grain overlay

export function createRenderer(canvas, ctx, world) {
  // 1. Create and prerender the static offscreen canvas
  const offscreen = document.createElement('canvas');
  offscreen.width = world.w;
  offscreen.height = world.h;
  const offCtx = offscreen.getContext('2d', { alpha: false });

  // Prerender ground, roads, sidewalks, beach, marina, and static building shadows
  world.prerender(offCtx);

  // Pre-generate a small film grain pattern canvas for high-performance grain overlay
  const grainCanvas = document.createElement('canvas');
  grainCanvas.width = 128;
  grainCanvas.height = 128;
  const grainCtx = grainCanvas.getContext('2d');
  const grainData = grainCtx.createImageData(128, 128);
  for (let i = 0; i < grainData.data.length; i += 4) {
    const val = (Math.random() * 255) | 0;
    grainData.data[i] = val;
    grainData.data[i + 1] = val;
    grainData.data[i + 2] = val;
    grainData.data[i + 3] = 16; // Very subtle noise
  }
  grainCtx.putImageData(grainData, 0, 0);
  const grainPattern = ctx.createPattern(grainCanvas, 'repeat');

  // Helpers to draw specific entities
  function drawBuilding(c, b, time) {
    const H = b.height;
    const roofYOffset = Math.round(H * 0.32);

    // Front / South Facade
    // Darkened version of building color for vertical wall
    c.fillStyle = b.color;
    c.fillRect(b.x, b.y + b.h - roofYOffset, b.w, roofYOffset);

    // Front facade wall shading
    c.fillStyle = 'rgba(0, 0, 0, 0.22)';
    c.fillRect(b.x, b.y + b.h - roofYOffset, b.w, roofYOffset);

    // Windows on south facade
    const winCols = Math.max(2, Math.floor(b.w / 28));
    const winRows = Math.max(1, Math.floor(roofYOffset / 18));
    const winW = (b.w - (winCols + 1) * 6) / winCols;
    const winH = (roofYOffset - (winRows + 1) * 5) / winRows;

    for (let wc = 0; wc < winCols; wc++) {
      for (let wr = 0; wr < winRows; wr++) {
        const wx = b.x + 6 + wc * (winW + 6);
        const wy = b.y + b.h - roofYOffset + 4 + wr * (winH + 5);

        // Lit / reflective window panes
        c.fillStyle = ((wc + wr) % 3 === 0) ? '#ffe082' : '#2a3b4c';
        c.fillRect(wx, wy, winW, winH);
        c.fillStyle = 'rgba(255, 255, 255, 0.35)';
        c.fillRect(wx, wy, winW, 2);
      }
    }

    // Striped fabric awning along entrance
    if (b.awnings) {
      const awnY = b.y + b.h - 4;
      const awnH = 10;
      c.fillStyle = b.awningColor || '#ff4d94';
      c.fillRect(b.x + 8, awnY, b.w - 16, awnH);

      // White awning stripes
      c.fillStyle = '#ffffff';
      for (let ax = b.x + 8; ax < b.x + b.w - 16; ax += 12) {
        c.fillRect(ax, awnY, 6, awnH);
      }

      // Awning scallop drop shadow
      c.fillStyle = 'rgba(0, 0, 0, 0.3)';
      c.fillRect(b.x + 8, awnY + awnH, b.w - 16, 3);
    }

    // Neon shop/hotel sign
    if (b.neon) {
      c.save();
      c.font = 'bold 12px "Arial Black", sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      const signX = b.x + b.w / 2;
      const signY = b.y + b.h - roofYOffset / 2;

      // Neon sign background plate
      c.fillStyle = '#10141c';
      c.fillRect(signX - 60, signY - 8, 120, 16);
      c.strokeStyle = b.neon.color;
      c.lineWidth = 1.5;
      c.strokeRect(signX - 60, signY - 8, 120, 16);

      // Neon glowing text
      c.shadowColor = b.neon.color;
      c.shadowBlur = 8;
      c.fillStyle = '#ffffff';
      c.fillText(b.neon.text, signX, signY);
      c.restore();
    }

    // Roof Deck (elevated)
    const roofY = b.y - roofYOffset;
    c.fillStyle = b.roofColor || '#7d848c';
    c.fillRect(b.x, roofY, b.w, b.h);

    // Subtle roof gravel / tile texture grid
    c.save();
    c.strokeStyle = 'rgba(0, 0, 0, 0.08)';
    c.lineWidth = 1;
    for (let gx = b.x + 18; gx < b.x + b.w - 10; gx += 20) {
      c.beginPath();
      c.moveTo(gx, roofY + 4);
      c.lineTo(gx, roofY + b.h - 4);
      c.stroke();
    }
    for (let gy = roofY + 18; gy < roofY + b.h - 10; gy += 20) {
      c.beginPath();
      c.moveTo(b.x + 4, gy);
      c.lineTo(b.x + b.w - 4, gy);
      c.stroke();
    }
    c.restore();

    // Darker parapet edge & inner shadow
    c.strokeStyle = b.parapetColor || '#23262d';
    c.lineWidth = 4;
    c.strokeRect(b.x + 2, roofY + 2, b.w - 4, b.h - 4);

    // Parapet inner drop shadow on north and west sides
    c.fillStyle = 'rgba(10, 14, 20, 0.28)';
    c.fillRect(b.x + 4, roofY + 4, b.w - 8, 4);
    c.fillRect(b.x + 4, roofY + 4, 4, b.h - 8);

    // Rooftop Clutter (AC boxes, stairwell boxes, turbine vents, water towers, antennas)
    if (b.roofClutter) {
      for (const item of b.roofClutter) {
        if (item.type === 'stairwell') {
          // Stairwell penthouse bulkhead box
          const sx = b.x + item.rx;
          const sy = roofY + item.ry;
          // Long soft shadow cast lower-right
          c.fillStyle = 'rgba(12, 16, 24, 0.35)';
          c.fillRect(sx + 5, sy + 5, item.rw, item.rh);

          // Box body
          c.fillStyle = '#4a5058';
          c.fillRect(sx, sy, item.rw, item.rh);
          c.strokeStyle = '#282c32';
          c.lineWidth = 1.5;
          c.strokeRect(sx, sy, item.rw, item.rh);

          // Metal access door on south face
          c.fillStyle = '#212529';
          c.fillRect(sx + 4, sy + item.rh - 3, 10, 3);
          // Small roof awning on stairwell box
          c.fillStyle = '#6c757d';
          c.fillRect(sx - 1, sy - 1, item.rw + 2, 3);
        } else if (item.type === 'ac') {
          // AC compressor unit
          const ax = b.x + item.rx;
          const ay = roofY + item.ry;
          // Drop shadow
          c.fillStyle = 'rgba(12, 16, 24, 0.32)';
          c.fillRect(ax + 4, ay + 4, item.rw, item.rh);

          // Unit casing
          c.fillStyle = '#5a626a';
          c.fillRect(ax, ay, item.rw, item.rh);
          c.strokeStyle = '#343a40';
          c.lineWidth = 1;
          c.strokeRect(ax, ay, item.rw, item.rh);

          // Fan grille
          c.fillStyle = '#1c2024';
          c.beginPath();
          c.arc(ax + item.rw / 2, ay + item.rh / 2, item.rh * 0.36, 0, Math.PI * 2);
          c.fill();
        } else if (item.type === 'vent') {
          // Rooftop turbine exhaust vent
          const vx = b.x + item.rx;
          const vy = roofY + item.ry;
          // Drop shadow
          c.fillStyle = 'rgba(12, 16, 24, 0.3)';
          c.beginPath();
          c.arc(vx + 3, vy + 3, item.radius, 0, Math.PI * 2);
          c.fill();

          // Vent cylinder
          c.fillStyle = '#6c757d';
          c.beginPath();
          c.arc(vx, vy, item.radius, 0, Math.PI * 2);
          c.fill();
          c.strokeStyle = '#343a40';
          c.lineWidth = 1;
          c.stroke();
          // Inner core
          c.fillStyle = '#212529';
          c.beginPath();
          c.arc(vx, vy, item.radius * 0.45, 0, Math.PI * 2);
          c.fill();
        } else if (item.type === 'water_tank') {
          // Circular water tank on stilts
          const tx = b.x + item.rx;
          const ty = roofY + item.ry;
          // Long soft shadow under tank
          c.fillStyle = 'rgba(12, 16, 24, 0.38)';
          c.beginPath();
          c.arc(tx + 6, ty + 6, item.radius, 0, Math.PI * 2);
          c.fill();
          // Tank body (cedar staves / weathered iron)
          c.fillStyle = '#795548';
          c.beginPath();
          c.arc(tx, ty, item.radius, 0, Math.PI * 2);
          c.fill();
          c.strokeStyle = '#4e342e';
          c.lineWidth = 2;
          c.stroke();
          // Tank steel reinforcement bands
          c.strokeStyle = '#3e2723';
          c.lineWidth = 1;
          c.beginPath();
          c.arc(tx, ty, item.radius * 0.7, 0, Math.PI * 2);
          c.stroke();
          // Conical top cap
          c.fillStyle = '#4e342e';
          c.beginPath();
          c.arc(tx, ty, item.radius * 0.4, 0, Math.PI * 2);
          c.fill();
        } else if (item.type === 'antenna') {
          // Antenna mast
          const ax = b.x + item.rx;
          const ay = roofY + item.ry;
          c.strokeStyle = '#adb5bd';
          c.lineWidth = 2;
          c.beginPath();
          c.moveTo(ax, ay);
          c.lineTo(ax, ay - item.h);
          c.stroke();
          // Cross spars
          c.beginPath();
          c.moveTo(ax - 6, ay - item.h * 0.6);
          c.lineTo(ax + 6, ay - item.h * 0.6);
          c.moveTo(ax - 4, ay - item.h * 0.8);
          c.lineTo(ax + 4, ay - item.h * 0.8);
          c.stroke();
          // Blinking red beacon light
          const blink = (Math.sin(time * 5 + ax) > 0.3);
          c.fillStyle = blink ? '#ff0055' : '#4a0018';
          c.beginPath();
          c.arc(ax, ay - item.h, 3, 0, Math.PI * 2);
          c.fill();
        }
      }
    }
  }

  function drawPalm(c, p, time) {
    const sway = Math.sin(time * 2.2 + p.seed) * 0.12;
    const apexX = p.x + sway * 14;
    const apexY = p.y - p.height;

    // Palm ground shadow
    c.fillStyle = 'rgba(12, 16, 24, 0.35)';
    c.beginPath();
    c.ellipse(p.x + 12, p.y + 8, 16, 9, 0, 0, Math.PI * 2);
    c.fill();

    // Trunk
    c.strokeStyle = '#6d4c41';
    c.lineWidth = p.trunkR || 4;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(p.x, p.y);
    c.quadraticCurveTo(p.x - 4, p.y - p.height * 0.5, apexX, apexY);
    c.stroke();

    // Palm Fronds (8 radiating leafy fronds)
    const frondAngles = [0, 0.78, 1.57, 2.35, 3.14, 3.92, 4.71, 5.5];
    for (let i = 0; i < frondAngles.length; i++) {
      const angle = frondAngles[i] + sway * 0.4;
      const frondLen = 24;
      const endX = apexX + Math.cos(angle) * frondLen;
      const endY = apexY + Math.sin(angle) * frondLen + 5; // Droop down

      c.strokeStyle = (i % 2 === 0) ? '#2f7d4f' : '#3ea568';
      c.lineWidth = 3.5;
      c.beginPath();
      c.moveTo(apexX, apexY);
      c.quadraticCurveTo(apexX + Math.cos(angle) * 12, apexY + Math.sin(angle) * 12 - 4, endX, endY);
      c.stroke();
    }
  }

  function drawStreetlight(c, l) {
    // Post shadow
    c.fillStyle = 'rgba(12, 16, 24, 0.35)';
    c.beginPath();
    c.ellipse(l.x + 8, l.y + 6, 8, 4, 0, 0, Math.PI * 2);
    c.fill();

    // Post base and pole
    c.strokeStyle = '#2b303a';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(l.x, l.y);
    c.lineTo(l.x, l.y - 34);
    // Overreach arm
    const armOffset = (l.arm === 'left') ? -14 : 14;
    c.lineTo(l.x + armOffset, l.y - 38);
    c.stroke();

    // Lamp fixture
    c.fillStyle = '#ffb703';
    c.beginPath();
    c.arc(l.x + armOffset, l.y - 37, 3, 0, Math.PI * 2);
    c.fill();
  }

  function drawCar(c, car) {
    c.save();
    c.translate(car.x, car.y);
    c.rotate(car.rot || 0);

    // Car ground shadow
    c.fillStyle = 'rgba(10, 14, 20, 0.45)';
    c.beginPath();
    c.roundRect(-car.w / 2 + 5, -car.h / 2 + 6, car.w, car.h, 4);
    c.fill();

    // Car body
    c.fillStyle = car.color;
    c.beginPath();
    c.roundRect(-car.w / 2, -car.h / 2, car.w, car.h, 4);
    c.fill();

    // Bumpers
    c.fillStyle = '#1c222b';
    c.fillRect(-car.w / 2, -car.h / 2, car.w, 3);
    c.fillRect(-car.w / 2, car.h / 2 - 3, car.w, 3);

    // Windshields
    c.fillStyle = '#7097b0';
    // Front windshield
    c.fillRect(-car.w / 2 + 2, -car.h / 2 + 8, car.w - 4, 6);
    // Rear windshield
    c.fillRect(-car.w / 2 + 2, car.h / 2 - 12, car.w - 4, 5);

    // Roof
    if (car.model !== 'convertible') {
      c.fillStyle = car.color;
      c.fillRect(-car.w / 2 + 2, -car.h / 2 + 14, car.w - 4, car.h - 26);
      c.fillStyle = 'rgba(255, 255, 255, 0.18)';
      c.fillRect(-car.w / 2 + 3, -car.h / 2 + 14, 3, car.h - 26);
    } else {
      // Convertible interior seats
      c.fillStyle = '#b08968';
      c.fillRect(-car.w / 2 + 3, -car.h / 2 + 14, car.w - 6, car.h - 26);
    }

    // Headlights (top)
    c.fillStyle = '#fff3b0';
    c.fillRect(-car.w / 2 + 2, -car.h / 2, 4, 2);
    c.fillRect(car.w / 2 - 6, -car.h / 2, 4, 2);

    // Taillights (bottom)
    c.fillStyle = '#d90429';
    c.fillRect(-car.w / 2 + 2, car.h / 2 - 2, 4, 2);
    c.fillRect(car.w / 2 - 6, car.h / 2 - 2, 4, 2);

    c.restore();
  }

  function drawBeachUmbrella(c, u) {
    c.save();
    c.translate(u.x, u.y);

    // Ground shadow
    c.fillStyle = 'rgba(12, 16, 24, 0.3)';
    c.beginPath();
    c.ellipse(10, 10, u.radius, u.radius * 0.7, 0, 0, Math.PI * 2);
    c.fill();

    // 8-segment parasol
    const numSegments = 8;
    const step = (Math.PI * 2) / numSegments;
    for (let i = 0; i < numSegments; i++) {
      c.fillStyle = (i % 2 === 0) ? u.color1 : u.color2;
      c.beginPath();
      c.moveTo(0, 0);
      c.arc(0, 0, u.radius, i * step, (i + 1) * step);
      c.closePath();
      c.fill();
    }
    // Center cap
    c.fillStyle = '#f8f9fa';
    c.beginPath();
    c.arc(0, 0, 3, 0, Math.PI * 2);
    c.fill();

    c.restore();
  }

  function drawBeachTowel(c, t) {
    c.save();
    c.translate(t.x, t.y);
    c.rotate(t.rot || 0);
    c.fillStyle = t.color;
    c.fillRect(-t.w / 2, -t.h / 2, t.w, t.h);
    // Stripe
    c.fillStyle = '#ffffff';
    c.fillRect(-t.w / 2, -2, t.w, 4);
    c.restore();
  }

  function drawBoat(c, boat) {
    c.save();
    c.translate(boat.x, boat.y);

    // Hull (pointed bow)
    c.fillStyle = boat.color;
    c.beginPath();
    c.moveTo(0, -boat.h / 2);
    c.lineTo(boat.w / 2, -boat.h / 4);
    c.lineTo(boat.w / 2, boat.h / 2);
    c.lineTo(-boat.w / 2, boat.h / 2);
    c.lineTo(-boat.w / 2, -boat.h / 4);
    c.closePath();
    c.fill();

    // Teak cockpit deck
    c.fillStyle = '#8d6e63';
    c.fillRect(-boat.w / 2 + 3, -boat.h / 4, boat.w - 6, boat.h * 0.65);

    // Windshield
    c.fillStyle = '#00b4d8';
    c.fillRect(-boat.w / 2 + 4, -boat.h / 4, boat.w - 8, 4);

    c.restore();
  }

  return {
    render(player, camera, entities = [], time = 0, combat = null, police = null) {
      const bounds = camera.bounds();

      // Clear frame
      ctx.fillStyle = '#0b0f17';
      ctx.fillRect(0, 0, 1280, 720);

      ctx.save();
      // Apply camera viewport transform
      camera.apply(ctx);

      // 1. Draw Prerendered Ground Layer (culled to viewport)
      const clipLeft = Math.max(0, Math.floor(bounds.left));
      const clipTop = Math.max(0, Math.floor(bounds.top));
      const clipRight = Math.min(world.w, Math.ceil(bounds.right));
      const clipBottom = Math.min(world.h, Math.ceil(bounds.bottom));
      const clipW = clipRight - clipLeft;
      const clipH = clipBottom - clipTop;

      if (clipW > 0 && clipH > 0) {
        ctx.drawImage(offscreen, clipLeft, clipTop, clipW, clipH, clipLeft, clipTop, clipW, clipH);
      }

      // 2. Animated Sea Foam / Ocean Waves
      if (bounds.right >= world.ocean.x - 80) {
        ctx.save();
        const foamStart = Math.max(0, bounds.top - 20);
        const foamEnd = Math.min(world.h, bounds.bottom + 20);

        // Multiple rolling wave foam lines
        for (let waveIndex = 0; waveIndex < 3; waveIndex++) {
          const speed = 1.6 + waveIndex * 0.4;
          const phase = (time * speed + waveIndex * 1.8) % 4.0;
          const rollOffset = Math.sin(phase) * 22;

          ctx.strokeStyle = `rgba(255, 255, 255, ${0.45 - waveIndex * 0.12})`;
          ctx.lineWidth = 3 - waveIndex * 0.5;
          ctx.beginPath();

          for (let y = foamStart; y <= foamEnd; y += 12) {
            const waveX = world.ocean.x - 12 + rollOffset + Math.sin(y * 0.035 + time * 2) * 16 + Math.cos(y * 0.08 - time) * 7;
            if (y === foamStart) ctx.moveTo(waveX, y);
            else ctx.lineTo(waveX, y);
          }
          ctx.stroke();
        }
        ctx.restore();
      }

      // 3. Park Fountain Water Spray
      if (world.park && bounds.right >= world.park.x && bounds.left <= world.park.x + world.park.w) {
        const fx = world.park.fountain.x;
        const fy = world.park.fountain.y;
        const ripple = (time * 3) % 18;

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(fx, fy, 8 + ripple, 0, Math.PI * 2);
        ctx.stroke();

        // Water jet spray
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(fx, fy, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // 4. Marina Boats
      if (world.marina && bounds.right >= world.marina.x && bounds.left <= world.marina.x + world.marina.w) {
        for (const boat of world.marina.boats) {
          drawBoat(ctx, boat);
        }
      }

      // 4.5 Tyre Skid Marks on Roads (drawn under vehicles)
      for (let i = 0; i < entities.length; i++) {
        const e = entities[i];
        if (e && e.drawSkids) e.drawSkids(ctx);
      }
      if (player && player.inCar && player.inCar.drawSkids) {
        player.inCar.drawSkids(ctx);
      }

      // 5. Collect and Depth-Sort Entities
      const renderList = [];

      // A. Buildings in view
      for (let i = 0; i < world.buildings.length; i++) {
        const b = world.buildings[i];
        if (b.x + b.w >= bounds.left && b.x <= bounds.right &&
            b.y + b.h >= bounds.top && b.y - b.height * 0.4 <= bounds.bottom) {
          renderList.push({
            type: 'building',
            sortY: b.y + b.h,
            item: b,
          });
        }
      }

      // B. Props in view
      for (let i = 0; i < world.props.length; i++) {
        const p = world.props[i];
        if (p.x >= bounds.left - 40 && p.x <= bounds.right + 40 &&
            p.y >= bounds.top - 60 && p.y <= bounds.bottom + 40) {
          renderList.push({
            type: 'prop',
            sortY: p.y,
            item: p,
          });
        }
      }

      // C. Player (only drawn on foot if not inside a car)
      if (player && !player.inCar) {
        renderList.push({
          type: 'player',
          sortY: player.y,
          item: player,
        });
      }

      // D. External entities (traffic cars, peds, player car)
      for (let i = 0; i < entities.length; i++) {
        const e = entities[i];
        if (e.x >= bounds.left - 60 && e.x <= bounds.right + 60 &&
            e.y >= bounds.top - 60 && e.y <= bounds.bottom + 60) {
          renderList.push({
            type: 'entity',
            sortY: e.sortY !== undefined ? e.sortY : e.y,
            item: e,
          });
        }
      }

      // If player is driving a car, include player's car in render list
      if (player && player.inCar) {
        const car = player.inCar;
        if (car.x >= bounds.left - 60 && car.x <= bounds.right + 60 &&
            car.y >= bounds.top - 60 && car.y <= bounds.bottom + 60) {
          renderList.push({
            type: 'entity',
            sortY: car.y,
            item: car,
          });
        }
      }

      // Sort by sortY ascending
      renderList.sort((a, b) => a.sortY - b.sortY);

      // 6. Draw Sorted Entities
      for (let i = 0; i < renderList.length; i++) {
        const entry = renderList[i];
        if (entry.type === 'building') {
          drawBuilding(ctx, entry.item, time);
        } else if (entry.type === 'player') {
          entry.item.draw(ctx);
        } else if (entry.type === 'entity') {
          if (entry.item.draw) entry.item.draw(ctx, time);
        } else if (entry.type === 'prop') {
          const p = entry.item;
          switch (p.type) {
            case 'palm':
              drawPalm(ctx, p, time);
              break;
            case 'streetlight':
              drawStreetlight(ctx, p);
              break;
            case 'car':
              drawCar(ctx, p);
              break;
            case 'umbrella':
              drawBeachUmbrella(ctx, p);
              break;
            case 'towel':
              drawBeachTowel(ctx, p);
              break;
            case 'hydrant':
              // Fire hydrant
              ctx.fillStyle = '#e63946';
              ctx.beginPath();
              ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = '#ffd166';
              ctx.fillRect(p.x - 2, p.y - 5, 4, 2);
              break;
            case 'bin':
              // Trash bin
              ctx.fillStyle = '#1d3557';
              ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
              break;
            case 'newspaper':
              // 80s Newspaper vending machine
              ctx.fillStyle = p.color || '#1d3557';
              ctx.fillRect(p.x - 4, p.y - 4, 8, 8);
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(p.x - 3, p.y - 3, 6, 3);
              break;
            case 'mailbox':
              // Street post box
              ctx.fillStyle = '#d90429';
              ctx.beginPath();
              ctx.roundRect(p.x - 4, p.y - 5, 8, 10, 2);
              ctx.fill();
              break;
            case 'planter':
              // Sidewalk planter box
              ctx.fillStyle = '#adb5bd';
              ctx.fillRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h);
              ctx.fillStyle = '#2d6a4f';
              ctx.beginPath();
              ctx.arc(p.x, p.y, p.w * 0.65, 0, Math.PI * 2);
              ctx.fill();
              break;
            case 'bench':
              // Park bench
              ctx.save();
              ctx.translate(p.x, p.y);
              ctx.rotate(p.rot || 0);
              ctx.fillStyle = '#5c4033';
              ctx.fillRect(-10, -3, 20, 6);
              ctx.strokeStyle = '#212529';
              ctx.lineWidth = 1;
              ctx.strokeRect(-10, -3, 20, 6);
              ctx.restore();
              break;
            case 'lifeguard_tower':
              // Wooden lifeguard stand
              ctx.fillStyle = '#f8f9fa';
              ctx.fillRect(p.x - 12, p.y - 12, 24, 24);
              ctx.fillStyle = '#e63946'; // Red roof
              ctx.fillRect(p.x - 14, p.y - 14, 28, 4);
              break;
          }
        }
      }

      // 7. Streetlight Illumination Halos at Dusk
      for (let i = 0; i < world.props.length; i++) {
        const p = world.props[i];
        if (p.type === 'streetlight' &&
            p.x >= bounds.left - 60 && p.x <= bounds.right + 60 &&
            p.y >= bounds.top - 60 && p.y <= bounds.bottom + 60) {
          const armOffset = (p.arm === 'left') ? -14 : 14;
          const lx = p.x + armOffset;
          const ly = p.y - 37;

          const halo = ctx.createRadialGradient(lx, ly, 2, lx, ly, 45);
          halo.addColorStop(0, 'rgba(255, 214, 102, 0.4)');
          halo.addColorStop(0.5, 'rgba(255, 183, 3, 0.15)');
          halo.addColorStop(1, 'rgba(255, 183, 3, 0)');
          ctx.fillStyle = halo;
          ctx.beginPath();
          ctx.arc(lx, ly, 45, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 7.5 Combat & Police World Visuals (Tracers, explosions, sparks, blood, cones)
      if (combat && combat.drawWorld) {
        combat.drawWorld(ctx);
      }
      if (police && police.drawWorld) {
        police.drawWorld(ctx, time);
      }

      ctx.restore(); // Camera transform restored

      // 8. Post-Processing: Golden-Hour Warm Sky Tint & Vignette
      const skyGrad = ctx.createLinearGradient(0, 0, 1280, 0);
      skyGrad.addColorStop(0, 'rgba(255, 140, 50, 0.08)'); // Sunset warmth in west
      skyGrad.addColorStop(0.65, 'rgba(255, 80, 120, 0.05)');
      skyGrad.addColorStop(1, 'rgba(30, 80, 160, 0.08)'); // Deep dusk turquoise in east over ocean
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, 1280, 720);

      // Subtle film grain overlay
      ctx.save();
      ctx.fillStyle = grainPattern;
      ctx.fillRect(0, 0, 1280, 720);
      ctx.restore();
    },
  };
}
