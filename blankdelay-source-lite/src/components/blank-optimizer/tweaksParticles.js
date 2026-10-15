const SPRITE_HUES = 6

function makeSprites() {
  const glowSprites = []
  const bokehSprites = []
  const dustSprites = []
  for (let i = 0; i < SPRITE_HUES; i += 1) {
    const hue = 350 + (i / Math.max(1, SPRITE_HUES - 1)) * 16
    const glowSize = 40
    const glow = document.createElement('canvas')
    glow.width = glowSize * 2
    glow.height = glowSize * 2
    const glowCtx = glow.getContext('2d')
    const glowGrad = glowCtx.createRadialGradient(glowSize, glowSize, 0, glowSize, glowSize, glowSize)
    glowGrad.addColorStop(0, `hsla(${hue}, 100%, 74%, 0.95)`)
    glowGrad.addColorStop(0.3, `hsla(${hue}, 96%, 58%, 0.45)`)
    glowGrad.addColorStop(1, `hsla(${hue}, 90%, 45%, 0)`)
    glowCtx.fillStyle = glowGrad
    glowCtx.fillRect(0, 0, glowSize * 2, glowSize * 2)
    glowSprites.push(glow)

    const bokehSize = 56
    const bokeh = document.createElement('canvas')
    bokeh.width = bokehSize * 2
    bokeh.height = bokehSize * 2
    const bokehCtx = bokeh.getContext('2d')
    const bokehGrad = bokehCtx.createRadialGradient(bokehSize, bokehSize, 0, bokehSize, bokehSize, bokehSize)
    bokehGrad.addColorStop(0, `hsla(${hue}, 86%, 62%, 0.42)`)
    bokehGrad.addColorStop(0.4, `hsla(${hue}, 82%, 50%, 0.1)`)
    bokehGrad.addColorStop(1, `hsla(${hue}, 80%, 42%, 0)`)
    bokehCtx.fillStyle = bokehGrad
    bokehCtx.fillRect(0, 0, bokehSize * 2, bokehSize * 2)
    bokehSprites.push(bokeh)

    const dust = document.createElement('canvas')
    dust.width = 5
    dust.height = 5
    const dustCtx = dust.getContext('2d')
    dustCtx.fillStyle = `hsla(${hue}, 88%, 80%, 0.85)`
    dustCtx.beginPath()
    dustCtx.arc(2.5, 2.5, 1.8, 0, Math.PI * 2)
    dustCtx.fill()
    dustSprites.push(dust)
  }
  return { glowSprites, bokehSprites, dustSprites }
}

export function startZeroDelayParticles(canvas) {
  const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true })
  if (!ctx) return () => {}
  ctx.imageSmoothingEnabled = true
  const { glowSprites, bokehSprites, dustSprites } = makeSprites()

  let width = 0
  let height = 0
  let centerX = 0
  let centerY = 0
  let bokehLayer = []
  let dustLayer = []
  let emberLayer = []
  let sparks = []
  let lastTs = 0
  let raf = 0
  let stopped = false
  let mouseX = 0
  let mouseY = 0
  let mouseActive = false
  let smoothParX = 0
  let smoothParY = 0

  const inListZone = (x, y, pad = 0.18) => {
    const dx = (x - centerX) / (width * pad)
    const dy = (y - centerY) / (height * pad)
    return dx * dx + dy * dy < 1
  }

  const spawnEmber = (initial) => {
    let x
    let tries = 0
    do {
      x = Math.random() * width
      tries += 1
    } while (inListZone(x, initial ? Math.random() * height : height + 20, 0.14) && tries < 6)
    return {
      x,
      y: initial ? Math.random() * height : height + 8 + Math.random() * 30,
      r: 1.4 + Math.random() * 3.2,
      vy: 0.22 + Math.random() * 0.42,
      vx: (Math.random() - 0.5) * 0.22,
      a: 0.32 + Math.random() * 0.48,
      sprite: Math.floor(Math.random() * SPRITE_HUES),
      phase: Math.random() * Math.PI * 2,
      tw: Math.random() * Math.PI * 2,
    }
  }

  const spawnDust = (initial) => ({
    x: Math.random() * width,
    y: initial ? Math.random() * height : height + Math.random() * 16,
    r: 0.5 + Math.random() * 1,
    vy: 0.05 + Math.random() * 0.12,
    vx: (Math.random() - 0.5) * 0.1,
    a: 0.1 + Math.random() * 0.2,
    sprite: Math.floor(Math.random() * SPRITE_HUES),
    phase: Math.random() * Math.PI * 2,
    tw: Math.random() * Math.PI * 2,
  })

  const spawnBokeh = (initial) => {
    let x
    let tries = 0
    do {
      x = Math.random() * width
      tries += 1
    } while (inListZone(x, initial ? Math.random() * height : height * 0.5, 0.2) && tries < 5)
    return {
      x,
      y: initial ? Math.random() * height : height + Math.random() * 50,
      r: 32 + Math.random() * 44,
      vy: 0.035 + Math.random() * 0.08,
      vx: (Math.random() - 0.5) * 0.06,
      a: 0.05 + Math.random() * 0.09,
      sprite: Math.floor(Math.random() * SPRITE_HUES),
      phase: Math.random() * Math.PI * 2,
      tw: Math.random() * Math.PI * 2,
    }
  }

  const spawnSpark = () => {
    const fromLeft = Math.random() > 0.5
    return {
      x: fromLeft ? -16 : width + 16,
      y: height * (0.2 + Math.random() * 0.6),
      vx: (fromLeft ? 1 : -1) * (2.2 + Math.random() * 2),
      life: 1,
      decay: 0.016 + Math.random() * 0.014,
      a: 0.4 + Math.random() * 0.35,
    }
  }

  const buildPopulation = () => {
    const area = width * height
    bokehLayer = Array.from({ length: Math.round(Math.min(7, area / 80000)) }, () => spawnBokeh(true))
    dustLayer = Array.from({ length: Math.round(Math.min(52, area / 17000)) }, () => spawnDust(true))
    emberLayer = Array.from({ length: Math.round(Math.min(46, area / 20000)) }, () => spawnEmber(true))
    sparks = []
  }

  const resize = () => {
    const rect = canvas.getBoundingClientRect()
    width = rect.width
    height = rect.height
    if (!width || !height) return
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.imageSmoothingEnabled = true
    centerX = width * 0.5
    centerY = height * 0.46
    buildPopulation()
  }

  const stepParticle = (particle, kind, dt, parX, parY) => {
    const swayScale = kind === 'ember' ? 0.24 : kind === 'dust' ? 0.1 : 0.035
    const parScale = kind === 'ember' ? 0.28 : kind === 'dust' ? 0.12 : 0.1
    particle.phase += (kind === 'ember' ? 0.008 : 0.0045) * dt
    const sway = Math.sin(particle.phase) * swayScale
    particle.y -= particle.vy * dt
    particle.x += (particle.vx + sway + parX * parScale) * dt
    particle.tw += 0.012 * dt
    if (particle.y < -16) {
      if (kind === 'ember') Object.assign(particle, spawnEmber(false))
      else if (kind === 'dust') Object.assign(particle, spawnDust(false))
      else Object.assign(particle, spawnBokeh(false))
    }
  }

  const drawParticle = (particle, kind, flick, parX, parY) => {
    ctx.globalAlpha = Math.min(1, particle.a * flick)
    if (kind === 'bokeh') {
      const size = particle.r * 1.85
      ctx.drawImage(bokehSprites[particle.sprite], particle.x - size * 0.5 + parX * 0.08, particle.y - size * 0.5 + parY * 0.08, size, size)
      return
    }
    if (kind === 'ember') {
      const size = particle.r * 3.2
      ctx.drawImage(glowSprites[particle.sprite], particle.x - size * 0.5 + parX * 0.25, particle.y - size * 0.5 + parY * 0.2, size, size)
      return
    }
    const size = particle.r * 2
    ctx.drawImage(dustSprites[particle.sprite], particle.x - particle.r + parX * 0.15, particle.y - particle.r + parY * 0.12, size, size)
  }

  const idle = () => document.hidden || document.documentElement.classList.contains('is-idle')

  const frame = (ts) => {
    if (stopped) return
    if (idle()) {
      raf = 0
      return
    }
    raf = requestAnimationFrame(frame)
    const dt = lastTs ? Math.min(2.4, (ts - lastTs) / 16.67) : 1
    lastTs = ts
    const targetParX = mouseActive ? (mouseX - centerX) * 0.009 : 0
    const targetParY = mouseActive ? (mouseY - centerY) * 0.006 : 0
    smoothParX += (targetParX - smoothParX) * 0.06
    smoothParY += (targetParY - smoothParY) * 0.06

    for (const particle of bokehLayer) stepParticle(particle, 'bokeh', dt, smoothParX, smoothParY)
    for (const particle of dustLayer) stepParticle(particle, 'dust', dt, smoothParX, smoothParY)
    for (const particle of emberLayer) stepParticle(particle, 'ember', dt, smoothParX, smoothParY)

    if (sparks.length < 3 && Math.random() < 0.006) sparks.push(spawnSpark())
    sparks = sparks.filter((spark) => {
      spark.x += spark.vx * dt
      spark.life -= spark.decay * dt
      return spark.life > 0 && spark.x > -30 && spark.x < width + 30
    })

    ctx.clearRect(0, 0, width, height)
    ctx.globalCompositeOperation = 'source-over'
    for (const particle of bokehLayer) drawParticle(particle, 'bokeh', 0.72 + Math.sin(particle.tw + particle.phase) * 0.28, smoothParX, smoothParY)
    for (const particle of dustLayer) drawParticle(particle, 'dust', 0.72 + Math.sin(particle.tw * 1.1 + particle.phase) * 0.28, smoothParX, smoothParY)
    for (const particle of emberLayer) drawParticle(particle, 'ember', 0.74 + Math.sin(particle.tw * 1.25 + particle.phase) * 0.26, smoothParX, smoothParY)

    for (const spark of sparks) {
      ctx.globalAlpha = spark.a * spark.life * 0.55
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(spark.x - spark.vx * 6, spark.y)
      ctx.lineTo(spark.x, spark.y)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  const wake = () => {
    if (stopped || raf || idle()) return
    lastTs = 0
    raf = requestAnimationFrame(frame)
  }

  const onMove = (event) => {
    const rect = canvas.getBoundingClientRect()
    mouseX = event.clientX - rect.left
    mouseY = event.clientY - rect.top
    mouseActive = true
  }
  const onLeave = () => {
    mouseActive = false
  }

  const root = canvas.parentElement
  root?.addEventListener('pointermove', onMove)
  root?.addEventListener('pointerleave', onLeave)
  window.addEventListener('focus', wake)
  document.addEventListener('visibilitychange', wake)
  window.addEventListener('resize', resize)
  resize()
  wake()

  return () => {
    stopped = true
    if (raf) cancelAnimationFrame(raf)
    root?.removeEventListener('pointermove', onMove)
    root?.removeEventListener('pointerleave', onLeave)
    window.removeEventListener('focus', wake)
    document.removeEventListener('visibilitychange', wake)
    window.removeEventListener('resize', resize)
    ctx.clearRect(0, 0, width, height)
  }
}
