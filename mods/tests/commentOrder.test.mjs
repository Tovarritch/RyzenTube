import { test } from 'node:test';
import assert from 'node:assert/strict';

const { parseAge, parseCount, sortThreads } = await import('../utils/commentOrder.js');

const thread = (id, likes, published, pinned = false) => ({ commentThreadRenderer: { comment: { commentRenderer: {
    commentId: id,
    voteCount: likes === null ? undefined : { simpleText: likes },
    publishedTimeText: { simpleText: published },
    pinnedCommentBadge: pinned ? {} : undefined,
} } } });
const ids = threads => threads.map(t => t.commentThreadRenderer.comment.commentRenderer.commentId);

test('parses YouTube like counts and relative ages', () => {
    assert.equal(parseCount('4.8m'), 4800000);
    assert.equal(parseCount('249K'), 249000);
    assert.equal(parseCount('1,234'), 1234);
    assert.equal(parseCount(undefined), 0);
    assert.equal(parseAge('18 seconds ago'), 18);
    assert.equal(parseAge('5 hours ago (edited)'), 18000);
    assert.ok(parseAge('6 years ago') > parseAge('11 months ago'));
    assert.equal(parseAge('Streamed live'), null);
});

const sample = () => [
    thread('pin', '10', '1 year ago', true),
    thread('a', '249k', '7 years ago'),
    thread('b', '4', '30 minutes ago'),
    thread('c', '310k', '6 months ago'),
    thread('d', null, '1 day ago'),
    thread('a', '249k', '7 years ago'),
];

test('Best puts the most liked first, keeping the pinned comment on top', () => {
    assert.deepEqual(ids(sortThreads(sample(), 'best')), ['pin', 'c', 'a', 'b', 'd']);
});

test('New and Old order by age and drop repeats', () => {
    assert.deepEqual(ids(sortThreads(sample(), 'new')), ['pin', 'b', 'd', 'c', 'a']);
    assert.deepEqual(ids(sortThreads(sample(), 'old')), ['pin', 'a', 'c', 'd', 'b']);
});
