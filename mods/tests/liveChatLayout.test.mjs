import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = { localStorage: {}, location: { hash: '#/' }, dispatchEvent() {} };
const { liveChatCss, messagesToHide } = await import('../features/liveChatLayout.js');

const message = translate => ({ getAttribute: () => `transform: translateY(${translate}rem) translateZ(0px);` });

test('chat moves to the left and scales from its bottom corner', () => {
    assert.doesNotMatch(liveChatCss('right', 1), /ytlr-live-chat \{/, 'YouTube default: no override');
    const left = liveChatCss('left', 1.25);
    assert.match(left, /left: 0 !important/);
    assert.match(left, /scale\(1\.25\)/);
    assert.match(left, /transform-origin: left bottom/);
    assert.match(liveChatCss('right', 0.8), /transform-origin: right bottom/);
});

test('only the newest messages, lowest on screen, stay visible', () => {
    const [newest, middle, oldest, older] = [message(-2), message(-10.5), message(-26.625), message(-18)];
    assert.deepEqual(messagesToHide([oldest, newest, older, middle], 2), [older, oldest]);
    assert.deepEqual(messagesToHide([oldest, newest], 0), [], 'No limit hides nothing');
});
