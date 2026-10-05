const pixels = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1
const cores = typeof navigator === 'undefined' ? 8 : navigator.hardwareConcurrency || 8
const memory = typeof navigator === 'undefined' ? 8 : navigator.deviceMemory || 8
const low = cores <= 4 || memory <= 4

// Shared with the scene. A weak GPU can lower `clouds` after the canvas starts.
export const quality = {
  dpr: low ? 1 : Math.min(pixels, pixels >= 2 ? 1.15 : 1.25),
  antialias: low ? false : pixels <= 1.05,
  clouds: low ? 110 : cores < 8 ? 160 : 200,
}
