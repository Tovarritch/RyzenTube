import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = { location: { hash: '#/' } };
const { markRows, reflowRows, hideRelevantRow } = await import('../features/rowReflow.js');

const tile = id => ({ tileRenderer: { contentId: id } });
const row = (ids, title) => ({ shelfRenderer: { title: title ? { simpleText: title } : undefined, content: { horizontalListRenderer: { items: ids.map(tile) } } } });
const page = (shelves, more = false) => ({ contents: { tvBrowseRenderer: { content: { tvSurfaceContentRenderer: { content: { sectionListRenderer: {
    contents: shelves, continuations: more ? [{ nextContinuationData: { continuation: 'x' } }] : undefined } } } } } } });
const next = (shelves, more = false) => ({ continuationContents: { sectionListContinuation: {
    contents: shelves, continuations: more ? [{ nextContinuationData: { continuation: 'y' } }] : undefined } } });
const rowsOf = list => list.map(s => s.shelfRenderer.content.horizontalListRenderer.items.map(i => i.tileRenderer.contentId));
const titles = list => list.map(s => s.shelfRenderer.title?.simpleText || null);
const drop = (r, ids) => {
    const lists = r.contents?.tvBrowseRenderer?.content?.tvSurfaceContentRenderer?.content?.sectionListRenderer?.contents
        || r.continuationContents.sectionListContinuation.contents;
    for (const s of lists) {
        const list = s.shelfRenderer.content.horizontalListRenderer;
        list.items = list.items.filter(i => !ids.includes(i.tileRenderer.contentId));
    }
};
const contentsOf = r => r.contents?.tvBrowseRenderer?.content?.tvSurfaceContentRenderer?.content?.sectionListRenderer?.contents
    || r.continuationContents.sectionListContinuation.contents;

test('grid rows are refilled in order and emptied rows dropped, keeping the title', () => {
    const r = page([row(['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7'], 'Most relevant'),
        row(['a', 'b', 'c'], 'All subscriptions'), row(['d', 'e', 'f']), row(['g', 'h', 'i']), row(['j', 'k', 'l'])]);
    markRows(r);
    drop(r, ['a', 'b', 'c', 'e', 'm2']);
    reflowRows(r);
    const list = contentsOf(r);
    assert.deepEqual(rowsOf(list), [['m1', 'm3', 'm4', 'm5', 'm6', 'm7'], ['d', 'f', 'g'], ['h', 'i', 'j'], ['k', 'l']]);
    assert.deepEqual(titles(list), ['Most relevant', 'All subscriptions', null, null]);
});

test('a page that continues ends on full rows; the rest opens the next page', () => {
    const first = page([row(['a', 'b', 'c'], 'All subscriptions'), row(['d', 'e', 'f'])], true);
    markRows(first);
    drop(first, ['b']);
    reflowRows(first);
    assert.deepEqual(rowsOf(contentsOf(first)), [['a', 'c', 'd']]);
    const second = next([row(['g', 'h', 'i']), row(['j', 'k', 'l'])]);
    markRows(second);
    drop(second, ['h']);
    reflowRows(second);
    assert.deepEqual(rowsOf(contentsOf(second)), [['e', 'f', 'g'], ['i', 'j', 'k'], ['l']]);
});

test('titled rows that scroll sideways are left alone', () => {
    const r = page([row(['a', 'b', 'c', 'd', 'e', 'f', 'g'], 'Recommended'), row(['h', 'i'], 'Trending')]);
    markRows(r);
    drop(r, ['b']);
    reflowRows(r);
    assert.deepEqual(rowsOf(contentsOf(r)), [['a', 'c', 'd', 'e', 'f', 'g'], ['h', 'i']]);
});

test('Subscriptions loses its Most relevant row; other pages keep theirs', () => {
    const subs = () => {
        const r = page([row(['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7'], 'Most relevant'), row(['a', 'b', 'c'], 'All subscriptions'), row(['d', 'e', 'f'])]);
        r.responseContext = { serviceTrackingParams: [{ params: [{ key: 'browse_id', value: 'FEsubscriptions' }] }] };
        return r;
    };
    const r = subs();
    markRows(r);
    hideRelevantRow(r, true);
    assert.deepEqual(titles(contentsOf(r)), ['All subscriptions', null]);
    const off = subs();
    hideRelevantRow(off, false);
    assert.equal(contentsOf(off).length, 3);
    const home = page([row(['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7'], 'Most relevant'), row(['a', 'b', 'c'], 'Trending')]);
    hideRelevantRow(home, true);
    assert.equal(contentsOf(home).length, 2);
});
