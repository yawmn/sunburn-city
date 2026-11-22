// HUD and Title screen graphics: Health/Armour bars, money, wanted stars, minimap mount,
// weapon badge, clock, radio station, and canvas-rendered SUNBURN CITY chrome wordmark.

export function createHud() {
  function drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
    let rot = (Math.PI / 2) * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
  }

  // Draw a silhouette palm tree for title screen
  function drawSilhouettePalm(ctx, x, y, scale = 1, flip = false) {
    ctx.save();
    ctx.translate(x, y);
    if (flip) ctx.scale(-1, 1);
    ctx.scale(scale, scale);

    ctx.fillStyle = '#0a0512';
    // Curved trunk
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.bezierCurveTo(-15, -60, -8, -130, 35, -180);
    ctx.bezierCurveTo(40, -182, 38, -178, 28, -176);
    ctx.bezierCurveTo(-3, -125, -7, -60, 6, 0);
    ctx.closePath();
    ctx.fill();

    // Palm fronds radiating from trunk apex (35, -180)
    const fronds = [
      { cp1x: 10, cp1y: -230, cp2x: -50, cp2y: -220, endX: -100, endY: -180, w: 9 },
      { cp1x: 20, cp1y: -245, cp2x: -10, cp2y: -250, endX: -45, endY: -230, w: 9 },
      { cp1x: 45, cp1y: -250, cp2x: 40, cp2y: -260, endX: 35, endY: -240, w: 8 },
      { cp1x: 65, cp1y: -240, cp2x: 95, cp2y: -230, endX: 120, endY: -195, w: 9 },
      { cp1x: 75, cp1y: -210, cp2x: 120, cp2y: -190, endX: 145, endY: -150, w: 9 },
      { cp1x: 50, cp1y: -190, cp2x: 90, cp2y: -160, endX: 115, endY: -130, w: 8 },
      { cp1x: 10, cp1y: -185, cp2x: -30, cp2y: -165, endX: -65, endY: -140, w: 8 },
    ];

    for (const f of fronds) {
      ctx.beginPath();
      ctx.moveTo(33, -178);
      ctx.bezierCurveTo(f.cp1x, f.cp1y, f.cp2x, f.cp2y, f.endX, f.endY);
      ctx.bezierCurveTo(f.cp2x, f.cp2y + f.w, f.cp1x, f.cp1y + f.w, 33, -178);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawWordmark(ctx, cx = 640, cy = 250, time = 0) {
    ctx.save();

    // 1. Setting Sun Disc
    const sunR = 125;
    const sunY = cy - 25;

    // Glowing halo behind sun
    const glowGrad = ctx.createRadialGradient(cx, sunY, sunR * 0.4, cx, sunY, sunR * 1.6);
    glowGrad.addColorStop(0, 'rgba(255, 94, 0, 0.45)');
    glowGrad.addColorStop(0.6, 'rgba(255, 0, 128, 0.25)');
    glowGrad.addColorStop(1, 'rgba(255, 0, 128, 0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(cx, sunY, sunR * 1.6, 0, Math.PI * 2);
    ctx.fill();

    // Sun Disc with vertical synthwave gradient
    const sunGrad = ctx.createLinearGradient(cx, sunY - sunR, cx, sunY + sunR);
    sunGrad.addColorStop(0, '#fff04b'); // Bright yellow
    sunGrad.addColorStop(0.45, '#ff5a36'); // Coral orange
    sunGrad.addColorStop(0.85, '#ff007f'); // Hot magenta
    sunGrad.addColorStop(1, '#83006a'); // Deep dusk purple

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, sunY, sunR, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = sunGrad;
    ctx.fillRect(cx - sunR, sunY - sunR, sunR * 2, sunR * 2);

    // Synthwave horizontal dark slats cut through lower sun
    ctx.fillStyle = '#0a0e1a';
    const slatBaseY = sunY + 8;
    const slatCount = 7;
    for (let i = 0; i < slatCount; i++) {
      const sy = slatBaseY + i * 16;
      const sh = 2.5 + i * 1.8;
      ctx.fillRect(cx - sunR, sy, sunR * 2, sh);
    }
    ctx.restore();

    // 2. Flanking Palm Tree Silhouettes
    drawSilhouettePalm(ctx, cx - 180, cy + 120, 0.95, false);
    drawSilhouettePalm(ctx, cx + 185, cy + 120, 0.95, true);

    // 3. "SUNBURN" Slanted 3D Chrome Text
    ctx.save();
    ctx.translate(cx, cy + 10);
    ctx.transform(1, 0, -0.22, 1, 0, 0); // Bold italic shear

    ctx.font = '900 86px "Arial Black", "Impact", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Deep neon glow drop shadow
    ctx.shadowColor = '#ff007f';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = '#12041d';
    ctx.fillText('SUNBURN', 0, 8);
    ctx.shadowColor = 'transparent';

    // Hot magenta outer outline
    ctx.strokeStyle = '#ff007f';
    ctx.lineWidth = 12;
    ctx.lineJoin = 'miter';
    ctx.miterLimit = 2;
    ctx.strokeText('SUNBURN', 0, 0);

    // Cyan accent outline
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 6;
    ctx.strokeText('SUNBURN', 0, 0);

    // Chrome Gradient Fill
    const chromeGrad = ctx.createLinearGradient(0, -45, 0, 45);
    chromeGrad.addColorStop(0.0, '#ffffff'); // White top sheen
    chromeGrad.addColorStop(0.35, '#cce4f7'); // Sky blue
    chromeGrad.addColorStop(0.48, '#6997c4'); // Slate blue
    chromeGrad.addColorStop(0.50, '#102542'); // Horizon line split
    chromeGrad.addColorStop(0.52, '#f6c344'); // Golden sunset reflection
    chromeGrad.addColorStop(0.78, '#c85a17'); // Copper
    chromeGrad.addColorStop(1.0, '#421600'); // Deep amber base
    ctx.fillStyle = chromeGrad;
    ctx.fillText('SUNBURN', 0, 0);

    // Inner bright white highlight stroke
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.strokeText('SUNBURN', 0, 0);

    ctx.restore();

    // 4. "C I T Y" Neon Script / Glowing Letter-Spaced Caps
    ctx.save();
    ctx.translate(cx, cy + 72);
    ctx.font = '900 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Glowing cyan neon
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 4;
    ctx.strokeText('C   I   T   Y', 0, 0);
    ctx.fillText('C   I   T   Y', 0, 0);
    ctx.restore();

    ctx.restore();
  }

  return {
    drawWordmark,

    drawPlaying(ctx, player, world, minimap, timeStr = '18:42', trafficCars = [], police = null, combat = null, time = 0) {
      ctx.save();

      // 1. TOP-LEFT: Health, Armour, Money
      const tlX = 30;
      const tlY = 28;
      const barW = 180;
      const barH = 15;

      // Drop shadow for status gauges
      ctx.fillStyle = 'rgba(10, 14, 20, 0.75)';
      ctx.beginPath();
      ctx.roundRect(tlX - 8, tlY - 8, barW + 16, 88, 6);
      ctx.fill();

      // HEALTH BAR
      ctx.font = 'bold 11px sans-serif';
      ctx.fillStyle = '#a0f0e2';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText('HEALTH', tlX, tlY + 12);
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round(player.health)}`, tlX + barW, tlY + 12);

      // Health bar track
      ctx.fillStyle = '#0f2220';
      ctx.beginPath();
      ctx.roundRect(tlX, tlY + 14, barW, barH, 3);
      ctx.fill();
      ctx.strokeStyle = '#1b3d39';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Health bar fill (Teal #20dfb8)
      const healthPct = Math.max(0, Math.min(1, player.health / player.maxHealth));
      if (healthPct > 0) {
        const hGrad = ctx.createLinearGradient(tlX, 0, tlX + barW, 0);
        hGrad.addColorStop(0, '#13b895');
        hGrad.addColorStop(1, '#20dfb8');
        ctx.fillStyle = hGrad;
        ctx.beginPath();
        ctx.roundRect(tlX, tlY + 14, barW * healthPct, barH, 3);
        ctx.fill();
        // Top highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.fillRect(tlX, tlY + 14, barW * healthPct, 2);
      }

      // ARMOUR BAR
      const armY = tlY + 36;
      ctx.font = 'bold 11px sans-serif';
      ctx.fillStyle = '#9bc5ff';
      ctx.textAlign = 'left';
      ctx.fillText('ARMOUR', tlX, armY + 12);
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round(player.armour)}`, tlX + barW, armY + 12);

      // Armour bar track
      ctx.fillStyle = '#101c2e';
      ctx.beginPath();
      ctx.roundRect(tlX, armY + 14, barW, barH, 3);
      ctx.fill();
      ctx.strokeStyle = '#1e3250';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Armour bar fill (Blue #3b82f6)
      const armourPct = Math.max(0, Math.min(1, player.armour / player.maxArmour));
      if (armourPct > 0) {
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        ctx.roundRect(tlX, armY + 14, barW * armourPct, barH, 3);
        ctx.fill();
      }

      // MONEY: Bold monospace $0
      const moneyY = armY + 38;
      ctx.font = '900 24px "Courier New", Courier, monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      // Black outline
      ctx.strokeStyle = '#050a08';
      ctx.lineWidth = 4;
      ctx.strokeText(`$${player.money}`, tlX, moneyY);
      // Bright neon mint/gold text
      ctx.fillStyle = '#78f0a0';
      ctx.fillText(`$${player.money}`, tlX, moneyY);

      // 2. TOP-RIGHT: Five Wanted Stars (filled gold with pulsing edge when active)
      const trX = 1280 - 32;
      const trY = 32;
      const starSpacing = 32;
      const wantedLevel = police ? police.wanted : 0;
      const pulse = 0.5 + 0.5 * Math.sin((time || 0) * 8);

      for (let i = 0; i < 5; i++) {
        const sx = trX - (4 - i) * starSpacing;
        const sy = trY;
        const starNum = i + 1;

        drawStar(ctx, sx, sy, 5, 13, 6);

        if (starNum <= wantedLevel) {
          // Active Wanted Star: Gold with pulsing edge
          const goldGrad = ctx.createLinearGradient(sx - 13, sy - 13, sx + 13, sy + 13);
          goldGrad.addColorStop(0, '#fff475');
          goldGrad.addColorStop(1, '#f4b41a');
          ctx.fillStyle = goldGrad;
          ctx.fill();

          ctx.shadowColor = '#ffd166';
          ctx.shadowBlur = 12 * pulse;
          ctx.strokeStyle = '#fff899';
          ctx.lineWidth = 2.0;
          ctx.stroke();
          ctx.shadowColor = 'transparent';
        } else {
          // Inactive / dim star: dark charcoal fill with subdued gold outline
          ctx.fillStyle = 'rgba(24, 26, 32, 0.85)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(160, 140, 95, 0.4)';
          ctx.lineWidth = 1.8;
          ctx.stroke();
        }
      }

      // 3. TOP-CENTRE: Mission Banner slot stays available

      // 4. BOTTOM-CENTRE: Compact Weapon Panel with Ammo & Reload Indicator
      const bcX = 640;
      const bcY = 678;

      ctx.save();
      // Weapon badge backing pill
      ctx.fillStyle = 'rgba(12, 16, 24, 0.88)';
      ctx.beginPath();
      ctx.roundRect(bcX - 110, bcY - 18, 220, 36, 18);
      ctx.fill();
      ctx.strokeStyle = 'rgba(32, 223, 184, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Weapon Name
      ctx.font = 'bold 14px "Arial Black", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`${player.weapon || 'FISTS'}`, bcX - 32, bcY);

      // Divider dot
      ctx.fillStyle = '#20dfb8';
      ctx.beginPath();
      ctx.arc(bcX + 22, bcY, 3, 0, Math.PI * 2);
      ctx.fill();

      // Ammo indicator / Reloading status
      if (combat && combat.isReloading) {
        const blink = Math.sin((time || 0) * 12) > 0;
        ctx.font = 'bold 12px monospace';
        ctx.fillStyle = blink ? '#ffbe0b' : '#ff5a1f';
        ctx.fillText('RELOAD...', bcX + 62, bcY);
      } else {
        ctx.font = 'bold 14px "Courier New", monospace';
        ctx.fillStyle = '#20dfb8';
        ctx.fillText(`${player.ammo || '∞'}`, bcX + 62, bcY);
      }
      ctx.restore();

      // 5. VEHICLE HUD: Speedometer & Car Name (Shown while driving)
      if (player.inCar) {
        const vX = 1280 - 32;
        const vY = 720 - 116;
        const mph = Math.round(player.inCar.speed * 0.35);

        ctx.save();
        ctx.textAlign = 'right';

        // Vehicle Pod Backing
        ctx.fillStyle = 'rgba(12, 16, 24, 0.88)';
        ctx.beginPath();
        ctx.roundRect(vX - 210, vY - 44, 218, 52, 6);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Car Name
        ctx.font = '900 15px "Arial Black", sans-serif';
        ctx.fillStyle = '#00f0ff';
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 8;
        ctx.fillText(player.inCar.name, vX - 12, vY - 24);
        ctx.shadowColor = 'transparent';

        // Speed Readout
        ctx.font = '900 20px "Courier New", monospace';
        ctx.fillStyle = '#f8f9fa';
        ctx.fillText(`${mph} MPH`, vX - 12, vY - 4);

        // Subtle Speed Gauge Bar
        const maxMph = 140;
        const speedPct = Math.min(1, mph / maxMph);
        ctx.fillStyle = '#1e2838';
        ctx.fillRect(vX - 200, vY + 2, 192, 3);
        const gaugeGrad = ctx.createLinearGradient(vX - 200, 0, vX - 8, 0);
        gaugeGrad.addColorStop(0, '#00f0ff');
        gaugeGrad.addColorStop(0.7, '#ffbe0b');
        gaugeGrad.addColorStop(1, '#ff0055');
        ctx.fillStyle = gaugeGrad;
        ctx.fillRect(vX - 200, vY + 2, 192 * speedPct, 3);

        ctx.restore();
      }

      // 6. BOTTOM-RIGHT: Clock and SUNBURN FM 98.3
      const brX = 1280 - 32;
      const brY = 720 - 32;

      ctx.save();
      ctx.textAlign = 'right';

      // Digital Clock
      ctx.font = '900 28px "Arial Black", sans-serif';
      ctx.textBaseline = 'bottom';
      ctx.strokeStyle = '#050810';
      ctx.lineWidth = 4;
      ctx.strokeText(timeStr, brX, brY - 20);
      ctx.fillStyle = '#f8f9fa';
      ctx.fillText(timeStr, brX, brY - 20);

      // Radio Station: SUNBURN FM 98.3
      ctx.font = 'bold 16px sans-serif';
      ctx.textBaseline = 'bottom';
      ctx.strokeStyle = '#12040d';
      ctx.lineWidth = 3;
      ctx.strokeText('SUNBURN FM 98.3', brX, brY);
      ctx.fillStyle = '#ff6f61'; // Coral
      ctx.fillText('SUNBURN FM 98.3', brX, brY);

      ctx.restore();

      // 7. BOTTOM-LEFT: Clean Circular Minimap (210 px) with Police Blips & Vision Cone
      minimap.draw(ctx, 130, 590, trafficCars, police);

      // 8. Red Damage Vignette Flash when hit
      if (player.damageVignette > 0) {
        ctx.save();
        const vGrad = ctx.createRadialGradient(640, 360, 240, 640, 360, 720);
        vGrad.addColorStop(0, 'rgba(255, 0, 0, 0)');
        vGrad.addColorStop(0.65, `rgba(220, 20, 30, ${player.damageVignette * 0.35})`);
        vGrad.addColorStop(1, `rgba(200, 10, 20, ${player.damageVignette * 0.85})`);
        ctx.fillStyle = vGrad;
        ctx.fillRect(0, 0, 1280, 720);
        ctx.restore();
      }

      // 9. Full-Screen BUSTED / WASTED Overlay Banner
      if (police && police.overlayType) {
        ctx.save();
        ctx.fillStyle = 'rgba(8, 12, 20, 0.78)';
        ctx.fillRect(0, 0, 1280, 720);

        const isBusted = police.overlayType === 'BUSTED';
        const title = isBusted ? 'BUSTED' : 'WASTED';
        const mainColor = isBusted ? '#00f0ff' : '#e63946';

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '900 84px "Arial Black", sans-serif';

        ctx.shadowColor = mainColor;
        ctx.shadowBlur = 32;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = mainColor;
        ctx.lineWidth = 6;
        ctx.strokeText(title, 640, 320);
        ctx.fillText(title, 640, 320);

        ctx.font = 'bold 22px monospace';
        ctx.shadowBlur = 10;
        ctx.fillStyle = isBusted ? '#ffd166' : '#f8f9fa';
        ctx.fillText(police.overlayMessage || (isBusted ? 'FINE PAID - $100' : 'HOSPITAL ADMISSION - $100'), 640, 410);

        ctx.restore();
      }

      ctx.restore();
    },

    drawTitle(ctx, time = 0) {
      ctx.save();

      // Warm dusk horizon gradient over the city
      const duskGrad = ctx.createLinearGradient(0, 0, 0, 720);
      duskGrad.addColorStop(0, 'rgba(42, 14, 56, 0.85)');
      duskGrad.addColorStop(0.45, 'rgba(142, 40, 80, 0.7)');
      duskGrad.addColorStop(0.75, 'rgba(255, 110, 80, 0.6)');
      duskGrad.addColorStop(1, 'rgba(25, 12, 38, 0.88)');
      ctx.fillStyle = duskGrad;
      ctx.fillRect(0, 0, 1280, 720);

      // Draw the iconic SUNBURN CITY wordmark
      drawWordmark(ctx, 640, 240, time);

      // Pulsing "PRESS ENTER TO START" prompt
      const pulse = 0.65 + 0.35 * Math.sin(time * 4);
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '900 26px "Arial Black", sans-serif';

      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = 16 * pulse;
      ctx.fillStyle = `rgba(255, 255, 255, ${pulse})`;
      ctx.fillText('PRESS ENTER TO START', 640, 520);
      ctx.restore();

      // Controls banner line at bottom
      ctx.save();
      ctx.fillStyle = 'rgba(8, 12, 20, 0.85)';
      ctx.fillRect(0, 672, 1280, 48);
      ctx.strokeStyle = 'rgba(255, 111, 97, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, 672);
      ctx.lineTo(1280, 672);
      ctx.stroke();

      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#cec7ba';
      ctx.fillText('[WASD / ARROWS] Move   •   [SHIFT] Sprint   •   [E] Interact   •   [P] Pause   •   [ESC] Title', 640, 696);
      ctx.restore();

      ctx.restore();
    },

    drawPaused(ctx) {
      ctx.save();
      // Semi-transparent dark overlay
      ctx.fillStyle = 'rgba(10, 14, 24, 0.75)';
      ctx.fillRect(0, 0, 1280, 720);

      // Pause box
      ctx.fillStyle = '#161c28';
      ctx.beginPath();
      ctx.roundRect(440, 260, 400, 200, 12);
      ctx.fill();
      ctx.strokeStyle = '#20dfb8';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // "PAUSED" text
      ctx.font = '900 48px "Arial Black", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#20dfb8';
      ctx.shadowBlur = 12;
      ctx.fillText('PAUSED', 640, 330);
      ctx.shadowColor = 'transparent';

      // Instructions
      ctx.font = 'bold 15px monospace';
      ctx.fillStyle = '#9bc5ff';
      ctx.fillText('[P] RESUME   •   [ESC] QUIT TO TITLE', 640, 400);

      ctx.restore();
    },
  };
}
