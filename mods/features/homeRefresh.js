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
  return ['FEwhat_to_watch', 'FEhome'].includes(id)
    || data?.icon?.iconType === 'HOME' || data?.icon === 'HOME'
    || entry.querySelector('[icon="HOME"], [icon-type="HOME"]') !== null;
}
function handleHomeKey(event) {
  if (!isOkActivationEvent({ key: event.key, keyCode: event.keyCode, which: event.which, repeat: false })) return;
  if (event.type === 'keydown' && !consuming && focusedHome(event)) {
    if (event.repeat) return;
    consuming = true;
    // Boot YouTube on Home, including when Home was selected from Library.
    window.location.hash = '#/';
    window.location.reload();
  }
  if (!consuming) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (event.type === 'keyup') consuming = false;
}
for (const type of ['keydown', 'keypress', 'keyup']) window.addEventListener(type, handleHomeKey, true);
window.addEventListener('blur', () => { consuming = false; });
