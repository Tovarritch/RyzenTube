import { isReturnYoutubeDislikeEnabled, requestVotes, getResponseVideoId } from './returnYoutubeDislike.js';
import { configChangeEmitter } from '../config.js';
import { setDiagnostic } from '../diagnostics.js';

const COUNT_ID = 'tt-dislike-count';
const DESCRIPTION_COUNT_ID = 'tt-description-dislike-count';

let activeVideoId = null;
let activeDislikes = null;
let requestGeneration = 0;
let retryAfter = 0;
const BUTTON_SELECTOR = 'button, [role="button"], ytlr-button, ytlr-button-renderer, ytlr-toggle-button-renderer, ytlr-like-button';
const buttonStyles = new Map();
const nativeModels = new Map();
const countFields = ['dislikeCountText', 'dislikeCountWithDislikeText', 'dislikeCountWithUndislikeText'];

function clearCounts() {
  for (const [instance, saved] of nativeModels) {
    for (const key of countFields) {
      if (saved.original[key] === undefined) delete saved.data[key];
      else saved.data[key] = saved.original[key];
    }
    saved.update({ ttDislikeCount: null });
  }
  nativeModels.clear();
  for (const [element, style] of buttonStyles) {
    if (style === null) element.removeAttribute('style');
    else element.setAttribute('style', style);
  }
  buttonStyles.clear();
  document.getElementById(COUNT_ID)?.remove();
  document.getElementById(DESCRIPTION_COUNT_ID)?.remove();
}

function renderNativeCount(button, text) {
  const instance = button.closest('ytlr-like-button-renderer')?.__instance;
  const data = instance?.props?.data;
  if (!data) return false;
  let saved = nativeModels.get(instance);
  if (!saved || saved.data !== data) {
    // The native selection callback calls the component's state updater.
    // Its minified name differs by client; derive it instead of guessing K/J.
    const selector = Object.values(instance).find(value => typeof value === 'function'
      && /this\.([\w$]+)\(\{selectedIndex:[\w$]+\}\)/.test(String(value)));
    const method = selector && String(selector).match(/this\.([\w$]+)\(\{selectedIndex:[\w$]+\}\)/)?.[1];
    if (!method || typeof instance[method] !== 'function') return false;
    saved = { data, original: Object.fromEntries(countFields.map(key => [key, data[key]])), update: state => instance[method](state) };
    nativeModels.set(instance, saved);
  }
  const changed = countFields.some(key => data[key]?.simpleText !== text);
  if (changed || saved.text !== text) {
    for (const key of countFields) data[key] = { simpleText: text, accessibility: { accessibilityData: { label: `${text} Dislikes` } } };
    saved.text = text;
    // Keep native selection, commands, dimensions and title placement intact.
    // The native title appears BELOW the focused icon, exactly like Likes.
    saved.update({ ttDislikeCount: `${activeVideoId}:${text}` });
  }
  document.getElementById(COUNT_ID)?.remove();
  setDiagnostic('dislikeDisplay', 'Native count below thumbs-down');
  return true;
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
  const container = group?.querySelector('yt-button-container[idomkey="dislike-button"], [role="button"][idomkey="dislike-button"]');
  if (container) return container;
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
    const nativeFactoid = Array.from(header.querySelectorAll('*')).some(element =>
      !element.children.length && element.textContent.trim() === 'Dislikes'
      && !element.closest(`#${DESCRIPTION_COUNT_ID}`));
    let descriptionCount = header.querySelector(`#${DESCRIPTION_COUNT_ID}`);
    if (nativeFactoid) descriptionCount?.remove();
    else if (!descriptionCount) {
      descriptionCount = document.createElement('div');
      descriptionCount.id = DESCRIPTION_COUNT_ID;
      descriptionCount.style.cssText = 'color:inherit;font:inherit;margin-top:.5em';
      header.appendChild(descriptionCount);
    }
    const descriptionText = `${formatCount(activeDislikes)} Dislikes`;
    if (!nativeFactoid && descriptionCount.textContent !== descriptionText) descriptionCount.textContent = descriptionText;
  }
  const button = findDislikeButton();
  if (!button) {
    setDiagnostic('dislikeDisplay', 'Count received; thumbs-down control not found');
    return;
  }

  const text = formatCount(activeDislikes);
  if (renderNativeCount(button, text)) return;

  let count = button.querySelector(`#${COUNT_ID}`);
  if (!count) {
    const nativeContainer = button.tagName.toLowerCase() === 'yt-button-container';
    const template = nativeContainer ? null : likeCountTemplate(button);
    count = template ? template.cloneNode(false) : document.createElement('span');
    count.id = COUNT_ID;
    count.removeAttribute?.('aria-label');
    count.style.cssText = 'display:block;position:absolute;top:100%;left:50%;transform:translateX(-50%);margin-top:.35em;font:inherit;color:inherit;white-space:nowrap';
    // Legacy clients without a native component get a label below the icon.
    if (!buttonStyles.has(button)) buttonStyles.set(button, button.getAttribute('style'));
    button.style.position = 'relative';
    button.appendChild(count);
  }
  if (count.textContent !== text) count.textContent = text;
  setDiagnostic('dislikeDisplay', 'Count below thumbs-down');
  if (!/dislike/i.test(button.getAttribute('aria-label') || '')) {
    button.setAttribute('aria-label', `Dislike, ${text}`);
  }
}

async function update() {
  if (!isReturnYoutubeDislikeEnabled()) {
    setDiagnostic('dislikeDisplay', 'Return YouTube Dislike is disabled');
    activeVideoId = null;
    activeDislikes = null;
    requestGeneration++;
    clearCounts();
    return;
  }
  const videoId = currentVideoId();
  if (!videoId) {
    setDiagnostic('dislikeDisplay', 'No playing video detected');
    return;
  }
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
