import { configRead } from '../config.js';
import resolveCommand from '../resolveCommand.js';
let armedAt = 0;
let swallow = false;
let passing = false;
const isBack = event => ['Escape', 'Backspace', 'BrowserBack', 'GoBack'].includes(event.key) || [4, 8, 27, 461, 10009].includes(event.keyCode);
function visible(element) {
  if (!element?.getClientRects().length) return false;
  for (let node = element; node && node !== document.body; node = node.parentElement) {
    const css = getComputedStyle(node);
    if (css.display === 'none' || css.visibility === 'hidden' || css.opacity === '0' || node.hidden) return false;
  }
  return true;
}
export function inFullPlayer() {
  return visible(document.querySelector('ytlr-watch-default, ytlr-watch-page'))
    || /^#?\/?watch(?:[/?]|$)/.test(location.hash);
}
// While the controls are up, focus sits inside the watch page (seek bar,
// buttons, related videos). Once they hide, YouTube moves it to the overlay stage.
export function controlsShown() {
  const active = document.activeElement;
  if (!active?.closest('ytlr-watch-default, ytlr-watch-page')) return false;
  const progress = document.querySelector('ytlr-progress-bar');
  if (progress?.contains(active) && progress.getAttribute('hybridnavfocusable') === 'false') return false;
  return !progress || visible(progress);
}
// Any direction key brings the controls back with focus on the seek bar.
// Up does so without seeking or pausing.
function revealControls() {
  const target = document.activeElement || document.body;
  for (const type of ['keydown', 'keyup']) {
    const event = new KeyboardEvent(type, { key: 'ArrowUp', code: 'ArrowUp', bubbles: true, cancelable: true });
    Object.defineProperties(event, { keyCode: { value: 38 }, which: { value: 38 } });
    target.dispatchEvent(event);
  }
}
function stop(event) { event.preventDefault(); event.stopImmediatePropagation(); }
function leavePlayer(event) {
  swallow = true;
  stop(event);
  resolveCommand({ signalAction: { signal: 'HISTORY_BACK' } });
}
function handle(event) {
  if (!isBack(event)) { if (event.type === 'keydown') armedAt = 0; return; }
  if (event.type !== 'keydown') {
    if (swallow) stop(event);
    if (event.type === 'keyup') { swallow = false; passing = false; }
    return;
  }
  if (swallow) return stop(event);
  if (passing) return;
  const confirm = configRead('enableDoubleBackExit');
  const reveal = configRead('enableBackRevealsControls');
  if ((!confirm && !reveal) || !inFullPlayer()) { armedAt = 0; return; }
  const active = document.activeElement;
  if (active?.closest('ytlr-overlay-section-renderer, ytlr-overlay-panel-renderer, [role="dialog"], input, textarea')) { armedAt = 0; return; }
  if (event.repeat) return stop(event);
  const now = Date.now();
  const shown = controlsShown();
  if (armedAt && now - armedAt <= 2000) {
    // Confirmed: leave the player. With the controls up a plain Back would
    // only hide them, so navigate back directly.
    armedAt = 0;
    if (shown) return leavePlayer(event);
    passing = true;
    return;
  }
  if (!shown && reveal) {
    // First Back on a bare video shows the controls instead of leaving.
    swallow = true;
    stop(event);
    revealControls();
    // After the synthetic Up, which would otherwise disarm the confirmation.
    armedAt = confirm ? now : 0;
    return;
  }
  if (shown && reveal && !confirm) return leavePlayer(event);
  if (!confirm) return;
  armedAt = now;
  // Let the first Back close visible player controls. When controls are already
  // hidden, block the navigation itself until the confirming second press.
  if (shown) passing = true;
  else { swallow = true; stop(event); }
}
for (const type of ['keydown', 'keypress', 'keyup']) window.addEventListener(type, handle, true);
window.addEventListener('blur', () => { armedAt = 0; passing = false; swallow = false; });
window.addEventListener('hashchange', () => { armedAt = 0; });
