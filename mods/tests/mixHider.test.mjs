import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = { location: { hash: '#/' } };
const { hideHomeMixes, isMix } = await import('../features/mixHider.js');

const video = id => ({ tileRenderer: { contentType: 'TILE_CONTENT_TYPE_VIDEO', contentId: id, onSelectCommand: { watchEndpoint: { videoId: id } } } });
const mix = id => ({ tileRenderer: { contentType: 'TILE_CONTENT_TYPE_PLAYLIST', contentId: `RD${id}`, onSelectCommand: { watchEndpoint: { videoId: id, playlistId: `RD${id}` } } } });
const playlist = id => ({ tileRenderer: { contentType: 'TILE_CONTENT_TYPE_PLAYLIST', contentId: `PL${id}`, onSelectCommand: { watchEndpoint: { videoId: id, playlistId: `PL${id}` } } } });
const home = (items, browseId = 'FEwhat_to_watch') => ({
    responseContext: { serviceTrackingParams: [{ params: [{ key: 'browse_id', value: browseId }] }] },
    contents: { tvBrowseRenderer: { content: { tvSurfaceContentRenderer: { content: { sectionListRenderer: {
        contents: [{ shelfRenderer: { content: { horizontalListRenderer: { items } } } }] } } } } } },
});
const ids = r => r.contents.tvBrowseRenderer.content.tvSurfaceContentRenderer.content.sectionListRenderer.contents[0]
    .shelfRenderer.content.horizontalListRenderer.items.map(i => i.tileRenderer.contentId);

test('Mixes are removed from Home only; other playlists and videos stay', () => {
    assert.equal(isMix(mix('a')), true);
    assert.equal(isMix(playlist('a')), false);
    assert.deepEqual(ids(hideHomeMixes(home([video('a'), mix('b'), playlist('c')]), true)), ['a', 'PLc']);
    assert.deepEqual(ids(hideHomeMixes(home([video('a'), mix('b')], 'FEsubscriptions'), true)), ['a', 'RDb']);
    assert.deepEqual(ids(hideHomeMixes(home([video('a'), mix('b')]), false)), ['a', 'RDb']);
});
