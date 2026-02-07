import {
  BRACE_SHAPES,
  CORRUPTION_TYPES,
  GAME_CONFIG,
  GRID_SIZE,
  MODULE_ORDER,
  RELIC_IDS,
  RESONANCE_TYPES,
  TRAY_SIZE
} from './config.js';
import { normalizeSeed, randomFloat01, randomInt } from './random.js';

function makeCell() {
  return {
    module: null,
    moduleMeta: null,
    hazard: null,
    hazardType: null,
    shielded: false,
    containmentWallTurns: 0,
    stabilityFieldTurns: 0,
    synergyLinkType: null,
    synergyLinkTurns: 0,
  };
}

function cloneResonanceMap(map) {
  return map.map((row) => row.map((entry) => ({ ...entry })));
}

function createResonanceMap(seed, config) {
  const map = Array.from({ length: GRID_SIZE }, () => Array.from({ length: GRID_SIZE }, () => ({ type: null, revealed: false })));
  let cursor = normalizeSeed(`${seed}-resonance`);
  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      const roll = randomFloat01(cursor);
      cursor = roll.state;
      if (roll.value < config.resonanceChance) {
        const pick = randomInt(cursor, RESONANCE_TYPES.length);
        cursor = pick.state;
        map[y][x] = { type: RESONANCE_TYPES[pick.value], revealed: false };
      }
    }
  }
  return map;
}

function createRelicState() {
  return RELIC_IDS.reduce((acc, id) => {
    acc[id] = false;
    return acc;
  }, {});
}

function createCorruptionTypeCounts() {
  return CORRUPTION_TYPES.reduce((acc, type) => {
    acc[type] = 0;
    return acc;
  }, {});
}

export function cloneState(state) {
  return {
    ...state,
    grid: state.grid.map((row) => row.map((cell) => ({ ...cell }))),
    tray: state.tray.map((entry) => ({ ...entry })),
    log: [...state.log],
    config: { ...state.config },
    resonanceMap: cloneResonanceMap(state.resonanceMap),
    relics: { ...state.relics },
    metrics: {
      ...state.metrics,
      corruptionTypeCounts: { ...state.metrics.corruptionTypeCounts },
    },
  };
}

export function drawTrayEntry(rngState) {
  let next = randomInt(rngState, MODULE_ORDER.length);
  const moduleId = MODULE_ORDER[next.value];
  const entry = { moduleId };
  if (moduleId === 'BRACE') {
    const shapeKeys = Object.keys(BRACE_SHAPES);
    next = randomInt(next.state, shapeKeys.length);
    entry.shapeKey = shapeKeys[next.value];
    return { rngState: next.state, entry };
  }
  return { rngState: next.state, entry };
}

function fillTray(rngState, size = TRAY_SIZE) {
  const tray = [];
  let cursor = rngState;
  for (let i = 0; i < size; i += 1) {
    const roll = drawTrayEntry(cursor);
    tray.push(roll.entry);
    cursor = roll.rngState;
  }
  return { tray, rngState: cursor };
}

export function createInitialState(overrides = {}) {
  const config = { ...GAME_CONFIG, ...(overrides.config ?? {}) };
  const grid = Array.from({ length: GRID_SIZE }, () => Array.from({ length: GRID_SIZE }, makeCell));
  const seed = normalizeSeed(overrides.seed ?? config.seed);
  const initialTray = fillTray(seed, TRAY_SIZE);
  const resonanceMap = createResonanceMap(seed, config);

  return {
    turn: 1,
    integrity: config.startingIntegrity,
    pressure: config.startingPressure,
    containmentState: 'NORMAL',
    phase: 'PLAYING',
    lossCause: null,
    selectedModuleIndex: 0,
    selectedModule: initialTray.tray[0],
    tray: initialTray.tray,
    rngState: initialTray.rngState,
    grid,
    log: [],
    config,
    resonanceMap,
    relics: createRelicState(),
    integrityRegenTurns: 0,
    metrics: {
      resonanceActivations: 0,
      corruptionTypeCounts: createCorruptionTypeCounts(),
    },
  };
}

export function withReselectedModule(state) {
  const idx = Math.min(state.selectedModuleIndex, Math.max(0, state.tray.length - 1));
  state.selectedModuleIndex = idx;
  state.selectedModule = state.tray[idx] ?? null;
  return state;
}

export function refillTray(state) {
  while (state.tray.length < TRAY_SIZE) {
    const roll = drawTrayEntry(state.rngState);
    state.rngState = roll.rngState;
    state.tray.push(roll.entry);
  }
}

export function rerollTray(state) {
  const rerolled = fillTray(state.rngState, TRAY_SIZE);
  state.rngState = rerolled.rngState;
  state.tray = rerolled.tray;
  withReselectedModule(state);
}
