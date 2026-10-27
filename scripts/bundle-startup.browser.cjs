const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { test } = require('node:test');
const { chromium } = require('playwright');

test('complete production bundle initializes with missing or changed YouTube storage', async () => {
    const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
    try {
        const bundle = readFileSync(resolve(__dirname, '../dist/userScript.js'), 'utf8');
        const build = readFileSync(resolve(__dirname, '../mods/buildInfo.js'), 'utf8').match(/BUILD_LABEL = '([^']+)'/)[1];
        for (const saved of [undefined, '{invalid', 'null', '{"data":{}}', '{"data":{"data":{}}}']) {
            const page = await browser.newPage();
            const errors = [];
            page.on('pageerror', error => errors.push(error.stack));
            await page.route('https://startup.test/**', route => route.fulfill({ contentType: 'text/html', body: '<html><head></head><body></body></html>' }));
            await page.goto('https://startup.test/tv');
            await page.evaluate(saved => {
                const services = {
                    mappings: true,
                    get(name) {
                        if (name === 'PlaybackPreviewService') return { start() {}, stop() {} };
                        return {};
                    },
                };
                window._yttv = { services };
                window.yt = { config_: { HL: 'en' } };
                if (saved !== undefined) localStorage['yt.leanback.default::recurring_actions'] = saved;
            }, saved);
            await page.addScriptTag({ content: bundle });
            assert.equal(await page.evaluate(() => window.tizenTubeBuild), build, `All imports must initialize for storage ${saved}; errors: ${errors.join('; ')}`);
            assert.equal(await page.evaluate(() => Boolean(window.queuedVideos && window.captionStyleHandler)), true);
            assert.deepEqual(errors, []);
            await page.close();
        }
    } finally {
        await browser.close();
    }
});
