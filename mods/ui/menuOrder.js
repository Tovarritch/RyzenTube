import { configRead } from '../config.js';

export const MENU_ENTRIES = [
  ['play', 'Play'], ['watchLater', 'Save to Watch Later'], ['playlist', 'Save to Playlist'],
  ['queue', 'Add to Queue'], ['channel', 'Go to Channel'],
  ['notInterested', 'Not interested'], ['dontRecommendChannel', 'Don’t recommend channel'],
  ['blockChannel', 'Hide channel locally'],
];
// Entries of the player's Settings (gear) menu. Entries YouTube adds that are
// not listed here keep their place and cannot be hidden. Listed in the order
// the menu shows them, which stays untouched until the entries are sorted.
export const PLAYER_MENU_ENTRIES = [
  ['quality', 'Quality'], ['captions', 'Captions'], ['miniPlayer', 'Mini Player'],
  ['pip', 'Picture in Picture'], ['screenOff', 'Turn off screen'], ['share', 'Share'],
  ['audio', 'Audio'], ['speed', 'Speed'], ['loop', 'Loop'], ['report', 'Report'],
  ['feedback', 'Feedback'], ['stats', 'Stats for nerds'],
];
export const MENUS = {
  longPress: { entries: MENU_ENTRIES, hiddenKey: 'longPressMenuHidden', orderKey: 'longPressMenuOrder',
    titles: { visibility: 'Long Press Menu Entries', order: 'Sort Long Press Menu' } },
  player: { entries: PLAYER_MENU_ENTRIES, hiddenKey: 'playerMenuHidden', orderKey: 'playerMenuOrder',
    titles: { visibility: 'Player Settings Menu Entries', order: 'Sort Player Settings' } },
};
export function tagMenuItem(item, id) { item.__ttMenuId = id; return item; }
export function menuOrder(menu = 'longPress') {
  const { entries, orderKey } = MENUS[menu];
  const valid = entries.map(([id]) => id);
  return [...new Set([...(configRead(orderKey) || []), ...valid])].filter(id => valid.includes(id));
}
export function arrangeMenu(items, menu = 'longPress') {
  const hidden = configRead(MENUS[menu].hiddenKey) || [];
  const order = menuOrder(menu);
  const tagged = items.filter(item => item.__ttMenuId && !hidden.includes(item.__ttMenuId));
  const sorted = menu !== 'player' || (configRead(MENUS[menu].orderKey) || []).length > 0;
  if (sorted) tagged.sort((a, b) => order.indexOf(a.__ttMenuId) - order.indexOf(b.__ttMenuId));
  let index = 0;
  // Only replace slots owned by this fork. Native items keep their identity
  // and relative position; only hidden fork slots are removed.
  return items.flatMap(item => !item.__ttMenuId ? [item]
    : hidden.includes(item.__ttMenuId) ? [] : [tagged[index++]]);
}

// Identifies an entry of the player's Settings menu by what it does.
export function playerMenuId(item) {
  if (item?.playlistLoopButtonRenderer) return 'loop';
  const link = item?.compactLinkRenderer;
  if (!link) return null;
  const endpoint = link.serviceEndpoint || {};
  const overlay = endpoint.openClientOverlayAction?.type || '';
  const actions = (endpoint.commandExecutorCommand?.commands || [endpoint])
    .map(command => command?.customAction?.action || command?.signalAction?.customAction?.action).filter(Boolean);
  const icon = link.icon?.iconType || '';
  if (/VIDEO_QUALITY/.test(overlay)) return 'quality';
  if (/CAPTIONS/.test(overlay) || icon === 'CAPTIONS') return 'captions';
  if (/AUDIO/.test(overlay) || icon === 'VOLUME_UP') return 'audio';
  if (actions.includes('TT_SPEED_SETTINGS_SHOW') || icon === 'SPEEDOMETER' || icon === 'SLOW_MOTION_VIDEO') return 'speed';
  if (actions.includes('ENTER_MP')) return 'miniPlayer';
  if (actions.includes('ENTER_PIP')) return 'pip';
  if (actions.includes('SCREEN_OFF')) return 'screenOff';
  if (actions.includes('SHARE')) return 'share';
  if (/VIDEO_REPORTING/.test(overlay)) return 'report';
  if (/SEND_FEEDBACK/.test(overlay)) return 'feedback';
  if (endpoint.signalAction?.signal === 'TOGGLE_VIDEO_INFO') return 'stats';
  return null;
}
export function arrangePlayerMenu(items) {
  if (!Array.isArray(items)) return items;
  for (const item of items) {
    const id = playerMenuId(item);
    if (id) tagMenuItem(item, id);
  }
  return arrangeMenu(items, 'player');
}
