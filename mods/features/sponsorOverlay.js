export function showSponsorSegments(video, slider) {
  if (!video || video.ended || !slider?.isConnected || !slider.getClientRects().length) return false;
  if (Number.isFinite(video.duration) && video.currentTime >= video.duration - 0.1) return false;
  for (let node = slider; node && node !== document.body; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0' || node.hidden) return false;
  }
  return true;
}

export function createSponsorOverlay(video, segments, colors) {
  const overlay = document.createElement('div');
  overlay.className = 'tt-sponsor-segments';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10;display:none';
  for (const item of segments || []) {
    const bar = document.createElement('div');
    const [start, end] = item.segment;
    const style = colors[item.category] || { color: 'blue', opacity: .7 };
    const duration = video.duration;
    bar.style.cssText = `position:absolute;top:0;height:100%;background:${style.color};opacity:${style.opacity};left:${100 * start / duration}%;width:${item.category === 'poi_highlight' ? 1 : 100 * (end - start) / duration}%`;
    overlay.appendChild(bar);
  }
  let lastSlider = null, originalPosition = null;
  function update() {
    const slider = document.querySelector('ytlr-progress-bar div[idomkey="slider"]');
    if (slider && overlay.parentElement !== slider) {
      if (lastSlider && originalPosition !== null) lastSlider.style.position = originalPosition;
      originalPosition = slider.style.position;
      if (getComputedStyle(slider).position === 'static') slider.style.position = 'relative';
      lastSlider = slider;
      // Inherit the real seek bar's visibility and geometry, including Up Next.
      slider.appendChild(overlay);
    }
    const display = showSponsorSegments(video, slider) ? 'block' : 'none';
    if (overlay.style.display !== display) overlay.style.display = display;
  }
  const timer = setInterval(update, 250);
  const events = ['ended', 'emptied', 'play', 'pause', 'timeupdate'];
  events.forEach(event => video.addEventListener(event, update));
  update();
  return () => {
    clearInterval(timer);
    events.forEach(event => video.removeEventListener(event, update));
    overlay.remove();
    if (lastSlider && originalPosition !== null) lastSlider.style.position = originalPosition;
  };
}
