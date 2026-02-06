import { BRACE_SHAPES, CORE_STATE_THRESHOLDS, GRID_SIZE, MODULE_DEFS } from './config.js';
import { cloneState, refillTray, rerollTray, withReselectedModule } from './state.js';
import { randomFloat01, randomInt } from './random.js';

const CARDINAL = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function inBounds(x, y) {
  return x >= 0 && y >= 0 && x < GRID_SIZE && y < GRID_SIZE;
}

function shapeForEntry(entry) {
  if (!entry) return [];
  if (entry.moduleId === 'BRACE') {
    const key = entry.shapeKey ?? 'BLOCK';
    return BRACE_SHAPES[key]?.cells ?? BRACE_SHAPES.BLOCK.cells;
  }
  return [[0, 0]];
}

export function getPlacementCells(entry, originX, originY) {
  return shapeForEntry(entry).map(([dx, dy]) => ({ x: originX + dx, y: originY + dy }));
}

export function canPlaceEntry(grid, entry, x, y) {
  const cells = getPlacementCells(entry, x, y);
  return cells.every(({ x: cx, y: cy }) => inBounds(cx, cy) && grid[cy][cx].module === null);
}

function deriveContainmentState(pressure, integrity) {
  if (pressure >= 100 || integrity <= 0) return 'BREACH';
  if (pressure <= CORE_STATE_THRESHOLDS.NORMAL.maxPressure && integrity >= CORE_STATE_THRESHOLDS.NORMAL.minIntegrity) return 'NORMAL';
  if (pressure <= CORE_STATE_THRESHOLDS.WARNING.maxPressure && integrity >= CORE_STATE_THRESHOLDS.WARNING.minIntegrity) return 'WARNING';
  return 'CRITICAL';
}

function onboardingModifiers(turn) {
  if (turn <= 3) {
    return {
      corruptionSpawnMultiplier: 0,
      leakDamageMultiplier: 0.3,
      pressurePerTurnMultiplier: 0.5,
    };
  }
  if (turn <= 7) {
    return {
      corruptionSpawnMultiplier: 0.5,
      leakDamageMultiplier: 0.5,
      pressurePerTurnMultiplier: 1,
    };
  }
  if (turn <= 10) {
    return {
      corruptionSpawnMultiplier: 0.8,
      leakDamageMultiplier: 0.8,
      pressurePerTurnMultiplier: 1,
    };
  }
  return {
    corruptionSpawnMultiplier: 1,
    leakDamageMultiplier: 1,
    pressurePerTurnMultiplier: 1,
  };
}

function markShieldAdjacency(state, x, y) {
  for (const [dx, dy] of CARDINAL) {
    const nx = x + dx;
    const ny = y + dy;
    if (!inBounds(nx, ny)) continue;
    const neighbor = state.grid[ny][nx];
    if (neighbor.module !== null) {
      neighbor.shielded = true;
    }
  }
}

function resolveModuleEffects(state, entry, cells) {
  switch (entry.moduleId) {
    case 'SHIELD_CORE': {
      for (const { x, y } of cells) {
        state.grid[y][x].shielded = true;
        markShieldAdjacency(state, x, y);
      }
      break;
    }
    case 'PURGE': {
      // Purge rule: clear a 3x3 centered area around placement.
      for (const { x, y } of cells) {
        for (let py = y - 1; py <= y + 1; py += 1) {
          for (let px = x - 1; px <= x + 1; px += 1) {
            if (inBounds(px, py)) state.grid[py][px].hazard = null;
          }
        }
      }
      break;
    }
    case 'PUMP': {
      state.pressure = Math.max(0, state.pressure - state.config.pumpPressureReduction);
      break;
    }
    case 'CYCLER': {
      rerollTray(state);
      break;
    }
    case 'BRACE':
    default:
      break;
  }
}

function spreadCorruption(state) {
  const additions = [];
  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      if (state.grid[y][x].hazard !== 'CORRUPTION') continue;
      for (const [dx, dy] of CARDINAL) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inBounds(nx, ny)) continue;
        const target = state.grid[ny][nx];
        if (target.hazard || target.module || target.shielded) continue;
        const roll = randomFloat01(state.rngState);
        state.rngState = roll.state;
        if (roll.value < state.config.corruptionSpreadChance) additions.push([nx, ny]);
      }
    }
  }
  for (const [x, y] of additions) state.grid[y][x].hazard = 'CORRUPTION';
}

function spawnHazards(state) {
  const { corruptionSpawnMultiplier } = onboardingModifiers(state.turn);
  const corruptionSpawnChance = state.config.corruptionSpawnChance * corruptionSpawnMultiplier;
  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      const cell = state.grid[y][x];
      if (cell.hazard || cell.module || cell.shielded) continue;
      const roll = randomFloat01(state.rngState);
      state.rngState = roll.state;
      if (roll.value < state.config.leakSpawnChance) {
        cell.hazard = 'LEAK';
      } else if (roll.value < state.config.leakSpawnChance + corruptionSpawnChance) {
        cell.hazard = 'CORRUPTION';
      }
    }
  }
}

function applyLeakDamage(state) {
  const { leakDamageMultiplier } = onboardingModifiers(state.turn);
  let damage = 0;
  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      const cell = state.grid[y][x];
      if (cell.hazard === 'LEAK') {
        const leakDamage = cell.shielded
          ? Math.max(0, state.config.leakDamagePerSource - state.config.shieldLeakMitigation)
          : state.config.leakDamagePerSource;
        damage += leakDamage * leakDamageMultiplier;
      }
    }
  }
  state.integrity = Math.max(0, state.integrity - damage);
}

function hasLegalMove(state) {
  for (const entry of state.tray) {
    for (let y = 0; y < GRID_SIZE; y += 1) {
      for (let x = 0; x < GRID_SIZE; x += 1) {
        if (canPlaceEntry(state.grid, entry, x, y)) return true;
      }
    }
  }
  return false;
}

function finalizeTurn(state) {
  const { pressurePerTurnMultiplier } = onboardingModifiers(state.turn);
  state.pressure = Math.min(100, state.pressure + state.config.pressurePerTurn * pressurePerTurnMultiplier);
  state.containmentState = deriveContainmentState(state.pressure, state.integrity);

  if (state.integrity <= 0) {
    state.phase = 'LOST';
    state.lossCause = 'INTEGRITY';
  } else if (state.pressure >= 100) {
    state.phase = 'LOST';
    state.lossCause = 'PRESSURE';
  } else if (state.turn >= state.config.winTurns) {
    state.phase = 'WON';
  } else if (!hasLegalMove(state)) {
    state.phase = 'LOST';
    state.lossCause = 'NO_MOVES';
  } else {
    state.turn += 1;
  }
}

function consumeTrayEntry(state, index) {
  state.tray.splice(index, 1);
  refillTray(state);
  withReselectedModule(state);
}

export function reduce(state, action) {
  if (state.phase !== 'PLAYING') return state;

  if (action.type === 'SELECT_MODULE') {
    if (action.index < 0 || action.index >= state.tray.length) return state;
    const next = cloneState(state);
    next.selectedModuleIndex = action.index;
    withReselectedModule(next);
    return next;
  }

  if (action.type !== 'PLACE_SELECTED') return state;

  const entry = state.tray[action.index ?? state.selectedModuleIndex];
  const entryIndex = action.index ?? state.selectedModuleIndex;
  if (!entry) return state;
  if (!canPlaceEntry(state.grid, entry, action.x, action.y)) return state;

  const next = cloneState(state);
  const currentEntry = next.tray[entryIndex];
  const cells = getPlacementCells(currentEntry, action.x, action.y);
  for (const { x, y } of cells) {
    const cell = next.grid[y][x];
    cell.module = currentEntry.moduleId;
    cell.moduleMeta = currentEntry.shapeKey ?? null;
  }

  resolveModuleEffects(next, currentEntry, cells);
  consumeTrayEntry(next, entryIndex);
  spreadCorruption(next);
  spawnHazards(next);
  applyLeakDamage(next);
  finalizeTurn(next);
  next.log.push(`T${state.turn}: ${MODULE_DEFS[currentEntry.moduleId].name} @ ${action.x},${action.y}`);

  return next;
}

export function listValidPlacements(state, trayIndex) {
  const entry = typeof trayIndex === 'number' ? state.tray[trayIndex] : state.tray[state.selectedModuleIndex];
  if (!entry) return [];
  const out = [];
  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      if (canPlaceEntry(state.grid, entry, x, y)) out.push({ x, y });
    }
  }
  return out;
}

export function sampleTrayIndex(state) {
  const roll = randomInt(state.rngState, state.tray.length || 1);
  return roll.value;
}
