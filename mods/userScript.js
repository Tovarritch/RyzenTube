import initPatches from "./features/standaloneUserscript.js";
import { BUILD_LABEL } from './buildInfo.js';
import { setDiagnostic } from './diagnostics.js';
if (window.location.hostname === 'localhost') {
    initPatches();
}
import "./features/userAgentSpoofing.js";
import "whatwg-fetch";
import "core-js/proposals/object-getownpropertydescriptors";

import './translations/index.js'
import "./domrect-polyfill";
import "./features/adblock.js";
import "./features/sponsorblock.js";
import "./ui/ui.js";
import "./ui/speedUI.js";
import "./ui/theme.js";
import "./ui/settings.js";
import "./ui/disableWhosWatching.js";
import "./features/moreSubtitles.js";
import "./features/captionStylePersistence.js";
import "./features/updater.js";
import "./features/pictureInPicture.js";
import "./features/preferredVideoQuality.js";
import "./features/videoQueuing.js";
import "./features/dislikeCount.js";
import "./features/homeRefresh.js";
import "./features/playerBackGuard.js";
import "./features/backToStart.js";
import "./features/instantSeek.js";
import "./features/enableFeatures.js";
import "./ui/customUI.js";
import "./ui/customGuideAction.js";
import "./features/autoFrameRate.js";
import "./ui/clock.js";
import "./features/chatProbe.js";

// This is set only after every imported feature has initialized successfully.
window.tizenTubeBuild = BUILD_LABEL;
setDiagnostic('initialized', true);
