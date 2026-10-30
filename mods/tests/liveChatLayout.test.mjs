import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = { localStorage: {}, location: { hash: '#/' }, dispatchEvent() {} };
const { liveChatCss, messagesToHide, withSection } = await import('../features/liveChatLayout.js');

const message = translate => ({ getAttribute: () => `transform: translateY(${translate}rem) translateZ(0px);` });

test('chat moves to the left and scales from its bottom corner', () => {
    assert.doesNotMatch(liveChatCss('right', 1), /ytlr-live-chat \{/, 'YouTube default: no override');
    const left = liveChatCss('left', 1.25, -1395);
    assert.match(left, /translateX\(-1395px\) scale\(1\.25\)/);
    assert.match(left, /scale\(1\.25\)/);
    assert.match(left, /transform-origin: left bottom/);
    assert.match(liveChatCss('right', 0.8), /transform-origin: right bottom/);
    assert.doesNotMatch(liveChatCss('left', 1, NaN), /translateX/, 'Not measured yet: stays put');
});

test('only the newest messages, lowest on screen, stay visible', () => {
    const [newest, middle, oldest, older] = [message(-2), message(-10.5), message(-26.625), message(-18)];
    assert.deepEqual(messagesToHide([oldest, newest, older, middle], 2), [older, oldest]);
    assert.deepEqual(messagesToHide([oldest, newest], 0), [], 'No limit hides nothing');
});

test("rules live in YouTube's own style block and replace their earlier version", () => {
    const once = withSection('.yt { color: red }', 'ytlr-live-chat { a: 1 }');
    const twice = withSection(once, 'ytlr-live-chat { a: 2 }');
    assert.match(twice, /^\.yt \{ color: red \}/);
    assert.equal((twice.match(/\/\* tt-live-chat-style \*\//g) || []).length, 1, 'one section');
    assert.match(twice, /a: 2/);
    assert.doesNotMatch(twice, /a: 1/);
});
