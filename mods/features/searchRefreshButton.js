import { isOkActivationEvent } from '../utils/okKey.js';

const BUTTON_ID = 'tt-refresh-button';
const SEARCH_TEXT_SELECTOR = 'ytlr-search-text-box';
const VOICE_SELECTOR = 'ytlr-search-voice:not(#tt-pip-button)';
let refreshSelected = false;
let returnTarget = null;
let swallowedDirection = null;

function stopKey(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
}

function direction(event) {
    if (event.key === 'ArrowRight' || event.keyCode === 39 || event.keyCode === 22) return 'right';
    if (event.key === 'ArrowLeft' || event.keyCode === 37 || event.keyCode === 21) return 'left';
    if (event.key === 'ArrowDown' || event.keyCode === 40 || event.keyCode === 20) return 'down';
    if (event.key === 'ArrowUp' || event.keyCode === 38 || event.keyCode === 19) return 'up';
    return null;
}

function hasFocus(element, event) {
    if (!element) return false;
    return element.contains(document.activeElement)
        || (event.target instanceof Element && element.contains(event.target))
        || element.classList.contains('zylon-focus')
        || Boolean(element.querySelector('.zylon-focus'));
}

function focusableTextBox(searchBar) {
    const textBox = searchBar?.querySelector(SEARCH_TEXT_SELECTOR);
    return textBox?.querySelector('.zylon-focus')
        || textBox?.querySelector('[tabindex], input, [hybridnavfocusable]') || textBox;
}

function clearRefreshSelection(button) {
    refreshSelected = false;
    button.classList.remove('tt-refresh-selected');
    button.closest('ytlr-search-bar')?.classList.remove('tt-refresh-selected');
}

function selectRefresh(button, searchBar) {
    returnTarget = focusableTextBox(searchBar);
    // The client keeps virtual focus on Search while a DOM-only control is
    // selected. Clear its old highlight and own this one stop explicitly.
    for (const selected of searchBar.querySelectorAll('.zylon-focus')) {
        selected.classList.remove('zylon-focus');
    }
    // Cobalt can keep the native text-entry element focused even after its
    // virtual focus class is removed. Blur it before selecting Refresh so the
    // Search box and Refresh are never painted as selected together.
    returnTarget?.blur?.();
    refreshSelected = true;
    searchBar.classList.add('tt-refresh-selected');
    button.classList.add('tt-refresh-selected');
    button.focus();
}

function returnToSearch(button) {
    clearRefreshSelection(button);
    const target = returnTarget?.isConnected ? returnTarget : focusableTextBox(button.closest('ytlr-search-bar'));
    button.blur();
    if (target) {
        // Restore the virtual highlight too: some Cobalt clients use a focus
        // container rather than a native input for the search text box.
        target.classList.add('zylon-focus');
        target.focus();
    }
    returnTarget = null;
}

function createRefreshButton(searchBar) {
    // Keep a separate DOM focus target and route the remote keys explicitly:
    // YouTube's virtual navigation does not register dynamically added buttons.
    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.type = 'button';
    button.classList.add('tt-search-refresh-button', 'zylon-ve');
    button.setAttribute('idomkey', 'TizenTubeSearchRefresh');
    button.setAttribute('hybridnavfocusable', 'true');
    button.setAttribute('tabindex', '0');
    button.setAttribute('role', 'button');
    button.setAttribute('aria-label', 'Refresh');
    button.setAttribute('title', 'Refresh');

    const icon = document.createElement('span');
    icon.className = 'tt-search-refresh-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '↻';
    button.appendChild(icon);
    button.addEventListener('blur', () => clearRefreshSelection(button));
    searchBar.appendChild(button);
    return button;
}

function ensureRefreshButton() {
    if (document.getElementById(BUTTON_ID)) return;
    refreshSelected = false;
    returnTarget = null;
    swallowedDirection = null;
    const searchBar = document.querySelector('ytlr-search-bar');
    if (searchBar) createRefreshButton(searchBar);
}

function refreshButtonHasFocus(button) {
    return refreshSelected || button.contains(document.activeElement);
}

function handleRemoteKey(event) {
    const button = document.getElementById(BUTTON_ID);
    if (!button || !button.getClientRects().length) return;
    const searchBar = button.closest('ytlr-search-bar');
    const selected = refreshButtonHasFocus(button);
    const keyDirection = direction(event);
    if (event.type !== 'keydown' && keyDirection && keyDirection === swallowedDirection) {
        stopKey(event);
        if (event.type === 'keyup') swallowedDirection = null;
        return;
    }

    if (selected) {
        // Swallow keypress/keyup as well: otherwise the original search control
        // can respond to the release of the same key and steal focus back.
        if (isOkActivationEvent({ key: event.key, keyCode: event.keyCode, which: event.which })) {
            stopKey(event);
            if (event.type === 'keydown' && !event.repeat) window.location.reload();
            return;
        }
        if (keyDirection === 'left' || keyDirection === 'down' || keyDirection === 'up'
            || event.key === 'Escape' || event.keyCode === 27 || event.keyCode === 4) {
            if (event.type === 'keydown') returnToSearch(button);
            if (keyDirection === 'left') {
                swallowedDirection = 'left';
                stopKey(event);
            }
            return;
        }
        if (keyDirection === 'right') stopKey(event);
        return;
    }

    if (keyDirection !== 'right' || !hasFocus(searchBar.querySelector(SEARCH_TEXT_SELECTOR), event)) return;
    // The microphone already has a native route into Search. Only extend the
    // right edge of Search, leaving the rest of YouTube's navigation intact.
    if (hasFocus(searchBar.querySelector(VOICE_SELECTOR), event)) return;
    swallowedDirection = 'right';
    stopKey(event);
    if (event.type === 'keydown' && !event.repeat) selectRefresh(button, searchBar);
}

for (const type of ['keydown', 'keypress', 'keyup']) {
    window.addEventListener(type, handleRemoteKey, true);
}

const observer = new MutationObserver(ensureRefreshButton);
observer.observe(document.body, { childList: true, subtree: true });
ensureRefreshButton();

export { createRefreshButton, refreshButtonHasFocus, handleRemoteKey };
