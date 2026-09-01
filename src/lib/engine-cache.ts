export const ENGINE_CACHE_NAME = 'clear-scan-engine-opencv-4.12.0'

export function getOpenCvUrl() {
  return new URL(`${import.meta.env.BASE_URL}vendor/opencv.js`, window.location.origin).href
}

export async function hasCachedEngineAsset() {
  if (typeof window === 'undefined' || !('caches' in window)) return false
  try {
    return Boolean(await window.caches.match(getOpenCvUrl()))
  } catch {
    return false
  }
}
