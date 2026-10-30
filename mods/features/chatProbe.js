// TEMPORARY: prints the live chat overlay's structure on screen for development
// on the TV (no developer console there). Remove before a release.
function describe(el) {
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return `${el.tagName.toLowerCase()}${el.getAttribute('idomkey') ? '[' + el.getAttribute('idomkey') + ']' : ''}.${String(el.className || '').trim().split(/\s+/).slice(0, 3).join('.')} `
    + `pos=${cs.position} x=${Math.round(r.left)} y=${Math.round(r.top)} w=${Math.round(r.width)} h=${Math.round(r.height)} `
    + `st="${(el.getAttribute('style') || '').slice(0, 60)}" kids=${el.children.length}`;
}
function probe() {
  let box = document.getElementById('tt-chat-probe');
  const chats = [...document.querySelectorAll('body *')].filter(e => /chat/i.test(e.tagName));
  if (!chats.length) { if (box) box.remove(); return; }
  if (!box) {
    box = document.createElement('pre');
    box.id = 'tt-chat-probe';
    box.style.cssText = 'position:fixed;left:0;top:0;width:62%;max-height:100%;overflow:hidden;z-index:99999;background:rgba(0,0,0,.85);color:#0f0;font:11px/1.25 monospace;margin:0;padding:6px;white-space:pre-wrap;pointer-events:none';
    document.body.appendChild(box);
  }
  const tags = [...new Set(chats.map(e => e.tagName.toLowerCase()))];
  const root = chats.find(e => !e.parentElement.closest(tags.join(','))) || chats[0];
  const lines = ['TAGS: ' + tags.join(' '), '', 'ANCESTORS:'];
  for (let n = root, i = 0; n && n !== document.body && i < 8; n = n.parentElement, i++) lines.push('  ' + describe(n));
  lines.push('', 'DESCENDANTS (first branch):');
  for (let n = root, i = 0; n && i < 9; n = n.firstElementChild, i++) lines.push('  '.repeat(i) + describe(n));
  const items = [...root.querySelectorAll('*')].filter(e => /message|item/i.test(e.tagName));
  lines.push('', `ITEMS: ${items.length} first=${items[0] ? describe(items[0]) : '-'}`);
  if (items[0]) lines.push(`  parent=${describe(items[0].parentElement)}`, `  grand=${describe(items[0].parentElement.parentElement)}`);
  box.textContent = lines.join('\n');
}
setInterval(probe, 3000);
