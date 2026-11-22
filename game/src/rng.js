// Deterministic pseudo-random number generator (mulberry32)
// Drives city layout and simulation randomness with seed reproducibility.

export function mulberry32(seed) {
  let a = (seed >>> 0) || 1;
  return function() {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(initialSeed = 1) {
  let generator = mulberry32(initialSeed);

  function rand() {
    return generator();
  }

  function range(min, max) {
    return min + rand() * (max - min);
  }

  function rangeInt(min, max) {
    return Math.floor(range(min, max + 1));
  }

  function pick(arr) {
    if (!arr || arr.length === 0) return null;
    return arr[Math.floor(rand() * arr.length)];
  }

  function chance(p) {
    return rand() < p;
  }

  function setSeed(s) {
    generator = mulberry32(s);
  }

  return {
    rand,
    range,
    rangeInt,
    pick,
    chance,
    setSeed,
  };
}

// Default global PRNG instance
const defaultRng = createRng(1);

export const rand = defaultRng.rand;
export const range = defaultRng.range;
export const rangeInt = defaultRng.rangeInt;
export const pick = defaultRng.pick;
export const chance = defaultRng.chance;
export const setSeed = defaultRng.setSeed;
