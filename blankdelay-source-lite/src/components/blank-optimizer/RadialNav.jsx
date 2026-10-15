import { useEffect, useState } from 'react'
import { SECTIONS } from './sections.jsx'

const LOGO = `${import.meta.env.BASE_URL}Blank Delay Logo.png`
const ARC_START = 150
const ARC_END = 30

function useGeometry() {
  const read = () => {
    const w = window.innerWidth
    const h = window.innerHeight
    const radius = Math.round(Math.max(230, Math.min(w * 0.27, h * 0.5, 370)))
    return { w, h, radius, cx: w / 2, cy: h - 74 }
  }
  const [geo, setGeo] = useState(read)
  useEffect(() => {
    const onResize = () => setGeo(read())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return geo
}

function angleFor(index) {
  return ARC_START - (index * (ARC_START - ARC_END)) / (SECTIONS.length - 1)
}

function polar(cx, cy, r, deg) {
  const rad = (deg * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) }
}

function arcPath(cx, cy, r, from, to) {
  const a = polar(cx, cy, r, from)
  const b = polar(cx, cy, r, to)
  return `M ${a.x} ${a.y} A ${r} ${r} 0 0 1 ${b.x} ${b.y}`
}

export default function RadialNav({ active, onSelect }) {
  const [open, setOpen] = useState(false)
  const [focus, setFocus] = useState(() => Math.max(0, SECTIONS.findIndex((s) => s.id === active)))
  const { cx, cy, radius } = useGeometry()
  const activeIndex = SECTIONS.findIndex((s) => s.id === active)
  const shown = SECTIONS[focus] || SECTIONS[0]

  const toggle = () => {
    setFocus(Math.max(0, activeIndex))
    setOpen((value) => !value)
  }

  const choose = (index) => {
    onSelect(SECTIONS[index].id)
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => {
      const n = Number(event.key)
      if (event.key === 'Escape') setOpen(false)
      else if (n >= 1 && n <= SECTIONS.length) choose(n - 1)
      else if (event.key === 'ArrowLeft') setFocus((i) => Math.max(0, i - 1))
      else if (event.key === 'ArrowRight') setFocus((i) => Math.min(SECTIONS.length - 1, i + 1))
      else if (event.key === 'Enter') choose(focus)
      else return
      event.preventDefault()
      event.stopPropagation()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })

  const litTo = angleFor(focus)

  return (
    <div className={`blank-nav${open ? ' is-open' : ''}`}>
      <div className="blank-nav__backdrop" onClick={() => setOpen(false)} aria-hidden="true" />

      <div className="blank-nav__rings" style={{ left: cx, top: cy }} aria-hidden="true">
        {[0, 1, 2].map((ring) => (
          <span key={ring} className="blank-nav__ripple" style={{ '--ring': ring }} />
        ))}
      </div>

      <svg className="blank-nav__arc" aria-hidden="true">
        <defs>
          <linearGradient id="blankNavLit" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#7a0716" />
            <stop offset="100%" stopColor="#ff3b4e" />
          </linearGradient>
        </defs>
        <path d={arcPath(cx, cy, radius, ARC_START + 6, ARC_END - 6)} className="blank-nav__arc-track" />
        <path d={arcPath(cx, cy, radius, ARC_START + 6, litTo)} className="blank-nav__arc-lit" stroke="url(#blankNavLit)" />
      </svg>

      <div className="blank-nav__caption" style={{ left: cx, top: cy - radius * 0.6 }} aria-live="polite">
        <span className="blank-nav__caption-key">{String(focus + 1).padStart(2, '0')}</span>
        <h2>{shown.label}</h2>
        <p>{shown.blurb}</p>
      </div>

      <nav className="blank-nav__items" aria-label="Sections">
        {SECTIONS.map((section, index) => {
          const deg = angleFor(index)
          const pos = polar(cx, cy, radius, deg)
          const cos = Math.cos((deg * Math.PI) / 180)
          const side = cos > 0.3 ? 'right' : cos < -0.3 ? 'left' : 'top'
          return (
            <button
              key={section.id}
              type="button"
              className={`blank-nav__item${index === activeIndex ? ' is-active' : ''}${index === focus ? ' is-focus' : ''}`}
              style={{
                left: pos.x,
                top: pos.y,
                '--from-x': `${cx - pos.x}px`,
                '--from-y': `${cy - pos.y}px`,
                '--delay': `${index * 34}ms`,
              }}
              tabIndex={open ? 0 : -1}
              aria-label={section.label}
              onMouseEnter={() => setFocus(index)}
              onFocus={() => setFocus(index)}
              onClick={() => choose(index)}
            >
              <span className="blank-nav__tile">{section.icon}</span>
              <span className="blank-nav__num">{index + 1}</span>
              <span className={`blank-nav__label blank-nav__label--${side}`}>{section.label}</span>
            </button>
          )
        })}
      </nav>

      <button
        type="button"
        className="blank-nav__orb"
        style={{ left: cx, top: cy }}
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        onClick={toggle}
      >
        <span className="blank-nav__orb-ring" aria-hidden="true" />
        <span className="blank-nav__orb-core">
          <img src={LOGO} alt="" draggable="false" />
        </span>
      </button>
      {!open && activeIndex >= 0 ? (
        <span className="blank-nav__current" style={{ left: cx, top: cy - 58 }}>{SECTIONS[activeIndex].label}</span>
      ) : null}
    </div>
  )
}
