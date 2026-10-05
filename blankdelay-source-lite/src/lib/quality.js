const cores = typeof navigator === 'undefined' ? 8 : navigator.hardwareConcurrency || 8
const memory = typeof navigator === 'undefined' ? 8 : navigator.deviceMemory || 8
const low = cores <= 6 || memory <= 4

// One pixel per CSS pixel. Extra DPR and antialiasing were the main hitch on open.
export const quality = {
  dpr: 1,
  antialias: false,
  clouds: low ? 36 : 64,
}
