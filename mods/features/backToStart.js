// Back resets the native virtual list selection, letting YouTube update both
// focus and scroll position. DOM scrollTo alone cannot move its virtual lists.
let consumeBackRelease = false;

function isBack(event) {
    return ['Escape', 'Backspace', 'BrowserBack', 'GoBack'].includes(event.key)
        || [4, 8, 27, 461, 10009].includes(event.keyCode);
}

function feedTarget(event) {
    if (/^#?\/?(?:watch|shorts)(?:[/?]|$)/.test(window.location.hash)) return null;
    const target = document.activeElement !== document.body ? document.activeElement
        : document.querySelector('.zylon-focus') || event.target;
    if (!(target instanceof Element)) return null;
    if (target.closest('input, textarea, [contenteditable="true"], [role="dialog"], ytlr-overlay-panel-renderer, ytlr-overlay-section-renderer')) return null;
    return target.closest('ytlr-tile-renderer, ytlr-lockup-view-model, ytlr-compact-video-renderer, [role="gridcell"]');
}

function listsFor(tile) {
    const lists = [];
    for (let element = tile; element; element = element.parentElement) {
        const instance = element.__instance;
        const props = instance?.props;
        // Native yt-virtual-list keeps every item in props.items, including
        // those unmounted when scrolling a long distance.
        if (element.tagName.toLowerCase() === 'yt-virtual-list'
            && props && Number.isInteger(props.selectedIndex) && props.selectedIndex > 0
            && typeof instance.ga === 'function') {
            lists.push({ instance, layout: props.layout });
        }
    }
    return lists;
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
    if (!tile) return;
    const lists = listsFor(tile);
    const list = lists.find(item => item.layout === 'horizontal')
        || lists.find(item => item.layout === 'vertical');
    if (!list) return;
    list.instance.ga(0);
    consumeBackRelease = true;
    event.preventDefault();
    event.stopImmediatePropagation();
}

for (const type of ['keydown', 'keypress', 'keyup']) {
    window.addEventListener(type, handleBackToStart, true);
}
window.addEventListener('blur', () => { consumeBackRelease = false; });
