import { reduce, listValidPlacements, onboardingModifiers } from '../../src/game/reducer.js';
import { cloneState, createInitialState } from '../../src/game/state.js';
import { createRng } from '../../src/game/random.js';

function scoreState(state) {
  const hazardPenalty = state.grid.flat().reduce((acc, cell) => {
    if (cell.hazard === 'CORRUPTION') return acc + 3;
    if (cell.hazard === 'LEAK') return acc + 2;
    return acc;
  }, 0);
  return state.integrity * 3 - state.pressure * 2 - hazardPenalty;
}

function collectActions(state) {
  const actions = [];
  for (let index = 0; index < state.tray.length; index += 1) {
    const placements = listValidPlacements(state, index);
    for (const placement of placements) {
      actions.push({ index, ...placement });
    }
  }
  return actions;
}

function chooseGreedyMove(state) {
  let bestAction = null;
  let bestScore = -Infinity;

  for (let index = 0; index < state.tray.length; index += 1) {
    const placements = listValidPlacements(state, index);
    for (const placement of placements) {
      const next = reduce(cloneState(state), { type: 'PLACE_SELECTED', index, ...placement });
      const score = scoreState(next);
      if (score > bestScore) {
        bestScore = score;
        bestAction = { index, ...placement };
      }
    }
  }
  return bestAction;
}

function chooseRandomMove(state, rng) {
  const actions = collectActions(state);
  if (!actions.length) return null;
  const choice = Math.floor(rng() * actions.length);
  return actions[Math.min(choice, actions.length - 1)];
}

export function chooseAction(state, policy, rng) {
  switch (policy) {
    case 'random':
      return chooseRandomMove(state, rng);
    case 'greedy':
    default:
      return chooseGreedyMove(state);
  }
}

function formatNumber(value) {
  if (Number.isInteger(value)) return `${value}`;
  return value.toFixed(2);
}

function formatDelta(delta) {
  const formatted = formatNumber(delta);
  return delta >= 0 ? `+${formatted}` : formatted;
}

function countHazards(grid) {
  return grid.flat().reduce(
    (acc, cell) => {
      if (cell.hazard === 'CORRUPTION') acc.corruption += 1;
      if (cell.hazard === 'LEAK') acc.leak += 1;
      return acc;
    },
    { corruption: 0, leak: 0 },
  );
}

export function runOneGame({
  seed,
  policy = 'greedy',
  maxTurns = 200,
  traceTurns = 0,
  onTrace,
} = {}) {
  let state = createInitialState({ seed });
  const rng = createRng(`${seed}-${policy}`);
  const turnCap = Math.min(maxTurns, state.config.winTurns);
  const shouldTrace = traceTurns > 0 && typeof onTrace === 'function';

  while (state.phase === 'PLAYING' && state.turn <= turnCap) {
    const action = chooseAction(state, policy, rng);
    if (!action) break;
    state = reduce(state, { type: 'SELECT_MODULE', index: action.index });
    const prevState = state;
    state = reduce(state, { type: 'PLACE_SELECTED', x: action.x, y: action.y });
    const turnResolved = prevState.turn;
    if (shouldTrace && turnResolved <= traceTurns) {
      const integrityDelta = state.integrity - prevState.integrity;
      const pressureDelta = state.pressure - prevState.pressure;
      const hazardCounts = countHazards(state.grid);
      const modifiers = onboardingModifiers(turnResolved);
      const line = [
        `T${turnResolved}`,
        `int ${formatNumber(state.integrity)} (${formatDelta(integrityDelta)})`,
        `pres ${formatNumber(state.pressure)} (${formatDelta(pressureDelta)})`,
        `corr ${hazardCounts.corruption}`,
        `leak ${hazardCounts.leak}`,
        `mods s${formatNumber(modifiers.corruptionSpawnMultiplier)}`,
        `sp${formatNumber(modifiers.corruptionSpreadMultiplier)}`,
        `l${formatNumber(modifiers.leakDamageMultiplier)}`,
        `p${formatNumber(modifiers.pressurePerTurnMultiplier)}`,
      ].join(' | ');
      onTrace(line);
    }
  }

  return state;
}

export function summarizeResults(results) {
  const runs = results.length;
  const wins = results.filter((s) => s.phase === 'WON').length;
  const losses = results.filter((s) => s.phase === 'LOST').length;
  const avgTurns = runs ? results.reduce((acc, s) => acc + s.turn, 0) / runs : 0;
  const lost = results.filter((s) => s.phase === 'LOST');
  const avgPressureAtLoss = lost.length ? lost.reduce((acc, s) => acc + s.pressure, 0) / lost.length : 0;
  const avgIntegrityAtLoss = lost.length ? lost.reduce((acc, s) => acc + s.integrity, 0) / lost.length : 0;
  const causeCount = new Map();
  for (const s of lost) causeCount.set(s.lossCause, (causeCount.get(s.lossCause) ?? 0) + 1);
  const commonLoss = [...causeCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'N/A';

  return {
    runs,
    wins,
    losses,
    avgTurns,
    avgPressureAtLoss,
    avgIntegrityAtLoss,
    commonLoss,
  };
}
