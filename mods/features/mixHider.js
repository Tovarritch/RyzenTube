// Hide Mixes on Home: YouTube's auto-generated "Mix" playlists. Their playlist
// IDs start with "RD" (radio). Rows left empty are dropped by rowReflow.js.

function browseIdOf(r) {
  for (const service of r?.responseContext?.serviceTrackingParams || []) {
    const param = (service?.params || []).find(p => p?.key === 'browse_id');
    if (param) return String(param.value || '');
  }
  return '';
}

const HOME_IDS = ['FEwhat_to_watch', 'FEhome', 'FEtopics'];
function onHome(r) {
  const id = browseIdOf(r);
  if (id) return HOME_IDS.includes(id);
  // Continuations carry no browse ID; they belong to the page on screen.
  return /^#?\/?$/.test(window.location?.hash || '');
}

const isMixId = id => typeof id === 'string' && id.startsWith('RD');
export function isMix(item) {
  const tile = item?.tileRenderer;
  if (tile) {
    const command = tile.onSelectCommand || {};
    return isMixId(command.watchEndpoint?.playlistId) || isMixId(command.watchPlaylistEndpoint?.playlistId)
      || (tile.contentType === 'TILE_CONTENT_TYPE_PLAYLIST' && isMixId(tile.contentId));
  }
  const lockup = item?.lockupViewModel;
  if (lockup) {
    const command = lockup.rendererContext?.commandContext?.onTap?.innertubeCommand || {};
    return isMixId(command.watchEndpoint?.playlistId) || isMixId(command.watchPlaylistEndpoint?.playlistId)
      || (/PLAYLIST/.test(lockup.contentType || '') && isMixId(lockup.contentId));
  }
  return false;
}

function filterRows(shelves) {
  for (const shelf of shelves || []) {
    const list = shelf?.shelfRenderer?.content?.horizontalListRenderer;
    if (list && Array.isArray(list.items)) list.items = list.items.filter(item => !isMix(item));
  }
}

export function hideHomeMixes(r, enabled) {
  if (!enabled || !r || typeof r !== 'object' || !onHome(r)) return r;
  filterRows(r.contents?.tvBrowseRenderer?.content?.tvSurfaceContentRenderer?.content?.sectionListRenderer?.contents);
  filterRows(r.continuationContents?.sectionListContinuation?.contents);
  const row = r.continuationContents?.horizontalListContinuation;
  if (row && Array.isArray(row.items)) row.items = row.items.filter(item => !isMix(item));
  return r;
}
