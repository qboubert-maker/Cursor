// Ink rendering on plain typed arrays. No DOM, so it runs inside a worker and in Node.
// A surface holds ink density (0..1) and the earliest stroke time (0..1) that touched
// each pixel, which the backdrop shader uses to paint strokes in order.

export function random(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hash(x, y, seed) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1442695041)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

export function noise2(x, y, seed) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const fx = x - xi
  const fy = y - yi
  const u = fx * fx * (3 - 2 * fx)
  const v = fy * fy * (3 - 2 * fy)
  const a = hash(xi, yi, seed)
  const b = hash(xi + 1, yi, seed)
  const c = hash(xi, yi + 1, seed)
  const d = hash(xi + 1, yi + 1, seed)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

function noise1(x, seed) {
  const xi = Math.floor(x)
  const f = x - xi
  const a = hash(xi, 0, seed)
  return a + (hash(xi + 1, 0, seed) - a) * f * f * (3 - 2 * f)
}

export function fbm(x, y, seed, octaves) {
  let sum = 0
  let amp = 0.5
  let norm = 0
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise2(x, y, seed + o * 101)
    norm += amp
    x *= 2.03
    y *= 2.03
    amp *= 0.5
  }
  return sum / norm
}

export function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

export function surface(w, h) {
  return { w, h, ink: new Float32Array(w * h), time: new Float32Array(w * h).fill(1) }
}

function deposit(s, i, amount, t) {
  s.ink[i] += (1 - s.ink[i]) * amount
  if (t < s.time[i]) s.time[i] = t
}

function dab(s, x, y, r, a, t) {
  const { w, h } = s
  const reach = r + 1
  const x0 = Math.max(0, Math.floor(x - reach))
  const x1 = Math.min(w - 1, Math.ceil(x + reach))
  const y0 = Math.max(0, Math.floor(y - reach))
  const y1 = Math.min(h - 1, Math.ceil(y + reach))
  for (let py = y0; py <= y1; py++) {
    const dy = py + 0.5 - y
    const row = py * w
    for (let px = x0; px <= x1; px++) {
      const dx = px + 0.5 - x
      const k = r + 0.5 - Math.sqrt(dx * dx + dy * dy)
      if (k > 0) deposit(s, row + px, a * (k > 1 ? 1 : k), t)
    }
  }
}

function softDab(s, x, y, r, a, t) {
  const { w, h } = s
  const x0 = Math.max(0, Math.floor(x - r))
  const x1 = Math.min(w - 1, Math.ceil(x + r))
  const y0 = Math.max(0, Math.floor(y - r))
  const y1 = Math.min(h - 1, Math.ceil(y + r))
  const core = r * 0.6
  for (let py = y0; py <= y1; py++) {
    const dy = py + 0.5 - y
    for (let px = x0; px <= x1; px++) {
      const dx = px + 0.5 - x
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d >= r) continue
      const k = d <= core ? 1 : 1 - (d - core) / (r - core)
      deposit(s, py * w + px, a * k * k * (3 - 2 * k), t)
    }
  }
}

/** A filled ellipse stretched along `angle`, used for droplets and speckles. */
export function drop(s, x, y, r, angle, stretch, a, t) {
  const { w, h } = s
  const c = Math.cos(angle)
  const sn = Math.sin(angle)
  const reach = r * stretch + 1
  const x0 = Math.max(0, Math.floor(x - reach))
  const x1 = Math.min(w - 1, Math.ceil(x + reach))
  const y0 = Math.max(0, Math.floor(y - reach))
  const y1 = Math.min(h - 1, Math.ceil(y + reach))
  for (let py = y0; py <= y1; py++) {
    const dy = py + 0.5 - y
    for (let px = x0; px <= x1; px++) {
      const dx = px + 0.5 - x
      const u = (dx * c + dy * sn) / stretch
      const v = dy * c - dx * sn
      const k = r + 0.5 - Math.sqrt(u * u + v * v)
      if (k > 0) deposit(s, py * w + px, a * (k > 1 ? 1 : k), t)
    }
  }
}

function catmull(a, b, c, d, t) {
  const t2 = t * t
  return 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t2 * t)
}

/** Catmull-Rom through `points`, resampled at an even arc-length `spacing`. */
function trace(points, spacing) {
  const dense = []
  const n = points.length
  for (let i = 0; i < n - 1; i++) {
    const a = points[Math.max(0, i - 1)]
    const b = points[i]
    const c = points[i + 1]
    const d = points[Math.min(n - 1, i + 2)]
    for (let k = 0; k < 48; k++) {
      const t = k / 48
      dense.push(catmull(a[0], b[0], c[0], d[0], t), catmull(a[1], b[1], c[1], d[1], t))
    }
  }
  dense.push(points[n - 1][0], points[n - 1][1])

  const xs = [dense[0]]
  const ys = [dense[1]]
  let need = spacing
  for (let i = 2; i < dense.length; i += 2) {
    const ax = dense[i - 2]
    const ay = dense[i - 1]
    const seg = Math.hypot(dense[i] - ax, dense[i + 1] - ay)
    let at = 0
    while (seg - at >= need) {
      at += need
      xs.push(ax + ((dense[i] - ax) * at) / seg)
      ys.push(ay + ((dense[i + 1] - ay) * at) / seg)
      need = spacing
    }
    need -= seg - at
  }

  const m = xs.length
  const tx = new Float32Array(m)
  const ty = new Float32Array(m)
  for (let i = 0; i < m; i++) {
    const a = Math.max(0, i - 3)
    const b = Math.min(m - 1, i + 3)
    const dx = xs[b] - xs[a]
    const dy = ys[b] - ys[a]
    const l = Math.hypot(dx, dy) || 1
    tx[i] = dx / l
    ty[i] = dy / l
  }
  return { xs, ys, tx, ty, m }
}

function pressure(u, o, seed) {
  const attack = o.attack ?? 0.06
  const release = o.release ?? 0.32
  const head = o.head ?? 0.55
  const tail = o.tail ?? 0.1
  let p = 1
  if (u < attack) p = head + (1 - head) * smoothstep(0, attack, u)
  else if (u > 1 - release) p = tail + (1 - tail) * smoothstep(0, release, 1 - u)
  return p * (1 + (noise1(u * (o.pulse ?? 3.2), seed + 11) - 0.5) * (o.swell ?? 0.22))
}

// Wide, soft body of a wet stroke, painted at quarter resolution and blended up.
function wash(s, path, o, seed, t0, t1) {
  const scale = 4
  const lw = Math.ceil(s.w / scale) + 2
  const lh = Math.ceil(s.h / scale) + 2
  const lo = surface(lw, lh)
  const step = 3
  for (let i = 0; i < path.m; i += step) {
    const u = i / (path.m - 1)
    const r = (o.width * pressure(u, o, seed) * 0.5 * (o.washWidth ?? 1.02)) / scale
    if (r < 0.75) continue
    const target = Math.min(0.97, o.wash * (0.6 + 0.8 * noise1(u * 3 + 17, seed + 41)))
    const per = 1 - Math.pow(1 - target, step / scale / (2 * r))
    softDab(lo, path.xs[i] / scale, path.ys[i] / scale, r, per, t0 + (t1 - t0) * u)
  }

  const { w, h } = s
  for (let y = 0; y < h; y++) {
    const fy = y / scale
    const y0 = Math.floor(fy)
    const wy = fy - y0
    for (let x = 0; x < w; x++) {
      const fx = x / scale
      const x0 = Math.floor(fx)
      const wx = fx - x0
      const i = y0 * lw + x0
      const a = lo.ink[i]
      const b = lo.ink[i + 1]
      const c = lo.ink[i + lw]
      const d = lo.ink[i + lw + 1]
      let v = a + (b - a) * wx + (c - a) * wy + (a - b - c + d) * wx * wy
      if (v <= 0.002) continue
      v *= 0.78 + 0.44 * (0.65 * noise2(x * 0.021, y * 0.021, seed + 51) + 0.35 * noise2(x * 0.047 + y * 0.012, y * 0.047 - x * 0.012, seed + 52))
      deposit(s, y * w + x, Math.min(1, v), lo.time[i])
    }
  }
}

/**
 * One brush stroke simulated as individual bristles. Each bristle carries its own
 * ink load and runs dry along the path, which breaks the stroke into streaks.
 */
export function stroke(s, rand, o) {
  const path = trace(o.points, o.spacing ?? 1)
  const { xs, ys, tx, ty, m } = path
  if (m < 2) return
  const seed = (rand() * 0x7fffffff) | 0
  const n = o.bristles
  const off = new Float32Array(n)
  const load = new Float32Array(n)
  const drain = new Float32Array(n)
  const phase = new Float32Array(n)
  const freq = new Float32Array(n)
  const radius = new Float32Array(n)
  const edgeLoss = o.edgeLoss ?? 0.5
  const grain = o.grain ?? 0.02
  // Hairs clump together, so neighbours share ink and skip the paper at the same spots.
  const clumps = o.clumps ?? 0
  const clumpLoad = new Float32Array(Math.max(1, clumps))
  const clumpPhase = new Float32Array(Math.max(1, clumps))
  for (let c = 0; c < clumps; c++) {
    clumpLoad[c] = 0.55 + 0.6 * rand()
    clumpPhase[c] = rand() * 4096
  }
  const thin = o.thin ?? [0.5, 0.45]
  for (let j = 0; j < n; j++) {
    off[j] = (j + rand()) / n - 0.5
    const c = clumps ? Math.min(clumps - 1, Math.floor((off[j] + 0.5) * clumps)) : -1
    load[j] = (0.62 + 0.38 * rand()) * (1 - Math.pow(Math.abs(off[j]) * 2, 4) * edgeLoss) * (o.ink ?? 1) * (c >= 0 ? clumpLoad[c] : 1)
    drain[j] = 0.55 + 0.9 * rand()
    phase[j] = c >= 0 ? clumpPhase[c] + rand() * 0.35 : rand() * 4096
    freq[j] = (0.45 + rand()) * grain
    radius[j] = (o.width / n) * (thin[0] + thin[1] * rand()) + (o.hair ?? 0.35)
  }

  const t0 = o.t0 ?? 0
  const t1 = o.t1 ?? 1
  if (o.wash) wash(s, path, o, seed, t0, t1)

  const flow = o.flow ?? 0.6
  const dryRate = ((o.dry ?? 0.5) * 1.5) / m
  const skip = o.skip ?? 1.15
  const soft = o.soft ?? 0.24
  const tooth = o.tooth ?? 0.35
  const wobble = o.wobble ?? 0.05
  for (let i = 0; i < m; i++) {
    const u = i / (m - 1)
    const press = pressure(u, o, seed)
    const width = o.width * press
    const nx = -ty[i]
    const ny = tx[i]
    const t = t0 + (t1 - t0) * u
    const sway = (noise1(u * 4.5, seed + 3) - 0.5) * wobble
    const shrink = 0.72 + 0.28 * Math.min(1, press)
    for (let j = 0; j < n; j++) {
      const l = load[j]
      if (l <= 0.015) continue
      const thirst = Math.max(0, 1 - l - 0.22) * skip
      const f = i * freq[j] + phase[j]
      const gap = noise1(f, seed) * 0.72 + noise1(f * 3.7, seed + 1) * 0.28
      let contact = smoothstep(thirst * 0.85, thirst * 0.85 + soft, gap)
      if (contact <= 0.002) continue
      const lateral = (off[j] + sway) * width
      const x = xs[i] + nx * lateral
      const y = ys[i] + ny * lateral
      if (tooth > 0 && thirst > 0) {
        contact *= smoothstep(thirst * tooth, thirst * tooth + 0.3, noise2(x * 0.42, y * 0.42, seed + 7))
      }
      const amount = Math.min(1, l * 1.35) * contact * flow
      if (amount <= 0.004) continue
      dab(s, x, y, radius[j] * shrink, amount, t)
      load[j] = l - drain[j] * dryRate * amount
    }
  }
}

/** Thrown ink: droplets with satellites and the odd tapering tail. */
export function splatter(s, rand, o) {
  const t = o.t ?? 0
  for (let k = 0; k < o.count; k++) {
    const a = o.direction === undefined ? rand() * Math.PI * 2 : o.direction + (rand() - 0.5) * (o.cone ?? 1.4)
    const d = o.spread * Math.pow(rand(), o.falloff ?? 0.65)
    const x = o.x + Math.cos(a) * d
    const y = o.y + Math.sin(a) * d
    const r = 0.45 + o.size * Math.pow(rand(), o.power ?? 2.6)
    drop(s, x, y, r, a, 1 + rand() * (o.stretch ?? 0.8), 1, t)
    if (r > o.size * 0.3 && rand() < (o.satellites ?? 0.55)) {
      const bits = 2 + Math.floor(rand() * 6)
      for (let q = 0; q < bits; q++) {
        const b = a + (rand() - 0.5) * 0.9
        const e = r * (1.6 + rand() * 3)
        drop(s, x + Math.cos(b) * e, y + Math.sin(b) * e, r * (0.12 + rand() * 0.22), b, 1, 1, t)
      }
    }
    if (o.tails && r > o.size * 0.25 && rand() < o.tails) {
      const len = r * (3 + rand() * 6)
      for (let q = 1; q <= 8; q++) {
        const f = q / 8
        drop(s, x + Math.cos(a) * len * f, y + Math.sin(a) * len * f, r * (1 - f) * 0.55 + 0.3, a, 1.4, 1, t)
      }
    }
  }
}

export function speckle(s, rand, o) {
  const x0 = o.x0 ?? 0
  const y0 = o.y0 ?? 0
  const x1 = o.x1 ?? s.w
  const y1 = o.y1 ?? s.h
  const t = o.t ?? 0
  for (let k = 0; k < o.count; k++) {
    const x = x0 + (x1 - x0) * rand()
    const y = y0 + (y1 - y0) * rand()
    if (o.density && rand() > o.density(x, y)) continue
    drop(s, x, y, 0.35 + (o.size ?? 1.2) * Math.pow(rand(), 3), rand() * Math.PI * 2, 1 + rand() * 0.6, 0.8 + 0.2 * rand(), t)
  }
}

function inside(ax, ay, bx, by, px, py) {
  const dx = bx - ax
  const dy = by - ay
  return ((py - ay) * dx - (px - ax) * dy) / Math.hypot(dx, dy)
}

/** The Blank Delay mark (dot and arrowhead), `width` pixels wide, centred on cx, cy. */
export function mark(s, cx, cy, width, t = 0) {
  const k = width / 346
  const left = cx - width / 2
  const top = cy - (216 * k) / 2
  const dotX = left + 70 * k
  const dotY = top + 108 * k
  const dotR = 70 * k
  const tipX = left + 143 * k
  const tipY = top + 108 * k
  const backX = left + 346 * k
  const bottom = top + 216 * k
  for (let py = Math.max(0, Math.floor(top) - 1); py <= Math.min(s.h - 1, Math.ceil(bottom) + 1); py++) {
    for (let px = Math.max(0, Math.floor(left) - 1); px <= Math.min(s.w - 1, Math.ceil(left + width) + 1); px++) {
      const x = px + 0.5
      const y = py + 0.5
      const dot = dotR + 0.5 - Math.hypot(x - dotX, y - dotY)
      const arrow =
        Math.min(inside(tipX, tipY, backX, top, x, y), inside(backX, top, backX, bottom, x, y), inside(backX, bottom, tipX, tipY, x, y)) + 0.5
      const cover = Math.min(1, Math.max(0, dot, arrow))
      if (cover > 0) deposit(s, py * s.w + px, cover, t)
    }
  }
}

function splat(buf, w, h, x, y, v) {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  if (x0 < 0 || y0 < 0 || x0 >= w - 1 || y0 >= h - 1) return
  const fx = x - x0
  const fy = y - y0
  const i = y0 * w + x0
  buf[i] += v * (1 - fx) * (1 - fy)
  buf[i + 1] += v * fx * (1 - fy)
  buf[i + w] += v * (1 - fx) * fy
  buf[i + w + 1] += v * fx * fy
}

/** Signed brightness offsets for paper: soft mottling, tooth, and fibres. */
export function paperGrain(w, h, seed) {
  const out = new Float32Array(w * h)
  const step = 8
  const lw = Math.ceil(w / step) + 2
  const lh = Math.ceil(h / step) + 2
  const lo = new Float32Array(lw * lh)
  for (let y = 0; y < lh; y++) {
    for (let x = 0; x < lw; x++) {
      const u = (x * step) / w
      const v = (y * step) / h
      lo[y * lw + x] = (fbm(u * 4.2, v * 2.4, seed, 4) - 0.5) * 0.075 + (fbm(u * 22, v * 12.5, seed + 9, 3) - 0.5) * 0.04
    }
  }
  for (let y = 0; y < h; y++) {
    const fy = y / step
    const y0 = Math.floor(fy)
    const wy = fy - y0
    for (let x = 0; x < w; x++) {
      const fx = x / step
      const x0 = Math.floor(fx)
      const wx = fx - x0
      const i = y0 * lw + x0
      const a = lo[i]
      const b = lo[i + 1]
      const c = lo[i + lw]
      const d = lo[i + lw + 1]
      out[y * w + x] = a + (b - a) * wx + (c - a) * wy + (a - b - c + d) * wx * wy + (hash(x, y, seed + 3) - 0.5) * 0.032
    }
  }
  const rand = random(seed + 77)
  const fibres = Math.round((w * h) / 420)
  for (let k = 0; k < fibres; k++) {
    let x = rand() * w
    let y = rand() * h
    let a = rand() * Math.PI * 2
    const len = 6 + rand() * 46
    const tone = (rand() < 0.62 ? -1 : 1) * (0.012 + rand() * 0.03)
    const bend = (rand() - 0.5) * 0.12
    for (let q = 0; q < len; q++) {
      splat(out, w, h, x, y, tone * (1 - Math.abs(q / len - 0.5) * 1.2))
      x += Math.cos(a)
      y += Math.sin(a)
      a += bend
    }
  }
  return out
}
