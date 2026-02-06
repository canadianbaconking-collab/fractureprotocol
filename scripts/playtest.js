import { runOneGame, summarizeResults } from './lib/runOneGame.js';

function parseArgs(argv) {
  const args = {
    runs: 100,
    seedStart: 1000,
    policy: 'greedy',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === '--runs' && argv[i + 1]) {
      args.runs = Number(argv[i + 1]);
      i += 1;
      continue;
    }
    if (value.startsWith('--runs=')) {
      args.runs = Number(value.split('=')[1]);
      continue;
    }
    if (value === '--seedStart' && argv[i + 1]) {
      args.seedStart = Number(argv[i + 1]);
      i += 1;
      continue;
    }
    if (value.startsWith('--seedStart=')) {
      args.seedStart = Number(value.split('=')[1]);
      continue;
    }
    if (value === '--policy' && argv[i + 1]) {
      args.policy = argv[i + 1];
      i += 1;
      continue;
    }
    if (value.startsWith('--policy=')) {
      args.policy = value.split('=')[1];
    }
  }

  args.runs = Number.isFinite(args.runs) && args.runs > 0 ? Math.floor(args.runs) : 100;
  args.seedStart = Number.isFinite(args.seedStart) ? Math.floor(args.seedStart) : 1000;
  return args;
}

const { runs, seedStart, policy } = parseArgs(process.argv.slice(2));

const results = [];
for (let i = 0; i < runs; i += 1) {
  results.push(runOneGame({ seed: seedStart + i, policy }));
}

const metrics = summarizeResults(results);

console.log(`Playtest results (${runs} seeded runs, policy: ${policy})`);
console.log(`Wins: ${metrics.wins}`);
console.log(`Losses: ${metrics.losses}`);
console.log(`Avg turns survived: ${metrics.avgTurns.toFixed(2)}`);
console.log(`Avg pressure at loss: ${metrics.avgPressureAtLoss.toFixed(2)}`);
console.log(`Avg integrity at loss: ${metrics.avgIntegrityAtLoss.toFixed(2)}`);
console.log(`Most common loss cause: ${metrics.commonLoss}`);
