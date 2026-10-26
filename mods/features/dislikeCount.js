const API_URL = 'https://returnyoutubedislikeapi.com/votes?videoId=';
const BADGE_ID = 'tt-dislike-count';

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

function metadataHost() {
  return document.querySelector('div[idomkey="Metadata-Section"]')
    || document.querySelector('ytlr-video-metadata-renderer')
    || document.querySelector('ytlr-watch-metadata')
    || document.querySelector('ytlr-watch-default');
}

function render() {
  if (activeDislikes === null) return;
  const host = metadataHost();
  if (!host) return;

  let badge = document.getElementById(BADGE_ID);
  if (!badge) {
    badge = document.createElement('div');
    badge.id = BADGE_ID;
    badge.setAttribute('aria-label', 'Dislike count');
    badge.style.cssText = [
      'display:inline-flex',
      'align-items:center',
      'width:max-content',
      'margin:0.5em 0',
      'padding:0.35em 0.7em',
      'border-radius:0.35em',
      'background:rgba(0,0,0,0.65)',
      'color:#fff',
      'font-size:1.15em',
      'font-weight:500',
      'line-height:1.2',
      'z-index:2'
    ].join(';');
  }
  const text = `👎 ${formatCount(activeDislikes)} dislikes`;
  if (badge.textContent !== text) badge.textContent = text;
  if (badge.parentElement !== host) host.appendChild(badge);
}

async function update() {
  const videoId = currentVideoId();
  if (!videoId) return;
  if (videoId === activeVideoId) {
    render();
    return;
  }

  activeVideoId = videoId;
  activeDislikes = null;
  document.getElementById(BADGE_ID)?.remove();
  const generation = ++requestGeneration;

  try {
    const response = await fetch(`${API_URL}${encodeURIComponent(videoId)}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (generation !== requestGeneration || activeVideoId !== videoId) return;
    if (typeof data.dislikes !== 'number') throw new Error('Missing dislikes count');
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
