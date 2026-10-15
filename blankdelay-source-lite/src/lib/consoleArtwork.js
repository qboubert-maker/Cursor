import { mark, paperGrain, random, speckle, splatter, stroke, surface } from './inkBrush.js'

const SKIN_BASE = [244, 244, 242]
const SKIN_INK = [11, 11, 12]

const scaled = (w, h) => (points) => points.map(([u, v]) => [u * w, v * h])

/**
 * Backdrop packed for the shader, rows bottom-up for WebGL:
 * R ink density, G when the stroke reaches the pixel, B paper brightness offset.
 */
export function paintBackdrop(width = 2048, height = 1152) {
  const s = surface(width, height)
  const rand = random(0x0b1a2c)
  const at = scaled(width, height)
  const H = height

  // Big fan from the top centre down to the left edge, passing behind the consoles
  // and under the title block.
  stroke(s, rand, {
    points: at([[0.62, -0.12], [0.53, 0.02], [0.43, 0.16], [0.32, 0.32], [0.2, 0.48], [0.08, 0.62], [-0.08, 0.76]]),
    width: 0.3 * H,
    bristles: 260,
    clumps: 26,
    flow: 0.62,
    dry: 0.8,
    wash: 0.8,
    head: 0.9,
    attack: 0.04,
    release: 0.5,
    tail: 0.28,
    grain: 0.014,
    skip: 1.25,
    soft: 0.16,
    tooth: 0.45,
    t0: 0,
    t1: 0.44,
  })
  // Light wash curl that runs between the title and the tagline, like the reference.
  stroke(s, rand, {
    points: at([[-0.06, 0.315], [0.05, 0.29], [0.16, 0.284], [0.245, 0.302], [0.268, 0.338]]),
    width: 0.06 * H,
    bristles: 120,
    clumps: 10,
    flow: 0.12,
    dry: 0.9,
    wash: 0.16,
    head: 0.7,
    release: 0.35,
    tail: 0.2,
    grain: 0.02,
    soft: 0.18,
    t0: 0.3,
    t1: 0.46,
  })
  stroke(s, rand, {
    points: at([[0.74, -0.07], [0.64, 0.06], [0.53, 0.2], [0.42, 0.33], [0.3, 0.45], [0.2, 0.54]]),
    width: 0.13 * H,
    bristles: 150,
    clumps: 16,
    flow: 0.6,
    dry: 1.05,
    wash: 0.35,
    head: 0.75,
    release: 0.55,
    tail: 0.06,
    grain: 0.02,
    skip: 1.35,
    soft: 0.14,
    t0: 0.1,
    t1: 0.42,
  })
  stroke(s, rand, {
    points: at([[0.5, 0.015], [0.4, 0.05], [0.31, 0.1], [0.24, 0.15]]),
    width: 0.045 * H,
    bristles: 70,
    flow: 0.75,
    dry: 1.1,
    head: 0.4,
    release: 0.55,
    tail: 0.05,
    grain: 0.03,
    skip: 1.3,
    t0: 0.14,
    t1: 0.3,
  })
  // Ground swoosh under the consoles that curls off the bottom edge.
  stroke(s, rand, {
    points: at([[-0.08, 0.84], [0.06, 0.775], [0.22, 0.755], [0.38, 0.79], [0.5, 0.87], [0.57, 0.97], [0.6, 1.1]]),
    width: 0.23 * H,
    bristles: 250,
    clumps: 24,
    flow: 0.58,
    dry: 0.75,
    wash: 0.72,
    head: 0.8,
    release: 0.38,
    tail: 0.22,
    grain: 0.016,
    skip: 1.2,
    soft: 0.16,
    tooth: 0.4,
    t0: 0.36,
    t1: 0.8,
  })
  splatter(s, rand, { x: 0.52 * width, y: 0.03 * H, spread: 0.1 * H, count: 70, size: 7, tails: 0.2, t: 0.04 })
  splatter(s, rand, { x: 0.04 * width, y: 0.48 * H, spread: 0.1 * H, count: 55, size: 5, direction: Math.PI * 0.85, cone: 1.8, t: 0.42 })
  splatter(s, rand, { x: 0.565 * width, y: 0.97 * H, spread: 0.08 * H, count: 60, size: 6, tails: 0.18, t: 0.78 })
  splatter(s, rand, { x: 0.46 * width, y: 0.24 * H, spread: 0.16 * H, count: 40, size: 3.2, t: 0.22 })
  speckle(s, rand, {
    count: 1100,
    size: 1.3,
    t: 0.5,
    density: (x) => Math.max(0, 1 - x / (0.66 * width)) ** 1.5,
  })

  const grain = paperGrain(width, height, 0x51)
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    const row = (height - 1 - y) * width * 4
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      const o = row + x * 4
      data[o] = s.ink[i] * 255
      data[o + 1] = s.time[i] * 255
      data[o + 2] = (0.5 + grain[i] * 3) * 255
      data[o + 3] = 255
    }
  }
  return { width, height, data }
}

function packSkin(s) {
  const { w, h, ink } = s
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    const row = (h - 1 - y) * w * 4
    for (let x = 0; x < w; x++) {
      const k = ink[y * w + x]
      const o = row + x * 4
      data[o] = SKIN_BASE[0] + (SKIN_INK[0] - SKIN_BASE[0]) * k
      data[o + 1] = SKIN_BASE[1] + (SKIN_INK[1] - SKIN_BASE[1]) * k
      data[o + 2] = SKIN_BASE[2] + (SKIN_INK[2] - SKIN_BASE[2]) * k
      data[o + 3] = 255
    }
  }
  return { width: w, height: h, data }
}

// Aggressive dry streaks: thin clumped hairs with hard edges that run out of ink fast.
const streak = (extra) => ({
  bristles: 150,
  clumps: 14,
  flow: 0.95,
  dry: 1.1,
  skip: 1.5,
  soft: 0.06,
  grain: 0.012,
  tooth: 0,
  head: 0.35,
  attack: 0.12,
  release: 0.55,
  tail: 0.05,
  hair: 0.2,
  thin: [0.35, 0.45],
  wobble: 0.03,
  edgeLoss: 0.8,
  ...extra,
})

function skin(width, height, seed, paint) {
  const s = surface(width, height)
  paint(s, random(seed), scaled(width, height))
  return packSkin(s)
}

/** Panel art. The left panels read front-to-the-right, the right panels front-to-the-left. */
export function paintSkins() {
  const drops = { stretch: 0.45, power: 3 }
  const ps5Left = skin(768, 1152, 0x5a1, (s, rand, at) => {
    stroke(s, rand, streak({ points: at([[-0.06, 1.02], [0.28, 0.8], [0.62, 0.55], [1.06, 0.29]]), width: 0.42 * 768 }))
    stroke(s, rand, streak({ points: at([[0.02, 0.31], [0.22, 0.19], [0.41, 0.1]]), width: 0.18 * 768, bristles: 70, clumps: 7, dry: 1.2 }))
    splatter(s, rand, { ...drops, x: 0.58 * 768, y: 0.48 * 1152, spread: 0.2 * 768, count: 130, size: 7, tails: 0.25, direction: -0.6, cone: 1.8 })
    splatter(s, rand, { ...drops, x: 0.25 * 768, y: 0.86 * 1152, spread: 0.16 * 768, count: 70, size: 6 })
    speckle(s, rand, { count: 1400, size: 1.4 })
    mark(s, 0.68 * 768, 0.11 * 1152, 0.17 * 768)
  })
  const ps5Right = skin(768, 1152, 0x5a2, (s, rand, at) => {
    stroke(s, rand, streak({ points: at([[1.06, 0.98], [0.76, 0.72], [0.5, 0.45], [0.38, 0.12], [0.36, -0.05]]), width: 0.36 * 768 }))
    stroke(s, rand, streak({ points: at([[0.08, 0.58], [0.16, 0.7], [0.2, 0.86]]), width: 0.14 * 768, bristles: 60, clumps: 6, dry: 1.25 }))
    splatter(s, rand, { ...drops, x: 0.45 * 768, y: 0.55 * 1152, spread: 0.22 * 768, count: 120, size: 7, tails: 0.22 })
    splatter(s, rand, { ...drops, x: 0.72 * 768, y: 0.2 * 1152, spread: 0.14 * 768, count: 60, size: 5 })
    speckle(s, rand, { count: 1300, size: 1.4 })
  })
  const xboxFront = skin(640, 1280, 0xb01, (s, rand, at) => {
    stroke(s, rand, streak({ points: at([[1.06, 0.06], [0.7, 0.3], [0.4, 0.58], [0.05, 0.93]]), width: 0.5 * 640 }))
    splatter(s, rand, { ...drops, x: 0.55 * 640, y: 0.42 * 1280, spread: 0.24 * 640, count: 120, size: 7, tails: 0.22 })
    splatter(s, rand, { ...drops, x: 0.3 * 640, y: 0.86 * 1280, spread: 0.14 * 640, count: 50, size: 5 })
    speckle(s, rand, { count: 1300, size: 1.4 })
  })
  const xboxSide = skin(640, 1280, 0xb02, (s, rand, at) => {
    stroke(s, rand, streak({ points: at([[-0.05, 0.86], [0.35, 0.62], [0.72, 0.36], [1.05, 0.12]]), width: 0.55 * 640 }))
    stroke(s, rand, streak({ points: at([[0.12, 0.04], [0.1, 0.3], [0.13, 0.5]]), width: 0.12 * 640, bristles: 55, clumps: 5, dry: 1.25 }))
    splatter(s, rand, { ...drops, x: 0.5 * 640, y: 0.5 * 1280, spread: 0.26 * 640, count: 130, size: 7, tails: 0.25, direction: -0.7, cone: 2 })
    speckle(s, rand, { count: 1300, size: 1.4 })
  })
  return { ps5Left, ps5Right, xboxFront, xboxSide }
}

/** Xbox Series X top: a circular field of vent holes on a dark plate. */
export function paintVent(size = 512) {
  const data = new Uint8ClampedArray(size * size * 4)
  const c = size / 2
  const radius = size * 0.43
  const pitch = size / 40
  const rowStep = pitch * 0.866
  const hole = pitch * 0.34
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5 - c
      const py = y + 0.5 - c
      const d = Math.hypot(px, py)
      let v = 20
      if (d < radius) {
        const row = Math.round(py / rowStep)
        let best = Infinity
        let dyBest = 0
        for (let r = row - 1; r <= row + 1; r++) {
          const shift = r & 1 ? pitch / 2 : 0
          const col = Math.round((px - shift) / pitch)
          for (let q = col - 1; q <= col + 1; q++) {
            const hx = q * pitch + shift
            const hy = r * rowStep
            if (Math.hypot(hx, hy) > radius - hole) continue
            const e = Math.hypot(px - hx, py - hy)
            if (e < best) {
              best = e
              dyBest = py - hy
            }
          }
        }
        v = 15 - 6 * (1 - d / radius)
        if (best < hole) v = 3
        else if (best < hole + 1.3) v = dyBest > 0 ? 40 : 9
      } else if (d < radius + 3) {
        v = 34
      }
      const o = (y * size + x) * 4
      data[o] = v
      data[o + 1] = v
      data[o + 2] = v
      data[o + 3] = 255
    }
  }
  return { width: size, height: size, data }
}
