import { runOneGame, summarizeResults } from './lib/runOneGame.js';

const runs = 100;
const results = [];
for (let i = 0; i < runs; i += 1) {
  results.push(runOneGame({ seed: 1000 + i, policy: 'greedy' }));
}

const metrics = summarizeResults(results);

console.log('Simulation results (100 seeded runs)');
console.log(`Wins: ${metrics.wins}`);
console.log(`Losses: ${metrics.losses}`);
console.log(`Avg turns survived: ${metrics.avgTurns.toFixed(2)}`);
console.log(`Avg pressure at loss: ${metrics.avgPressureAtLoss.toFixed(2)}`);
console.log(`Avg integrity at loss: ${metrics.avgIntegrityAtLoss.toFixed(2)}`);
console.log(`Most common loss cause: ${metrics.commonLoss}`);
