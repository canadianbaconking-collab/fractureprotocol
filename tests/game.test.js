import test from 'node:test';
import assert from 'node:assert/strict';

import { reduce } from '../src/game/reducer.js';
import { createInitialState } from '../src/game/state.js';

function fixedRng(value) {
  return () => value;
}

test('turn resolution increments turn and applies pressure', () => {
  const state = createInitialState({
    config: {
      pressurePerTurn: 5,
      leakSpawnChance: 0,
      corruptionSpawnChance: 0,
      corruptionSpreadChance: 0,
    },
  });

  const next = reduce(state, { type: 'PLACE_MODULE', moduleId: 'PUMP', x: 0, y: 0 }, fixedRng(0.99));

  assert.equal(next.turn, 1);
  assert.equal(next.pressure, 5);
  assert.equal(next.phase, 'PLAYING');
});

test('corruption spreads to orthogonal neighbors', () => {
  const state = createInitialState({
    config: {
      leakSpawnChance: 0,
      corruptionSpawnChance: 0,
      corruptionSpreadChance: 1,
    },
  });

  state.grid[4][4].hazard = 'CORRUPTION';

  const next = reduce(state, { type: 'PLACE_MODULE', moduleId: 'PUMP', x: 0, y: 0 }, fixedRng(0));

  assert.equal(next.grid[4][5].hazard, 'CORRUPTION');
  assert.equal(next.grid[4][3].hazard, 'CORRUPTION');
  assert.equal(next.grid[5][4].hazard, 'CORRUPTION');
  assert.equal(next.grid[3][4].hazard, 'CORRUPTION');
});

test('loss and win conditions are derived deterministically', () => {
  const losingState = createInitialState({
    config: {
      pressurePerTurn: 5,
      leakSpawnChance: 0,
      corruptionSpawnChance: 0,
      corruptionSpreadChance: 0,
    },
  });
  losingState.pressure = 99;

  const lost = reduce(losingState, { type: 'PLACE_MODULE', moduleId: 'BRACE', x: 0, y: 0 }, fixedRng(0.99));
  assert.equal(lost.phase, 'LOST');
  assert.equal(lost.containmentState, 'BREACH');

  const winningState = createInitialState({
    config: {
      winTurns: 1,
      pressurePerTurn: 0,
      leakSpawnChance: 0,
      corruptionSpawnChance: 0,
      corruptionSpreadChance: 0,
    },
  });

  const won = reduce(winningState, { type: 'PLACE_MODULE', moduleId: 'PUMP', x: 0, y: 0 }, fixedRng(0.99));
  assert.equal(won.phase, 'WON');
});
