export const GRID_SIZE = 8;

export const GAME_CONFIG = {
  winTurns: 20,
  startingIntegrity: 100,
  startingPressure: 0,
  pressurePerTurn: 5,
  corruptionSpreadChance: 0.3,
  leakDamagePerSource: 2,
  leakSpawnChance: 0.25,
  corruptionSpawnChance: 0.4,
};

export const CORE_STATE_THRESHOLDS = {
  NORMAL: { maxPressure: 39, minIntegrity: 70 },
  WARNING: { maxPressure: 69, minIntegrity: 40 },
  CRITICAL: { maxPressure: 99, minIntegrity: 1 },
};

export const MODULE_DEFS = {
  BRACE: {
    id: 'BRACE',
    name: 'Brace',
    shape: [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ],
    effect: 'brace',
  },
  SHIELD_CORE: {
    id: 'SHIELD_CORE',
    name: 'Shield Core',
    shape: [[0, 0]],
    effect: 'shieldCore',
  },
  PURGE: {
    id: 'PURGE',
    name: 'Purge',
    shape: [
      [0, 0],
      [0, 1],
      [0, 2],
    ],
    effect: 'purge',
  },
  PUMP: {
    id: 'PUMP',
    name: 'Pump',
    shape: [[0, 0]],
    effect: 'pump',
  },
  CYCLER: {
    id: 'CYCLER',
    name: 'Cycler',
    shape: [
      [0, 0],
      [1, 0],
      [2, 0],
    ],
    effect: 'cycler',
  },
};

export const MODULE_ORDER = ['BRACE', 'SHIELD_CORE', 'PURGE', 'PUMP', 'CYCLER'];
