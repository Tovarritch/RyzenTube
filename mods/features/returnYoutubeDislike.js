import { configRead } from '../config.js';

const API_URL = 'https://returnyoutubedislikeapi.com/Votes?videoId=';
const DESCRIPTION_PANEL = 'video-description-ep-identifier';
const MAX_CACHED = 200;
const votesByVideo = new Map();
const inFlight = new Map();
let currentResponseVideoId = null;

export function getResponseVideoId() {
    return currentResponseVideoId;
}

export function isReturnYoutubeDislikeEnabled() {
    return configRead('enableReturnYoutubeDislike') === true;
}

export function formatDislikeCount(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) return '0';
    for (const [threshold, suffix] of [[1e9, 'B'], [1e6, 'M'], [1e3, 'K']]) {
        if (number < threshold) continue;
        const compact = Math.round((number / threshold) * 10) / 10;
        return `${compact}${suffix}`;
    }
    return String(Math.round(number));
}

export function findVideoId(response) {
    return response?.videoDetails?.videoId
        || response?.playerResponse?.videoDetails?.videoId
        || response?.currentVideoEndpoint?.watchEndpoint?.videoId
        || null;
}

export function injectDislikes(response, votes, label = 'Dislikes') {
    if (!response || votes?.dislikes === undefined || votes?.dislikes === null) return response;
    const text = formatDislikeCount(votes.dislikes);

    const panel = (response.engagementPanels || []).find(
        item => item?.engagementPanelSectionListRenderer?.panelIdentifier === DESCRIPTION_PANEL
    );
    const descriptionItems = panel?.engagementPanelSectionListRenderer?.content
        ?.structuredDescriptionContentRenderer?.items || [];
    const header = descriptionItems.find(item => item?.videoDescriptionHeaderRenderer)?.videoDescriptionHeaderRenderer;
    if (Array.isArray(header?.factoid)
        && !header.factoid.some(item => item?.factoidRenderer?.label?.simpleText === label)) {
        header.factoid.push({
            factoidRenderer: {
                value: { simpleText: text },
                label: { simpleText: label },
            },
        });
    }

    const controls = response.transportControls?.transportControlsRenderer;
    const actions = controls?.buttons || controls?.engagementActions || [];
    const likeAction = actions.find(action =>
        action?.type === 'TRANSPORT_CONTROLS_BUTTON_TYPE_LIKE_BUTTON'
        || action?.button?.likeButtonRenderer
    );
    const renderer = likeAction?.button?.likeButtonRenderer;
    if (renderer) {
        renderer.dislikeCountText = { simpleText: text };
        renderer.dislikeCountWithDislikeText = { simpleText: text };
        renderer.dislikeCountWithUndislikeText = { simpleText: text };
    }
    return response;
}

function remember(videoId, votes) {
    if (votesByVideo.size >= MAX_CACHED) votesByVideo.delete(votesByVideo.keys().next().value);
    votesByVideo.set(videoId, votes);
}

export function requestVotes(videoId) {
    if (!isReturnYoutubeDislikeEnabled() || !videoId) return Promise.resolve(null);
    if (votesByVideo.has(videoId)) return Promise.resolve(votesByVideo.get(videoId));
    if (inFlight.has(videoId)) return inFlight.get(videoId);
    const request = fetch(`${API_URL}${encodeURIComponent(videoId)}`)
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        })
        .then(votes => {
            if (!Number.isFinite(votes?.dislikes) || votes.dislikes < 0) throw new Error('Invalid dislike count');
            remember(videoId, votes);
            window.dispatchEvent?.(new CustomEvent('tt-dislike-votes', { detail: { videoId, dislikes: votes.dislikes } }));
            return votes;
        })
        .catch(error => {
            console.warn('TizenTube: Return YouTube Dislike request failed:', error);
            return null;
        })
        .then(votes => {
            inFlight.delete(videoId);
            return votes;
        });
    inFlight.set(videoId, request);
    return request;
}

/**
 * Enabling this feature intentionally sends each opened video ID to
 * returnyoutubedislike.com. It is disabled in the default configuration.
 */
export function addDislikes(response) {
    if (!isReturnYoutubeDislikeEnabled()) return response;
    const responseVideoId = findVideoId(response);
    if (responseVideoId) currentResponseVideoId = responseVideoId;
    // The controls and description can arrive separately from the player
    // response, without repeating its video ID.
    const videoId = responseVideoId || ((response?.transportControls || response?.engagementPanels) && currentResponseVideoId);
    if (!videoId) return response;
    requestVotes(videoId);
    const votes = votesByVideo.get(videoId);
    if (votes) injectDislikes(response, votes);
    return response;
}

export const _internals = { votesByVideo, inFlight };
