import { runOneGame, summarizeResults } from './lib/runOneGame.js';

function parseArgs(argv) {
  const args = {
    runs: 100,
    seedStart: 1000,
    policy: 'greedy',
    trace: 0,
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
      continue;
    }
    if (value === '--trace' && argv[i + 1]) {
      args.trace = Number(argv[i + 1]);
      i += 1;
      continue;
    }
    if (value.startsWith('--trace=')) {
      args.trace = Number(value.split('=')[1]);
    }
  }

  args.runs = Number.isFinite(args.runs) && args.runs > 0 ? Math.floor(args.runs) : 100;
  args.seedStart = Number.isFinite(args.seedStart) ? Math.floor(args.seedStart) : 1000;
  args.trace = Number.isFinite(args.trace) && args.trace > 0 ? Math.floor(args.trace) : 0;
  return args;
}

const { runs, seedStart, policy, trace } = parseArgs(process.argv.slice(2));

const results = [];
for (let i = 0; i < runs; i += 1) {
  const traceTurns = i === 0 ? trace : 0;
  results.push(
    runOneGame({
      seed: seedStart + i,
      policy,
      traceTurns,
      onTrace: traceTurns > 0 ? (line) => console.log(line) : undefined,
    }),
  );
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

console.log(`Playtest results (${runs} seeded runs, policy: ${policy})`);
console.log(`Avg turns survived: ${metrics.avgTurns.toFixed(2)}`);
console.log(`Wins: ${metrics.wins}`);
console.log(`Loss causes: ${lossSummary}`);
