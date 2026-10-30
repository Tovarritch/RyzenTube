// Volume boost levels and the request that hands a level to the APK
// (android/VolumeBoost.java). Kept free of UI code for tests.
export const VOLUME_BOOST_LEVELS = [1, 1.5, 2, 2.5, 3];
export const boostLabel = level => `${Math.round(level * 100)}%`;
const BRIDGE = 'http://127.0.0.1:18947/boost?level=';

export function boostRequestUrl(level) {
  const percent = Math.round(Math.min(3, Math.max(1, Number(level) || 1)) * 100);
  return BRIDGE + String(percent).padStart(3, '0');
}
