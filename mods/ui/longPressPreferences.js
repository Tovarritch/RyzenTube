import { configRead, configWrite } from '../config.js';
import { buttonItem, showModal, overlayPanelItemListRenderer } from './ytUI.js';
import { MENUS, menuOrder } from './menuOrder.js';

export { MENU_ENTRIES, PLAYER_MENU_ENTRIES, tagMenuItem, menuOrder, arrangeMenu, playerMenuId, arrangePlayerMenu } from './menuOrder.js';

export function showMenuPreferences(action, parameters = {}) {
  const menu = MENUS[parameters.menu] ? parameters.menu : 'longPress';
  const { entries, hiddenKey, orderKey, titles } = MENUS[menu];
  const labels = Object.fromEntries(entries);
  const order = menuOrder(menu);
  if (action === 'toggle') {
    const hidden = configRead(hiddenKey).filter(id => id !== parameters.id);
    if (!configRead(hiddenKey).includes(parameters.id)) hidden.push(parameters.id);
    configWrite(hiddenKey, hidden);
    return showMenuPreferences('visibility', { menu, update: true });
  }
  if (action === 'move') {
    const index = order.indexOf(parameters.id), next = index + parameters.delta;
    if (index >= 0 && next >= 0 && next < order.length) [order[index], order[next]] = [order[next], order[index]];
    configWrite(orderKey, order);
    return showMenuPreferences('order', { menu, update: true });
  }
  const command = (action, args) => ({ customAction: { action: 'TT_MENU_PREFERENCES', parameters: { action, menu, ...args } } });
  const choosing = action === 'visibility';
  const buttons = action === 'chooseMove' ? [-1, 1].map(delta => buttonItem(
    { title: delta < 0 ? 'Move up' : 'Move down' }, { icon: delta < 0 ? 'UP_ARROW' : 'DOWN_ARROW' },
    [command('move', { id: parameters.id, delta }), { signalAction: { signal: 'POPUP_BACK' } }]
  )) : order.map(id => buttonItem(
    { title: labels[id] }, { secondaryIcon: choosing ? configRead(hiddenKey).includes(id) ? 'CHECK_BOX_OUTLINE_BLANK' : 'CHECK_BOX' : 'CHEVRON_RIGHT' },
    [command(choosing ? 'toggle' : 'chooseMove', { id })]
  ));
  showModal({ title: choosing ? titles.visibility : action === 'chooseMove' ? labels[parameters.id] : titles.order,
    subtitle: menu === 'player' ? 'Entries not listed here keep their place.' : 'YouTube’s own entries are preserved.' }, overlayPanelItemListRenderer(buttons),
  action === 'chooseMove' ? `tt-${menu}-menu-move` : `tt-${menu}-menu-${action}`, !!parameters.update);
}
