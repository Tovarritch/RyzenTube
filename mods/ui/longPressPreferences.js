import { configRead, configWrite } from '../config.js';
import { buttonItem, showModal, overlayPanelItemListRenderer } from './ytUI.js';

export const MENU_ENTRIES = [
  ['play', 'Play'], ['watchLater', 'Save to Watch Later'], ['playlist', 'Save to Playlist'],
  ['queue', 'Add to Queue'], ['channel', 'Go to Channel'],
  ['notInterested', 'Not interested'], ['dontRecommendChannel', 'Don’t recommend channel'],
  ['blockChannel', 'Hide channel locally'],
];
export function tagMenuItem(item, id) { item.__ttMenuId = id; return item; }
export function menuOrder() {
  const valid = MENU_ENTRIES.map(([id]) => id);
  return [...new Set([...(configRead('longPressMenuOrder') || []), ...valid])].filter(id => valid.includes(id));
}
export function arrangeMenu(items) {
  const hidden = configRead('longPressMenuHidden') || [];
  const order = menuOrder();
  const tagged = items.filter(item => item.__ttMenuId && !hidden.includes(item.__ttMenuId));
  tagged.sort((a, b) => order.indexOf(a.__ttMenuId) - order.indexOf(b.__ttMenuId));
  let index = 0;
  // Only replace slots owned by this fork. Native items keep their identity
  // and relative position; only hidden fork slots are removed.
  return items.flatMap(item => !item.__ttMenuId ? [item]
    : hidden.includes(item.__ttMenuId) ? [] : [tagged[index++]]);
}
export function showMenuPreferences(action, parameters = {}) {
  const labels = Object.fromEntries(MENU_ENTRIES);
  const order = menuOrder();
  if (action === 'toggle') {
    const hidden = configRead('longPressMenuHidden').filter(id => id !== parameters.id);
    if (!configRead('longPressMenuHidden').includes(parameters.id)) hidden.push(parameters.id);
    configWrite('longPressMenuHidden', hidden);
    return showMenuPreferences('visibility', { update: true });
  }
  if (action === 'move') {
    const index = order.indexOf(parameters.id), next = index + parameters.delta;
    if (index >= 0 && next >= 0 && next < order.length) [order[index], order[next]] = [order[next], order[index]];
    configWrite('longPressMenuOrder', order);
    return showMenuPreferences('order', { update: true });
  }
  const command = (action, args) => ({ customAction: { action: 'TT_MENU_PREFERENCES', parameters: { action, ...args } } });
  const choosing = action === 'visibility';
  const buttons = action === 'chooseMove' ? [-1, 1].map(delta => buttonItem(
    { title: delta < 0 ? 'Move up' : 'Move down' }, { icon: delta < 0 ? 'UP_ARROW' : 'DOWN_ARROW' },
    [command('move', { id: parameters.id, delta }), { signalAction: { signal: 'POPUP_BACK' } }]
  )) : order.map(id => buttonItem(
    { title: labels[id] }, { secondaryIcon: choosing ? configRead('longPressMenuHidden').includes(id) ? 'CHECK_BOX_OUTLINE_BLANK' : 'CHECK_BOX' : 'CHEVRON_RIGHT' },
    [command(choosing ? 'toggle' : 'chooseMove', { id })]
  ));
  showModal({ title: choosing ? 'Long Press Menu Entries' : action === 'chooseMove' ? labels[parameters.id] : 'Sort Long Press Menu',
    subtitle: 'YouTube’s own entries are preserved.' }, overlayPanelItemListRenderer(buttons),
  action === 'chooseMove' ? 'tt-menu-move' : `tt-menu-${action}`, !!parameters.update);
}
