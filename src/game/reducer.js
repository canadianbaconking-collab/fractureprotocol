import { CORE_STATE_THRESHOLDS, GRID_SIZE, MODULE_DEFS } from './config.js';
import { cloneState } from './state.js';

const CARDINAL_STEPS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function inBounds(x, y) {
  return x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE;
}

function getCellsForPlacement(moduleDef, originX, originY) {
  return moduleDef.shape.map(([dx, dy]) => ({ x: originX + dx, y: originY + dy }));
}

function canPlaceModule(grid, moduleDef, originX, originY) {
  return getCellsForPlacement(moduleDef, originX, originY).every(({ x, y }) => {
    if (!inBounds(x, y)) return false;
    return grid[y][x].module === null;
  });
}

function applyModuleEffect(state, moduleDef, cells) {
  switch (moduleDef.effect) {
    case 'brace': {
      for (const { x, y } of cells) {
        state.grid[y][x].brace += 1;
      }
      state.pressure = Math.max(0, state.pressure - 1);
      break;
    }
    case 'shieldCore': {
      const center = { x: 3, y: 3 };
      for (let y = center.y - 1; y <= center.y + 1; y += 1) {
        for (let x = center.x - 1; x <= center.x + 1; x += 1) {
          if (inBounds(x, y)) {
            state.grid[y][x].shielded = true;
          }
        }
      }
      break;
    }
    case 'purge': {
      for (const { x, y } of cells) {
        if (state.grid[y][x].hazard === 'CORRUPTION') {
          state.grid[y][x].hazard = null;
        }
      }
      break;
    }
    case 'pump': {
      state.pressure = Math.max(0, state.pressure - 10);
      break;
    }
    case 'cycler': {
      for (const { x, y } of cells) {
        for (const [sx, sy] of CARDINAL_STEPS) {
          const tx = x + sx;
          const ty = y + sy;
          if (inBounds(tx, ty) && state.grid[ty][tx].hazard === 'LEAK') {
            state.grid[ty][tx].hazard = null;
          }
        }
      }
      break;
    }
    default:
      break;
  }
}

function spreadCorruption(state, rng) {
  const additions = [];
  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      if (state.grid[y][x].hazard !== 'CORRUPTION') continue;
      for (const [sx, sy] of CARDINAL_STEPS) {
        const nx = x + sx;
        const ny = y + sy;
        if (!inBounds(nx, ny)) continue;
        const target = state.grid[ny][nx];
        if (target.hazard || target.shielded) continue;
        if (rng() < state.config.corruptionSpreadChance) {
          additions.push([nx, ny]);
        }
      }
    }
  }
  for (const [x, y] of additions) {
    state.grid[y][x].hazard = 'CORRUPTION';
  }
}

function spawnRandomHazards(state, rng) {
  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      const cell = state.grid[y][x];
      if (cell.hazard || cell.shielded) continue;
      const roll = rng();
      if (roll < state.config.leakSpawnChance) {
        cell.hazard = 'LEAK';
      } else if (roll < state.config.leakSpawnChance + state.config.corruptionSpawnChance) {
        cell.hazard = 'CORRUPTION';
      }
    }
  }
}

function applyHazardDamage(state) {
  let leakCount = 0;
  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      const cell = state.grid[y][x];
      if (cell.hazard === 'LEAK') {
        leakCount += 1;
      }
      if (cell.hazard === 'CORRUPTION' && cell.brace > 0) {
        cell.hazard = null;
        cell.brace -= 1;
      }
    }
  }
  state.integrity -= leakCount * state.config.leakDamagePerSource;
}

function deriveContainmentState(pressure, integrity) {
  if (pressure >= 100 || integrity <= 0) return 'BREACH';
  if (pressure <= CORE_STATE_THRESHOLDS.NORMAL.maxPressure && integrity >= CORE_STATE_THRESHOLDS.NORMAL.minIntegrity) {
    return 'NORMAL';
  }
  if (pressure <= CORE_STATE_THRESHOLDS.WARNING.maxPressure && integrity >= CORE_STATE_THRESHOLDS.WARNING.minIntegrity) {
    return 'WARNING';
  }
  return 'CRITICAL';
}

function hasLegalMove(state) {
  for (const moduleId of Object.keys(MODULE_DEFS)) {
    const def = MODULE_DEFS[moduleId];
    for (let y = 0; y < GRID_SIZE; y += 1) {
      for (let x = 0; x < GRID_SIZE; x += 1) {
        if (canPlaceModule(state.grid, def, x, y)) return true;
      }
    }
  }
  return false;
}

function finalizeTurn(state) {
  state.turn += 1;
  state.pressure = Math.min(100, state.pressure + state.config.pressurePerTurn);
  state.containmentState = deriveContainmentState(state.pressure, state.integrity);

  if (state.integrity <= 0 || state.pressure >= 100) {
    state.phase = 'LOST';
  } else if (state.turn >= state.config.winTurns) {
    state.phase = 'WON';
  } else if (!hasLegalMove(state)) {
    state.phase = 'LOST';
  }
}

export function reduce(state, action, rng = Math.random) {
  if (state.phase !== 'PLAYING') return state;

  if (action.type !== 'PLACE_MODULE') {
    return state;
  }

  const moduleDef = MODULE_DEFS[action.moduleId];
  if (!moduleDef) return state;

  if (!canPlaceModule(state.grid, moduleDef, action.x, action.y)) {
    return state;
  }

  const next = cloneState(state);
  const cells = getCellsForPlacement(moduleDef, action.x, action.y);
  for (const { x, y } of cells) {
    next.grid[y][x].module = moduleDef.id;
  }

  applyModuleEffect(next, moduleDef, cells);
  spreadCorruption(next, rng);
  spawnRandomHazards(next, rng);
  applyHazardDamage(next);
  finalizeTurn(next);
  next.log.push(`Turn ${next.turn}: ${moduleDef.name} at (${action.x},${action.y})`);

  return next;
}

export function listValidPlacements(state, moduleId) {
  const moduleDef = MODULE_DEFS[moduleId];
  if (!moduleDef) return [];
  const placements = [];
  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      if (canPlaceModule(state.grid, moduleDef, x, y)) {
        placements.push({ x, y });
      }
    }
  }
  return placements;
}
