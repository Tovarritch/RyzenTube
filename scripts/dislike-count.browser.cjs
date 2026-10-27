const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { test } = require('node:test');
const { chromium } = require('playwright');

test('late dislike response updates TV icons and description, respects opt-out and video changes', async () => {
    const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
    try {
        const page = await browser.newPage();
        await page.setContent(`
            <div class="html5-video-player"></div>
            <ytlr-like-button-renderer><div class="ytLrLikeButtonThumbsDown" aria-label="Не нравится"></div></ytlr-like-button-renderer>
            <ytlr-video-description-header-renderer></ytlr-video-description-header-renderer>
        `);
        await page.evaluate(() => {
            window.optIn = false;
            window.configRead = () => window.optIn;
            window.configChangeEmitter = new EventTarget();
            window.videoId = 'video-a';
            document.querySelector('.html5-video-player').getVideoData = () => ({ video_id: window.videoId });
            window.requests = [];
            window.pending = {};
            window.fetch = url => {
                const videoId = new URL(url).searchParams.get('videoId');
                window.requests.push(videoId);
                return new Promise(resolve => {
                    window.pending[videoId] = count => resolve({ ok: true, json: async () => ({ dislikes: count }) });
                });
            };
            window.toggle = value => {
                window.optIn = value;
                window.configChangeEmitter.dispatchEvent(new CustomEvent('configChange', { detail: { key: 'enableReturnYoutubeDislike' } }));
            };
        });
        const source = ['returnYoutubeDislike.js', 'dislikeCount.js'].map(file =>
            readFileSync(resolve(__dirname, '../mods/features', file), 'utf8')
                .replace(/^import .*;\r?\n/gm, '')
                .replace(/^export /gm, '')
        ).join('\n');
        await page.addScriptTag({ content: source });
        assert.deepEqual(await page.evaluate(() => window.requests), []);
        await page.evaluate(() => window.toggle(true));
        assert.deepEqual(await page.evaluate(() => window.requests), ['video-a']);
        await page.evaluate(() => window.pending['video-a'](12500));
        await page.waitForFunction(() => document.getElementById('tt-dislike-count')?.textContent === '13K');
        assert.equal(await page.locator('#tt-description-dislike-count').innerText(), '13K Dislikes');

        await page.evaluate(() => {
            window.videoId = 'video-b';
            document.dispatchEvent(new Event('loadedmetadata'));
        });
        assert.equal(await page.locator('#tt-dislike-count').count(), 0, 'Previous count must be removed immediately');
        await page.evaluate(() => window.toggle(false));
        await page.evaluate(() => window.pending['video-b'](99));
        await page.waitForTimeout(50);
        assert.equal(await page.locator('#tt-dislike-count').count(), 0, 'Late response must not bypass opt-out');
    } finally {
        await browser.close();
    }
});
