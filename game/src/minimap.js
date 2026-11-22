// Minimap system: circular clipped radar of streets, beach, water, park, clean building footprints,
// moving traffic dots, player arrow/car indicator, north compass marker, and metallic bezel ring.

export function createMinimap(world, player) {
  const DIAMETER = 210;
  const RADIUS = DIAMETER / 2; // 105 px

  return {
    draw(ctx, cx = 130, cy = 590, trafficCars = [], police = null, missions = null) {
      if (!world || !player) return;

      ctx.save();

      // Outer bezel drop shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
      ctx.shadowBlur = 16;
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 5;

      // Outer bezel base
      ctx.beginPath();
      ctx.arc(cx, cy, RADIUS + 8, 0, Math.PI * 2);
      ctx.fillStyle = '#12161f';
      ctx.fill();
      ctx.shadowColor = 'transparent'; // Reset shadow

      // Metallic border gradient
      const rimGrad = ctx.createLinearGradient(cx - RADIUS, cy - RADIUS, cx + RADIUS, cy + RADIUS);
      rimGrad.addColorStop(0, '#3a4454');
      rimGrad.addColorStop(0.5, '#1e242f');
      rimGrad.addColorStop(1, '#0e1218');
      ctx.strokeStyle = rimGrad;
      ctx.lineWidth = 5;
      ctx.stroke();

      // Clip circular map view
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, RADIUS, 0, Math.PI * 2);
      ctx.clip();

      // Background water/land base (clean dark slate)
      ctx.fillStyle = '#1a1f28';
      ctx.fillRect(cx - RADIUS, cy - RADIUS, DIAMETER, DIAMETER);

      // Transform world coordinates centered on player
      // Scale: 1 minimap pixel ≈ 11 world units
      const scale = 0.09;
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.translate(-player.x, -player.y);

      // 1. Terrain: Clean Sandy Beach & Ocean
      ctx.fillStyle = '#cdb794';
      ctx.fillRect(world.beach.x, 0, world.beach.w, world.h);
      ctx.fillStyle = '#16697a';
      ctx.fillRect(world.ocean.x, 0, world.ocean.w, world.h);

      // 2. Marina water
      if (world.marina) {
        ctx.fillStyle = '#135968';
        ctx.fillRect(world.marina.x, world.marina.y, world.marina.w, world.marina.h);
      }

      // 3. Central Park
      if (world.park) {
        ctx.fillStyle = '#2f5238';
        ctx.fillRect(world.park.x, world.park.y, world.park.w, world.park.h);
        ctx.fillStyle = '#1b8f9c';
        ctx.beginPath();
        ctx.arc(world.park.fountain.x, world.park.fountain.y, world.park.fountain.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // 4. Roads (clean asphalt ribbons)
      ctx.fillStyle = '#3c4353';
      for (const r of world.roads) {
        ctx.fillRect(r.x, r.y, r.w, r.h);
      }

      // 5. Buildings footprints: Clean uniform dark architectural slate (no rainbow blocks)
      ctx.fillStyle = '#222834';
      ctx.strokeStyle = '#151922';
      ctx.lineWidth = 3;
      for (const b of world.buildings) {
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.strokeRect(b.x, b.y, b.w, b.h);
      }

      // 6. Moving Traffic Cars as Dots
      if (trafficCars && trafficCars.length > 0) {
        ctx.fillStyle = '#f8f9fa';
        for (let i = 0; i < trafficCars.length; i++) {
          const tc = trafficCars[i];
          if (tc.isPlayerCar || tc.hasLightbar) continue;
          ctx.beginPath();
          ctx.arc(tc.x, tc.y, 22, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 6.5. Police Cruisers, Officers, and Red Vision Cone
      if (police) {
        // Red vision cone for the nearest cruiser
        let nearestCruiser = null;
        let minCruiserDist = Infinity;
        if (police.cruisers) {
          for (let i = 0; i < police.cruisers.length; i++) {
            const c = police.cruisers[i];
            if (c.isWreck) continue;
            const d = Math.hypot(c.x - player.x, c.y - player.y);
            if (d < minCruiserDist) {
              minCruiserDist = d;
              nearestCruiser = c;
            }
          }
        }

        if (nearestCruiser) {
          ctx.save();
          ctx.fillStyle = 'rgba(255, 30, 60, 0.28)';
          ctx.strokeStyle = 'rgba(255, 30, 60, 0.7)';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(nearestCruiser.x, nearestCruiser.y);
          const coneAngle = nearestCruiser.angle;
          const coneSpread = 0.44;
          const coneLen = 420;
          ctx.arc(nearestCruiser.x, nearestCruiser.y, coneLen, coneAngle - coneSpread, coneAngle + coneSpread);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }

        // Blue blips for police cruisers
        if (police.cruisers) {
          for (let i = 0; i < police.cruisers.length; i++) {
            const c = police.cruisers[i];
            if (c.isWreck) continue;
            ctx.fillStyle = '#00d2ff';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(c.x, c.y, 30, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }
        }

        // Blue blips for officers
        if (police.officers) {
          ctx.fillStyle = '#3a86ff';
          for (let i = 0; i < police.officers.length; i++) {
            const off = police.officers[i];
            if (off.isDead) continue;
            ctx.beginPath();
            ctx.arc(off.x, off.y, 22, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // 6.6 Mission blip slot stays
      const missionWp = (missions && missions.waypoint) || world.missionBlip;
      if (missionWp && missionWp.x != null && missionWp.y != null) {
        ctx.fillStyle = '#ffd166';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(missionWp.x, missionWp.y, 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ff007f';
        ctx.fillRect(missionWp.x - 9, missionWp.y - 9, 18, 18);
      }

      // End of world transformed drawing
      ctx.restore();

      // Inner glowing neon rim
      ctx.strokeStyle = '#20dfb8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, RADIUS - 1, 0, Math.PI * 2);
      ctx.stroke();

      // Radar rings & crosshairs (subtle)
      ctx.strokeStyle = 'rgba(32, 223, 184, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, RADIUS * 0.45, 0, Math.PI * 2);
      ctx.arc(cx, cy, RADIUS * 0.75, 0, Math.PI * 2);
      ctx.stroke();

      // Tick marks along the rim every 30 degrees
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
        const cos = Math.cos(a);
        const sin = Math.sin(a);
        const r1 = RADIUS - 6;
        const r2 = RADIUS - 1;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx + cos * r1, cy + sin * r1);
        ctx.lineTo(cx + cos * r2, cy + sin * r2);
        ctx.stroke();
      }

      // North Marker ("N" with red triangle) at top
      const nY = cy - RADIUS + 13;
      ctx.fillStyle = '#ff3366';
      ctx.beginPath();
      ctx.moveTo(cx, nY - 9);
      ctx.lineTo(cx - 5, nY - 1);
      ctx.lineTo(cx + 5, nY - 1);
      ctx.fill();
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('N', cx, nY + 1);

      // Player Arrow at center
      ctx.save();
      ctx.translate(cx, cy);
      const playerAngle = player.inCar ? player.inCar.angle : player.facingAngle;
      ctx.rotate(playerAngle);

      if (player.inCar) {
        // Driving vehicle chevron / arrow
        ctx.fillStyle = '#00f0ff';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(12, 0); // Tip
        ctx.lineTo(-8, -8);
        ctx.lineTo(-4, 0);
        ctx.lineTo(-8, 8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        // On foot player arrow
        ctx.fillStyle = '#00f0ff';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(-7, -7);
        ctx.lineTo(-3, 0);
        ctx.lineTo(-7, 7);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      ctx.restore();

      // Clamped perimeter arrow if waypoint is outside circular radar view
      if (missionWp && missionWp.x != null && missionWp.y != null) {
        const dx = (missionWp.x - player.x) * scale;
        const dy = (missionWp.y - player.y) * scale;
        const dist = Math.hypot(dx, dy);
        if (dist > RADIUS - 10) {
          const angle = Math.atan2(dy, dx);
          const rimDist = RADIUS - 8;
          const blipX = cx + Math.cos(angle) * rimDist;
          const blipY = cy + Math.sin(angle) * rimDist;

          ctx.save();
          ctx.translate(blipX, blipY);
          ctx.rotate(angle);
          ctx.fillStyle = '#ffd166';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(9, 0);
          ctx.lineTo(-6, -6);
          ctx.lineTo(-2, 0);
          ctx.lineTo(-6, 6);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      }

      ctx.restore();
    },
  };
}
