// Run with Playwright installed: node --test scripts/search-refresh.browser.cjs
// Set CHROME_PATH to test against a locally installed Chrome executable.
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { test } = require('node:test');
const { chromium } = require('playwright');

test('remote navigation reaches Refresh even when native navigation skips it', async () => {
    const browser = await chromium.launch({
        headless: true,
        ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {})
    });
    try {
        const page = await browser.newPage();
        await page.setContent(`
            <style>
                #search.zylon-focus, #search:focus { background-color: rgb(255, 255, 255); }
            </style>
            <ytlr-search-bar style="display:block;position:relative;height:70px">
                <ytlr-search-voice><button id="mic">Microphone</button></ytlr-search-voice>
                <ytlr-search-text-box><div id="search" tabindex="0">Search</div></ytlr-search-text-box>
            </ytlr-search-bar>
            <button id="result">Result</button>
        `);
        await page.addStyleTag({ path: resolve(__dirname, '../mods/ui/ui.css') });
        await page.evaluate(() => {
            window.reloadRequests = 0;
            window.nativeKeys = [];
            // Emulate the native client knowing only microphone, Search and
            // results. Adding tabindex alone never reaches our custom control.
            document.addEventListener('keydown', event => {
                window.nativeKeys.push(event.key);
                const current = document.activeElement.id;
                if (event.key === 'ArrowRight' && current === 'mic') document.getElementById('search').focus();
                else if (event.key === 'ArrowRight' && current === 'search') document.getElementById('result').focus();
                else if (event.key === 'ArrowLeft' && current === 'search') document.getElementById('mic').focus();
                else if (event.key === 'ArrowDown') document.getElementById('result').focus();
            });
        });
        const source = [
            readFileSync(resolve(__dirname, '../mods/utils/okKey.js'), 'utf8').replace('export function', 'function'),
            readFileSync(resolve(__dirname, '../mods/features/searchRefreshButton.js'), 'utf8')
                .replace(/^import .*;\r?\n/m, '')
                .replace(/^export .*;\r?$/m, '')
                // Count reloads without losing the test fixture through navigation.
                .replace('window.location.reload()', 'window.reloadRequests++')
        ].join('\n');
        await page.addScriptTag({ content: source });

        const active = () => page.evaluate(() => document.activeElement.id);
        const reloads = () => page.evaluate(() => window.reloadRequests);
        await page.locator('#mic').focus();
        await page.keyboard.press('Enter');
        assert.equal(await reloads(), 0, 'OK on microphone must not reload');
        await page.keyboard.press('ArrowRight');
        assert.equal(await active(), 'search');
        await page.keyboard.press('Enter');
        assert.equal(await reloads(), 0, 'OK on Search must not reload');
        await page.locator('#search').evaluate(element => element.classList.add('zylon-focus'));
        await page.keyboard.press('ArrowRight');
        assert.equal(await active(), 'tt-refresh-button', 'Right must reach Refresh');
        assert.equal(await reloads(), 0, 'Selecting Refresh must not reload');
        assert.equal(await page.locator('ytlr-search-bar .zylon-focus').count(), 0, 'Old Search highlight must be cleared');
        assert.equal(
            await page.locator('#search').evaluate(element => getComputedStyle(element).backgroundColor),
            'rgb(39, 39, 39)',
            'Search must retain a visible unfocused background while Refresh is selected'
        );
        assert.equal(await page.locator('#search').evaluate(element => getComputedStyle(element).color), 'rgb(241, 241, 241)');
        assert.equal(await page.locator('#search').isVisible(), true);
        assert.equal(await page.locator('ytlr-search-text-box').evaluate(element => getComputedStyle(element).borderRadius), '999px');
        assert.equal(await page.locator('#search').evaluate(element => getComputedStyle(element).borderRadius), '999px', 'Search keeps rounded corners while Refresh is focused');
        await page.keyboard.press('Enter');
        assert.equal(await reloads(), 1, 'OK on Refresh must reload exactly once');
        await page.keyboard.press('ArrowLeft');
        assert.equal(await active(), 'search', 'Left must return to Search');
        await page.keyboard.press('ArrowLeft');
        assert.equal(await active(), 'mic', 'Native navigation must still reach microphone');

        // Cobalt can expose virtual focus while the DOM activeElement is body.
        await page.locator('#mic').evaluate(element => element.blur());
        await page.locator('#search').evaluate(element => element.classList.add('zylon-focus'));
        await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { keyCode: 22, bubbles: true })));
        assert.equal(await active(), 'tt-refresh-button', 'Android DPAD_RIGHT must work with virtual focus');
        await page.evaluate(() => {
            window.dispatchEvent(new KeyboardEvent('keyup', { keyCode: 22, bubbles: true }));
            window.dispatchEvent(new KeyboardEvent('keydown', { keyCode: 23, bubbles: true }));
            window.dispatchEvent(new KeyboardEvent('keydown', { keyCode: 23, repeat: true, bubbles: true }));
            window.dispatchEvent(new KeyboardEvent('keyup', { keyCode: 23, bubbles: true }));
        });
        assert.equal(await reloads(), 2, 'Android DPAD_CENTER must reload once, ignoring repeats');
        await page.keyboard.press('ArrowDown');
        assert.equal(await active(), 'result', 'Down must resume native navigation to results');
        assert.equal(await page.locator('ytlr-search-bar.tt-refresh-selected').count(), 0);
        await page.keyboard.press('Enter');
        assert.equal(await reloads(), 2, 'OK outside header must not reload');

        await page.locator('#search').evaluate(element => element.classList.remove('zylon-focus'));
        await page.locator('#mic').evaluate(element => element.classList.add('zylon-focus'));
        await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
        assert.notEqual(await active(), 'tt-refresh-button', 'Microphone focus must not be mistaken for Search focus');
    } finally {
        await browser.close();
    }
});
