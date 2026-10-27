const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

test('Not interested feedback displays the reasons YouTube returns', async () => {
    const source = readFileSync(resolve(__dirname, '../mods/resolveCommand.js'), 'utf8');
    const modals = [];
    const sent = [];
    const context = vm.createContext({
        console,
        getFeedbackPanelTokens: async () => ['not-interested-token'],
        sendFeedbackToken: async token => {
            sent.push(token);
            return { feedbackResponses: [{ followUpDialog: { dismissalFollowUpRenderer: {
                dismissalReasonsPrompt: { simpleText: 'Tell us why' },
                reasons: [{ dismissalReasonTextRenderer: {
                    text: { simpleText: 'Already watched' }, token: 'reason-token',
                } }],
            } } }] };
        },
        buttonItem: (label, icon, commands) => ({ label, commands }),
        overlayPanelItemListRenderer: items => items,
        showModal: (...args) => modals.push(args),
    });
    vm.runInContext(source.slice(source.indexOf('async function markFeedback(')), context);
    await context.markFeedback({ panelId: 'panel', params: 'params' }, 0, true);
    assert.deepEqual(sent, ['not-interested-token']);
    assert.equal(modals[0][0], 'Tell us why');
    assert.equal(modals[0][1][0].commands[1].customAction.parameters.token, 'reason-token');
});
