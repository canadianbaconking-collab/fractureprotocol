import { GAME_CONFIG } from './config.js';

function formatSigned(value) {
  return value > 0 ? `+${value}` : `${value}`;
}

function parsePurgePattern(pattern) {
  if (!pattern) return '';
  return pattern.split('-')[0];
}

export function getModuleDeltaSummary(moduleId, state) {
  const config = state?.config ?? GAME_CONFIG;
  const badges = [];
  let title = moduleId;

  switch (moduleId) {
    case 'PUMP':
      title = 'Pump';
      badges.push({
        label: 'Pressure',
        value: formatSigned(-config.pumpPressureReduction),
        tone: 'positive',
      });
      break;
    case 'SHIELD_CORE':
      title = 'Shield Core';
      badges.push({
        label: 'Leak Damage',
        value: `${formatSigned(-config.shieldLeakMitigation)}/source`,
        tone: 'positive',
      });
      break;
    case 'PURGE': {
      title = 'Purge Unit';
      const pattern = parsePurgePattern(config.purgePattern);
      badges.push({
        label: 'Hazards',
        value: pattern ? `clear ${pattern}` : 'clear',
        tone: 'positive',
      });
      break;
    }
    case 'CYCLER':
      title = 'Cycler';
      badges.push({
        label: 'Tray',
        value: 'reroll',
        tone: 'neutral',
      });
      break;
    case 'BRACE':
      title = 'Brace';
      badges.push({
        label: 'Footprint',
        value: 'block space',
        tone: 'neutral',
      });
      break;
    default:
      title = moduleId ?? 'Module';
      break;
  }

  return { title, badges };
}
