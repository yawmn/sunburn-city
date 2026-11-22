// SUNBURN CITY - Story Mission System
// Drives 4 story missions with briefings, ordered objectives, rewards, HUD objective panels,
// in-world pulsing waypoint markers, screen-edge guidance arrows, and completion banners.

export function createMissions(world = null, player = null, police = null) {
  let missionIndex = 0;
  let objectiveIndex = 0;
  let state = 'inactive'; // 'inactive', 'active', 'complete', 'all_completed'
  let bannerTimer = 0;
  let surviveTimer = 0;
  let targetHits = 0;
  let lastDeadPedsCount = 0;

  // Track initial dead peds count safely
  function getDeadPedsCount() {
    try {
      const g = window.__game;
      const peds = g?.pedestrians?.list;
      if (Array.isArray(peds)) {
        return peds.filter(p => p && (p.isDead || p.state === 'dead' || p.state === 'knocked_down')).length;
      }
    } catch {
      // ignore
    }
    return 0;
  }

  const MISSIONS = [
    {
      id: 'sunset_vice',
      name: 'SUNSET VICE',
      briefing: 'Welcome to Sunburn City. Meet your contact at Ocean Pier and acquire a Cheetah.',
      reward: 500,
      objectives: [
        {
          id: 'meet_contact',
          text: 'Go to Ocean Pier waypoint',
          type: 'waypoint',
          x: 3560,
          y: 1600,
          radius: 55,
          check(m, p) {
            if (!p) return false;
            const dist = Math.hypot((p.x || 0) - this.x, (p.y || 0) - this.y);
            return dist <= this.radius;
          },
          getProgress(m, p) {
            if (!p) return 'IN TRANSIT';
            const dist = Math.round(Math.hypot((p.x || 0) - this.x, (p.y || 0) - this.y));
            return `${dist}m AWAY`;
          },
        },
        {
          id: 'steal_cheetah',
          text: 'Steal a CHEETAH sports car',
          type: 'action',
          x: null,
          y: null,
          check(m, p) {
            if (!p) return false;
            return !!(p.inCar && (p.inCar.name === 'CHEETAH' || p.inCar.type === 'sports'));
          },
          getProgress(m, p) {
            if (p?.inCar) {
              return (p.inCar.name === 'CHEETAH' || p.inCar.type === 'sports') ? 'VEHICLE SECURED' : 'WRONG CAR';
            }
            return 'FIND CHEETAH';
          },
        },
        {
          id: 'hit_speed',
          text: 'Reach 60 MPH on Boulevard',
          type: 'action',
          x: null,
          y: null,
          check(m, p) {
            if (!p?.inCar) return false;
            const mph = (p.inCar.speed || 0) * 0.35;
            return mph >= 60;
          },
          getProgress(m, p) {
            const mph = Math.round((p?.inCar?.speed || 0) * 0.35);
            return `${mph} / 60 MPH`;
          },
        },
      ],
    },
    {
      id: 'heat_on_ocean_drive',
      name: 'HEAT ON OCEAN DRIVE',
      briefing: 'Draw VCPD attention to the boulevard and survive the pursuit.',
      reward: 1000,
      objectives: [
        {
          id: 'drive_junction',
          text: 'Drive to Washington & 5th Ave',
          type: 'waypoint',
          x: 2520,
          y: 1420,
          radius: 65,
          check(m, p) {
            if (!p) return false;
            return Math.hypot((p.x || 0) - this.x, (p.y || 0) - this.y) <= this.radius;
          },
          getProgress(m, p) {
            if (!p) return 'IN TRANSIT';
            return `${Math.round(Math.hypot((p.x || 0) - this.x, (p.y || 0) - this.y))}m AWAY`;
          },
        },
        {
          id: 'gain_wanted',
          text: 'Attract police (Wanted 2+ Stars)',
          type: 'action',
          x: null,
          y: null,
          check(m, p, pol) {
            return (pol?.wanted || 0) >= 2;
          },
          getProgress(m, p, pol) {
            return `WANTED: ${pol?.wanted || 0}/2 STARS`;
          },
        },
        {
          id: 'survive_wanted',
          text: 'Survive pursuit for 10 seconds',
          type: 'action',
          x: null,
          y: null,
          check(m) {
            return m.surviveTimer >= 10.0;
          },
          getProgress(m) {
            const left = Math.max(0, Math.ceil(10.0 - m.surviveTimer));
            return `${left}s REMAINING`;
          },
        },
      ],
    },
    {
      id: 'syndicate_takedown',
      name: 'SYNDICATE TAKEDOWN',
      briefing: 'Rival syndicate runners are operating Downtown. Neutralize 3 targets.',
      reward: 1500,
      objectives: [
        {
          id: 'reach_downtown',
          text: 'Infiltrate Downtown Alley',
          type: 'waypoint',
          x: 1560,
          y: 1860,
          radius: 65,
          check(m, p) {
            if (!p) return false;
            return Math.hypot((p.x || 0) - this.x, (p.y || 0) - this.y) <= this.radius;
          },
          getProgress(m, p) {
            if (!p) return 'IN TRANSIT';
            return `${Math.round(Math.hypot((p.x || 0) - this.x, (p.y || 0) - this.y))}m AWAY`;
          },
        },
        {
          id: 'neutralize_targets',
          text: 'Neutralize 3 syndicate targets',
          type: 'action',
          x: null,
          y: null,
          check(m) {
            return m.targetHits >= 3;
          },
          getProgress(m) {
            return `${Math.min(3, m.targetHits)} / 3 TARGETS`;
          },
        },
        {
          id: 'escape_marina',
          text: 'Rendezvous at Marina Safehouse',
          type: 'waypoint',
          x: 3120,
          y: 320,
          radius: 65,
          check(m, p) {
            if (!p) return false;
            return Math.hypot((p.x || 0) - this.x, (p.y || 0) - this.y) <= this.radius;
          },
          getProgress(m, p) {
            if (!p) return 'IN TRANSIT';
            return `${Math.round(Math.hypot((p.x || 0) - this.x, (p.y || 0) - this.y))}m AWAY`;
          },
        },
      ],
    },
    {
      id: 'sunburn_escape',
      name: 'SUNBURN ESCAPE',
      briefing: 'The heat is on. Floor it to top speed and reach the South Beach docks.',
      reward: 2500,
      objectives: [
        {
          id: 'reach_top_speed',
          text: 'Push vehicle to 80 MPH',
          type: 'action',
          x: null,
          y: null,
          check(m, p) {
            if (!p?.inCar) return false;
            return ((p.inCar.speed || 0) * 0.35) >= 80;
          },
          getProgress(m, p) {
            const mph = Math.round((p?.inCar?.speed || 0) * 0.35);
            return `${mph} / 80 MPH`;
          },
        },
        {
          id: 'reach_docks',
          text: 'Escape to South Beach docks',
          type: 'waypoint',
          x: 3560,
          y: 2740,
          radius: 70,
          check(m, p) {
            if (!p) return false;
            return Math.hypot((p.x || 0) - this.x, (p.y || 0) - this.y) <= this.radius;
          },
          getProgress(m, p) {
            if (!p) return 'IN TRANSIT';
            return `${Math.round(Math.hypot((p.x || 0) - this.x, (p.y || 0) - this.y))}m AWAY`;
          },
        },
      ],
    },
  ];

  function start(index = 0) {
    missionIndex = Math.max(0, Math.min(MISSIONS.length - 1, index));
    objectiveIndex = 0;
    state = 'active';
    bannerTimer = 0;
    surviveTimer = 0;
    targetHits = 0;
    lastDeadPedsCount = getDeadPedsCount();
  }

  function advanceMission() {
    missionIndex++;
    if (missionIndex >= MISSIONS.length) {
      state = 'all_completed';
      missionIndex = MISSIONS.length - 1;
    } else {
      objectiveIndex = 0;
      state = 'active';
      surviveTimer = 0;
      targetHits = 0;
      lastDeadPedsCount = getDeadPedsCount();
    }
  }

  const missionsSystem = {
    get missionIndex() {
      return missionIndex;
    },
    get objectiveIndex() {
      return objectiveIndex;
    },
    get state() {
      return state;
    },
    set state(val) {
      state = val;
    },
    get currentMission() {
      return MISSIONS[missionIndex] || null;
    },
    get name() {
      return this.currentMission ? this.currentMission.name : '';
    },
    get missionName() {
      return this.name;
    },
    get briefing() {
      return this.currentMission ? this.currentMission.briefing : '';
    },
    get reward() {
      return this.currentMission ? this.currentMission.reward : 0;
    },
    get currentObjective() {
      const m = this.currentMission;
      if (!m || !m.objectives) return null;
      return m.objectives[objectiveIndex] || null;
    },
    get objectiveText() {
      return this.currentObjective ? this.currentObjective.text : '';
    },
    get currentObjectiveText() {
      return this.objectiveText;
    },
    get waypoint() {
      const obj = this.currentObjective;
      if (obj && obj.type === 'waypoint' && obj.x != null && obj.y != null) {
        return { x: obj.x, y: obj.y, radius: obj.radius || 60 };
      }
      return null;
    },
    get waypointX() {
      return this.waypoint ? this.waypoint.x : null;
    },
    get waypointY() {
      return this.waypoint ? this.waypoint.y : null;
    },
    get progress() {
      const obj = this.currentObjective;
      if (!obj) return '';
      try {
        const p = player || window.__game?.player;
        const pol = police || window.__game?.police;
        if (typeof obj.getProgress === 'function') {
          return obj.getProgress(this, p, pol);
        }
      } catch {
        // Safe fallback
      }
      return 'IN PROGRESS';
    },
    get bannerTimer() {
      return bannerTimer;
    },
    get bannerVisible() {
      return bannerTimer > 0;
    },
    get bannerText() {
      return 'MISSION COMPLETE';
    },
    get bannerSubtext() {
      const m = this.currentMission;
      return m ? `${m.name} • +$${m.reward}` : '+$500';
    },
    get surviveTimer() {
      return surviveTimer;
    },
    get targetHits() {
      return targetHits;
    },

    start,

    update(dt) {
      try {
        const p = player || window.__game?.player;
        const pol = police || window.__game?.police;

        // Completion Banner timing
        if (bannerTimer > 0) {
          bannerTimer -= dt;
          if (bannerTimer <= 0) {
            bannerTimer = 0;
            advanceMission();
          }
          return;
        }

        if (state !== 'active') return;

        const m = this.currentMission;
        if (!m || !m.objectives) return;

        const obj = m.objectives[objectiveIndex];
        if (!obj) return;

        // Track syndicate takedown target hits safely
        if (obj.id === 'neutralize_targets') {
          const currentDead = getDeadPedsCount();
          if (currentDead > lastDeadPedsCount) {
            targetHits += (currentDead - lastDeadPedsCount);
            lastDeadPedsCount = currentDead;
          }
        }

        // Track survive timer safely
        if (obj.id === 'survive_wanted') {
          if (!p?.isWasted && !p?.isBusted) {
            surviveTimer += dt;
          }
        }

        // Check if current objective condition is satisfied
        let isDone = false;
        try {
          if (typeof obj.check === 'function') {
            isDone = obj.check(this, p, pol);
          }
        } catch {
          isDone = false;
        }

        if (isDone) {
          objectiveIndex++;
          surviveTimer = 0;
          lastDeadPedsCount = getDeadPedsCount();

          // Check if all objectives in current mission are complete
          if (objectiveIndex >= m.objectives.length) {
            // Pay reward into player money
            if (p) {
              p.money = (p.money || 0) + m.reward;
            }
            state = 'complete';
            bannerTimer = 3.0; // 3 seconds completion banner
          }
        }
      } catch {
        // Never throw
      }
    },

    // Draw world marker: pulsing ring in the world
    drawWorld(ctx, camera, time = 0) {
      try {
        const wp = this.waypoint;
        if (!wp || wp.x == null || wp.y == null) return;

        ctx.save();
        const pulse = 0.5 + 0.5 * Math.sin(time * 5);
        const ringR = wp.radius * (0.8 + 0.25 * Math.sin(time * 4));

        // 1. Soft ground glow
        const glowGrad = ctx.createRadialGradient(wp.x, wp.y, 4, wp.x, wp.y, wp.radius * 1.5);
        glowGrad.addColorStop(0, 'rgba(255, 209, 102, 0.45)');
        glowGrad.addColorStop(0.6, 'rgba(0, 240, 255, 0.2)');
        glowGrad.addColorStop(1, 'rgba(0, 240, 255, 0)');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(wp.x, wp.y, wp.radius * 1.5, 0, Math.PI * 2);
        ctx.fill();

        // 2. Outer pulsing neon ring
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 3.5;
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 12 * pulse;
        ctx.beginPath();
        ctx.arc(wp.x, wp.y, ringR, 0, Math.PI * 2);
        ctx.stroke();

        // 3. Inner pulsing gold ring
        ctx.strokeStyle = '#ffd166';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#ffd166';
        ctx.beginPath();
        ctx.arc(wp.x, wp.y, wp.radius * 0.45, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowColor = 'transparent';

        // 4. Center pulsing core disc
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(wp.x, wp.y, 7 + 2 * pulse, 0, Math.PI * 2);
        ctx.fill();

        // 5. Floating vertical marker diamond bobbing above waypoint
        const bobY = wp.y - 45 + Math.sin(time * 4) * 8;
        ctx.save();
        ctx.translate(wp.x, bobY);
        ctx.fillStyle = '#ffd166';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -14);
        ctx.lineTo(10, 0);
        ctx.lineTo(0, 14);
        ctx.lineTo(-10, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Small downward point arrow below diamond
        ctx.fillStyle = '#00f0ff';
        ctx.beginPath();
        ctx.moveTo(0, 24);
        ctx.lineTo(5, 15);
        ctx.lineTo(-5, 15);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        ctx.restore();
      } catch {
        // Never throw
      }
    },

    // Draw screen edge guidance arrow
    drawScreen(ctx, camera, time = 0) {
      try {
        const wp = this.waypoint;
        if (!wp || wp.x == null || wp.y == null || !camera) return;

        const camW = 1280;
        const camH = 720;
        const zoom = camera.zoom || 1.0;
        const screenX = (wp.x - camera.x) * zoom + camW / 2;
        const screenY = (wp.y - camera.y) * zoom + camH / 2;

        const margin = 55;
        const minX = margin;
        const maxX = camW - margin;
        const minY = margin + 25;
        const maxY = camH - margin;

        const isOffscreen = (screenX < minX || screenX > maxX || screenY < minY || screenY > maxY);

        if (isOffscreen) {
          const centerX = camW / 2;
          const centerY = camH / 2;
          const dx = screenX - centerX;
          const dy = screenY - centerY;
          const angle = Math.atan2(dy, dx);

          const halfW = (maxX - minX) / 2;
          const halfH = (maxY - minY) / 2;
          const midX = (minX + maxX) / 2;
          const midY = (minY + maxY) / 2;

          const absCos = Math.abs(Math.cos(angle));
          const absSin = Math.abs(Math.sin(angle));
          let t = Infinity;
          if (absCos > 0.0001) t = Math.min(t, halfW / absCos);
          if (absSin > 0.0001) t = Math.min(t, halfH / absSin);

          const edgeX = midX + Math.cos(angle) * t;
          const edgeY = midY + Math.sin(angle) * t;

          ctx.save();
          ctx.translate(edgeX, edgeY);
          ctx.rotate(angle);

          const pulse = 0.7 + 0.3 * Math.sin(time * 6);

          // Arrow backing drop shadow
          ctx.shadowColor = '#ffd166';
          ctx.shadowBlur = 12 * pulse;

          // Arrow Chevron
          ctx.fillStyle = '#ffd166';
          ctx.strokeStyle = '#12161f';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(18, 0);
          ctx.lineTo(-10, -14);
          ctx.lineTo(-4, 0);
          ctx.lineTo(-10, 14);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Inner bright cyan chevron core
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.moveTo(12, 0);
          ctx.lineTo(-4, -7);
          ctx.lineTo(0, 0);
          ctx.lineTo(-4, 7);
          ctx.closePath();
          ctx.fill();

          ctx.restore();

          // Distance label beside the screen-edge arrow
          const p = player || window.__game?.player;
          if (p) {
            const distM = Math.round(Math.hypot(wp.x - p.x, wp.y - p.y) / 10);
            ctx.save();
            ctx.font = '900 11px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const labelX = Math.max(40, Math.min(camW - 40, edgeX - Math.cos(angle) * 28));
            const labelY = Math.max(25, Math.min(camH - 25, edgeY - Math.sin(angle) * 28));

            ctx.fillStyle = 'rgba(10, 14, 20, 0.85)';
            ctx.beginPath();
            ctx.roundRect(labelX - 22, labelY - 9, 44, 18, 4);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 209, 102, 0.6)';
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.fillStyle = '#ffd166';
            ctx.fillText(`${distM}m`, labelX, labelY);
            ctx.restore();
          }
        }
      } catch {
        // Never throw
      }
    },
  };

  return missionsSystem;
}
