import { configRead } from '../config.js';

// Hide Duplicate Videos: keep a video's first appearance on a page and drop
// later repeats, including rows left empty by that. The watch page (Up Next,
// pivot shelves) and playlists are left alone, where repeats are meaningful.
//
// Continuations (more rows, more tiles in a row) belong to the page that was
// loaded last, so they are compared against everything that page already showed.

let seen = new Set();
let active = false;

export function duplicateVideoId(item) {
  const tile = item?.tileRenderer;
  if (tile) {
    const command = tile.onSelectCommand;
    return command?.watchEndpoint?.videoId || command?.reelWatchEndpoint?.videoId
      || (tile.contentType === 'TILE_CONTENT_TYPE_VIDEO' || tile.contentType === 'TILE_CONTENT_TYPE_SHORTS' ? tile.contentId : null)
      || null;
  }
  const lockup = item?.lockupViewModel;
  if (lockup && /^LOCKUP_CONTENT_TYPE_(?:VIDEO|SHORT)$/.test(lockup.contentType || '')) return lockup.contentId || null;
  return null;
}

function browseId(r) {
  for (const service of r?.responseContext?.serviceTrackingParams || []) {
    const param = (service?.params || []).find(p => p?.key === 'browse_id');
    if (param) return String(param.value || '');
  }
  return '';
}

function onWatchOrPlaylist() {
  const hash = window.location?.hash || '';
  return /^#?\/?watch(?:[/?]|$)/.test(hash) || /[?&](?:c=VL|list=)/.test(hash);
}

function dedupeItems(items) {
  if (!Array.isArray(items)) return items;
  return items.filter(item => {
    const id = duplicateVideoId(item);
    if (!id) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function dedupeShelves(shelves) {
  if (!Array.isArray(shelves)) return shelves;
  return shelves.filter(shelf => {
    const list = shelf?.shelfRenderer?.content?.horizontalListRenderer;
    if (list && Array.isArray(list.items)) {
      const hadItems = list.items.length > 0;
      list.items = dedupeItems(list.items);
      return !hadItems || list.items.length > 0;
    }
    const grid = shelf?.shelfRenderer?.content?.gridRenderer || shelf?.gridRenderer;
    if (grid && Array.isArray(grid.items)) {
      const hadItems = grid.items.length > 0;
      grid.items = dedupeItems(grid.items);
      return !hadItems || grid.items.length > 0;
    }
    return true;
  });
}

function dedupeSurface(content) {
  if (!content) return false;
  let found = false;
  if (Array.isArray(content.sectionListRenderer?.contents)) {
    content.sectionListRenderer.contents = dedupeShelves(content.sectionListRenderer.contents);
    found = true;
  }
  if (Array.isArray(content.gridRenderer?.items)) {
    content.gridRenderer.items = dedupeItems(content.gridRenderer.items);
    found = true;
  }
  return found;
}

export function hideDuplicateVideos(r) {
  if (!r || typeof r !== 'object' || !configRead('hideDuplicateVideos')) return r;
  // Up Next and its continuations never take part.
  if (r.contents?.singleColumnWatchNextResults) return r;

  const browse = r.contents?.tvBrowseRenderer?.content;
  const surface = browse?.tvSurfaceContentRenderer?.content;
  const tabs = (browse?.tvSecondaryNavRenderer?.sections || [])
    .flatMap(section => section?.tvSecondaryNavSectionRenderer?.tabs || [])
    .map(tab => tab?.tabRenderer?.content?.tvSurfaceContentRenderer?.content)
    .filter(Boolean);
  const search = r.contents?.sectionListRenderer?.contents ? r.contents : null;

  if (surface || tabs.length || search) {
    // A new page: start over.
    seen = new Set();
    active = !browseId(r).startsWith('VL') && !onWatchOrPlaylist();
    if (!active) return r;
    dedupeSurface(surface);
    for (const tab of tabs) {
      // Each tab of a secondary navigation is its own page.
      seen = new Set();
      dedupeSurface(tab);
    }
    dedupeSurface(search);
    return r;
  }

  const continuation = r.continuationContents;
  if (!continuation || !active || onWatchOrPlaylist()) return r;
  if (Array.isArray(continuation.sectionListContinuation?.contents)) {
    continuation.sectionListContinuation.contents = dedupeShelves(continuation.sectionListContinuation.contents);
  }
  if (Array.isArray(continuation.horizontalListContinuation?.items)) {
    continuation.horizontalListContinuation.items = dedupeItems(continuation.horizontalListContinuation.items);
  }
  if (Array.isArray(continuation.gridContinuation?.items)) {
    continuation.gridContinuation.items = dedupeItems(continuation.gridContinuation.items);
  }
  return r;
}
