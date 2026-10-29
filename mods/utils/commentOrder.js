// Comment ordering for the Best / New / Old buttons in the comments panel.

export const COMMENT_SORTS = [
  ['best', 'Best', 'Most liked first', 'LIKE'],
  ['new', 'New', 'Newest first', 'UP_ARROW'],
  ['old', 'Old', 'Oldest first', 'DOWN_ARROW'],
];

const UNITS = { second: 1, minute: 60, hour: 3600, day: 86400, week: 604800, month: 2629800, year: 31557600 };
// "5 hours ago", "6 years ago (edited)" -> seconds.
export function parseAge(text) {
  const match = /(\d+)\s*(second|minute|hour|day|week|month|year)/i.exec(String(text || ''));
  return match ? Number(match[1]) * UNITS[match[2].toLowerCase()] : null;
}
// "4.8m", "249k", "1,234" -> number.
export function parseCount(text) {
  const match = /([\d.,]+)\s*([kmb])?/i.exec(String(text || ''));
  if (!match) return 0;
  const value = Number(match[1].replace(/,/g, ''));
  return Math.round(value * ({ k: 1e3, m: 1e6, b: 1e9 }[(match[2] || '').toLowerCase()] || 1)) || 0;
}

const commentOf = thread => thread?.commentThreadRenderer?.comment?.commentRenderer;
const likes = thread => parseCount(commentOf(thread)?.voteCount?.simpleText);
const age = thread => parseAge(commentOf(thread)?.publishedTimeText?.simpleText);
const pinned = thread => !!commentOf(thread)?.pinnedCommentBadge;

export function sortThreads(threads, mode) {
  const seen = new Set();
  const unique = threads.filter(thread => {
    const id = commentOf(thread)?.commentId;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  const compare = {
    best: (a, b) => likes(b.thread) - likes(a.thread),
    new: (a, b) => (age(a.thread) ?? Infinity) - (age(b.thread) ?? Infinity),
    old: (a, b) => (age(b.thread) ?? -1) - (age(a.thread) ?? -1),
  }[mode];
  // The pinned comment stays first, as YouTube shows it in every order.
  return unique.map((thread, index) => ({ thread, index }))
    .sort((a, b) => (pinned(b.thread) - pinned(a.thread)) || compare(a, b) || a.index - b.index)
    .map(entry => entry.thread);
}
