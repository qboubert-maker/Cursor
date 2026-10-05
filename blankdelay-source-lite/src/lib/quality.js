const cores = typeof navigator === 'undefined' ? 8 : navigator.hardwareConcurrency || 8
const memory = typeof navigator === 'undefined' ? 8 : navigator.deviceMemory || 8
const narrow = typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches
const coarse = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
const mobile = narrow || coarse || (typeof navigator !== 'undefined' && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent))
const low = mobile || cores <= 6 || memory <= 4

// Phones skip the heavy cloud field. Every device stays at 1x so the first frame stays smooth.
export const quality = {
  mobile,
  dpr: 1,
  antialias: false,
  clouds: mobile ? 0 : low ? 28 : 48,
}
