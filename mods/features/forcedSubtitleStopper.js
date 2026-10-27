import { configRead } from '../config.js';

/**
 * Remove only the instruction that makes a video enable captions itself.
 * Caption tracks remain in the response and can still be selected manually.
 */
export function stopForcedSubtitles(response) {
    if (configRead('enableStopForcedSubtitles') !== true) return response;
    const tracks = response?.captions?.playerCaptionsTracklistRenderer?.audioTracks;
    if (!Array.isArray(tracks)) return response;

    for (const track of tracks) {
        if (!track || typeof track !== 'object') continue;
        if (track.captionsInitialState !== undefined) delete track.captionsInitialState;
        if (track.hasDefaultTrack === true) track.hasDefaultTrack = false;
    }
    return response;
}
