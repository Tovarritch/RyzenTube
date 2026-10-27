import { configChangeEmitter, configRead } from '../config.js';

const STORAGE_KEY = 'yt.leanback.default::recurring_actions';
const ACTION_KEYS = [
    'startup-screen-account-selector-with-guest',
    'whos_watching_fullscreen_zero_accounts',
    'startup-screen-signed-out-welcome-back',
];
let interval;

function readActions() {
    try {
        const raw = localStorage[STORAGE_KEY];
        if (!raw) return null;
        const saved = JSON.parse(raw);
        const actions = saved?.data?.data;
        if (!actions || typeof actions !== 'object' || Array.isArray(actions)) return null;
        return { saved, actions };
    } catch (_) {
        // This optional key may be absent or have a newer format. An account
        // screen preference must never abort the remaining TizenTube modules.
        return null;
    }
}

function disableWhosWatching(value) {
    clearInterval(interval);
    const current = readActions();
    if (!current) return false;
    const permanently = configRead('permanentlyEnableWhoIsWatchingMenu');
    const now = Date.now();
    const lastFired = current.actions['startup-screen-account-selector-with-guest']?.lastFired;
    if (value && !permanently && now - lastFired > 0 && now - lastFired < 2 * 60 * 60 * 1000) return true;

    const timestamp = !value ? now + 7 * 24 * 60 * 60 * 1000
        : permanently ? now - 7 * 24 * 60 * 60 * 1000 : now;
    function setActions() {
        const latest = readActions();
        if (!latest) return;
        let changed = false;
        for (const key of ACTION_KEYS) {
            const action = latest.actions[key];
            if (action && typeof action === 'object' && !Array.isArray(action)) {
                action.lastFired = timestamp;
                changed = true;
            }
        }
        if (changed) {
            try { localStorage[STORAGE_KEY] = JSON.stringify(latest.saved); } catch (_) { }
        }
    }
    setActions();
    if (value && permanently) interval = setInterval(setActions, 60 * 1000);
    return true;
}

configChangeEmitter.addEventListener('configChange', event => {
    if (['enableWhoIsWatchingMenu', 'permanentlyEnableWhoIsWatchingMenu'].includes(event.detail?.key)) {
        disableWhosWatching(configRead('enableWhoIsWatchingMenu'));
    }
});

// Retry briefly while YouTube initializes, without blocking other modules.
function initialize(attempt = 0) {
    if (!disableWhosWatching(configRead('enableWhoIsWatchingMenu')) && attempt < 20) {
        setTimeout(() => initialize(attempt + 1), 500);
    }
}
initialize();
