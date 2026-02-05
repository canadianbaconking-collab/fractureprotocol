import { GAME_CONFIG, GRID_SIZE } from './config.js';

function makeCell() {
  return {
    module: null,
    hazard: null,
    shielded: false,
    brace: 0,
  };
}

export function createInitialState(overrides = {}) {
  const config = { ...GAME_CONFIG, ...(overrides.config ?? {}) };
  const grid = Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, makeCell),
  );

  return {
    turn: 0,
    integrity: config.startingIntegrity,
    pressure: config.startingPressure,
    containmentState: 'NORMAL',
    phase: 'PLAYING',
    selectedModule: null,
    grid,
    log: [],
    config,
  };
}

export function cloneState(state) {
  return {
    ...state,
    grid: state.grid.map((row) => row.map((cell) => ({ ...cell }))),
    log: [...state.log],
    config: { ...state.config },
  };
}
