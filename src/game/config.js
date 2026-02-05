export const GRID_SIZE = 8;
export const TRAY_SIZE = 3;

export const MODULE_ORDER = ['BRACE', 'SHIELD_CORE', 'PURGE', 'PUMP', 'CYCLER'];

export const BRACE_SHAPES = {
  BLOCK: {
    key: 'BLOCK',
    cells: [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ],
  },
  LINE3: {
    key: 'LINE3',
    cells: [
      [0, 0],
      [1, 0],
      [2, 0],
    ],
  },
  L3: {
    key: 'L3',
    cells: [
      [0, 0],
      [0, 1],
      [1, 1],
    ],
  },
};

export const MODULE_DEFS = {
  BRACE: { id: 'BRACE', name: 'Brace', effect: 'brace' },
  SHIELD_CORE: { id: 'SHIELD_CORE', name: 'Shield Core', effect: 'shieldCore' },
  PURGE: { id: 'PURGE', name: 'Purge Unit', effect: 'purge' },
  PUMP: { id: 'PUMP', name: 'Pump', effect: 'pump' },
  CYCLER: { id: 'CYCLER', name: 'Cycler', effect: 'cycler' },
};

export const GAME_CONFIG = {
  seed: 42,
  winTurns: 20,
  startingIntegrity: 100,
  startingPressure: 0,
  pressurePerTurn: 5,
  pumpPressureReduction: 8,
  corruptionSpreadChance: 0.35,
  leakSpawnChance: 0.08,
  corruptionSpawnChance: 0.1,
  leakDamagePerSource: 2,
  shieldLeakMitigation: 1,
  purgePattern: '3x3-centered',
};

export const CORE_STATE_THRESHOLDS = {
  NORMAL: { maxPressure: 39, minIntegrity: 70 },
  WARNING: { maxPressure: 69, minIntegrity: 40 },
  CRITICAL: { maxPressure: 99, minIntegrity: 1 },
};
