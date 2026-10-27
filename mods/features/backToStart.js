// Back resets the native virtual list selection, letting YouTube update both
// focus and scroll position. DOM scrollTo alone cannot move its virtual lists.
import { setDiagnostic } from '../diagnostics.js';
let consumeBackRelease = false;
const TILE_SELECTOR = 'ytlr-tile-renderer, yt-lockup-view-model, ytlr-lockup-view-model, ytlr-compact-video-renderer, [role="gridcell"]';

function isBack(event) {
    return ['Escape', 'Backspace', 'BrowserBack', 'GoBack'].includes(event.key)
        || [4, 8, 27, 461, 10009].includes(event.keyCode);
}

function feedTarget(event) {
    if (/^#?\/?(?:watch|shorts)(?:[/?]|$)/.test(window.location.hash)) return null;
    const excluded = 'input, textarea, [contenteditable="true"], [role="dialog"], ytlr-overlay-panel-renderer, ytlr-overlay-section-renderer';
    for (const node of [event.target, document.activeElement]) {
        if (node instanceof Element && node.closest(excluded)) return null;
    }
    // .zylon-focus is on every ancestor of the selected tile. The first match
    // is the whole app, so start with the real key target/active element and
    // otherwise use the deepest focused video tile.
    let target = event.target instanceof Element && event.target.closest(TILE_SELECTOR) ? event.target
        : document.activeElement;
    if (!target?.closest?.(TILE_SELECTOR)) {
        const focused = Array.from(document.querySelectorAll('.zylon-focus'));
        target = focused.reverse().find(element => element.closest(TILE_SELECTOR)) || target;
    }
    if (!(target instanceof Element)) return null;
    if (target.closest(excluded)) return null;
    return target.closest(TILE_SELECTOR);
}

function listsFor(tile) {
    const lists = [];
    for (let element = tile; element; element = element.parentElement) {
        const instance = element.__instance;
        const props = instance?.props;
        // Native yt-virtual-list keeps every item in props.items, including
        // those unmounted when scrolling a long distance.
        if (element.tagName.toLowerCase() === 'yt-virtual-list'
            && props && Number.isInteger(props.selectedIndex) && props.selectedIndex > 0) {
            const reset = resetListAction(instance);
            if (reset) lists.push({ reset, layout: props.layout });
        }
    }
    return lists;
}

// YouTube minifies this method differently on Cobalt and Chrome. Find the
// native reset action by its implementation, rather than pinning a build's
// private method name (r17's `ga` does not exist on the Sony TV client).
function resetListAction(instance) {
    const prototype = Object.getPrototypeOf(instance);
    for (const name of Object.getOwnPropertyNames(prototype || {})) {
        const fn = Object.getOwnPropertyDescriptor(prototype, name)?.value;
        if (typeof fn !== 'function') continue;
        const match = String(fn).match(/^[\w$]+\(\)\s*\{\s*this\.([\w$]+)\(0\);?\s*\}$/);
        if (match && typeof instance[match[1]] === 'function') return () => fn.call(instance);
    }
    return null;
}

function handleBackToStart(event) {
    if (!isBack(event)) return;
    if (event.type !== 'keydown') {
        if (!consumeBackRelease) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (event.type === 'keyup') consumeBackRelease = false;
        return;
    }
    if (consumeBackRelease) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
    }
    const tile = feedTarget(event);
    if (!tile) {
        setDiagnostic('back', `Normal Back (${event.keyCode}): outside a video feed`);
        return;
    }
    const lists = listsFor(tile);
    const list = lists.find(item => item.layout === 'horizontal')
        || lists.find(item => item.layout === 'vertical');
    if (!list) {
        setDiagnostic('back', `Normal Back (${event.keyCode}): at start or no list controller`);
        return;
    }
    list.reset();
    setDiagnostic('back', `${list.layout === 'horizontal' ? 'Row start' : 'Feed top'} requested (${event.keyCode})`);
    consumeBackRelease = true;
    event.preventDefault();
    event.stopImmediatePropagation();
}

for (const type of ['keydown', 'keypress', 'keyup']) {
    window.addEventListener(type, handleBackToStart, true);
}
window.addEventListener('blur', () => { consumeBackRelease = false; });
