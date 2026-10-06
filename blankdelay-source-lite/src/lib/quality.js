const pixels = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1
const cores = typeof navigator === 'undefined' ? 8 : navigator.hardwareConcurrency || 8
const memory = typeof navigator === 'undefined' ? 8 : navigator.deviceMemory || 8
const mobile =
  typeof window !== 'undefined' &&
  (window.matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent))
const low = cores <= 4 || memory <= 4

// Shared with the scene. A weak GPU can lower `clouds` after the canvas starts.
// Phones report desktop-class core counts but run out of GPU memory far sooner, so they get their own budget.
export const quality = {
  mobile,
  dpr: mobile || low ? 1 : Math.min(pixels, pixels >= 2 ? 1.15 : 1.25),
  antialias: mobile || low ? false : pixels <= 1.05,
  clouds: mobile ? (low ? 60 : 90) : low ? 110 : cores < 8 ? 160 : 200,
}
