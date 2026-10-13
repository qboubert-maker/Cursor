const pixels = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1
const cores = typeof navigator === 'undefined' ? 8 : navigator.hardwareConcurrency || 8
const memory = typeof navigator === 'undefined' ? 8 : navigator.deviceMemory || 8
const width = typeof window === 'undefined' ? 1280 : window.innerWidth || 1280
const coarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
const mobile = width < 820 || (coarse && width < 1100)
const laptop = !mobile && (width < 1440 || cores <= 8 || memory <= 8)

const tier = mobile
  ? { dpr: 1, antialias: false, clouds: 36, streams: 0.32, particles: 0.22 }
  : laptop
    ? { dpr: 1, antialias: false, clouds: 56, streams: 0.42, particles: 0.32 }
    : { dpr: Math.min(pixels, 1), antialias: false, clouds: 72, streams: 0.5, particles: 0.4 }

// Shared with the scene. A weak GPU can lower `clouds` after the canvas starts.
export const quality = {
  mobile,
  ...tier,
}
