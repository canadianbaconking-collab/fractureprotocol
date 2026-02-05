import { MODULE_DEFS, MODULE_ORDER } from '../game/config.js';
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
const bootSplashEl = document.getElementById('bootSplash');

let state = createInitialState({ seed: 4242 });

function modulePalette(moduleId) {
  switch (moduleId) {
    case 'SHIELD_CORE': return 'shield';
    case 'PURGE': return 'purge';
    case 'PUMP': return 'pump';
    case 'CYCLER': return 'cycler';
    default: return 'brace';
  }
}

function renderGrid() {
  gridEl.innerHTML = '';
  for (let y = 0; y < state.grid.length; y += 1) {
    for (let x = 0; x < state.grid[y].length; x += 1) {
      const cell = state.grid[y][x];
      const button = document.createElement('button');
      button.className = 'cell';
      if (cell.module) {
        button.classList.add('module', `module-${modulePalette(cell.module)}`);
      }
      if (cell.shielded) button.classList.add('shielded');
      if (cell.hazard === 'CORRUPTION') button.classList.add('hazard-corruption');
      if (cell.hazard === 'LEAK') button.classList.add('hazard-leak');
      button.disabled = state.phase !== 'PLAYING';
      button.addEventListener('click', () => {
        state = reduce(state, { type: 'PLACE_SELECTED', x, y });
        render();
      });
      gridEl.append(button);
    }
  }
}

function renderTray() {
  trayEl.innerHTML = '';
  const selected = state.tray[state.selectedModuleIndex];
  for (const moduleId of MODULE_ORDER) {
    const isInTray = state.tray.findIndex((entry) => entry.moduleId === moduleId);
    const def = MODULE_DEFS[moduleId];
    const button = document.createElement('button');
    const trayBadge = isInTray >= 0 ? `IN TRAY ${isInTray + 1}` : 'NOT IN TRAY';
    const isActive = selected?.moduleId === moduleId;
    button.className = `module-btn palette-${modulePalette(moduleId)} ${isActive ? 'active' : ''}`;
    button.innerHTML = `<span>${def.name}</span><small>${trayBadge}</small>`;
    button.disabled = isInTray < 0 || state.phase !== 'PLAYING';
    button.addEventListener('click', () => {
      state = reduce(state, { type: 'SELECT_MODULE', index: isInTray });
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
  phaseStatEl.textContent = `Phase: ${state.phase}${state.lossCause ? ` (${state.lossCause})` : ''}`;
}

function wireBackButton() {
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && state.phase !== 'PLAYING') {
      state = createInitialState({ seed: 4242 });
      render();
    }
  });

  if (window.Capacitor?.Plugins?.App) {
    window.Capacitor.Plugins.App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) return;
      if (state.phase !== 'PLAYING') {
        state = createInitialState({ seed: 4242 });
        render();
      } else if (window.confirm('Exit Fracture Protocol?')) {
        window.Capacitor.Plugins.App.exitApp();
      }
    });
  }
}

function render() {
  renderHero();
  renderGrid();
  renderTray();
}

wireBackButton();
render();

setTimeout(() => bootSplashEl?.classList.add('hidden'), 1200);
