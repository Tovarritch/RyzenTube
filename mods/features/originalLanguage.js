import { configRead, configChangeEmitter } from '../config.js';

const titles = new Map(), pending = new Map(), oldTitles = new Map(), retry = new Map();
const queue = [];
let running = 0;
let appliedAudio = null;
let audioBusy = false;
const validId = id => typeof id === 'string' && /^[\w-]{11}$/.test(id);

// YouTube's own oEmbed metadata contains the creator's title. Requests stay on
// YouTube, need no API key and are bounded to three at a time and 200 cached IDs.
function pump() {
  while (running < 3 && queue.length) {
    const { id, resolve } = queue.shift();
    if (!configRead('enableOriginalTitles')) { pending.delete(id); resolve(null); continue; }
    running++;
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timeout = setTimeout(() => controller?.abort(), 10000);
    fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`,
      { credentials: 'omit', ...(controller ? { signal: controller.signal } : {}) })
      .then(response => { if (!response.ok) throw new Error('Metadata unavailable'); return response.json(); })
      .then(data => {
        const title = typeof data.title === 'string' ? data.title.trim() : '';
        if (!title) throw new Error('Missing original title');
        if (titles.size >= 200) { const oldest = titles.keys().next().value; titles.delete(oldest); oldTitles.delete(oldest); }
        titles.set(id, title);
        resolve(title);
        scheduleDOM();
      }).catch(() => { retry.set(id, Date.now() + 60000); resolve(null); })
      .finally(() => { clearTimeout(timeout); running--; pending.delete(id); pump(); });
  }
}
export function originalTitle(id) {
  if (!configRead('enableOriginalTitles') || !validId(id)) return Promise.resolve(null);
  if (titles.has(id)) return Promise.resolve(titles.get(id));
  if (pending.has(id)) return pending.get(id);
  if (Date.now() < (retry.get(id) || 0)) return Promise.resolve(null);
  const request = new Promise(resolve => queue.push({ id, resolve }));
  pending.set(id, request);
  pump();
  return request;
}
function replaceTitle(id, node, key) {
  if (!node || typeof node[key] !== 'string' || !validId(id)) return;
  if (!oldTitles.has(id)) oldTitles.set(id, new Set());
  if (oldTitles.size > 220) oldTitles.delete(oldTitles.keys().next().value);
  oldTitles.get(id).add(node[key]);
  const update = title => { if (title && configRead('enableOriginalTitles')) node[key] = title; };
  if (titles.has(id)) update(titles.get(id)); else originalTitle(id).then(update);
}
export function patchOriginalMetadata(response) {
  if (!configRead('enableOriginalTitles') || !response || typeof response !== 'object') return response;
  const visit = node => {
    if (!node || typeof node !== 'object') return;
    if (node.videoDetails) replaceTitle(node.videoDetails.videoId, node.videoDetails, 'title');
    if (node.tileRenderer) replaceTitle(node.tileRenderer.contentId || node.tileRenderer.onSelectCommand?.watchEndpoint?.videoId,
      node.tileRenderer.metadata?.tileMetadataRenderer?.title, 'simpleText');
    if (node.lockupViewModel) replaceTitle(node.lockupViewModel.contentId,
      node.lockupViewModel.metadata?.lockupMetadataViewModel?.title, 'content');
    for (const value of Object.values(node)) if (value && typeof value === 'object') {
      if (Array.isArray(value)) value.forEach(visit); else visit(value);
    }
  };
  visit(response);
  return response;
}

export function findOriginalTrack(tracks) {
  return tracks?.find(track => {
    if (track.isOriginal === true || track.audioTrackType === 'ORIGINAL') return true;
    const name = `${track.displayName || ''} ${Object.values(track).filter(v => v && typeof v === 'object').map(v => v.name || '').join(' ')}`;
    if (/original|оригинал|オリジナル|原始|원본|origineel|oryginał|původní|orijinal|gốc|أصلي/i.test(name)) return true;
    try { return atob(String(track.id).split(';')[1] || '').includes('original'); } catch (_) { return false; }
  }) || null;
}
export async function applyOriginalAudio(player) {
  if (!configRead('enableOriginalAudio') || audioBusy) return;
  const id = player?.getVideoData?.()?.video_id;
  if (!id || id === appliedAudio || typeof player.getAvailableAudioTracks !== 'function') return;
  audioBusy = true;
  try {
    const tracks = await player.getAvailableAudioTracks();
    const original = findOriginalTrack(tracks);
    if (!original || !configRead('enableOriginalAudio') || player.getVideoData()?.video_id !== id) return;
    const current = await player.getAudioTrack?.();
    if (!configRead('enableOriginalAudio') || player.getVideoData()?.video_id !== id) return;
    if (current?.id !== original.id) await player.setAudioTrack(original);
    // Apply once per video, preserving a subsequent manual audio choice.
    appliedAudio = id;
  } catch (_) { /* Tracks may not be ready yet. Retry while this video loads. */ }
  finally { audioBusy = false; }
}

function updateDOM() {
  const player = document.querySelector('.html5-video-player');
  applyOriginalAudio(player);
  if (!configRead('enableOriginalTitles')) return;
  const videoId = player?.getVideoData?.()?.video_id;
  const videoTitle = player?.getVideoData?.()?.title;
  if (validId(videoId)) {
    if (!oldTitles.has(videoId)) oldTitles.set(videoId, new Set());
    if (videoTitle) oldTitles.get(videoId).add(videoTitle);
    originalTitle(videoId);
  }
  for (const el of document.querySelectorAll('ytlr-tile-renderer, yt-lockup-view-model, ytlr-lockup-view-model')) {
    const data = el.__instance?.props?.data || el.__instance?.props;
    const id = data?.contentId || data?.onSelectCommand?.watchEndpoint?.videoId;
    if (!validId(id)) continue;
    const model = data?.metadata?.tileMetadataRenderer?.title;
    replaceTitle(id, model, 'simpleText');
    updateTitleNodes(el, id);
  }
  if (validId(videoId)) {
    for (const container of document.querySelectorAll('ytlr-video-title, ytlr-video-title-tray, ytlr-watch-metadata, ytlr-player-controls, ytlr-video-description-header-renderer')) updateTitleNodes(container, videoId);
  }
}
function updateTitleNodes(container, id) {
  const title = titles.get(id), old = oldTitles.get(id);
  if (!title || !old) return;
  for (const node of container.querySelectorAll('*')) {
    if (!node.children.length && old.has(node.textContent.trim()) && node.textContent !== title) node.textContent = title;
  }
}
let scheduled = false;
function scheduleDOM() {
  if (scheduled || typeof document === 'undefined') return;
  scheduled = true;
  requestAnimationFrame(() => { scheduled = false; updateDOM(); });
}
if (typeof document !== 'undefined' && document.body) {
  new MutationObserver(scheduleDOM).observe(document.body, { childList: true, subtree: true });
  setInterval(scheduleDOM, 1500);
  configChangeEmitter.addEventListener('configChange', event => {
    if (event.detail.key === 'enableOriginalAudio') appliedAudio = null;
    scheduleDOM();
  });
}
