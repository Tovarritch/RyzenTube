// DEBUG BUNDLE ONLY. Test builds sent over adb (scripts/tv.py --load) are kept in
// localStorage and run instead of this bundle on the next page load, so a
// change can be tried on the TV without pushing a tag to GitHub.
//
// This must be the first import of debugEntry.js. When a stored build runs, it
// throws to stop the rest of this bundle (an iife), so TizenTube does not run
// twice. The stored build contains this file too; the flag keeps it from
// loading itself again.
export const OVERRIDE_KEY = 'tt-dev-bundle';

let stored = null;
try { stored = window.__ttDevOverride ? null : window.localStorage.getItem(OVERRIDE_KEY); } catch (_) {}
if (stored) {
  window.__ttDevOverride = true;
  const policy = window.trustedTypes?.createPolicy?.('tizentube-dev-override', { createScript: source => source });
  let failed = null;
  try { (0, eval)(policy ? policy.createScript(stored) : stored); } catch (error) { failed = error; }
  if (!failed) throw new Error('TizenTube: running the test build sent over adb (tv.py --unload to stop)');
  // A test build that fails to start is dropped; this bundle runs instead.
  console.error('TizenTube: the test build failed and was removed:', failed);
  try { window.localStorage.removeItem(OVERRIDE_KEY); } catch (_) {}
}
