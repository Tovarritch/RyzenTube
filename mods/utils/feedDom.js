let lastFocusedFeedItem = null;

const ITEM_HINT = /(tile|lockup|card|grid-item)/i;
const ROW_HINT = /(shelf|horizontal-list|grid-renderer|section-list)/i;

function elementHint(element) {
  if (!element) return '';
  return `${element.tagName || ''} ${element.id || ''} ${element.className || ''}`;
}

function findFeedItem(element) {
  let current = element;
  let fallback = null;
  for (let depth = 0; current && current !== document.body && depth < 10; depth++) {
    if (ITEM_HINT.test(elementHint(current)) || current.getAttribute?.('role') === 'listitem') {
      return current;
    }
    const parent = current.parentElement;
    if (!fallback && parent?.children?.length > 1 && !ROW_HINT.test(elementHint(current))) {
      fallback = current;
    }
    current = parent;
  }
  return fallback;
}

function hideElement(element) {
  if (!element || !element.isConnected) return false;
  element.style.setProperty('display', 'none', 'important');
  element.setAttribute('aria-hidden', 'true');
  element.dataset.ttHidden = 'true';
  return true;
}

function rememberFocusedFeedItem() {
  const focused = document.activeElement;
  if (focused?.closest?.('[role="dialog"], ytlr-menu-renderer, ytlr-overlay-renderer, [class*="popup"], [class*="menu"]')) {
    return;
  }
  const item = findFeedItem(focused);
  if (item) lastFocusedFeedItem = item;
}

// Remember the tile before YouTube moves focus into the long-press popup.
document.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.keyCode === 13) rememberFocusedFeedItem();
}, true);

export function hideSelectedFeedItem(videoId) {
  if (hideElement(lastFocusedFeedItem)) return true;
  if (!videoId) return false;

  const markers = document.querySelectorAll('a[href], img[src], [data-video-id]');
  for (const marker of markers) {
    const value = `${marker.getAttribute('href') || ''} ${marker.getAttribute('src') || ''} ${marker.getAttribute('data-video-id') || ''}`;
    if (value.includes(videoId) && hideElement(findFeedItem(marker))) return true;
  }
  return false;
}

export function hideChannelFeedItems(channel) {
  if (!channel) return 0;
  const id = (channel.id || '').toLowerCase();
  const name = (channel.name || '').trim().toLowerCase();
  if (!id && !name) return 0;

  const candidates = document.querySelectorAll(
    'ytlr-tile-renderer, ytlr-lockup-view-model, ytlr-video-tile, [role="listitem"], [class*="tile-renderer"], [class*="lockup"]'
  );
  let hidden = 0;
  for (const candidate of candidates) {
    if (candidate.dataset?.ttHidden === 'true') continue;
    const textMatches = name && (candidate.textContent || '').trim().toLowerCase().includes(name);
    const linkMatches = id && Array.from(candidate.querySelectorAll?.('a[href]') || [])
      .some((link) => (link.getAttribute('href') || '').toLowerCase().includes(id));
    if ((textMatches || linkMatches) && hideElement(candidate)) hidden++;
  }
  return hidden;
}
