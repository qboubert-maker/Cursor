import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, Pause, Play, X } from 'lucide-react'
import DiscordIcon from './icons/DiscordIcon'
import { useCheckout } from '../context/CheckoutContext'
import { DISCORD_URL } from '../lib/content'
import { EASE_EXPO, LOGO_URL, SECTIONS, scrollProgress } from '../lib/rig'

const LINKS = SECTIONS
const GROUPS = Array.from({ length: Math.ceil(LINKS.length / 3) }, (_, group) =>
  LINKS.slice(group * 3, group * 3 + 3).map((link, offset) => ({ link, index: group * 3 + offset })),
)

export default function Navbar({ active, booted, playing, onTogglePlay, onNavigate }) {
  const [open, setOpen] = useState(false)
  const { isTheaterOpen, isCheckoutOpen } = useCheckout()
  const hidden = isTheaterOpen || isCheckoutOpen

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const go = (index) => {
    setOpen(false)
    onNavigate(index)
  }

  return (
    <motion.header
      initial={{ y: -90, opacity: 0 }}
      animate={booted ? { y: 0, opacity: hidden ? 0 : 1 } : { y: -90, opacity: 0 }}
      transition={{ duration: 1.1, ease: EASE_EXPO, delay: 0.35 }}
      className={`fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-black/75 transition-opacity duration-500 ${hidden ? 'pointer-events-none opacity-0' : ''}`}
    >
      <div className="mx-auto flex h-16 max-w-[1680px] items-center justify-between px-5 md:px-8">
        <button onClick={() => go(0)} className="group flex shrink-0 items-center gap-2.5" aria-label="Blank Delay — back to top">
          <span className="relative block h-8 w-[3.25rem] overflow-hidden" aria-hidden="true">
            <img src={LOGO_URL} alt="" className="pointer-events-none absolute left-1/2 top-1/2 h-[4.75rem] w-[4.75rem] max-w-none -translate-x-1/2 -translate-y-1/2" />
          </span>
          <span className="font-display stretch-wide text-[13px] font-extrabold tracking-[0.06em] text-white">BLANK DELAY</span>
        </button>

        <nav className="mx-3 hidden min-w-0 flex-1 items-center justify-center gap-2 md:flex min-[1440px]:mx-5 min-[1440px]:gap-3" aria-label="Primary">
          {GROUPS.map((group) => (
            <div
              key={group[0].link.id}
              className="flex h-11 shrink-0 items-center rounded-full border border-white/20 bg-linear-to-b from-white/[0.09] to-white/[0.03] px-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_10px_36px_rgba(0,0,0,0.45)] backdrop-blur-xl"
            >
              {group.map(({ link, index }) => {
                const isActive = active === index
                return (
                  <button
                    key={link.id}
                    onClick={() => go(index)}
                    className={`relative shrink-0 whitespace-nowrap rounded-full px-2 py-1.5 font-mono text-[9px] uppercase tracking-[0.08em] transition-colors duration-300 min-[1680px]:px-2.5 min-[1680px]:text-[10px] min-[1680px]:tracking-[0.12em] ${
                      isActive ? 'text-black' : 'text-white/60 hover:text-white'
                    }`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="nav-active"
                        className="absolute inset-0 rounded-full bg-white shadow-[0_0_28px_rgba(255,255,255,0.4)]"
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      />
                    )}
                    <span className="relative">{link.label}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="flex items-center gap-3 sm:gap-4">
          <a
            href={DISCORD_URL}
            target="_blank"
            rel="noreferrer"
            className="hidden items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-black transition-shadow duration-300 hover:shadow-[0_0_32px_rgba(255,255,255,0.6)] sm:inline-flex"
          >
            <DiscordIcon className="h-4 w-4 shrink-0" />
            <span className="flex flex-col items-start leading-[1.05]">
              <span className="text-[12px] font-semibold tracking-tight">Join Discord</span>
              <span className="text-[9px] font-medium tracking-tight text-black/55">for % off</span>
            </span>
          </a>
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onTogglePlay()
            }}
            aria-pressed={playing}
            aria-label={playing ? 'Pause slideshow' : 'Play slideshow'}
            className="pointer-events-auto relative z-10 group inline-flex items-center gap-2.5 text-white"
          >
            <span className="relative grid h-10 w-10 place-items-center">
              <svg viewBox="0 0 40 40" className="pointer-events-none absolute inset-0 -rotate-90" aria-hidden="true">
                <circle cx="20" cy="20" r="18.25" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1.5" />
                <motion.circle
                  cx="20"
                  cy="20"
                  r="18.25"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  style={{ pathLength: scrollProgress }}
                />
              </svg>
              <span className="grid h-7 w-7 place-items-center rounded-full bg-white text-black transition-shadow duration-300 group-hover:shadow-[0_0_22px_rgba(255,255,255,0.7)]">
                {playing ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" className="translate-x-px" />}
              </span>
            </span>
            <span className="hidden font-mono text-[10px] tracking-[0.22em] text-white/70 transition-colors group-hover:text-white min-[1440px]:inline">
              {playing ? 'PAUSE' : 'PLAY'}
            </span>
          </button>
          <button
            onClick={() => setOpen((v) => !v)}
            className="grid h-10 w-10 place-items-center rounded-full border border-white/15 text-white md:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      <motion.div
        style={{ scaleX: scrollProgress }}
        className="absolute bottom-[-1px] left-0 h-px w-full origin-left bg-white shadow-[0_0_12px_rgba(255,255,255,0.8)]"
      />

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35, ease: EASE_EXPO }}
            className="border-t border-white/10 bg-black/80 px-5 pt-4 pb-6 backdrop-blur-md md:hidden"
          >
            {SECTIONS.map((s, i) => (
              <button
                key={s.id}
                onClick={() => go(i)}
                className="flex w-full items-center justify-between border-b border-white/10 py-4 text-left"
              >
                <span className="font-display stretch-wide text-xl font-extrabold uppercase">{s.label}</span>
                <span className="font-mono text-[11px] text-white/40">{s.index}</span>
              </button>
            ))}
            <a
              href={DISCORD_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-6 flex items-center justify-center gap-2 rounded-full bg-white py-3.5 font-semibold text-black"
            >
              <DiscordIcon className="h-5 w-5" /> Join Discord for % off
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  )
}
