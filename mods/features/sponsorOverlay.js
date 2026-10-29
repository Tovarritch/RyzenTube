// SponsorBlock segments on the player's seek bar.
//
// This follows the original TizenTube overlay, which is known to render on
// Cobalt: a transparent bar styled like the seek bar slider, appended to the
// progress bar container and shown or hidden with the seek bar itself. The only
// addition is hiding it once the video has ended (Up Next screen).

export function showSponsorSegments(video, progressBar) {
  if (!video || video.ended) return false;
  if (Number.isFinite(video.duration) && video.currentTime >= video.duration - 0.1) return false;
  return !progressBar || progressBar.getAttribute('hybridnavfocusable') !== 'false';
}

export function createSponsorOverlay(video, segments, colors) {
  const duration = video.duration;
  const overlay = document.createElement('div');
  overlay.classList.add('tt-sponsor-segments', 'ytLrProgressBarSlider', 'ytLrProgressBarSliderRectangularProgressBar');
  overlay.setAttribute('aria-hidden', 'true');
  overlay.style.setProperty('z-index', '10', 'important');
  overlay.style.setProperty('background-color', 'rgba(0, 0, 0, 0)', 'important');
  overlay.style.setProperty('width', '72rem', 'important');
  overlay.style.setProperty('left', '4rem', 'important');
  overlay.style.setProperty('pointer-events', 'none', 'important');
  overlay.style.setProperty('display', 'none', 'important');

  for (const item of segments || []) {
    const [start, end] = item.segment;
    const style = colors[item.category] || { color: 'blue', opacity: 0.7 };
    const left = duration ? (100 * start) / duration : 0;
    const width = duration ? (100 * (end - start)) / duration : 0;
    const bar = document.createElement('div');
    bar.style.setProperty('background-color', style.color, 'important');
    bar.style.setProperty('opacity', String(style.opacity), 'important');
    bar.style.setProperty('height', '100%', 'important');
    bar.style.setProperty('width', `${item.category === 'poi_highlight' ? 1 : width}%`, 'important');
    bar.style.setProperty('left', `${left}%`, 'important');
    bar.style.setProperty('position', 'absolute', 'important');
    overlay.appendChild(bar);
  }

  let styled = false;
  function update() {
    const slider = document.querySelector('div[idomkey="slider"]');
    if (slider && !styled) {
      styled = true;
      // Newer seek bars use different slider classes; copy them and the size.
      if (!slider.classList.contains('ytLrProgressBarSlider')) {
        for (let i = 0; i < slider.classList.length; i++) overlay.classList.add(slider.classList[i]);
        const rect = slider.getBoundingClientRect();
        overlay.style.setProperty('height', `${rect.height}px`, 'important');
        overlay.style.setProperty('bottom', `${rect.bottom - rect.top}px`, 'important');
      }
    }
    const container = document.querySelector('ytlr-redux-connect-ytlr-progress-bar');
    if (container && overlay.parentElement !== container) container.appendChild(overlay);
    const display = showSponsorSegments(video, document.querySelector('ytlr-progress-bar')) ? 'block' : 'none';
    if (overlay.style.getPropertyValue('display') !== display) overlay.style.setProperty('display', display, 'important');
  }

  const timer = setInterval(update, 250);
  const events = ['ended', 'emptied', 'play', 'pause', 'timeupdate', 'seeked'];
  events.forEach(event => video.addEventListener(event, update));
  update();
  return () => {
    clearInterval(timer);
    events.forEach(event => video.removeEventListener(event, update));
    overlay.remove();
  };
}
