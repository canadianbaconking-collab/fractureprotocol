import { GRID_SIZE, MODULE_DEFS, MODULE_ORDER, RELIC_IDS } from '../game/config.js';
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
const winOverlayEl = document.getElementById('winOverlay');
const winTerminalEl = document.getElementById('winTerminal');
const winPulseEl = document.getElementById('winPulse');
const winScoreValueEl = document.getElementById('winScoreValue');
const winRestartButtonEl = document.getElementById('winRestartButton');
const startRunButtonEl = document.getElementById('startRunButton');
const howToButtonEl = document.getElementById('howToButton');
const helpButtonEl = document.getElementById('helpButton');
const playAgainButtonEl = document.getElementById('playAgainButton');
const howToCloseEls = document.querySelectorAll('[data-close-howto]');
const winTurnsEls = document.querySelectorAll('[data-win-turns]');
const winTurnsLineEls = document.querySelectorAll('[data-win-turns-line]');
const moduleDeltaNameEl = document.getElementById('moduleDeltaName');
const moduleDeltaBadgesEl = document.getElementById('moduleDeltaBadges');
const moduleDeltaPanelEl = document.getElementById('moduleDeltaPanel');
const finalScoreValueEl = document.getElementById('finalScoreValue');
const highScoreListEl = document.getElementById('highScoreList');
const relicTrayEl = document.getElementById('relicTray');

let state = createInitialState({ seed: 4242 });
let previousState = null;
let showStartOverlay = true;
let showHowToOverlay = false;
let showGameOverOverlay = false;
let showWinOverlay = false;
let shakeTimeout = null;
let hoveredModuleId = null;
let lastDeltaModuleId = null;
let breachTriggered = false;
let breachTimeout = null;
let winTriggered = false;
let winTimeouts = [];
let winMosaicColors = null;
let winOrigin = { x: (GRID_SIZE - 1) / 2, y: (GRID_SIZE - 1) / 2 };

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

const CAKE_MOSAIC_SRC = '';
const cakeImage = new Image();
cakeImage.src = CAKE_MOSAIC_SRC;
cakeImage.decoding = 'async';

function loadCakeMosaicColors() {
  return new Promise((resolve) => {
    if (!CAKE_MOSAIC_SRC) {
      resolve(null);
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = GRID_SIZE;
    canvas.height = GRID_SIZE;
    const ctx = canvas.getContext('2d');
    const handleLoad = () => {
      if (!ctx) return resolve(null);
      ctx.clearRect(0, 0, GRID_SIZE, GRID_SIZE);
      ctx.drawImage(cakeImage, 0, 0, GRID_SIZE, GRID_SIZE);
      const imageData = ctx.getImageData(0, 0, GRID_SIZE, GRID_SIZE);
      const colors = [];
      for (let i = 0; i < imageData.data.length; i += 4) {
        const r = imageData.data[i];
        const g = imageData.data[i + 1];
        const b = imageData.data[i + 2];
        colors.push(`rgb(${r}, ${g}, ${b})`);
      }
      resolve(colors);
    };
    if (cakeImage.complete) {
      handleLoad();
    } else {
      cakeImage.addEventListener('load', handleLoad, { once: true });
      cakeImage.addEventListener('error', () => resolve(null), { once: true });
    }
  });
}

function renderGrid(prevState) {
  gridEl.innerHTML = '';
  const showMosaic = winTriggered && winMosaicColors;
  const origin = winOrigin;
  for (let y = 0; y < state.grid.length; y += 1) {
    for (let x = 0; x < state.grid[y].length; x += 1) {
      const cell = state.grid[y][x];
      const prevCell = prevState?.grid?.[y]?.[x] ?? null;
      const isNewHazard = cell.hazard && !prevCell?.hazard;
      const resonance = state.resonanceMap?.[y]?.[x];
      const prevResonance = prevState?.resonanceMap?.[y]?.[x];
      const button = document.createElement('button');
      button.className = 'cell';
      if (cell.module) {
        button.classList.add('module', `module-${modulePalette(cell.module)}`);
      }
      if (cell.shielded) button.classList.add('shielded');
      if (cell.containmentWallTurns > 0) button.classList.add('containment-wall');
      if (cell.stabilityFieldTurns > 0) button.classList.add('stability-field');
      if (cell.synergyLinkType) button.classList.add(`synergy-${cell.synergyLinkType.toLowerCase()}`);
      if (cell.hazard === 'CORRUPTION') button.classList.add('hazard-corruption');
      if (cell.hazard === 'LEAK') button.classList.add('hazard-leak');
      if (cell.hazard === 'CORRUPTION' && cell.hazardType) {
        button.classList.add(`hazard-corruption-${cell.hazardType.toLowerCase()}`);
      }
      if (isNewHazard) button.classList.add('hazard-spawn');
      if (resonance?.revealed) {
        button.classList.add('resonance-revealed', `resonance-${resonance.type.toLowerCase()}`);
        if (!prevResonance?.revealed) button.classList.add('resonance-activate');
      }
      if (showMosaic) {
        const index = y * GRID_SIZE + x;
        const distance = Math.hypot(x - origin.x, y - origin.y);
        const delay = Math.round(distance * 80);
        button.classList.add('win-mosaic');
        button.style.setProperty('--mosaic-color', winMosaicColors[index] ?? '#101b3b');
        button.style.setProperty('--mosaic-delay', `${delay}ms`);
      }
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

function renderRelics() {
  if (!relicTrayEl) return;
  relicTrayEl.innerHTML = '';
  const entries = RELIC_IDS.filter((id) => state.relics?.[id]);
  if (!entries.length) return;
  entries.forEach((id) => {
    const icon = document.createElement('span');
    icon.className = 'relic-icon';
    const label = id === 'PURIFIER_LENS'
      ? 'PL'
      : id === 'STRUCTURAL_MEMORY'
        ? 'SM'
        : 'ED';
    icon.textContent = label;
    icon.title = id.replace('_', ' ');
    relicTrayEl.append(icon);
  });
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
  if (winOverlayEl) {
    winOverlayEl.classList.toggle('is-active', showWinOverlay);
    winOverlayEl.setAttribute('aria-hidden', (!showWinOverlay).toString());
  }
  document.body.classList.toggle('game-over-active', showGameOverOverlay);
  document.body.classList.toggle('win-overlay-active', showWinOverlay);
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
    scoreText.className = 'score-value mono';
    item.append(scoreText);
    highScoreListEl.append(item);
  });
}

function renderGameOver(currentState) {
  const integrity = Math.max(0, Math.round(currentState.integrity));
  const pressure = Math.round(currentState.pressure);
  const turns = currentState.turn;
  const score = computeFinalScore(currentState);
  if (finalScoreValueEl) finalScoreValueEl.textContent = score.toLocaleString();
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

function resetWinUI() {
  winTriggered = false;
  showWinOverlay = false;
  winTerminalEl?.replaceChildren();
  document.body.classList.remove('win-terminal-active', 'win-pulse-active', 'win-mosaic-active');
  if (winPulseEl) {
    winPulseEl.style.removeProperty('--win-x');
    winPulseEl.style.removeProperty('--win-y');
  }
  winTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
  winTimeouts = [];
}

function startNewRun({ showStart = false } = {}) {
  resetBreachUI();
  resetWinUI();
  state = createInitialState({ seed: 4242 });
  previousState = null;
  showStartOverlay = showStart;
  showHowToOverlay = false;
  showGameOverOverlay = false;
  showWinOverlay = false;
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

    const targets = document.querySelectorAll('.hero, .grid-panel, .tray-panel');
    targets.forEach((target) => {
      const tRect = target.getBoundingClientRect();
      const cx = tRect.left + tRect.width / 2;
      const cy = tRect.top + tRect.height / 2;
      const dx = cx - x;
      const dy = cy - y;
      const dist = Math.max(1, Math.hypot(dx, dy));
      const magnitude = 80;
      const tx = (dx / dist) * magnitude;
      const ty = (dy / dist) * magnitude;
      const rot = ((dx - dy) / dist) * 4;
      target.style.setProperty('--blast-dx', `${tx}px`);
      target.style.setProperty('--blast-dy', `${ty}px`);
      target.style.setProperty('--blast-rot', `${rot}deg`);
    });
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

function typeTerminalLines(lines, speed = 35) {
  if (!winTerminalEl) return Promise.resolve();
  winTerminalEl.replaceChildren();
  document.body.classList.add('win-terminal-active');
  let lineIndex = 0;
  let charIndex = 0;

  return new Promise((resolve) => {
    const lineEls = lines.map(() => {
      const lineEl = document.createElement('span');
      lineEl.className = 'win-terminal-line';
      winTerminalEl.append(lineEl);
      return lineEl;
    });

    const step = () => {
      if (lineIndex >= lines.length) {
        resolve();
        return;
      }
      const currentLine = lines[lineIndex];
      lineEls[lineIndex].textContent = currentLine.slice(0, charIndex + 1);
      charIndex += 1;
      if (charIndex >= currentLine.length) {
        lineIndex += 1;
        charIndex = 0;
        winTimeouts.push(window.setTimeout(step, 220));
      } else {
        winTimeouts.push(window.setTimeout(step, speed));
      }
    };
    step();
  });
}

function triggerWinSequence() {
  if (winTriggered) return;
  winTriggered = true;
  showGameOverOverlay = false;
  showWinOverlay = false;
  renderOverlays();

  const coreRect = coreOrbEl?.getBoundingClientRect();
  const gridRect = gridEl?.getBoundingClientRect();
  if (coreRect && winPulseEl) {
    const x = coreRect.left + coreRect.width / 2;
    const y = coreRect.top + coreRect.height / 2;
    winPulseEl.style.setProperty('--win-x', `${x}px`);
    winPulseEl.style.setProperty('--win-y', `${y}px`);
  }
  if (coreRect && gridRect) {
    const gridX = (coreRect.left + coreRect.width / 2 - gridRect.left) / gridRect.width;
    const gridY = (coreRect.top + coreRect.height / 2 - gridRect.top) / gridRect.height;
    winOrigin = {
      x: Math.min(GRID_SIZE - 1, Math.max(0, gridX * (GRID_SIZE - 1))),
      y: Math.min(GRID_SIZE - 1, Math.max(0, gridY * (GRID_SIZE - 1))),
    };
  }

  typeTerminalLines(['> CORE STABILIZED', '> CONTAINMENT CERTIFIED']).then(() => {
    document.body.classList.add('win-pulse-active');
    winTimeouts.push(window.setTimeout(() => {
      document.body.classList.add('win-mosaic-active');
      render();
    }, 400));

    winTimeouts.push(window.setTimeout(() => {
      const score = computeFinalScore(state);
      if (winScoreValueEl) winScoreValueEl.textContent = score.toLocaleString();
      showWinOverlay = true;
      renderOverlays();
    }, 1500));
  });
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
  playAgainButtonEl?.addEventListener('click', () => {
    startNewRun({ showStart: false });
  });
  winRestartButtonEl?.addEventListener('click', () => {
    startNewRun({ showStart: false });
  });
}

function render() {
  const prevState = previousState;
  renderHero();
  renderGrid(prevState);
  renderTray();
  renderRelics();
  if (prevState && state.integrity < prevState.integrity) {
    document.body.classList.remove('integrity-shake');
    window.clearTimeout(shakeTimeout);
    document.body.classList.add('integrity-shake');
    shakeTimeout = window.setTimeout(() => {
      document.body.classList.remove('integrity-shake');
    }, 450);
  }
  if (!winTriggered) {
    const winNow = state.phase === 'WON';
    const winPreviously = prevState?.phase === 'WON';
    if (winNow && !winPreviously) {
      triggerWinSequence();
    }
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
loadCakeMosaicColors().then((colors) => {
  winMosaicColors = colors;
});
