import { runOneGame, summarizeResults } from './lib/runOneGame.js';

const runs = 100;
const results = [];
for (let i = 0; i < runs; i += 1) {
  results.push(runOneGame({ seed: 1000 + i, policy: 'greedy' }));
}

const metrics = summarizeResults(results);
const breakdown = metrics.lossBreakdown;
const normalizedBreakdown = {
  INTEGRITY: breakdown.INTEGRITY ?? 0,
  PRESSURE: breakdown.PRESSURE ?? 0,
  ...breakdown,
};
const lossSummary = Object.keys(normalizedBreakdown).length
  ? Object.entries(normalizedBreakdown)
    .map(([cause, count]) => `${cause}:${count}`)
    .join(' | ')
  : 'None';

console.log('Simulation results (100 seeded runs)');
console.log(`Avg turns survived: ${metrics.avgTurns.toFixed(2)}`);
console.log(`Wins: ${metrics.wins}`);
console.log(`Loss causes: ${lossSummary}`);
