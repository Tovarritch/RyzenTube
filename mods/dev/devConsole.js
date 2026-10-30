// DEBUG BUNDLE ONLY (dbgs/userScript.js, loaded by debug APKs). Never in
// dist/userScript.js. Runs JavaScript sent from the PC (scripts/tv.py) through
// the debug APK's loopback DevConsole and sends back the result.
import { configRead, configWrite } from '../config.js';
import resolveCommand from '../resolveCommand.js';

const BASE = 'http://127.0.0.1:18946';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Helpers available to commands as `tt`.
window.tt = {
  get: key => configRead(key),
  set: (key, value) => { configWrite(key, value); return configRead(key); },
  cmd: command => resolveCommand(command),
  // Short description of elements: tag, idomkey, classes and box.
  el(selector, limit = 10) {
    return [...document.querySelectorAll(selector)].slice(0, limit).map(e => {
      const r = e.getBoundingClientRect();
      return `${e.tagName.toLowerCase()}${e.getAttribute('idomkey') ? `[${e.getAttribute('idomkey')}]` : ''}`
        + ` x=${Math.round(r.left)} y=${Math.round(r.top)} w=${Math.round(r.width)} h=${Math.round(r.height)}`
        + ` text="${(e.innerText || '').slice(0, 60).replace(/\s+/g, ' ')}"`;
    });
  },
  text: (selector = 'body') => (document.querySelector(selector)?.innerText || '').slice(0, 4000),
};

function serialize(value, depth = 0, seen = new WeakSet()) {
  if (value === undefined) return '(undefined)';
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Element) return value.outerHTML.slice(0, 2000);
  if (seen.has(value) || depth > 6) return '[…]';
  seen.add(value);
  if (Array.isArray(value)) return value.slice(0, 200).map(v => serialize(v, depth + 1, seen));
  const out = {};
  for (const key of Object.keys(value).slice(0, 200)) {
    try { out[key] = serialize(value[key], depth + 1, seen); } catch (e) { out[key] = `[${e}]`; }
  }
  return out;
}

async function run(code) {
  try {
    const value = await new Function(`return (async () => {\n${code}\n})()`)();
    return { ok: true, value: serialize(value) };
  } catch (error) {
    return { ok: false, error: String(error && error.stack || error) };
  }
}

async function loop() {
  for (;;) {
    try {
      const response = await fetch(`${BASE}/poll`);
      if (response.status === 200) {
        const { id, code } = await response.json();
        const result = await run(code);
        // text/plain keeps this a simple request (no CORS preflight).
        await fetch(`${BASE}/result?id=${encodeURIComponent(id)}`, {
          method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(result),
        });
      } else if (response.status !== 204) {
        await sleep(3000);
      }
    } catch (_) {
      await sleep(5000);
    }
  }
}
loop();
