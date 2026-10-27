import { isReturnYoutubeDislikeEnabled, requestVotes, getResponseVideoId } from './returnYoutubeDislike.js';
import { configChangeEmitter } from '../config.js';

const COUNT_ID = 'tt-dislike-count';
const DESCRIPTION_COUNT_ID = 'tt-description-dislike-count';

let activeVideoId = null;
let activeDislikes = null;
let requestGeneration = 0;
let retryAfter = 0;
const BUTTON_SELECTOR = 'button, [role="button"], ytlr-button, ytlr-button-renderer, ytlr-toggle-button-renderer, ytlr-like-button';
const nativeCounts = new Map();

function repaint(instance, text) {
  // Fa is the TV client's force-render operation. K({}) may be skipped when
  // the shallow state comparison sees no change after editing props.data.
  if (typeof instance.Fa === 'function') instance.Fa();
  else instance.K({ ttDislikeCount: text });
}

// Current YouTube TV builds use minified CSS classes and expose their rendered
// component on __instance. Update the native model so the normal button title
// is laid out alongside the icon, including when the renderer is replaced.
function updateNativeCounts() {
  for (const host of nativeCounts.keys()) {
    if (!host.isConnected) nativeCounts.delete(host);
  }
  let updatedButton = false;
  const text = formatCount(activeDislikes);
  for (const host of document.querySelectorAll('ytlr-like-button-renderer, ytlr-video-description-header-renderer')) {
    const instance = host.__instance;
    const data = instance?.props?.data;
    if (!data || typeof instance.K !== 'function') continue;
    if (host.tagName.toLowerCase() === 'ytlr-like-button-renderer') {
      const keys = ['dislikeCountText', 'dislikeCountWithDislikeText', 'dislikeCountWithUndislikeText'];
      const previous = nativeCounts.get(host);
      if (previous?.videoId === activeVideoId && previous.text === text && previous.data === data
          && data.dislikeCountText?.simpleText === text) {
        updatedButton = true;
        continue;
      }
      nativeCounts.set(host, { videoId: activeVideoId, text, data,
        values: previous?.data === data ? previous.values : keys.map(key => data[key]) });
      for (const key of keys) data[key] = { simpleText: text, accessibility: { accessibilityData: { label: `${text} Dislikes` } } };
      repaint(instance, text);
      updatedButton = true;
    }
  }
  return updatedButton;
}

function clearCounts() {
  for (const [host, saved] of nativeCounts) {
    if (host.__instance?.props?.data !== saved.data) continue;
    ['dislikeCountText', 'dislikeCountWithDislikeText', 'dislikeCountWithUndislikeText'].forEach((key, index) => {
      if (saved.values[index] === undefined) delete saved.data[key];
      else saved.data[key] = saved.values[index];
    });
    repaint(host.__instance, null);
  }
  nativeCounts.clear();
  document.getElementById(COUNT_ID)?.remove();
  document.getElementById(DESCRIPTION_COUNT_ID)?.remove();
}

function currentVideoId() {
  const playerId = document.querySelector('.html5-video-player')?.getVideoData?.()?.video_id;
  if (playerId) return playerId;
  try {
    const route = new URL(location.hash.substring(1), location.href);
    return route.searchParams.get('v') || getResponseVideoId();
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
  const buttonSelector = BUTTON_SELECTOR;
  for (const element of document.querySelectorAll(buttonSelector)) {
    if (pattern.test(buttonLabel(element))) return element;
  }

  for (const icon of document.querySelectorAll('[icon], [icon-type], [class*="Thumb"], [class*="thumb"], [class*="Dislike"], [class*="dislike"], yt-icon, .yt-icon')) {
    const hint = `${icon.getAttribute?.('icon') || ''} ${icon.getAttribute?.('icon-type') || ''} ${icon.id || ''} ${icon.className || ''}`;
    if (pattern.test(hint)) {
      return icon.closest(buttonSelector) || icon.closest('ytlr-like-button-renderer') || icon.parentElement;
    }
  }
  return null;
}

function findDislikeButton() {
  const group = document.querySelector('ytlr-like-button-renderer');
  const nativeButton = group && Array.from(group.querySelectorAll('*')).find(element =>
    element.getAttribute('idomkey') === 'dislike-button'
    || element.__instance?.props?.idomKey === 'dislike-button'
    || element.__instance?.props?.icon === 'DISLIKE'
  );
  if (nativeButton) return nativeButton;
  const direct = findActionButton(/dislike|thumb(?:s)?[_ -]?down/i);
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
  if (!isReturnYoutubeDislikeEnabled() || activeDislikes === null) return;
  // The description can be opened after playback has begun and after its
  // response has been consumed. Render the fetched count there as well.
  const header = document.querySelector('ytlr-video-description-header-renderer, ytlr-video-description-header');
  if (header) {
    let descriptionCount = header.querySelector(`#${DESCRIPTION_COUNT_ID}`);
    if (!descriptionCount) {
      descriptionCount = document.createElement('div');
      descriptionCount.id = DESCRIPTION_COUNT_ID;
      descriptionCount.style.cssText = 'color:inherit;font:inherit;margin-top:.5em';
      header.appendChild(descriptionCount);
    }
    const descriptionText = `${formatCount(activeDislikes)} Dislikes`;
    if (descriptionCount.textContent !== descriptionText) descriptionCount.textContent = descriptionText;
  }
  if (updateNativeCounts()) return;
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
    requestGeneration++;
    clearCounts();
    return;
  }
  const videoId = currentVideoId();
  if (!videoId) return;
  if (videoId === activeVideoId && (activeDislikes !== null || Date.now() < retryAfter)) {
    render();
    return;
  }

  activeVideoId = videoId;
  activeDislikes = null;
  clearCounts();
  const generation = ++requestGeneration;
  retryAfter = Date.now() + 30000;

  try {
    const data = await requestVotes(videoId);
    if (!isReturnYoutubeDislikeEnabled() || generation !== requestGeneration || activeVideoId !== videoId) return;
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
  // Update immediately when the response-level request finishes, including
  // when the controls were already rendered before the service responded.
  window.addEventListener('tt-dislike-votes', event => {
    if (!isReturnYoutubeDislikeEnabled() || event.detail?.videoId !== currentVideoId()) return;
    if (activeVideoId !== event.detail.videoId) clearCounts();
    activeVideoId = event.detail.videoId;
    activeDislikes = event.detail.dislikes;
    render();
  });
  configChangeEmitter.addEventListener('configChange', event => {
    if (event.detail?.key === 'enableReturnYoutubeDislike') {
      activeVideoId = null;
      activeDislikes = null;
      retryAfter = 0;
      update();
    }
  });
  setInterval(update, 1500);
  update();
}

init();
