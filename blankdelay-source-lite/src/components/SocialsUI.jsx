import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { SOCIALS } from '../lib/content'
import { EASE_EXPO, socialRig } from '../lib/rig'
import DiscordIcon from './icons/DiscordIcon'

const INDEX = { tiktok: 1, instagram: 2, youtube: 3, discord: 4 }

function Mark({ id }) {
  if (id === 'tiktok') {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path
          d="M9.2 8.2v6.1a2.7 2.7 0 1 1-1.8-2.55V9.4c.55.2 1.15.32 1.8.32V8.2Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path d="M9.2 8.2c.7 1.55 2.05 2.55 3.7 2.7V8.7A4.4 4.4 0 0 1 11 7.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M14.6 6.4h1.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    )
  }
  if (id === 'discord') {
    return <DiscordIcon className="h-5 w-5" />
  }
  if (id === 'instagram') {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <rect x="4" y="4" width="16" height="16" rx="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="12" cy="12" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="16.6" cy="7.4" r="0.9" fill="currentColor" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <rect x="3" y="6.5" width="18" height="11" rx="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M11 9.5v5l4.2-2.5L11 9.5Z" fill="currentColor" />
    </svg>
  )
}

function focus(index) {
  socialRig.id = index
}

export default function SocialsUI({ active }) {
  const [hot, setHot] = useState(null)
  const [open, setOpen] = useState(null)
  const root = useRef(null)

  useEffect(() => {
    if (!active) setOpen(null)
  }, [active])

  useEffect(() => {
    if (!open) return undefined
    const onPointer = (event) => {
      if (!root.current?.contains(event.target)) setOpen(null)
    }
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(null)
    }
    window.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <motion.div
      ref={root}
      initial="hidden"
      animate={active ? 'show' : 'hidden'}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } } }}
      className="mt-8 flex w-full max-w-[340px] flex-col gap-3"
    >
      {SOCIALS.map((social) => {
        const index = INDEX[social.id]
        const on = hot === social.id || open === social.id
        const expanded = open === social.id
        return (
          <motion.div
            key={social.id}
            variants={{ hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE_EXPO } } }}
            onMouseEnter={() => {
              setHot(social.id)
              socialRig.locked = index
              focus(index)
            }}
            onMouseLeave={() => {
              setHot((current) => (current === social.id ? null : current))
              if (open !== social.id) {
                socialRig.locked = 0
                socialRig.id = 0
              }
            }}
            className="flex flex-col"
          >
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={`${social.id}-channels`}
              onClick={() => {
                socialRig.locked = index
                focus(index)
                setOpen((current) => (current === social.id ? null : social.id))
              }}
              className={`pointer-events-auto group inline-flex min-w-[180px] items-center justify-between gap-4 rounded-full border px-5 py-3.5 text-left transition-shadow duration-300 ${
                on
                  ? 'border-white bg-white text-black shadow-[0_0_40px_rgba(255,255,255,0.55)]'
                  : 'border-white/20 bg-white/5 text-white hover:border-white hover:shadow-[0_0_32px_rgba(255,255,255,0.28)]'
              }`}
            >
              <span className="flex items-center gap-3">
                <Mark id={social.id} />
                <span className="font-display stretch-wide text-[13px] font-black tracking-[0.14em] uppercase">{social.label}</span>
              </span>
              <span className="flex items-center gap-2">
                <span className={`font-mono text-[10px] tracking-[0.18em] ${on ? 'text-black/50' : 'text-white/40'}`}>
                  {String(social.channels.length).padStart(2, '0')}
                </span>
                <svg
                  viewBox="0 0 12 12"
                  className={`h-3 w-3 transition-transform duration-500 ${expanded ? 'rotate-180' : ''} ${on ? 'text-black/70' : 'text-white/50'}`}
                  aria-hidden="true"
                >
                  <path d="M2.2 4.2 6 8l3.8-3.8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </button>

            <AnimatePresence initial={false}>
              {expanded && (
                <motion.div
                  id={`${social.id}-channels`}
                  key="menu"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.45, ease: EASE_EXPO }}
                  className="overflow-hidden"
                >
                  <motion.ul
                    initial="hidden"
                    animate="show"
                    variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.08 } } }}
                    className="flex flex-col gap-2 pt-2 pl-3"
                  >
                    {social.channels.map((channel, i) => (
                      <motion.li
                        key={channel.label}
                        variants={{
                          hidden: { opacity: 0, x: -16, filter: 'blur(6px)' },
                          show: { opacity: 1, x: 0, filter: 'blur(0px)', transition: { duration: 0.45, ease: EASE_EXPO } },
                        }}
                      >
                        <a
                          href={channel.href}
                          target="_blank"
                          rel="noreferrer"
                          className="pointer-events-auto flex items-center justify-between gap-3 rounded-full border border-white/15 bg-black/50 px-4 py-2.5 text-white backdrop-blur-md transition-colors duration-300 hover:border-white hover:bg-white hover:text-black"
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            <span className="font-mono text-[10px] tracking-[0.16em] text-current/45">{String(i + 1).padStart(2, '0')}</span>
                            <span className="truncate font-display text-[12px] font-bold tracking-[0.08em] uppercase">{channel.label}</span>
                          </span>
                          <span className="shrink-0 font-mono text-[10px] tracking-[0.16em] text-current/45">OPEN</span>
                        </a>
                      </motion.li>
                    ))}
                  </motion.ul>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )
      })}
    </motion.div>
  )
}
