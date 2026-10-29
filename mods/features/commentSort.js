import { configRead, configWrite } from '../config.js';
import resolveCommand from '../resolveCommand.js';
import { showToast } from '../ui/ytUI.js';
import { COMMENT_SORTS, sortThreads } from '../utils/commentOrder.js';

// Best / New / Old buttons at the top of the comments panel.
//
// The TV app receives YouTube's Top/Newest sort menu with the comments but never
// draws it. New uses YouTube's own newest-first order and keeps loading more as
// you scroll. YouTube has no oldest-first or most-liked order, so Best and Old
// load several pages and sort them here.

const PANEL_ID = 'comment-item-section';
const SORTED_TAG = 'tt-sorted-comments';
const BEST_PAGES = 5;
const OLD_PAGES = 10;

// Per video: YouTube's sort tokens and the panel header.
const panels = new Map();
let request = 0;

// A row of small round icon buttons, like the search bar's microphone. ui.css
// keeps the row as tall as the buttons.
export function sortButtons() {
  const buttons = COMMENT_SORTS.map(([mode, title, subtitle, icon]) => ({
    buttonRenderer: {
      style: 'STYLE_DEFAULT',
      size: 'SIZE_DEFAULT',
      isDisabled: false,
      icon: { iconType: icon },
      accessibility: { label: `Sort: ${title}. ${subtitle}` },
      accessibilityData: { accessibilityData: { label: `Sort: ${title}. ${subtitle}` } },
      command: { customAction: { action: 'TT_COMMENTS_SORT', parameters: { mode } } },
    },
  }));
  return { horizontalButtonListRenderer: { items: buttons } };
}
// The header names the order in use; the buttons have no room for a check mark.
function sortHeader(header, mode) {
  const sort = COMMENT_SORTS.find(([id]) => id === mode);
  const result = { ...(header || { title: { runs: [{ text: 'Comments' }] } }), menu: undefined };
  result.subtitle = { simpleText: sort ? `Sorted by: ${sort[1]} – ${sort[2].toLowerCase()}` : 'Sort: Best · New · Old' };
  return result;
}

function videoIdOf(r) {
  return r?.currentVideoEndpoint?.watchEndpoint?.videoId
    || r?.contents?.singleColumnWatchNextResults?.results?.results?.contents
      ?.find(item => item.itemSectionRenderer)?.itemSectionRenderer?.contents
      ?.find(item => item.videoMetadataRenderer)?.videoMetadataRenderer?.videoId
    || null;
}

// Watch responses: remember YouTube's sort tokens and the panel header.
export function patchCommentPanel(r) {
  if (!Array.isArray(r?.engagementPanels)) return r;
  for (const entry of r.engagementPanels) {
    const panel = entry?.engagementPanelSectionListRenderer;
    if (panel?.panelIdentifier !== PANEL_ID) continue;
    const header = panel.header?.engagementPanelTitleHeaderRenderer;
    const tokens = {};
    for (const item of header?.menu?.sortFilterSubMenuRenderer?.subMenuItems || []) {
      const token = item?.continuation?.reloadContinuationData?.continuation;
      if (token) tokens[/new/i.test(item.title || '') ? 'new' : 'top'] = token;
    }
    const videoId = videoIdOf(r);
    if (videoId && tokens.top && tokens.new) {
      panels.set(videoId, { tokens, header: header ? { ...header, menu: undefined } : null });
    }
  }
  return r;
}

function currentVideoId() {
  try {
    return document.querySelector('.html5-video-player')?.getVideoData?.()?.video_id || null;
  } catch (_) {
    return null;
  }
}
// The sort tokens of the video playing. They come with the watch response;
// when that was parsed before TizenTube was ready, ask YouTube again.
async function currentPanel() {
  const videoId = currentVideoId();
  if (!videoId) return null;
  if (!panels.has(videoId)) patchCommentPanel(await innerTube({ videoId }));
  return panels.get(videoId) || null;
}

function fetchPage(continuation) {
  return innerTube({ continuation });
}
function innerTube(payload) {
  const mappings = Object.values(window._yttv || {}).find(a => a && a.mappings);
  const client = mappings?.get('KabukiInnerTubeClient');
  const identityService = mappings?.get('CurrentIdentityService');
  if (!client) return Promise.reject(new Error('InnerTube client not found'));
  const identity = identityService ? identityService.get() : Promise.resolve(undefined);
  return identity.then(identity => new Promise((resolve, reject) => {
    client.fetch({ identity, isPrefetch: false, path: '/youtubei/v1/next', payload,
      clickTracking: { clickTrackingParams: null } }).subscribe(resolve, reject);
  }));
}

async function collect(token, maxPages) {
  const threads = [];
  let next = token;
  for (let page = 0; page < maxPages && next; page++) {
    const response = await fetchPage(next);
    const section = response?.continuationContents?.itemSectionContinuation;
    threads.push(...(section?.contents || []).filter(item => item.commentThreadRenderer));
    next = section?.continuations?.[0]?.nextContinuationData?.continuation || null;
  }
  return { threads, next };
}

// The comments panel, with the sort buttons above the comments. A continuation
// lets YouTube load more comments as the list is scrolled.
function panelShown() {
  for (const row of document.querySelectorAll('ytlr-engagement-panel-section-list-renderer ytlr-horizontal-button-list-renderer')) {
    const rect = row.getBoundingClientRect();
    if (rect.width > 0 && rect.bottom > 0 && rect.top < window.innerHeight) return true;
  }
  return false;
}
// The first panel opened after the app starts is sometimes dropped while
// YouTube loads its panel code, so check and open it again.
function showPanel(state, mode, threads, continuation, attempt = 0) {
  const id = request;
  openPanel(state, mode, threads, continuation);
  if (attempt < 3) {
    setTimeout(() => {
      if (id === request && !panelShown()) showPanel(state, mode, threads, continuation, attempt + 1);
    }, 700);
  }
}
function openPanel(state, mode, threads, continuation) {
  const section = {
    contents: [sortButtons(), ...threads],
    sectionIdentifier: PANEL_ID,
    targetId: SORTED_TAG,
  };
  if (continuation) section.continuations = [{ nextContinuationData: { continuation } }];
  resolveCommand({
    showEngagementPanelEndpoint: {
      engagementPanel: {
        engagementPanelSectionListRenderer: {
          header: { engagementPanelTitleHeaderRenderer: sortHeader(state.header, mode) },
          content: { sectionListRenderer: { contents: [{ itemSectionRenderer: section }] } },
        },
      },
      identifier: { surface: 'ENGAGEMENT_PANEL_SURFACE_WATCH', tag: SORTED_TAG },
    },
  });
  // Showing only adds the panel; until a YouTube panel has been opened once,
  // it stays hidden unless it is expanded explicitly.
  resolveCommand({ changeEngagementPanelVisibilityAction: { targetId: SORTED_TAG, visibility: 'ENGAGEMENT_PANEL_VISIBILITY_EXPANDED' } });
}

// mode: 'best', 'new', 'old', or null for YouTube's own order.
async function showComments(state, mode) {
  const id = ++request;
  if (mode === 'best' || mode === 'old') showToast('Comments', 'Sorting comments…');
  try {
    if (!mode || mode === 'new') {
      const { threads, next } = await collect(mode ? state.tokens.new : state.tokens.top, 1);
      if (id === request) showPanel(state, mode, threads, next);
    } else if (mode === 'best') {
      const { threads } = await collect(state.tokens.top, BEST_PAGES);
      if (id === request) showPanel(state, mode, sortThreads(threads, mode), null);
    } else {
      const newest = await collect(state.tokens.new, OLD_PAGES);
      let threads = newest.threads;
      if (newest.next) {
        // Too many comments to reach the oldest: add YouTube's top comments,
        // which reach further back, and sort everything that was loaded.
        threads = threads.concat((await collect(state.tokens.top, BEST_PAGES)).threads);
        if (id === request) showToast('Comments', 'Showing the oldest of the comments loaded');
      }
      if (id === request) showPanel(state, mode, sortThreads(threads, mode), null);
    }
  } catch (err) {
    console.error('TizenTube: comment sorting failed:', err);
    if (id === request) showToast('Comments', 'Could not load comments');
  }
}

export async function sortComments(mode) {
  if (!COMMENT_SORTS.some(([id]) => id === mode)) return;
  configWrite('commentSortOrder', mode);
  const state = await currentPanel().catch(() => null);
  if (!state) return showToast('Comments', 'Could not load comments');
  showComments(state, mode);
}

// Opening the comments shows them with the sort buttons, in the order chosen
// last time. If that fails, YouTube's own panel opens instead.
let passThrough = false;
export function openSortedComments(cmd) {
  const action = cmd?.changeEngagementPanelVisibilityAction;
  if (action?.targetId !== PANEL_ID || action.visibility !== 'ENGAGEMENT_PANEL_VISIBILITY_EXPANDED') return false;
  if (passThrough || !currentVideoId()) return false;
  const mode = configRead('commentSortOrder');
  currentPanel().catch(() => null).then(state => {
    if (state) return showComments(state, COMMENT_SORTS.some(([id]) => id === mode) ? mode : null);
    passThrough = true;
    try { resolveCommand(cmd); } finally { passThrough = false; }
  });
  return true;
}
