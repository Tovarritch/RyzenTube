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
            window.setDiagnostic = () => {};
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

        // Model the TV's native count title below the focused icon. The state
        // updater name is discovered from its selection callback, not pinned.
        await page.evaluate(() => {
            const host = document.querySelector('ytlr-like-button-renderer');
            host.style.cssText = 'display:inline-block;width:2.5rem';
            host.innerHTML = '<yt-icon-button style="display:inline-block;width:2.5rem" idomkey="dislike-button"><yt-button-container style="display:inline-block;width:2.5rem" idomkey="dislike-button" role="button"><div style="width:2.5rem"><yt-button-graphic style="display:inline-block;min-width:2rem">▼</yt-button-graphic></div></yt-button-container></yt-icon-button>';
            const comments = document.createElement('span');
            comments.id = 'comments';
            comments.textContent = 'Comments';
            host.after(comments);
            host.__instance = {
                props: { data: {} },
                state: { selectedIndex: 1 },
                J(state) {
                    this.state = { ...this.state, ...state };
                    let title = host.querySelector('#native-dislike-title');
                    if (!title) {
                        title = document.createElement('span');
                        title.id = 'native-dislike-title';
                        title.style.cssText = 'display:block;position:absolute;top:100%';
                        host.querySelector('[role="button"]').appendChild(title);
                    }
                    title.textContent = this.props.data.dislikeCountText?.simpleText || 'Dislike';
                },
            };
            host.__instance.ea = function(b){this.J({selectedIndex:b});};
            window.toggle(true);
        });
        await page.waitForFunction(() => document.getElementById('native-dislike-title')?.textContent === '99');
        assert.equal(await page.locator('#tt-dislike-count').count(), 0, 'Never add a second count beside the native title');
        assert.equal(await page.locator('#native-dislike-title').count(), 1);
        assert.equal(await page.locator('ytlr-like-button-renderer').evaluate(el => el.__instance.state.selectedIndex), 1, 'Updating the count preserves native focus');
        assert.equal(await page.locator('yt-button-container > div').evaluate(element => element.style.width), '2.5rem', 'Native button dimensions stay unchanged');
        await page.evaluate(() => window.toggle(false));
        assert.equal(await page.locator('#tt-dislike-count').count(), 0, 'Opt-out removes the inline count');
        assert.equal(await page.locator('#native-dislike-title').innerText(), 'Dislike', 'Opt-out restores the original title');
        assert.equal(await page.locator('yt-button-container > div').evaluate(element => element.style.width), '2.5rem');
        assert.equal(await page.locator('ytlr-like-button-renderer').evaluate(element => element.style.width), '2.5rem');
    } finally {
        await browser.close();
    }
});
