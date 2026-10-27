import { configRead } from '../config.js';
import { isMembersOnlyVideo } from './videoBadges.js';

export function filterMembersOnlyVideos(items) {
    if (!Array.isArray(items) || !items.length || configRead('hideMembersOnlyVideos') !== true) return items;
    return items.filter(item => !isMembersOnlyVideo(item));
}
