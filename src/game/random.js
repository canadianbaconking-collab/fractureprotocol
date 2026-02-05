export function normalizeSeed(seed) {
  if (typeof seed === 'number' && Number.isFinite(seed)) {
    return seed >>> 0;
  }
  let hash = 2166136261;
  const text = String(seed ?? 'fracture-seed');
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function nextRngState(state) {
  return (Math.imul(1664525, state >>> 0) + 1013904223) >>> 0;
}

export function randomFloat01(state) {
  const next = nextRngState(state);
  return { state: next, value: next / 0x100000000 };
}

export function randomInt(state, maxExclusive) {
  if (maxExclusive <= 0) return { state, value: 0 };
  const roll = randomFloat01(state);
  return { state: roll.state, value: Math.floor(roll.value * maxExclusive) };
}

export function createRng(seed) {
  let state = normalizeSeed(seed);
  return function rng() {
    state = nextRngState(state);
    return state / 0x100000000;
  };
}
