const CONFIG_KEY = 'ytaf-configuration';
const defaultConfig = {
  enableAdBlock: true,
  enableSponsorBlock: true,
  enableSponsorBlockToasts: true,
  sponsorBlockManualSkips: ['intro', 'outro', 'filler'],
  enableSponsorBlockSponsor: true,
  enableSponsorBlockIntro: true,
  enableSponsorBlockOutro: true,
  enableSponsorBlockInteraction: true,
  enableSponsorBlockSelfPromo: true,
  enableSponsorBlockPreview: true,
  enableSponsorBlockMusicOfftopic: true,
  enableSponsorBlockFiller: false,
  enableSponsorBlockHighlight: true,
  videoSpeed: 1,
  preferredVideoQuality: 'auto',
  enableDeArrow: true,
  enableDeArrowThumbnails: false,
  enableReturnYoutubeDislike: false,
  focusContainerColor: '#0f0f0f',
  routeColor: '#0f0f0f',
  enableFixedUI: (window.h5vcc) ? false : true,
  enableHqThumbnails: false,
  enableChapters: true,
  enableLongPress: true,
  enableShorts: true,
  dontCheckUpdateUntil: 0,
  enableWhoIsWatchingMenu: false,
  permanentlyEnableWhoIsWatchingMenu: false,
  enableWhosWatchingMenuOnAppExit: false,
  enableShowUserLanguage: true,
  enableShowOtherLanguages: false,
  enableCaptionStylePersistence: true,
  enableStopForcedSubtitles: false,
  captionStyleSettings: null,
  captionRawKeyBackups: {},
  showWelcomeToast: true,
  enablePreviousNextButtons: true,
  hidePlayerJoinButton: false,
  enableInstantSeek: false,
  enableDoubleBackExit: true,
  enableBackRevealsControls: true,
  instantSeekDelayMs: 500,
  hiddenLibraryTabIds: [],
  longPressMenuHidden: [],
  longPressMenuOrder: [],
  playerMenuHidden: [],
  playerMenuOrder: [],
  enableOriginalTitles: false,
  enableOriginalAudio: false,
  enableSuperThanksButton: false,
  enableAIAskButton: false,
  enableSpeedControlsButton: true,
  enablePatchingVideoPlayer: true,
  enableMPButton: true,
  enableSwapMPWithPIP: false,
  enablePreviews: true,
  enableHideWatchedVideos: false,
  hideWatchedVideosThreshold: 80,
  hideWatchedVideosPages: [],
  hideDuplicateVideos: false,
  hideSubscriptionsRelevantRow: true,
  commentSortOrder: '',
  enableHideEndScreenCards: false,
  enableYouThereRenderer: true,
  lastAnnouncementCheck: 0,
  enableScreenDimming: false,
  dimmingTimeout: 60,
  dimmingOpacity: 0.5,
  enablePaidPromotionOverlay: true,
  speedSettingsIncrement: 0.25,
  videoPreferredCodec: 'any',
  launchToOnStartup: null,
  reloadHomeOnStartup: true,
  disabledSidebarContents: [],
  sidebarContentsOrder: [],
  disableChannelsOnSidebar: false,
  enableUpdater: true,
  autoFrameRate: false,
  autoFrameRatePauseVideoFor: 0,
  enableSigninReminder: false,
  sortSubscriptionsByAlphabet: false,
  enableClock: false,
  isClock12HourFormat: false,
  clockShowSeconds: false,
  clockHideWhenVideoPlaying: false,
  disableEnlargingThumbnails: false,
  enableShrinkingThumbnails: false,
  hideMembersOnlyVideos: false,
  hideRelatedVideosPlayer: false,
  blockedChannels: [],
  blockedChannelNames: {},
  hiddenVideos: [],
};

let localConfig;

try {
  const raw = window.localStorage[CONFIG_KEY];
  localConfig = raw ? JSON.parse(raw) : {};
  if (!localConfig || typeof localConfig !== 'object' || Array.isArray(localConfig)) localConfig = {};
} catch (err) {
  console.warn('Config read failed:', err);
  localConfig = {};
}

export function configRead(key) {
  if (localConfig[key] === undefined) {
    console.warn('Populating key', key, 'with default value', defaultConfig[key]);
    const fallback = defaultConfig[key];
    localConfig[key] = typeof fallback === 'object' && fallback !== null ? JSON.parse(JSON.stringify(fallback)) : fallback;
  }

  return localConfig[key];
}

export function configWrite(key, value) {
  console.info('Setting key', key, 'to', value);
  localConfig[key] = value;
  window.localStorage[CONFIG_KEY] = JSON.stringify(localConfig);
  configChangeEmitter.dispatchEvent(new CustomEvent('configChange', { detail: { key, value } }));
}

export const configChangeEmitter = {
  listeners: {},
  addEventListener(type, callback) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(callback);
  },
  removeEventListener(type, callback) {
    if (!this.listeners[type]) return;
    this.listeners[type] = this.listeners[type].filter(cb => cb !== callback);
  },
  dispatchEvent(event) {
    const type = event.type;
    if (!this.listeners[type]) return;
    this.listeners[type].forEach(cb => {
      try {
        cb.call(this, event)
      } catch (_) {};
    });
  }
};
