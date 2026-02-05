import { BRACE_SHAPES, GAME_CONFIG, GRID_SIZE, MODULE_ORDER, TRAY_SIZE } from './config.js';
import { normalizeSeed, randomInt } from './random.js';

function makeCell() {
  return {
    module: null,
    moduleMeta: null,
    hazard: null,
    shielded: false,
  };
}

export function cloneState(state) {
  return {
    ...state,
    grid: state.grid.map((row) => row.map((cell) => ({ ...cell }))),
    tray: state.tray.map((entry) => ({ ...entry })),
    log: [...state.log],
    config: { ...state.config },
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
