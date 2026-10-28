import { configRead, configChangeEmitter } from '../config.js';

function membership(node) {
  if (!node || typeof node !== 'object') return false;
  return Object.keys(node).some(key => /^(?:ypcGetOffersEndpoint|ypcGetMembershipOfferEndpoint|sponsorships?Endpoint)$/.test(key)
    || membership(node[key]));
}
export function shouldHidePlayerButton(button) {
  if (!configRead('enablePatchingVideoPlayer') || !configRead('hidePlayerJoinButton')) return false;
  return /TRANSPORT_CONTROLS_BUTTON_TYPE_(?:SPONSORSHIPS|MEMBERSHIP|JOIN)/.test(String(button?.type || ''))
    || membership(button);
}
export function patchPlayerButtons(response) {
  if (!response || !configRead('enablePatchingVideoPlayer')) return response;
  const controls = response.transportControls?.transportControlsRenderer;
  if (!controls) return response;
  if (!configRead('enablePreviousNextButtons')) {
    for (const slot of ['skipPreviousButton', 'skipNextButton', 'previousButton', 'nextButton']) delete controls[slot];
  }
  for (const key of Object.keys(controls)) {
    if (Array.isArray(controls[key])) controls[key] = controls[key].filter(item => !shouldHidePlayerButton(item)
      && (configRead('enablePreviousNextButtons') || !/^TRANSPORT_CONTROLS_BUTTON_TYPE_(?:SKIP_NEXT|SKIP_PREVIOUS|PREVIOUS|NEXT)$/.test(item?.type)));
  }
  return response;
}

// Also update a player already open when a preference changes.
const saved = new Map();
function refreshVisibility() {
  const enabled = configRead('enablePatchingVideoPlayer');
  const controls = document.querySelectorAll('ytlr-player-controls yt-icon-button, ytlr-player-controls ytlr-button-renderer, ytlr-player-actions-container yt-icon-button, ytlr-player-actions-container ytlr-button-renderer');
  for (const element of controls) {
    const props = element.__instance?.props;
    const id = `${element.getAttribute('idomkey') || ''} ${props?.icon || ''}`;
    const hide = enabled && ((!configRead('enablePreviousNextButtons') && /skip[-_ ]?(?:next|previous)|SKIP_NEXT|SKIP_PREVIOUS/i.test(id))
      || (configRead('hidePlayerJoinButton') && membership(props?.data || props?.command)));
    if (hide && !saved.has(element)) {
      saved.set(element, { style: element.getAttribute('style'), focus: element.getAttribute('hybridnavfocusable') });
      element.style.setProperty('display', 'none', 'important');
      element.setAttribute('hybridnavfocusable', 'false');
    } else if (!hide && saved.has(element)) {
      const original = saved.get(element);
      if (original.style === null) element.removeAttribute('style'); else element.setAttribute('style', original.style);
      if (original.focus === null) element.removeAttribute('hybridnavfocusable'); else element.setAttribute('hybridnavfocusable', original.focus);
      saved.delete(element);
    }
  }
  for (const [element] of saved) if (!element.isConnected) saved.delete(element);
}
let scheduled = false;
function schedule() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => { scheduled = false; refreshVisibility(); });
}
if (typeof document !== 'undefined' && document.body) {
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  configChangeEmitter.addEventListener('configChange', schedule);
  schedule();
}
