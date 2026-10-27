const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const { chromium } = require('playwright');

test('Back resets native row selection, then feed selection, then resumes normal Back', async () => {
    const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
    try {
        const page = await browser.newPage();
        await page.setContent(`
            <yt-virtual-list id="vertical">
                <yt-virtual-list id="horizontal">
                    <yt-lockup-view-model><button id="tile">Video</button></yt-lockup-view-model>
                </yt-virtual-list>
            </yt-virtual-list>
            <div role="dialog"><ytlr-tile-renderer><button id="dialog">Dialog</button></ytlr-tile-renderer></div>
        `);
        await page.evaluate(() => {
            window.setDiagnostic = () => {};
            window.normalBack = 0;
            window.resets = [];
            for (const [id, layout, index] of [['horizontal', 'horizontal', 80], ['vertical', 'vertical', 100]]) {
                // Actual Cobalt method names differ from the desktop client.
                class TvList {
                    constructor() { this.props = { layout, selectedIndex: index }; }
                    Z() { this.ea(0); }
                    ea(index) { this.props.selectedIndex = index; window.resets.push(id); }
                }
                document.getElementById(id).__instance = new TvList();
            }
            document.addEventListener('keyup', event => {
                if (event.key === 'Escape') window.normalBack++;
            });
        });
        await page.addScriptTag({ content: readFileSync(resolve(__dirname, '../mods/features/backToStart.js'), 'utf8').replace(/^import .*;\r?\n/gm, '') });
        await page.locator('#tile').focus();
        await page.keyboard.press('Escape');
        assert.deepEqual(await page.evaluate(() => window.resets), ['horizontal']);
        assert.equal(await page.evaluate(() => window.normalBack), 0);
        await page.keyboard.press('Escape');
        assert.deepEqual(await page.evaluate(() => window.resets), ['horizontal', 'vertical']);
        await page.keyboard.press('Escape');
        assert.equal(await page.evaluate(() => window.normalBack), 1);

        await page.locator('#dialog').focus();
        await page.keyboard.press('Escape');
        assert.equal(await page.evaluate(() => window.normalBack), 2, 'Popups keep normal Back');
        await page.locator('#tile').focus();
        await page.evaluate(() => {
            window.location.hash = '/watch?v=test';
            document.getElementById('horizontal').__instance.props.selectedIndex = 70;
        });
        await page.keyboard.press('Escape');
        assert.equal(await page.evaluate(() => window.normalBack), 3, 'Watch page keeps normal Back');
        assert.deepEqual(await page.evaluate(() => window.resets), ['horizontal', 'vertical']);
    } finally {
        await browser.close();
    }
});
