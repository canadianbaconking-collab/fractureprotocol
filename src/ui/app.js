import { MODULE_ORDER, MODULE_DEFS } from '../game/config.js';
import { createRng } from '../game/random.js';
import { reduce } from '../game/reducer.js';
import { createInitialState } from '../game/state.js';

const gridEl = document.getElementById('grid');
const trayEl = document.getElementById('moduleTray');
const coreOrbEl = document.getElementById('coreOrb');
const coreStateLabelEl = document.getElementById('coreStateLabel');
const turnStatEl = document.getElementById('turnStat');
const integrityStatEl = document.getElementById('integrityStat');
const pressureStatEl = document.getElementById('pressureStat');
const phaseStatEl = document.getElementById('phaseStat');

let state = createInitialState();
let selectedModule = MODULE_ORDER[0];
const rng = createRng(42);

function renderGrid() {
  gridEl.innerHTML = '';
  for (let y = 0; y < state.grid.length; y += 1) {
    for (let x = 0; x < state.grid[y].length; x += 1) {
      const cell = state.grid[y][x];
      const button = document.createElement('button');
      button.className = 'cell';
      if (cell.module) button.classList.add('module');
      if (cell.shielded) button.classList.add('shielded');
      if (cell.hazard === 'CORRUPTION') button.classList.add('hazard-corruption');
      if (cell.hazard === 'LEAK') button.classList.add('hazard-leak');
      button.addEventListener('click', () => {
        state = reduce(state, { type: 'PLACE_MODULE', moduleId: selectedModule, x, y }, rng);
        render();
      });
      gridEl.append(button);
    }
  }
}

function renderTray() {
  trayEl.innerHTML = '';
  for (const moduleId of MODULE_ORDER) {
    const def = MODULE_DEFS[moduleId];
    const button = document.createElement('button');
    button.className = `module-btn ${selectedModule === moduleId ? 'active' : ''}`;
    button.textContent = def.name;
    button.disabled = state.phase !== 'PLAYING';
    button.addEventListener('click', () => {
      selectedModule = moduleId;
      renderTray();
    });
    trayEl.append(button);
  }
}

function renderHero() {
  coreOrbEl.className = `core-orb ${state.containmentState}`;
  coreStateLabelEl.textContent = state.containmentState;
  turnStatEl.textContent = `Turn: ${state.turn}`;
  integrityStatEl.textContent = `Integrity: ${Math.max(0, state.integrity)}`;
  pressureStatEl.textContent = `Pressure: ${state.pressure}`;
  phaseStatEl.textContent = `Phase: ${state.phase}`;
}

function render() {
  renderHero();
  renderGrid();
  renderTray();
}

render();
