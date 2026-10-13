import { useEffect, useRef, useState } from 'react'
import { OPTIMIZER_GAMES } from './games.js'

const LAYOUT = [
  { xMul: 0, z: 0, ry: 0, s: 1.06, op: 1 },
  { xMul: 1.48, z: -58, ry: 24, s: 0.86, op: 0.96 },
  { xMul: 2.52, z: -112, ry: 28, s: 0.76, op: 0.88 },
  { xMul: 3.46, z: -158, ry: 32, s: 0.68, op: 0.78 },
]
const MAX_VISIBLE = 3

function cardStyle(offset, width) {
  const dist = Math.abs(offset)
  if (dist > MAX_VISIBLE) return { visibility: 'hidden', opacity: 0, pointerEvents: 'none', zIndex: 0 }
  const sign = offset < 0 ? -1 : 1
  const cfg = LAYOUT[dist]
  const x = offset === 0 ? 0 : sign * cfg.xMul * width
  const ry = offset === 0 ? 0 : -sign * cfg.ry
  return {
    transform: `translate3d(${x.toFixed(1)}px, 0, ${cfg.z}px) rotateY(${ry}deg) scale(${cfg.s})`,
    zIndex: offset === 0 ? 120 : 100 - dist,
    '--card-op': cfg.op,
  }
}

export default function GameLibrary() {
  const [active, setActive] = useState(0)
  const [cardWidth, setCardWidth] = useState(360)
  const [launching, setLaunching] = useState('')
  const [notice, setNotice] = useState('')
  const sampleRef = useRef(null)
  const wheelLock = useRef(0)
  const total = OPTIMIZER_GAMES.length

  const step = (dir) => setActive((i) => (i + dir + total) % total)

  useEffect(() => {
    const measure = () => {
      const w = sampleRef.current?.offsetWidth
      if (w > 40) setCardWidth(w)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  useEffect(() => {
    const onKey = (event) => {
      if (event.repeat) return
      if (event.key === 'ArrowLeft') step(-1)
      if (event.key === 'ArrowRight') step(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => setNotice(''), 3200)
    return () => clearTimeout(timer)
  }, [notice])

  const onWheel = (event) => {
    const now = performance.now()
    if (now - wheelLock.current < 110) return
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
    if (Math.abs(delta) < 8) return
    wheelLock.current = now
    step(delta > 0 ? 1 : -1)
  }

  const launch = async (game) => {
    if (launching) return
    setLaunching(game.id)
    const result = await window.optimizerWindow?.launchGame?.(game.id)
    setNotice(result?.ok ? `Launching ${game.title}…` : `Couldn't open ${game.title}. Is ${game.platform} installed?`)
    setTimeout(() => setLaunching(''), 2400)
  }

  return (
    <section className="blank-games" onWheel={onWheel}>
      <div className="blank-games__spotlight" aria-hidden="true" />
      <div className="blank-games__track" role="list" aria-label="Game showcase">
        {OPTIMIZER_GAMES.map((game, index) => {
          const offset = index - active
          const isCenter = offset === 0
          return (
            <div
              key={game.id}
              ref={index === 0 ? sampleRef : undefined}
              role="listitem"
              title={game.title}
              className={`blank-games__card${isCenter ? ' is-center' : ''}`}
              style={cardStyle(offset, cardWidth)}
              onClick={() => (isCenter ? launch(game) : setActive(index))}
            >
              <div className="blank-games__inner">
                <img
                  className="blank-games__img"
                  src={game.cover}
                  alt=""
                  draggable="false"
                  style={game.position ? { objectPosition: game.position } : undefined}
                />
                <div className="blank-games__scrim" />
                <div className="blank-games__glow" />
                <div className="blank-games__cap"><span>{game.title}</span></div>
                <div className="blank-games__body">
                  <h3 className="blank-games__title">{game.title}</h3>
                  <p className="blank-games__desc">Your games · Launch with Blank Optimizer.</p>
                  <button
                    type="button"
                    className="blank-games__play"
                    tabIndex={isCenter ? 0 : -1}
                    onClick={(event) => {
                      event.stopPropagation()
                      launch(game)
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                    {launching === game.id ? `Launching ${game.title}…` : 'Launch with Blank Optimizer'}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <button type="button" className="blank-games__nav blank-games__nav--prev" aria-label="Previous game" onClick={() => step(-1)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
      </button>
      <button type="button" className="blank-games__nav blank-games__nav--next" aria-label="Next game" onClick={() => step(1)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
      </button>
      {notice ? <p className="blank-games__notice" role="status">{notice}</p> : null}
    </section>
  )
}
