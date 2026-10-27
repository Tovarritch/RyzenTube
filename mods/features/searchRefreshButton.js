import { isOkActivationEvent } from '../utils/okKey.js';

const BUTTON_ID = 'tt-refresh-button';

function createRefreshButton(searchBar) {
    // A second ytlr-search-voice shares the microphone component's internal
    // focus state. Use an ordinary hybrid-navigation button so YouTube sees a
    // third, independent target beside the text box and microphone.
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
    searchBar.appendChild(button);
    return button;
}

function ensureRefreshButton() {
    if (document.getElementById(BUTTON_ID)) return;
    const searchBar = document.querySelector('ytlr-search-bar');
    if (searchBar) createRefreshButton(searchBar);
}

function refreshButtonHasFocus(button, event) {
    const eventTarget = event.target instanceof Element ? event.target : null;
    return button === document.activeElement
        || button.contains(document.activeElement)
        || (eventTarget && button.contains(eventTarget))
        || button.classList.contains('zylon-focus')
        || Boolean(button.querySelector('.zylon-focus'));
}

document.addEventListener('keydown', (event) => {
    if (!isOkActivationEvent(event)) return;
    const button = document.getElementById(BUTTON_ID);
    if (!button || !refreshButtonHasFocus(button, event)) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    setTimeout(() => window.location.reload(), 0);
}, true);

const observer = new MutationObserver(ensureRefreshButton);
observer.observe(document.body, { childList: true, subtree: true });
ensureRefreshButton();

export { createRefreshButton, refreshButtonHasFocus };
