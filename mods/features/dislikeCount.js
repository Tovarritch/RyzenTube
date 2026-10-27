import { isReturnYoutubeDislikeEnabled, requestVotes } from './returnYoutubeDislike.js';

const COUNT_ID = 'tt-dislike-count';

let activeVideoId = null;
let activeDislikes = null;
let requestGeneration = 0;

function currentVideoId() {
  const playerId = document.querySelector('.html5-video-player')?.getVideoData?.()?.video_id;
  if (playerId) return playerId;
  try {
    const route = new URL(location.hash.substring(1), location.href);
    return route.searchParams.get('v');
  } catch (_) {
    return null;
  }
}

function formatCount(value) {
  if (value >= 1000000000) return `${(value / 1000000000).toFixed(value >= 10000000000 ? 0 : 1)}B`;
  if (value >= 1000000) return `${(value / 1000000).toFixed(value >= 10000000 ? 0 : 1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K`;
  return String(value);
}

function buttonLabel(element) {
  return `${element.getAttribute?.('aria-label') || ''} ${element.getAttribute?.('title') || ''}`.toLowerCase();
}

function findActionButton(pattern) {
  const buttonSelector = 'button, [role="button"], ytlr-button, ytlr-button-renderer, ytlr-toggle-button-renderer';
  for (const element of document.querySelectorAll(buttonSelector)) {
    if (pattern.test(buttonLabel(element))) return element;
  }

  for (const icon of document.querySelectorAll('[icon], [icon-type], yt-icon, .yt-icon')) {
    const hint = `${icon.getAttribute?.('icon') || ''} ${icon.getAttribute?.('icon-type') || ''} ${icon.id || ''} ${icon.className || ''}`;
    if (pattern.test(hint)) {
      return icon.closest(buttonSelector);
    }
  }
  return null;
}

function findDislikeButton() {
  const direct = findActionButton(/\b(dislike|thumb(?:s)?[_ -]?down)\b/i);
  if (direct) return direct;

  // Some TV builds expose a label only for Like. Dislike is the adjacent
  // toggle in the same segmented action control.
  const like = findActionButton(/\b(like|thumb(?:s)?[_ -]?up)\b/i);
  if (!like) return null;
  const actions = Array.from(like.parentElement?.querySelectorAll?.(
    'button, [role="button"], ytlr-button, ytlr-button-renderer, ytlr-toggle-button-renderer'
  ) || []);
  const likeIndex = actions.indexOf(like);
  return actions[likeIndex + 1] || null;
}

function likeCountTemplate(dislikeButton) {
  const like = findActionButton(/\b(like|thumb(?:s)?[_ -]?up)\b/i);
  if (!like || like === dislikeButton) return null;
  return Array.from(like.querySelectorAll('*')).find(element =>
    element.children.length === 0 && /^\s*[\d.,]+\s*[KMB]?\s*$/i.test(element.textContent || '')
  ) || null;
}

function render() {
  if (activeDislikes === null) return;
  const button = findDislikeButton();
  if (!button) return;

  let count = button.querySelector(`#${COUNT_ID}`);
  if (!count) {
    const template = likeCountTemplate(button);
    count = template ? template.cloneNode(false) : document.createElement('span');
    count.id = COUNT_ID;
    count.removeAttribute?.('aria-label');
    if (!template) {
      count.style.cssText = 'display:inline-block;margin-left:.35em;font:inherit;color:inherit';
    }
    button.appendChild(count);
  }
  const text = formatCount(activeDislikes);
  if (count.textContent !== text) count.textContent = text;
  if (!/dislike/i.test(button.getAttribute('aria-label') || '')) {
    button.setAttribute('aria-label', `Dislike, ${text}`);
  }
}

async function update() {
  if (!isReturnYoutubeDislikeEnabled()) {
    activeVideoId = null;
    activeDislikes = null;
    document.getElementById(COUNT_ID)?.remove();
    return;
  }
  const videoId = currentVideoId();
  if (!videoId) return;
  if (videoId === activeVideoId) {
    render();
    return;
  }

  activeVideoId = videoId;
  activeDislikes = null;
  document.getElementById(COUNT_ID)?.remove();
  const generation = ++requestGeneration;

  try {
    const data = await requestVotes(videoId);
    if (generation !== requestGeneration || activeVideoId !== videoId) return;
    if (typeof data?.dislikes !== 'number') throw new Error('Missing dislikes count');
    activeDislikes = Math.max(0, Math.round(data.dislikes));
    render();
  } catch (error) {
    console.warn('TizenTube: failed to load dislike count:', error);
  }
}

function init() {
  if (!document.body) return setTimeout(init, 100);
  new MutationObserver(render).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('hashchange', () => setTimeout(update, 100));
  document.addEventListener('loadedmetadata', update, true);
  setInterval(update, 1500);
  update();
}

init();
