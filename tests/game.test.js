import test from 'node:test';
import assert from 'node:assert/strict';

import { reduce, canPlaceEntry, listValidPlacements } from '../src/game/reducer.js';
import { createInitialState } from '../src/game/state.js';

function stateWithTray(entries, seed = 99) {
  const state = createInitialState({ seed, config: { leakSpawnChance: 0, corruptionSpawnChance: 0, corruptionSpreadChance: 0 } });
  state.tray = entries;
  state.selectedModuleIndex = 0;
  state.selectedModule = entries[0];
  return state;
}

test('placement validation enforces in-bounds and non-overlap', () => {
  const state = stateWithTray([{ moduleId: 'BRACE', shapeKey: 'BLOCK' }]);
  assert.equal(canPlaceEntry(state.grid, state.tray[0], 7, 7), false);
  assert.equal(canPlaceEntry(state.grid, state.tray[0], 0, 0), true);

  const next = reduce(state, { type: 'PLACE_SELECTED', x: 0, y: 0 });
  assert.equal(canPlaceEntry(next.grid, { moduleId: 'PUMP' }, 0, 0), false);
});

test('purge clears hazards in 3x3 centered area', () => {
  const state = stateWithTray([{ moduleId: 'PURGE' }]);
  state.grid[2][2].hazard = 'LEAK';
  state.grid[3][3].hazard = 'CORRUPTION';
  state.grid[4][4].hazard = 'LEAK';

  const next = reduce(state, { type: 'PLACE_SELECTED', x: 3, y: 3 });
  assert.equal(next.grid[2][2].hazard, null);
  assert.equal(next.grid[3][3].hazard, null);
  assert.equal(next.grid[4][4].hazard, null);
});

test('pump reduces pressure with floor at zero and applies turn tick', () => {
  const state = stateWithTray([{ moduleId: 'PUMP' }]);
  state.pressure = 3;
  const next = reduce(state, { type: 'PLACE_SELECTED', x: 0, y: 0 });
  assert.equal(next.pressure, 5); // max(0,3-8)+5 per turn
});

test('cycler reroll is deterministic from seed', () => {
  const first = stateWithTray([{ moduleId: 'CYCLER' }], 1234);
  const second = stateWithTray([{ moduleId: 'CYCLER' }], 1234);

  const nextA = reduce(first, { type: 'PLACE_SELECTED', x: 0, y: 0 });
  const nextB = reduce(second, { type: 'PLACE_SELECTED', x: 0, y: 0 });

  assert.deepEqual(nextA.tray, nextB.tray);
});

test('corruption spread is deterministic with fixed seed', () => {
  const initial = createInitialState({ seed: 77, config: { leakSpawnChance: 0, corruptionSpawnChance: 0, corruptionSpreadChance: 1 } });
  initial.tray = [{ moduleId: 'PUMP' }];
  initial.selectedModule = initial.tray[0];
  initial.grid[4][4].hazard = 'CORRUPTION';

  const next = reduce(initial, { type: 'PLACE_SELECTED', x: 0, y: 0 });
  assert.equal(next.grid[4][5].hazard, 'CORRUPTION');
  assert.equal(next.grid[4][3].hazard, 'CORRUPTION');
  assert.equal(next.grid[5][4].hazard, 'CORRUPTION');
  assert.equal(next.grid[3][4].hazard, 'CORRUPTION');
});

test('win and loss are deterministic with fixed seed', () => {
  const lose = stateWithTray([{ moduleId: 'BRACE', shapeKey: 'BLOCK' }], 900);
  lose.pressure = 99;
  const lost = reduce(lose, { type: 'PLACE_SELECTED', x: 0, y: 0 });
  assert.equal(lost.phase, 'LOST');
  assert.equal(lost.lossCause, 'PRESSURE');

  const win = createInitialState({ seed: 900, config: { winTurns: 1, pressurePerTurn: 0, leakSpawnChance: 0, corruptionSpawnChance: 0, corruptionSpreadChance: 0 } });
  win.tray = [{ moduleId: 'PUMP' }];
  win.selectedModule = win.tray[0];
  const won = reduce(win, { type: 'PLACE_SELECTED', x: 0, y: 0 });
  assert.equal(won.phase, 'WON');
});

test('listValidPlacements reads from tray index', () => {
  const state = stateWithTray([{ moduleId: 'PUMP' }, { moduleId: 'BRACE', shapeKey: 'LINE3' }]);
  const p = listValidPlacements(state, 1);
  assert.ok(p.length > 0);
});
