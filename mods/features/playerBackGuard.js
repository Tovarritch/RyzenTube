import { configRead } from '../config.js';
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
function stop(event) { event.preventDefault(); event.stopImmediatePropagation(); }
function handle(event) {
  if (!isBack(event)) { if (event.type === 'keydown') armedAt = 0; return; }
  if (event.type !== 'keydown') {
    if (swallow) stop(event);
    if (event.type === 'keyup') { swallow = false; passing = false; }
    return;
  }
  if (swallow) return stop(event);
  if (passing) return;
  if (!configRead('enableDoubleBackExit') || !inFullPlayer()) { armedAt = 0; return; }
  const active = document.activeElement;
  if (active?.closest('ytlr-overlay-section-renderer, ytlr-overlay-panel-renderer, [role="dialog"], input, textarea')) { armedAt = 0; return; }
  if (event.repeat) return stop(event);
  const now = Date.now();
  if (armedAt && now - armedAt <= 2000) { armedAt = 0; passing = true; return; }
  armedAt = now;
  const progress = document.querySelector('ytlr-progress-bar');
  // Let the first Back close visible player controls. When controls are already
  // hidden, block the navigation itself until the confirming second press.
  if (progress?.getAttribute('hybridnavfocusable') === 'true' && visible(progress)) passing = true;
  else { swallow = true; stop(event); }
}
for (const type of ['keydown', 'keypress', 'keyup']) window.addEventListener(type, handle, true);
window.addEventListener('blur', () => { armedAt = 0; passing = false; swallow = false; });
window.addEventListener('hashchange', () => { armedAt = 0; });
