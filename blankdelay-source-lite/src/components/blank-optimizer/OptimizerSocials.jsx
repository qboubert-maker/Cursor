import { useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { SOCIALS } from '../../lib/content.js'
import { rig, socialRig } from '../../lib/rig.js'
import DiscordIcon from '../icons/DiscordIcon.jsx'
import SocialParticles from '../SocialParticles.jsx'
import useAppActive from './useAppActive.js'

const INDEX = { tiktok: 1, instagram: 2, youtube: 3, discord: 4 }

function Logo({ id }) {
  if (id === 'tiktok') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.27 6.27 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15.28a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.69a8.18 8.18 0 0 0 4.76 1.52v-3.4a4.85 4.85 0 0 1-1-.12z" />
      </svg>
    )
  }
  if (id === 'instagram') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="4.1" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="17.15" cy="6.85" r="1.15" fill="currentColor" />
      </svg>
    )
  }
  if (id === 'youtube') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" fillRule="evenodd" d="M21.6 7.2a2.5 2.5 0 0 0-1.76-1.77C18.2 5 12 5 12 5s-6.2 0-7.84.43A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.76 1.77C5.8 19 12 19 12 19s6.2 0 7.84-.43a2.5 2.5 0 0 0 1.76-1.77A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8zM10.15 15.15V8.85L15.7 12l-5.55 3.15z" />
      </svg>
    )
  }
  return <DiscordIcon />
}

function focus(index) {
  socialRig.id = index
}

function Marks() {
  const active = useAppActive()
  useEffect(() => {
    const previous = rig.social
    rig.social = 1
    return () => {
      rig.social = previous
      socialRig.id = 0
      socialRig.locked = 0
    }
  }, [])
  return (
    <Canvas
      frameloop={active ? 'always' : 'never'}
      dpr={[1, 1.6]}
      gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      camera={{ fov: 36, near: 0.1, far: 40, position: [-0.15, 0.18, 9.2] }}
      onCreated={({ gl, camera }) => {
        gl.setClearColor(0x000000, 0)
        camera.lookAt(0.35, 0.02, 0)
      }}
    >
      <SocialParticles color="#e23b52" />
    </Canvas>
  )
}

export default function OptimizerSocials() {
  const [hot, setHot] = useState(null)
  const [open, setOpen] = useState(null)
  const [shown, setShown] = useState(SOCIALS[0].id)
  const root = useRef(null)
  const hotRef = useRef(null)
  const openRef = useRef(null)
  hotRef.current = hot
  openRef.current = open
  const activeId = open || hot || shown

  useEffect(() => {
    let step = 0
    const tick = () => {
      if (hotRef.current || openRef.current || socialRig.locked) return
      const social = SOCIALS[step % SOCIALS.length]
      step += 1
      setShown(social.id)
      focus(INDEX[social.id])
    }
    tick()
    const id = window.setInterval(tick, 3400)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (!open) return undefined
    const onPointer = (event) => {
      if (!root.current?.contains(event.target)) {
        socialRig.locked = 0
        setOpen(null)
      }
    }
    const onKey = (event) => {
      if (event.key === 'Escape') {
        socialRig.locked = 0
        setOpen(null)
      }
    }
    window.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <section className="blank-socials" aria-label="Connect With Us">
      <div className="blank-socials__wash" aria-hidden="true" />
      <div className="blank-socials__stage" aria-hidden="true">
        <Marks />
      </div>
      <div className="blank-socials__layout" ref={root}>
        <div className="blank-socials__copy">
          <p className="blank-socials__kicker">03 — Signal</p>
          <h1>
            Connect
            <span>With Us</span>
          </h1>
          <p className="blank-socials__lead">Hover a channel and its logo takes the stage. Click it to open an account.</p>
          <div className="blank-socials__list">
            {SOCIALS.map((social) => {
              const index = INDEX[social.id]
              const on = activeId === social.id
              const expanded = open === social.id
              return (
                <div
                  key={social.id}
                  className="blank-socials__item"
                  onMouseEnter={() => {
                    setHot(social.id)
                    socialRig.locked = index
                    focus(index)
                  }}
                  onMouseLeave={() => {
                    setHot((current) => (current === social.id ? null : current))
                    if (open !== social.id) socialRig.locked = 0
                  }}
                >
                  <button
                    type="button"
                    className={on ? 'is-on' : ''}
                    aria-expanded={expanded}
                    aria-controls="social-accounts"
                    onClick={() => {
                      const next = open === social.id ? null : social.id
                      socialRig.locked = next ? index : 0
                      focus(index)
                      setOpen(next)
                    }}
                  >
                    <span className="blank-socials__logo">
                      <Logo id={social.id} />
                    </span>
                    <span className="blank-socials__name">
                      <strong>{social.label}</strong>
                      <em>{social.channels.length === 1 ? '1 account' : `${social.channels.length} accounts`}</em>
                    </span>
                    <svg viewBox="0 0 12 12" className={expanded ? 'is-open' : ''} aria-hidden="true">
                      <path d="M4.2 2.2 8 6 4.2 9.8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  {expanded ? (
                    <ul id="social-accounts">
                      {social.channels.map((channel, i) => (
                        <li key={channel.label}>
                          <a href={channel.href} target="_blank" rel="noreferrer">
                            <span>
                              <em>{String(i + 1).padStart(2, '0')}</em>
                              {channel.label}
                            </span>
                            <strong>Open</strong>
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
