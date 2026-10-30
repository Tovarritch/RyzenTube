import { configRead, configWrite, configChangeEmitter } from '../config.js';
import { showModal, showToast, buttonItem, overlayPanelItemListRenderer } from '../ui/ytUI.js';
import { VOLUME_BOOST_LEVELS, boostLabel, boostRequestUrl } from '../utils/volumeBoostUrl.js';
import resolveCommand from '../resolveCommand.js';

export { VOLUME_BOOST_LEVELS, boostLabel };

// Volume boost: louder than 100%.
//
// Video sound on the TV goes from the media pipeline straight to Android's
// audio output and never through the page's Web Audio (routing the video into
// Web Audio leaves it unchanged or silent). So the APK does the boosting: a
// loudness enhancer on each audio track Cobalt creates (android/VolumeBoost.java).
// The page only tells it the level, over a loopback request.

export function updateBoost() {
  // An APK without the bridge just refuses the connection; nothing to undo.
  if (!window.h5vcc) return Promise.resolve(false);
  return fetch(boostRequestUrl(configRead('volumeBoost')))
    .then(response => response.ok)
    .catch(() => false);
}

export function showVolumeBoost() {
  const current = Number(configRead('volumeBoost')) || 1;
  const buttons = VOLUME_BOOST_LEVELS.map(level => buttonItem(
    { title: level === 1 ? '100% (off)' : boostLabel(level) },
    { icon: 'VOLUME_UP', secondaryIcon: level === current ? 'RADIO_BUTTON_CHECKED' : 'RADIO_BUTTON_UNCHECKED' },
    [{ customAction: { action: 'TT_VOLUME_BOOST_SET', parameters: level } }]
  ));
  showModal({ title: 'Volume boost', subtitle: 'Louder than 100%. Loud parts are kept from distorting.' },
    overlayPanelItemListRenderer(buttons, Math.max(0, VOLUME_BOOST_LEVELS.indexOf(current))), 'tt-volume-boost');
}

// The picker sits on the player's settings menu. Close only the picker; the
// menu below stays open (the user closes it) and its Volume boost line is
// updated in place, since YouTube does not redraw that menu by itself.
function isBoostEntry(element) {
  const commands = element.__instance?.props?.data?.serviceEndpoint?.commandExecutorCommand?.commands || [];
  return commands.some(command => command?.customAction?.action === 'TT_VOLUME_BOOST_SHOW');
}
function relabelMenu(label) {
  for (const entry of document.querySelectorAll('ytlr-compact-link-renderer')) {
    if (!isBoostEntry(entry)) continue;
    const data = entry.__instance.props.data;
    if (data.subtitle) data.subtitle.simpleText = label;
    for (const node of entry.querySelectorAll('*')) {
      if (!node.children.length && /^\d+%$/.test(node.textContent.trim())) node.textContent = label;
    }
  }
}
function closePicker(label) {
  resolveCommand({ signalAction: { signal: 'POPUP_BACK' } });
  // Once the menu below is back on screen.
  setTimeout(() => relabelMenu(label), 300);
}

export function setVolumeBoost(level) {
  if (!VOLUME_BOOST_LEVELS.includes(Number(level))) return;
  closePicker(boostLabel(Number(level)));
  configWrite('volumeBoost', Number(level));
  updateBoost().then(applied => showToast('Volume boost',
    applied ? (Number(level) > 1 ? boostLabel(level) : 'Off') : 'Needs the latest TizenTube app (APK)'));
}

if (typeof document !== 'undefined') {
  configChangeEmitter.addEventListener('configChange', event => {
    if (event.detail.key === 'volumeBoost') updateBoost();
  });
  // The APK starts at 100%; restore the chosen level.
  updateBoost();
}
