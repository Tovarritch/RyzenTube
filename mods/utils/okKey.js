const OK_KEYS = new Set(['Enter', 'Select', 'Accept']);

// DOM Enter plus Android TV's DPAD_CENTER, ENTER, BUTTON_A, BUTTON_SELECT and
// NUMPAD_ENTER KeyEvent values. Cobalt versions differ in whether they normalize
// these to DOM Enter before dispatching the browser event.
const OK_KEY_CODES = new Set([13, 23, 66, 96, 109, 160]);

export function isOkActivationEvent(event) {
    if (!event || event.repeat) return false;
    const keyCode = event.keyCode || event.which;
    return OK_KEYS.has(event.key) || OK_KEY_CODES.has(keyCode);
}
