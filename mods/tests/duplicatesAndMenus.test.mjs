import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';

const store = {};
globalThis.window = { localStorage: store, location: { hash: '#/' }, dispatchEvent() {} };
globalThis.CustomEvent = class {
    constructor(type, init) {
        this.type = type;
        this.detail = init?.detail;
    }
};

const { configWrite } = await import('../config.js');
const { hideDuplicateVideos } = await import('../features/duplicateHider.js');
const { arrangePlayerMenu, playerMenuId } = await import('../ui/menuOrder.js');

const tile = id => ({ tileRenderer: { contentId: id, contentType: 'TILE_CONTENT_TYPE_VIDEO', onSelectCommand: { watchEndpoint: { videoId: id } } } });
const shelf = (...ids) => ({ shelfRenderer: { content: { horizontalListRenderer: { items: ids.map(tile) } } } });
const ids = s => s.shelfRenderer.content.horizontalListRenderer.items.map(i => i.tileRenderer.contentId);
const home = (...shelves) => ({ contents: { tvBrowseRenderer: { content: { tvSurfaceContentRenderer: { content: { sectionListRenderer: { contents: shelves } } } } } } });

beforeEach(() => {
    window.location.hash = '#/';
    configWrite('hideDuplicateVideos', true);
    configWrite('playerMenuHidden', []);
    configWrite('playerMenuOrder', []);
});

test('keeps the first occurrence and drops rows left empty', () => {
    const r = home(shelf('a', 'b'), shelf('b', 'c'), shelf('a', 'c'), { feedNudgeRenderer: {} });
    hideDuplicateVideos(r);
    const rows = r.contents.tvBrowseRenderer.content.tvSurfaceContentRenderer.content.sectionListRenderer.contents;
    assert.deepEqual(rows.filter(s => s.shelfRenderer).map(ids), [['a', 'b'], ['c']]);
    assert.ok(rows.some(s => s.feedNudgeRenderer), 'Non-video rows stay');
});

test('continuations are compared with the page that was loaded', () => {
    hideDuplicateVideos(home(shelf('a', 'b')));
    const more = { continuationContents: { sectionListContinuation: { contents: [shelf('b'), shelf('d', 'a')] } } };
    hideDuplicateVideos(more);
    assert.deepEqual(more.continuationContents.sectionListContinuation.contents.map(ids), [['d']]);
    const row = { continuationContents: { horizontalListContinuation: { items: [tile('d'), tile('e')] } } };
    hideDuplicateVideos(row);
    assert.deepEqual(row.continuationContents.horizontalListContinuation.items.map(i => i.tileRenderer.contentId), ['e']);
});

test('never applied on the watch page or inside a playlist, or when disabled', () => {
    const watch = { contents: { singleColumnWatchNextResults: { pivot: { sectionListRenderer: { contents: [shelf('a'), shelf('a')] } } } } };
    hideDuplicateVideos(watch);
    assert.equal(watch.contents.singleColumnWatchNextResults.pivot.sectionListRenderer.contents.length, 2);

    const playlist = home(shelf('a', 'a'));
    playlist.responseContext = { serviceTrackingParams: [{ params: [{ key: 'browse_id', value: 'VLPL123' }] }] };
    hideDuplicateVideos(playlist);
    assert.deepEqual(ids(playlist.contents.tvBrowseRenderer.content.tvSurfaceContentRenderer.content.sectionListRenderer.contents[0]), ['a', 'a']);
    const playlistMore = { continuationContents: { horizontalListContinuation: { items: [tile('a')] } } };
    hideDuplicateVideos(playlistMore);
    assert.equal(playlistMore.continuationContents.horizontalListContinuation.items.length, 1);

    window.location.hash = '#/watch?v=a';
    const pivotMore = { continuationContents: { sectionListContinuation: { contents: [shelf('x'), shelf('x')] } } };
    hideDuplicateVideos(home(shelf('x')));
    hideDuplicateVideos(pivotMore);
    assert.equal(pivotMore.continuationContents.sectionListContinuation.contents.length, 2);

    window.location.hash = '#/';
    configWrite('hideDuplicateVideos', false);
    const off = home(shelf('a'), shelf('a'));
    hideDuplicateVideos(off);
    assert.equal(off.contents.tvBrowseRenderer.content.tvSurfaceContentRenderer.content.sectionListRenderer.contents.length, 2);
});

const link = (title, serviceEndpoint, icon) => ({ compactLinkRenderer: { title: { simpleText: title }, icon: icon && { iconType: icon }, serviceEndpoint } });
const playerMenu = () => [
    link('Quality', { openClientOverlayAction: { type: 'CLIENT_OVERLAY_TYPE_VIDEO_QUALITY' } }),
    link('Captions', { openClientOverlayAction: { type: 'CLIENT_OVERLAY_TYPE_CAPTIONS_LANGUAGE' } }, 'CAPTIONS'),
    link('Mini Player', { commandExecutorCommand: { commands: [{ customAction: { action: 'ENTER_MP' } }] } }),
    link('Something new', { openClientOverlayAction: { type: 'CLIENT_OVERLAY_TYPE_NEW' } }),
    link('Audio', undefined, 'VOLUME_UP'),
    link('Audio Track', { openClientOverlayAction: { type: 'CLIENT_OVERLAY_TYPE_AUDIO_TRACK' } }),
    link('Speed', { signalAction: { customAction: { action: 'TT_SPEED_SETTINGS_SHOW' } } }, 'SPEEDOMETER'),
    { playlistLoopButtonRenderer: {} },
    link('Stats for nerds', { signalAction: { signal: 'TOGGLE_VIDEO_INFO' } }),
];
const titles = items => items.map(i => i.compactLinkRenderer?.title.simpleText || 'Loop');

test('player settings entries are recognised, hidden and sorted', () => {
    assert.deepEqual(playerMenu().map(playerMenuId), ['quality', 'captions', 'miniPlayer', null, 'audio', 'audioTrack', 'speed', 'loop', 'stats']);
    assert.deepEqual(titles(arrangePlayerMenu(playerMenu())), titles(playerMenu()), 'Unchanged by default');

    configWrite('playerMenuHidden', ['miniPlayer', 'stats']);
    configWrite('playerMenuOrder', ['speed', 'loop']);
    assert.deepEqual(titles(arrangePlayerMenu(playerMenu())),
        ['Speed', 'Loop', 'Something new', 'Quality', 'Captions', 'Audio', 'Audio Track'],
        'Unknown entries keep their slot; the rest follow the chosen order');
});

test('entries added after sorting appear after the entry they follow by default', async () => {
    const { menuOrder } = await import('../ui/menuOrder.js');
    configWrite('playerMenuOrder', ['speed', 'quality', 'captions']);
    const order = menuOrder('player');
    assert.equal(order.indexOf('volumeBoost'), order.indexOf('speed') + 1);
    assert.deepEqual(order.slice(0, 3), ['speed', 'volumeBoost', 'loop'], 'Each new entry follows its default neighbour');
});
