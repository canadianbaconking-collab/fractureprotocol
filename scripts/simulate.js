import { reduce, listValidPlacements } from '../src/game/reducer.js';
import { cloneState, createInitialState } from '../src/game/state.js';

function scoreState(state) {
  const hazardPenalty = state.grid.flat().reduce((acc, cell) => {
    if (cell.hazard === 'CORRUPTION') return acc + 3;
    if (cell.hazard === 'LEAK') return acc + 2;
    return acc;
  }, 0);
  return state.integrity * 3 - state.pressure * 2 - hazardPenalty;
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
        bestAction = { type: 'PLACE_SELECTED', index, ...placement };
      }
    }
  }
  return bestAction;
}

function runOne(seed) {
  let state = createInitialState({ seed });
  while (state.phase === 'PLAYING') {
    const action = chooseGreedyMove(state);
    if (!action) break;
    state = reduce(state, action);
  }
  return state;
}

const runs = 100;
const results = [];
for (let i = 0; i < runs; i += 1) {
  results.push(runOne(1000 + i));
}

const wins = results.filter((s) => s.phase === 'WON').length;
const losses = results.filter((s) => s.phase === 'LOST').length;
const avgTurns = results.reduce((acc, s) => acc + s.turn, 0) / runs;
const lost = results.filter((s) => s.phase === 'LOST');
const avgPressureAtLoss = lost.length ? lost.reduce((acc, s) => acc + s.pressure, 0) / lost.length : 0;
const avgIntegrityAtLoss = lost.length ? lost.reduce((acc, s) => acc + s.integrity, 0) / lost.length : 0;
const causeCount = new Map();
for (const s of lost) causeCount.set(s.lossCause, (causeCount.get(s.lossCause) ?? 0) + 1);
const commonLoss = [...causeCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'N/A';

console.log('Simulation results (100 seeded runs)');
console.log(`Wins: ${wins}`);
console.log(`Losses: ${losses}`);
console.log(`Avg turns survived: ${avgTurns.toFixed(2)}`);
console.log(`Avg pressure at loss: ${avgPressureAtLoss.toFixed(2)}`);
console.log(`Avg integrity at loss: ${avgIntegrityAtLoss.toFixed(2)}`);
console.log(`Most common loss cause: ${commonLoss}`);
