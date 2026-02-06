import { MODULE_DEFS, MODULE_ORDER } from '../game/config.js';
import { getModuleDeltaSummary } from '../game/moduleEffects.js';
import { reduce } from '../game/reducer.js';
import { createInitialState } from '../game/state.js';

console.log('APP_JS_BOOT');

window.addEventListener('error', (event) => {
  console.error('APP_JS_ERROR', event.error ?? event.message, event);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('APP_JS_UNHANDLED_REJECTION', event.reason);
});

const gridEl = document.getElementById('grid');
const trayEl = document.getElementById('moduleTray');
const coreOrbEl = document.getElementById('coreOrb');
const coreStateLabelEl = document.getElementById('coreStateLabel');
const turnStatEl = document.getElementById('turnStat');
const integrityStatEl = document.getElementById('integrityStat');
const pressureStatEl = document.getElementById('pressureStat');
const phaseStatEl = document.getElementById('phaseStat');
const bootSplashEl = document.getElementById('bootSplash');
const startOverlayEl = document.getElementById('startOverlay');
const howToOverlayEl = document.getElementById('howToOverlay');
const breachOverlayEl = document.getElementById('breachOverlay');
const gameOverOverlayEl = document.getElementById('gameOverOverlay');
const startRunButtonEl = document.getElementById('startRunButton');
const howToButtonEl = document.getElementById('howToButton');
const helpButtonEl = document.getElementById('helpButton');
const backToStartButtonEl = document.getElementById('backToStartButton');
const playAgainButtonEl = document.getElementById('playAgainButton');
const howToCloseEls = document.querySelectorAll('[data-close-howto]');
const winTurnsEls = document.querySelectorAll('[data-win-turns]');
const winTurnsLineEls = document.querySelectorAll('[data-win-turns-line]');
const moduleDeltaNameEl = document.getElementById('moduleDeltaName');
const moduleDeltaBadgesEl = document.getElementById('moduleDeltaBadges');
const moduleDeltaPanelEl = document.getElementById('moduleDeltaPanel');
const finalScoreValueEl = document.getElementById('finalScoreValue');
const finalTurnsValueEl = document.getElementById('finalTurnsValue');
const finalIntegrityValueEl = document.getElementById('finalIntegrityValue');
const finalPressureValueEl = document.getElementById('finalPressureValue');
const highScoreListEl = document.getElementById('highScoreList');

let state = createInitialState({ seed: 4242 });
let previousState = null;
let showStartOverlay = true;
let showHowToOverlay = false;
let showGameOverOverlay = false;
let shakeTimeout = null;
let hoveredModuleId = null;
let lastDeltaModuleId = null;
let breachTriggered = false;
let breachTimeout = null;

const HIGH_SCORE_KEY = 'fractureProtocolHighScores';

function modulePalette(moduleId) {
  switch (moduleId) {
    case 'SHIELD_CORE': return 'shield';
    case 'PURGE': return 'purge';
    case 'PUMP': return 'pump';
    case 'CYCLER': return 'cycler';
    default: return 'brace';
  }
}

function renderGrid(prevState) {
  gridEl.innerHTML = '';
  for (let y = 0; y < state.grid.length; y += 1) {
    for (let x = 0; x < state.grid[y].length; x += 1) {
      const cell = state.grid[y][x];
      const prevCell = prevState?.grid?.[y]?.[x] ?? null;
      const isNewHazard = cell.hazard && !prevCell?.hazard;
      const button = document.createElement('button');
      button.className = 'cell';
      if (cell.module) {
        button.classList.add('module', `module-${modulePalette(cell.module)}`);
      }
      if (cell.shielded) button.classList.add('shielded');
      if (cell.hazard === 'CORRUPTION') button.classList.add('hazard-corruption');
      if (cell.hazard === 'LEAK') button.classList.add('hazard-leak');
      if (isNewHazard) button.classList.add('hazard-spawn');
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
    button.addEventListener('mouseenter', () => {
      hoveredModuleId = moduleId;
      renderModuleDeltas(moduleId);
    });
    button.addEventListener('mouseleave', () => {
      if (hoveredModuleId === moduleId) hoveredModuleId = null;
      renderModuleDeltas(selected?.moduleId);
    });
    button.addEventListener('focus', () => {
      hoveredModuleId = moduleId;
      renderModuleDeltas(moduleId);
    });
    button.addEventListener('blur', () => {
      if (hoveredModuleId === moduleId) hoveredModuleId = null;
      renderModuleDeltas(selected?.moduleId);
    });
    button.addEventListener('click', () => {
      state = reduce(state, { type: 'SELECT_MODULE', index: isInTray });
      renderTray();
    });
    trayEl.append(button);
  }
  renderModuleDeltas(hoveredModuleId ?? selected?.moduleId);
}

function renderHero() {
  coreOrbEl.className = `core-orb ${state.containmentState}`;
  coreStateLabelEl.textContent = state.containmentState;
  turnStatEl.textContent = `Turn: ${state.turn}`;
  integrityStatEl.textContent = `Integrity: ${Math.max(0, Math.round(state.integrity))}`;
  pressureStatEl.textContent = `Pressure: ${Math.round(state.pressure)}`;
  phaseStatEl.textContent = `Phase: ${state.phase}${state.lossCause ? ` (${state.lossCause})` : ''}`;
}

function renderModuleDeltas(moduleId) {
  if (!moduleDeltaBadgesEl || !moduleDeltaNameEl) return;
  if (!moduleId) {
    if (moduleDeltaPanelEl) moduleDeltaPanelEl.dataset.module = '';
    return;
  }
  if (moduleId === lastDeltaModuleId) return;
  lastDeltaModuleId = moduleId;
  if (moduleDeltaPanelEl) moduleDeltaPanelEl.dataset.module = moduleId;
  const summary = getModuleDeltaSummary(moduleId, state);
  moduleDeltaNameEl.textContent = summary.title;
  moduleDeltaBadgesEl.innerHTML = '';
  if (!summary.badges.length) return;
  for (const badge of summary.badges) {
    const badgeEl = document.createElement('span');
    badgeEl.className = `delta-badge ${badge.tone ?? 'neutral'}`;
    badgeEl.textContent = `${badge.label}: ${badge.value}`;
    moduleDeltaBadgesEl.append(badgeEl);
  }
}

function syncWinTurns() {
  const winTurns = state.config.winTurns;
  winTurnsEls.forEach((el) => {
    el.textContent = winTurns.toString();
  });
  winTurnsLineEls.forEach((el) => {
    el.textContent = `Turn: ${winTurns}/${winTurns}`;
  });
}

function wireBackButton() {
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && showHowToOverlay) {
      showHowToOverlay = false;
      renderOverlays();
      return;
    }
    if (event.key === 'Escape' && showGameOverOverlay) {
      startNewRun({ showStart: true });
      return;
    }
    if (event.key === 'Escape' && state.phase !== 'PLAYING') {
      startNewRun({ showStart: true });
    }
  });

  if (window.Capacitor?.Plugins?.App) {
    window.Capacitor.Plugins.App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) return;
      if (showGameOverOverlay || state.phase !== 'PLAYING') {
        startNewRun({ showStart: true });
      } else if (window.confirm('Exit Fracture Protocol?')) {
        window.Capacitor.Plugins.App.exitApp();
      }
    });
  }
}

function renderOverlays() {
  if (startOverlayEl) {
    startOverlayEl.classList.toggle('is-active', showStartOverlay);
  }
  if (howToOverlayEl) {
    howToOverlayEl.classList.toggle('is-active', showHowToOverlay);
    howToOverlayEl.setAttribute('aria-hidden', (!showHowToOverlay).toString());
  }
  if (gameOverOverlayEl) {
    gameOverOverlayEl.classList.toggle('is-active', showGameOverOverlay);
    gameOverOverlayEl.setAttribute('aria-hidden', (!showGameOverOverlay).toString());
  }
}

function computeFinalScore(currentState) {
  const integrity = Math.max(0, Math.round(currentState.integrity));
  const pressure = Math.round(currentState.pressure);
  const turns = currentState.turn;
  return Math.max(0, Math.round(turns * 120 + integrity * 8 - pressure * 4));
}

function loadHighScores() {
  if (!window.localStorage) return [];
  try {
    const stored = window.localStorage.getItem(HIGH_SCORE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('HIGH_SCORE_LOAD_FAILED', error);
    return [];
  }
}

function saveHighScores(scores) {
  if (!window.localStorage) return;
  try {
    window.localStorage.setItem(HIGH_SCORE_KEY, JSON.stringify(scores));
  } catch (error) {
    console.warn('HIGH_SCORE_SAVE_FAILED', error);
  }
}

function updateHighScores(entry) {
  const scores = loadHighScores();
  scores.push(entry);
  scores.sort((a, b) => b.score - a.score);
  const trimmed = scores.slice(0, 10);
  saveHighScores(trimmed);
  return trimmed;
}

function renderHighScoreList(scores) {
  if (!highScoreListEl) return;
  highScoreListEl.innerHTML = '';
  if (!scores.length) {
    const item = document.createElement('li');
    item.textContent = 'No recorded runs yet.';
    highScoreListEl.append(item);
    return;
  }
  scores.forEach((entry) => {
    const item = document.createElement('li');
    const scoreText = document.createElement('span');
    scoreText.textContent = entry.score.toLocaleString();
    const metaText = document.createElement('span');
    metaText.className = 'score-meta mono';
    metaText.textContent = `T${entry.turns} · I${entry.integrity} · P${entry.pressure}`;
    item.append(scoreText, metaText);
    highScoreListEl.append(item);
  });
}

function renderGameOver(currentState) {
  const integrity = Math.max(0, Math.round(currentState.integrity));
  const pressure = Math.round(currentState.pressure);
  const turns = currentState.turn;
  const score = computeFinalScore(currentState);
  if (finalScoreValueEl) finalScoreValueEl.textContent = score.toLocaleString();
  if (finalTurnsValueEl) finalTurnsValueEl.textContent = turns.toString();
  if (finalIntegrityValueEl) finalIntegrityValueEl.textContent = integrity.toString();
  if (finalPressureValueEl) finalPressureValueEl.textContent = pressure.toString();
  const scores = updateHighScores({ score, turns, integrity, pressure });
  renderHighScoreList(scores);
}

function resetBreachUI() {
  document.body.classList.remove('breach-active');
  breachOverlayEl?.classList.remove('is-active');
  if (breachTimeout) {
    window.clearTimeout(breachTimeout);
    breachTimeout = null;
  }
  breachTriggered = false;
}

function startNewRun({ showStart = false } = {}) {
  resetBreachUI();
  state = createInitialState({ seed: 4242 });
  previousState = null;
  showStartOverlay = showStart;
  showHowToOverlay = false;
  showGameOverOverlay = false;
  render();
  renderOverlays();
}

function triggerBreachSequence() {
  if (breachTriggered) return;
  breachTriggered = true;
  showStartOverlay = false;
  showHowToOverlay = false;
  showGameOverOverlay = false;
  renderOverlays();

  const rect = coreOrbEl?.getBoundingClientRect();
  if (rect && breachOverlayEl) {
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    breachOverlayEl.style.setProperty('--breach-x', `${x}px`);
    breachOverlayEl.style.setProperty('--breach-y', `${y}px`);
  }

  document.body.classList.add('breach-active');
  breachOverlayEl?.classList.add('is-active');

  breachTimeout = window.setTimeout(() => {
    breachOverlayEl?.classList.remove('is-active');
    renderGameOver(state);
    showGameOverOverlay = true;
    renderOverlays();
  }, 850);
}

function wireOverlayButtons() {
  startRunButtonEl?.addEventListener('click', () => {
    showStartOverlay = false;
    showHowToOverlay = false;
    renderOverlays();
  });
  howToButtonEl?.addEventListener('click', () => {
    showHowToOverlay = true;
    renderOverlays();
  });
  helpButtonEl?.addEventListener('click', () => {
    showHowToOverlay = true;
    renderOverlays();
  });
  howToCloseEls.forEach((button) => {
    button.addEventListener('click', () => {
      showHowToOverlay = false;
      renderOverlays();
    });
  });
  howToOverlayEl?.addEventListener('click', (event) => {
    if (event.target === howToOverlayEl) {
      showHowToOverlay = false;
      renderOverlays();
    }
  });
  backToStartButtonEl?.addEventListener('click', () => {
    startNewRun({ showStart: true });
  });
  playAgainButtonEl?.addEventListener('click', () => {
    startNewRun({ showStart: false });
  });
}

function render() {
  const prevState = previousState;
  renderHero();
  renderGrid(prevState);
  renderTray();
  if (prevState && state.integrity < prevState.integrity) {
    document.body.classList.remove('integrity-shake');
    window.clearTimeout(shakeTimeout);
    document.body.classList.add('integrity-shake');
    shakeTimeout = window.setTimeout(() => {
      document.body.classList.remove('integrity-shake');
    }, 450);
  }
  if (!breachTriggered) {
    const lossNow = state.phase === 'LOST' || state.integrity <= 0;
    const lossPreviously = prevState?.phase === 'LOST' || prevState?.integrity <= 0;
    if (lossNow && !lossPreviously) {
      triggerBreachSequence();
    }
  }
  previousState = state;
}

wireBackButton();
wireOverlayButtons();
syncWinTurns();
render();
renderOverlays();

setTimeout(() => bootSplashEl?.classList.add('hidden'), 1200);
