import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = { localStorage: {}, location: { hash: '#/' }, dispatchEvent() {} };
const { boostRequestUrl } = await import('../utils/volumeBoostUrl.js');

test('levels are sent to the APK as three-digit percentages, clamped to 100-300%', () => {
    assert.equal(boostRequestUrl(1), 'http://127.0.0.1:18947/boost?level=100');
    assert.equal(boostRequestUrl(2.5), 'http://127.0.0.1:18947/boost?level=250');
    assert.equal(boostRequestUrl(9), 'http://127.0.0.1:18947/boost?level=300');
    assert.equal(boostRequestUrl('x'), 'http://127.0.0.1:18947/boost?level=100');
});
