import assert from 'node:assert/strict';
import test from 'node:test';

import { isOkActivationEvent } from '../utils/okKey.js';

test('recognizes DOM and Android TV selection keys', () => {
    for (const key of ['Enter', 'Select', 'Accept']) {
        assert.equal(isOkActivationEvent({ key }), true, key);
    }

    for (const keyCode of [13, 23, 66, 96, 109, 160]) {
        assert.equal(isOkActivationEvent({ keyCode }), true, String(keyCode));
    }

    assert.equal(isOkActivationEvent({ which: 23 }), true);
});

test('ignores repeats and unrelated remote keys', () => {
    assert.equal(isOkActivationEvent({ key: 'Enter', repeat: true }), false);
    assert.equal(isOkActivationEvent({ key: 'ArrowDown', keyCode: 20 }), false);
    assert.equal(isOkActivationEvent(), false);
});
