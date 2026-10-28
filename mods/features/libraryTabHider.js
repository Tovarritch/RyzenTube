import { configRead } from '../config.js';

export const LIBRARY_TABS = [
  ['femusic_last_played', 'Music'], ['festorefront', 'Movies & Shows'],
  ['fecollection_podcasts', 'Podcasts'], ['femy_videos', 'My Videos'],
  ['fehistory', 'History'], ['femy_youtube', 'Watch Later'],
  ['feplaylist_aggregation', 'Playlists'],
];
const known = new Set(LIBRARY_TABS.map(([id]) => id));
function tabId(item) {
  const tile = item?.tileRenderer;
  const id = tile?.contentId || tile?.onSelectCommand?.browseEndpoint?.browseId
    || item?.tabRenderer?.endpoint?.browseEndpoint?.browseId
    || item?.navigationEndpoint?.browseEndpoint?.browseId;
  return String(id || '').toLowerCase();
}

export function filterLibraryTabs(root, hidden = configRead('hiddenLibraryTabIds')) {
  if (!root || !Array.isArray(hidden) || !hidden.length) return root;
  const ids = new Set(hidden.map(id => String(id).toLowerCase()).filter(id => known.has(id)));
  const visit = node => {
    if (!node || typeof node !== 'object') return;
    for (const key of Object.keys(node)) {
      let value = node[key];
      // Only tab collections and horizontal navigation tiles are eligible.
      // Never prune video shelves by title or partial ID matches.
      if (Array.isArray(value) && ['tabs', 'items'].includes(key) && value.some(item => known.has(tabId(item)))) {
        node[key] = value = value.filter(item => !ids.has(tabId(item)));
        const selected = value.findIndex(item => item?.tabRenderer?.selected);
        if (key === 'tabs' && value.length && selected < 0 && value[0].tabRenderer) value[0].tabRenderer.selected = true;
        if (Number.isInteger(node.selectedIndex)) node.selectedIndex = Math.min(node.selectedIndex, Math.max(0, value.length - 1));
      }
      if (value && typeof value === 'object') {
        if (Array.isArray(value)) value.forEach(visit); else visit(value);
      }
    }
  };
  visit(root);
  return root;
}
