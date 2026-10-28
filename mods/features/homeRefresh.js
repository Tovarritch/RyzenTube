import { isOkActivationEvent } from '../utils/okKey.js';
const GUIDE_ENTRY = 'ytlr-guide-entry-renderer, ytlr-guide-entry';
let consuming = false;
function focusedHome(event) {
  let entry = event.target?.closest?.(GUIDE_ENTRY) || document.activeElement?.closest?.(GUIDE_ENTRY);
  if (!entry) entry = [...document.querySelectorAll(`${GUIDE_ENTRY.split(', ').map(tag => `${tag}.zylon-focus`).join(', ')}`)].pop();
  if (!entry) return false;
  const props = entry.__instance?.props;
  const data = props?.data?.guideEntryRenderer || props?.data || props?.guideEntryRenderer || props;
  const id = data?.navigationEndpoint?.browseEndpoint?.browseId;
  return ['FEtopics', 'FEwhat_to_watch', 'FEhome'].includes(id)
    || ['HOME', 'WHAT_TO_WATCH'].includes(data?.icon?.iconType) || data?.icon === 'HOME'
    || entry.querySelector('[icon="HOME"], [icon-type="HOME"]') !== null;
}
function handleHomeKey(event) {
  if (!isOkActivationEvent({ key: event.key, keyCode: event.keyCode, which: event.which, repeat: false })) return;
  if (event.type === 'keydown' && !consuming && focusedHome(event)) {
    if (event.repeat) return;
    consuming = true;
    event.preventDefault();
    event.stopImmediatePropagation();
    try { window.sessionStorage.setItem('tt-explicit-home-refresh', '1'); } catch (_) {}
    // Let the key dispatch finish before reloading. A same-document hash
    // navigation followed immediately by reload can cancel the reload in Cobalt.
    const navigate = window.location.hash !== '#/';
    if (navigate) window.location.hash = '#/';
    setTimeout(() => window.location.reload(), navigate ? 250 : 50);
  }
  if (!consuming) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (event.type === 'keyup') consuming = false;
}
for (const type of ['keydown', 'keypress', 'keyup']) window.addEventListener(type, handleHomeKey, true);
window.addEventListener('blur', () => { consuming = false; });
