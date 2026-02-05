import { MODULE_ORDER } from '../src/game/config.js';
import { createRng } from '../src/game/random.js';
import { listValidPlacements, reduce } from '../src/game/reducer.js';
import { createInitialState } from '../src/game/state.js';

function chooseAction(state, rng) {
  for (const moduleId of MODULE_ORDER) {
    const placements = listValidPlacements(state, moduleId);
    if (placements.length > 0) {
      const index = Math.floor(rng() * placements.length);
      return { type: 'PLACE_MODULE', moduleId, ...placements[index] };
    }
  }
  return null;
}

function runOne(seed) {
  const rng = createRng(seed);
  let state = createInitialState();

  while (state.phase === 'PLAYING') {
    const action = chooseAction(state, rng);
    if (!action) break;
    state = reduce(state, action, rng);
  }

  return {
    phase: state.phase,
    turns: state.turn,
    integrity: state.integrity,
    pressure: state.pressure,
  };
}

const runs = 100;
const summaries = [];
for (let i = 0; i < runs; i += 1) {
  summaries.push(runOne(1000 + i));
}

const wins = summaries.filter((s) => s.phase === 'WON').length;
const losses = summaries.filter((s) => s.phase === 'LOST').length;
const avgTurns = summaries.reduce((acc, s) => acc + s.turns, 0) / runs;
const avgIntegrity = summaries.reduce((acc, s) => acc + s.integrity, 0) / runs;
const avgPressure = summaries.reduce((acc, s) => acc + s.pressure, 0) / runs;

console.log('Simulation results');
console.log(`Runs: ${runs}`);
console.log(`Wins: ${wins}`);
console.log(`Losses: ${losses}`);
console.log(`Average turns: ${avgTurns.toFixed(2)}`);
console.log(`Average integrity: ${avgIntegrity.toFixed(2)}`);
console.log(`Average pressure: ${avgPressure.toFixed(2)}`);
