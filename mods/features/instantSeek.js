// Adapted from KrX3D/TizenTube's instant seek: let YouTube move its own scrub
// position and send one OK once movement stops, never while the key is held.
import { configRead, configChangeEmitter } from '../config.js';
let timer = null;
let target = null;
let held = false;
let synthetic = false;
const arrows = new Set([21, 22, 37, 39]);
function cancel() { clearTimeout(timer); timer = null; target = null; held = false; }
function progressTarget(event) {
  const active = document.activeElement;
  const bar = active?.closest?.('ytlr-progress-bar, [role="slider"]')
    || event.target?.closest?.('ytlr-progress-bar, [role="slider"]');
  const video = document.querySelector('video');
  return bar && video && !video.ended && Number.isFinite(video.duration) && video.duration > 0 ? bar : null;
}
function schedule() {
  clearTimeout(timer);
  const delay = Math.min(1500, Math.max(250, Number(configRead('instantSeekDelayMs')) || 500));
  timer = setTimeout(() => {
    const bar = target;
    if (held || !configRead('enableInstantSeek') || !bar?.isConnected
      || !(bar === document.activeElement || bar.contains(document.activeElement))) return cancel();
    cancel();
    synthetic = true;
    try {
      for (const type of ['keydown', 'keyup']) {
        const event = new KeyboardEvent(type, { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true });
        Object.defineProperties(event, { keyCode: { value: 13 }, which: { value: 13 } });
        bar.dispatchEvent(event);
      }
    } finally { synthetic = false; }
  }, delay);
}
export function handleSeekKey(event) {
  if (synthetic) return;
  if (!configRead('enableInstantSeek')) return cancel();
  const code = event.keyCode;
  if (!arrows.has(code)) return cancel();
  const bar = progressTarget(event);
  if (!bar) return cancel();
  target = bar;
  if (event.type === 'keydown') { held = true; clearTimeout(timer); }
  else if (event.type === 'keyup') { held = false; schedule(); }
}
window.addEventListener('keydown', handleSeekKey, true);
window.addEventListener('keyup', handleSeekKey, true);
window.addEventListener('blur', cancel);
window.addEventListener('hashchange', cancel);
document.addEventListener('focusout', event => { if (target?.contains(event.target)) cancel(); }, true);
configChangeEmitter.addEventListener('configChange', event => { if (event.detail.key === 'enableInstantSeek') cancel(); });
