import { isOkActivationEvent } from '../utils/okKey.js';

const BUTTON_ID = 'tt-refresh-button';

function iconClassMap() {
    return Object.values(window._yttv || {}).find(value =>
        value instanceof Map && (value.has('REPLAY') || value.has('REFRESH'))
    );
}

function replaceMicrophoneIcon(button) {
    const icon = button.querySelector('yt-icon');
    if (!icon) return;

    const classes = iconClassMap();
    const refreshClass = classes?.get('REPLAY') || classes?.get('REFRESH');
    const microphoneClass = classes?.get('MICROPHONE_ON');
    if (refreshClass) {
        if (microphoneClass) icon.classList.remove(microphoneClass);
        icon.classList.add(refreshClass);
        return;
    }

    // Fallback for clients that do not expose YouTube's icon-class map.
    icon.className = 'ytLrSearchVoiceMicButtonIcon tt-refresh-icon-fallback';
    icon.textContent = '↻';
}

function createBareButton() {
    const button = document.createElement('ytlr-search-voice');
    button.classList.add('ytLrSearchVoiceHost', 'ytLrSearchBarSearchVoice');

    const face = document.createElement('ytlr-search-voice-mic-button');
    face.classList.add('ytLrSearchVoiceMicButtonHost', 'zylon-ve');
    face.setAttribute('hybridnavfocusable', 'true');
    face.setAttribute('tabindex', '-1');

    const icon = document.createElement('yt-icon');
    icon.classList.add('ytContribIconHost', 'ytLrSearchVoiceMicButtonIcon');
    const classes = iconClassMap();
    const refreshClass = classes?.get('REPLAY') || classes?.get('REFRESH');
    if (refreshClass) icon.classList.add(refreshClass);
    else {
        icon.classList.add('tt-refresh-icon-fallback');
        icon.textContent = '↻';
    }

    face.appendChild(icon);
    button.appendChild(face);
    return button;
}

function createRefreshButton(searchBar) {
    const voiceButton = searchBar.querySelector('ytlr-search-voice');
    const button = voiceButton ? voiceButton.cloneNode(true) : createBareButton();
    button.id = BUTTON_ID;
    button.setAttribute('idomkey', 'TizenTubeSearchRefresh');
    button.setAttribute('tabindex', '0');
    button.setAttribute('aria-label', 'Refresh');
    button.setAttribute('title', 'Refresh');
    button.style.left = '10.25em';

    const focusableChild = button.querySelector('ytlr-search-voice-mic-button');
    focusableChild?.setAttribute('hybridnavfocusable', 'true');
    focusableChild?.setAttribute('tabindex', '-1');
    if (voiceButton) replaceMicrophoneIcon(button);
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
