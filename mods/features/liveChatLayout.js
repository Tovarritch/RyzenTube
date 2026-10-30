import { configRead, configChangeEmitter } from '../config.js';

// Live chat layout: side of the screen, size, and how many messages show.
//
// The TV shows live chat as <ytlr-live-chat>, a full-height box over the video.
// Its messages hang from a bottom anchor, each moved up by its own
// translateY(-Nrem): the newest is lowest, older ones further up.

const STYLE_ID = 'tt-live-chat-style';
export const LIVE_CHAT_SIZES = [['Small', 0.8], ['Medium', 1], ['Large', 1.25], ['Extra large', 1.5]];
export const LIVE_CHAT_MESSAGE_LIMITS = [0, 3, 5, 8, 12];

// The box sits flush with the right edge and does not follow left/right, so
// it is moved with a transform: its own width minus the screen width puts it
// flush with the left edge. Scaling grows it from its bottom outer corner.
export function liveChatCss(position, scale) {
  const left = position === 'left';
  const parts = [];
  if (left) parts.push('translateX(calc(100% - 100vw))');
  if (scale && scale !== 1) parts.push(`scale(${scale})`);
  const hidden = '.tt-chat-hidden { visibility: hidden !important; }';
  if (!parts.length) return hidden;
  return `ytlr-live-chat { transform: ${parts.join(' ')} !important; transform-origin: ${left ? 'left' : 'right'} bottom !important; }\n${hidden}`;
}

function applyStyle() {
  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = liveChatCss(configRead('liveChatPosition'), Number(configRead('liveChatScale')) || 1);
}

const offsetOf = element => {
  const match = /translateY\(\s*(-?[\d.]+)/.exec(element.getAttribute('style') || '');
  return match ? Math.abs(Number(match[1])) : 0;
};

// Messages, newest first: the ones moved up the least.
export function messagesToHide(messages, limit) {
  if (!limit) return [];
  return messages.map((element, index) => ({ element, index, offset: offsetOf(element) }))
    .sort((a, b) => a.offset - b.offset || b.index - a.index)
    .slice(limit)
    .map(entry => entry.element);
}

function limitMessages() {
  const limit = Number(configRead('liveChatMaxMessages')) || 0;
  for (const chat of document.querySelectorAll('ytlr-live-chat')) {
    const holders = new Set([...chat.querySelectorAll('[style*="translateY"]')].map(element => element.parentElement));
    for (const holder of holders) {
      const messages = [...holder.children];
      const hide = new Set(messagesToHide(messages, limit));
      for (const message of messages) message.classList.toggle('tt-chat-hidden', hide.has(message));
    }
  }
}

let scheduled = false;
function schedule() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => { scheduled = false; limitMessages(); });
}

if (typeof document !== 'undefined' && document.head) {
  applyStyle();
  configChangeEmitter.addEventListener('configChange', event => {
    if (/^liveChat/.test(event.detail.key)) { applyStyle(); schedule(); }
  });
  // Messages move (style changes) and arrive (child changes) continuously, so
  // watch only the chat box, and only while a message limit is set.
  let watched = null;
  const chatObserver = new MutationObserver(schedule);
  const watchChat = () => {
    const chat = Number(configRead('liveChatMaxMessages')) ? document.querySelector('ytlr-live-chat') : null;
    if (chat === watched) return;
    chatObserver.disconnect();
    watched = chat;
    if (chat) {
      chatObserver.observe(chat, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
      schedule();
    }
  };
  new MutationObserver(watchChat).observe(document.body, { childList: true, subtree: true });
  configChangeEmitter.addEventListener('configChange', event => {
    if (event.detail.key === 'liveChatMaxMessages') { watchChat(); schedule(); }
  });
}
