import {
  BRACE_SHAPES,
  CORRUPTION_TYPES,
  CORE_STATE_THRESHOLDS,
  GRID_SIZE,
  MODULE_DEFS,
  RELIC_IDS
} from './config.js';
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

export function onboardingModifiers(turn) {
  if (turn <= 3) {
    return {
      corruptionSpawnMultiplier: 0,
      corruptionSpreadMultiplier: 0,
      leakSpawnMultiplier: 0,
      leakSpreadMultiplier: 0,
      leakDamageMultiplier: 0.25,
      pressurePerTurnMultiplier: 0.6,
    };
  }
  if (turn <= 10) {
    const leakRamp = (turn - 3) / 7;
    const leakDamageMultiplier = 0.25 + leakRamp * 0.75;
    return {
      corruptionSpawnMultiplier: turn <= 7 ? 0.5 : 0.8,
      corruptionSpreadMultiplier: turn <= 7 ? 0.5 : 0.8,
      leakSpawnMultiplier: leakRamp,
      leakSpreadMultiplier: leakRamp,
      leakDamageMultiplier,
      pressurePerTurnMultiplier: 0.8,
    };
  }
  return {
    corruptionSpawnMultiplier: 1,
    corruptionSpreadMultiplier: 1,
    leakSpawnMultiplier: 1,
    leakSpreadMultiplier: 1,
    leakDamageMultiplier: 1,
    pressurePerTurnMultiplier: 1,
  };
}

function markShieldAdjacency(state, x, y, radius = 1) {
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      if (Math.abs(dx) + Math.abs(dy) > radius) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(nx, ny)) continue;
      const neighbor = state.grid[ny][nx];
      if (neighbor.module !== null || (dx === 0 && dy === 0)) {
        neighbor.shielded = true;
      }
    }
  }
}

function applyContainmentWall(state, x, y) {
  const cell = state.grid[y][x];
  cell.containmentWallTurns = Math.max(cell.containmentWallTurns, state.config.containmentWallTurns);
  cell.synergyLinkType = 'WALL';
  cell.synergyLinkTurns = Math.max(cell.synergyLinkTurns, state.config.synergyGlowTurns);
}

function applyStabilityField(state, x, y) {
  if (!inBounds(x, y)) return;
  const cell = state.grid[y][x];
  cell.stabilityFieldTurns = Math.max(cell.stabilityFieldTurns, state.config.stabilityFieldTurns);
}

function applySynergyLinks(state, x, y, type) {
  const cell = state.grid[y][x];
  cell.synergyLinkType = type;
  cell.synergyLinkTurns = Math.max(cell.synergyLinkTurns, state.config.synergyGlowTurns);
}

function rotateRing(state, cx, cy) {
  const ring = [
    [cx - 1, cy - 1],
    [cx, cy - 1],
    [cx + 1, cy - 1],
    [cx + 1, cy],
    [cx + 1, cy + 1],
    [cx, cy + 1],
    [cx - 1, cy + 1],
    [cx - 1, cy],
  ];
  if (!ring.every(([x, y]) => inBounds(x, y))) return;
  const snapshot = ring.map(([x, y]) => ({ ...state.grid[y][x] }));
  for (let i = 0; i < ring.length; i += 1) {
    const [tx, ty] = ring[(i + 1) % ring.length];
    const source = snapshot[i];
    const target = state.grid[ty][tx];
    target.module = source.module;
    target.moduleMeta = source.moduleMeta;
    target.hazard = source.hazard;
    target.hazardType = source.hazardType;
    target.shielded = source.shielded;
    target.containmentWallTurns = source.containmentWallTurns;
    target.stabilityFieldTurns = source.stabilityFieldTurns;
    target.synergyLinkType = source.synergyLinkType;
    target.synergyLinkTurns = source.synergyLinkTurns;
  }
}

function rollCorruptionType(state) {
  const pick = randomInt(state.rngState, CORRUPTION_TYPES.length);
  state.rngState = pick.state;
  return CORRUPTION_TYPES[pick.value];
}

function tryClearHazard(state, x, y) {
  const cell = state.grid[y][x];
  if (cell.hazard !== 'CORRUPTION') {
    cell.hazard = null;
    cell.hazardType = null;
    return;
  }
  if (cell.hazardType === 'CREEPER') {
    const roll = randomFloat01(state.rngState);
    state.rngState = roll.state;
    if (roll.value < state.config.creeperResistChance) return;
  }
  cell.hazard = null;
  cell.hazardType = null;
}

function maybeGrantRelic(state) {
  const milestones = state.config.relicMilestones ?? [];
  const available = RELIC_IDS.filter((id) => !state.relics[id]);
  if (!available.length) return;
  const isMilestone = milestones.includes(state.turn);
  let shouldGrant = isMilestone;
  if (!shouldGrant) {
    const roll = randomFloat01(state.rngState);
    state.rngState = roll.state;
    shouldGrant = roll.value < state.config.relicRandomChance;
  }
  if (!shouldGrant) return;
  const pick = randomInt(state.rngState, available.length);
  state.rngState = pick.state;
  state.relics[available[pick.value]] = true;
}

function findAdjacentModule(state, x, y, moduleId) {
  for (const [dx, dy] of CARDINAL) {
    const nx = x + dx;
    const ny = y + dy;
    if (!inBounds(nx, ny)) continue;
    if (state.grid[ny][nx].module === moduleId) return [dx, dy, nx, ny];
  }
  return null;
}

function applySynergies(state, entry, cells) {
  let purgeSweepDirection = null;
  if (entry.moduleId === 'PURGE') {
    for (const { x, y } of cells) {
      const neighbor = findAdjacentModule(state, x, y, 'CYCLER');
      if (neighbor) {
        const [dx, dy, nx, ny] = neighbor;
        purgeSweepDirection = [dx, dy];
        applySynergyLinks(state, x, y, 'SWEEP');
        applySynergyLinks(state, nx, ny, 'SWEEP');
        break;
      }
    }
  }

  if (entry.moduleId === 'SHIELD_CORE' || entry.moduleId === 'BRACE') {
    const target = entry.moduleId === 'SHIELD_CORE' ? 'BRACE' : 'SHIELD_CORE';
    for (const { x, y } of cells) {
      const neighbor = findAdjacentModule(state, x, y, target);
      if (!neighbor) continue;
      const [, , nx, ny] = neighbor;
      applyContainmentWall(state, x, y);
      applyContainmentWall(state, nx, ny);
    }
  }

  if (entry.moduleId === 'BRACE') {
    for (const { x, y } of cells) {
      const neighbor = findAdjacentModule(state, x, y, 'BRACE');
      if (!neighbor) continue;
      const [, , nx, ny] = neighbor;
      applySynergyLinks(state, x, y, 'STABILITY');
      applySynergyLinks(state, nx, ny, 'STABILITY');
      for (let py = y - 1; py <= y + 1; py += 1) {
        for (let px = x - 1; px <= x + 1; px += 1) {
          applyStabilityField(state, px, py);
        }
      }
      for (let py = ny - 1; py <= ny + 1; py += 1) {
        for (let px = nx - 1; px <= nx + 1; px += 1) {
          applyStabilityField(state, px, py);
        }
      }
    }
  }

  return { purgeSweepDirection };
}

function applyResonanceEffects(state, cells) {
  const modifiers = {
    effectRadiusBonus: 0,
    overloadCount: 0,
    cyclonicCells: [],
  };
  for (const { x, y } of cells) {
    const resonance = state.resonanceMap[y][x];
    if (!resonance?.type || resonance.revealed) continue;
    resonance.revealed = true;
    state.metrics.resonanceActivations += 1;
    switch (resonance.type) {
      case 'AMPLIFIER':
        modifiers.effectRadiusBonus += 1;
        break;
      case 'STABILIZER':
        state.integrityRegenTurns += state.config.stabilizerRegenTurns;
        break;
      case 'OVERLOAD':
        modifiers.effectRadiusBonus += 1;
        modifiers.overloadCount += 1;
        break;
      case 'CYCLONIC':
        modifiers.cyclonicCells.push({ x, y });
        break;
      default:
        break;
    }
  }
  return modifiers;
}

function resolveModuleEffects(state, entry, cells, modifiers = {}) {
  const effectRadiusBonus = modifiers.effectRadiusBonus ?? 0;
  const overloadCount = modifiers.overloadCount ?? 0;
  const purgeSweepDirection = modifiers.purgeSweepDirection ?? null;
  switch (entry.moduleId) {
    case 'SHIELD_CORE': {
      const radius = state.config.shieldAdjacencyRadius + effectRadiusBonus;
      for (const { x, y } of cells) {
        state.grid[y][x].shielded = true;
        markShieldAdjacency(state, x, y, radius);
      }
      break;
    }
    case 'PURGE': {
      const radius = state.config.purgeRadius + effectRadiusBonus + (state.relics.PURIFIER_LENS ? state.config.purifierLensBonus : 0);
      if (purgeSweepDirection) {
        for (const { x, y } of cells) {
          const [dx, dy] = purgeSweepDirection;
          let step = 0;
          while (inBounds(x + dx * step, y + dy * step)) {
            const px = x + dx * step;
            const py = y + dy * step;
            if (state.grid[py][px].hazard) tryClearHazard(state, px, py);
            step += 1;
          }
        }
      } else {
        for (const { x, y } of cells) {
          for (let py = y - radius; py <= y + radius; py += 1) {
            for (let px = x - radius; px <= x + radius; px += 1) {
              if (inBounds(px, py) && state.grid[py][px].hazard) {
                tryClearHazard(state, px, py);
              }
            }
          }
        }
      }
      break;
    }
    case 'PUMP': {
      const bonus = overloadCount > 0 ? state.config.overloadPumpBonus : 0;
      state.pressure = Math.max(0, state.pressure - state.config.pumpPressureReduction - bonus);
      break;
    }
    case 'CYCLER': {
      rerollTray(state);
      break;
    }
    case 'BRACE': {
      if (state.relics.STRUCTURAL_MEMORY) {
        state.integrityRegenTurns = Math.max(
          state.integrityRegenTurns,
          state.config.structuralMemoryRegenTurns
        );
      }
      break;
    }
    default:
      break;
  }

  if (overloadCount > 0) {
    state.pressure = Math.min(100, state.pressure + state.config.overloadPressurePenalty * overloadCount);
  }
}

function spreadCorruption(state) {
  const { corruptionSpreadMultiplier } = onboardingModifiers(state.turn);
  const relicMultiplier = state.relics.ENTROPY_DAMPENER ? state.config.entropyDampenerMultiplier : 1;
  const spreadChance = state.config.corruptionSpreadChance * corruptionSpreadMultiplier * relicMultiplier * 0.75;
  if (spreadChance <= 0) return;
  const additions = [];
  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      if (state.grid[y][x].hazard !== 'CORRUPTION') continue;
      const source = state.grid[y][x];
      const corruptionType = source.hazardType ?? 'CREEPER';
      if (corruptionType === 'DORMANT' && state.pressure < state.config.dormantPressureThreshold) continue;
      const typeMultiplier = corruptionType === 'CREEPER' ? state.config.creeperSpreadMultiplier : 1;
      for (const [dx, dy] of CARDINAL) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inBounds(nx, ny)) continue;
        const target = state.grid[ny][nx];
        if (target.hazard || target.module || target.shielded || target.containmentWallTurns > 0) continue;
        const stabilityModifier = (target.stabilityFieldTurns > 0 || source.stabilityFieldTurns > 0)
          ? state.config.stabilityFieldSpreadMultiplier
          : 1;
        const roll = randomFloat01(state.rngState);
        state.rngState = roll.state;
        if (roll.value < spreadChance * typeMultiplier * stabilityModifier) {
          additions.push([nx, ny, corruptionType]);
        }
      }

      if (corruptionType === 'SPIKER') {
        const spikeRoll = randomFloat01(state.rngState);
        state.rngState = spikeRoll.state;
        if (spikeRoll.value < state.config.spikerJumpChance) {
          const dirPick = randomInt(state.rngState, CARDINAL.length);
          state.rngState = dirPick.state;
          const [dx, dy] = CARDINAL[dirPick.value];
          const nx = x + dx * 2;
          const ny = y + dy * 2;
          if (inBounds(nx, ny)) {
            const target = state.grid[ny][nx];
            if (!target.hazard && !target.module && !target.shielded && target.containmentWallTurns === 0) {
              additions.push([nx, ny, corruptionType]);
            }
          }
        }
      }
    }
  }
  for (const [x, y, corruptionType] of additions) {
    state.grid[y][x].hazard = 'CORRUPTION';
    state.grid[y][x].hazardType = corruptionType;
    state.metrics.corruptionTypeCounts[corruptionType] += 1;
  }
}

function spawnHazards(state) {
  const { corruptionSpawnMultiplier, leakSpawnMultiplier } = onboardingModifiers(state.turn);
  const corruptionSpawnChance = state.config.corruptionSpawnChance * corruptionSpawnMultiplier;
  const leakSpawnChance = state.config.leakSpawnChance * leakSpawnMultiplier;
  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      const cell = state.grid[y][x];
      if (cell.hazard || cell.module || cell.shielded) continue;
      const roll = randomFloat01(state.rngState);
      state.rngState = roll.state;
      if (roll.value < leakSpawnChance) {
        cell.hazard = 'LEAK';
        cell.hazardType = null;
      } else if (roll.value < leakSpawnChance + corruptionSpawnChance) {
        cell.hazard = 'CORRUPTION';
        cell.hazardType = rollCorruptionType(state);
        state.metrics.corruptionTypeCounts[cell.hazardType] += 1;
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
  if (state.integrityRegenTurns > 0) {
    state.integrity = Math.min(100, state.integrity + state.config.stabilizerRegenAmount);
    state.integrityRegenTurns = Math.max(0, state.integrityRegenTurns - 1);
  }

  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      const cell = state.grid[y][x];
      if (cell.containmentWallTurns > 0) cell.containmentWallTurns -= 1;
      if (cell.stabilityFieldTurns > 0) cell.stabilityFieldTurns -= 1;
      if (cell.synergyLinkTurns > 0) {
        cell.synergyLinkTurns -= 1;
        if (cell.synergyLinkTurns === 0) cell.synergyLinkType = null;
      }
    }
  }
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
    maybeGrantRelic(state);
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

  const resonanceModifiers = applyResonanceEffects(next, cells);
  for (const { x, y } of resonanceModifiers.cyclonicCells) {
    rotateRing(next, x, y);
  }
  const synergyModifiers = applySynergies(next, currentEntry, cells);
  resolveModuleEffects(next, currentEntry, cells, {
    effectRadiusBonus: resonanceModifiers.effectRadiusBonus,
    overloadCount: resonanceModifiers.overloadCount,
    purgeSweepDirection: synergyModifiers.purgeSweepDirection,
  });
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
