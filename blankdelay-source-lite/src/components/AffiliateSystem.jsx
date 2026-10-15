import { useEffect, useRef, useState } from 'react'
import { animate, motion } from 'framer-motion'
import { TrendingUp } from 'lucide-react'
import {
  AFFILIATE_CHART,
  AFFILIATE_CURRENT_TIER,
  AFFILIATE_NEXT_TIER,
  AFFILIATE_STATS,
  AFFILIATE_TIERS,
} from '../lib/content'
import { EASE_EXPO } from '../lib/rig'

const formatNumber = (v, { decimals = 0, prefix = '', suffix = '' }) =>
  `${prefix}${v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`

function CountUp({ stat, active, delay = 0 }) {
  const ref = useRef(null)

  useEffect(() => {
    const node = ref.current
    if (!active) {
      node.textContent = formatNumber(0, stat)
      return undefined
    }
    const controls = animate(0, stat.value, {
      duration: 1.8,
      delay,
      ease: EASE_EXPO,
      onUpdate: (v) => {
        node.textContent = formatNumber(v, stat)
      },
    })
    return () => controls.stop()
  }, [active, stat, delay])

  return (
    <span ref={ref} className="tabular-nums">
      {formatNumber(0, stat)}
    </span>
  )
}

const panelVariants = {
  hidden: { opacity: 0, y: 50, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 1.1, ease: EASE_EXPO, delay: 0.2, staggerChildren: 0.07, delayChildren: 0.5 } },
}

const rowVariants = {
  hidden: { opacity: 0, x: -16 },
  show: { opacity: 1, x: 0, transition: { duration: 0.7, ease: EASE_EXPO } },
}

const NODES = [
  { id: 'you', x: 12, y: 36, label: 'You' },
  { id: 'ops', x: 38, y: 14, label: 'Ops' },
  { id: 'creators', x: 62, y: 22, label: 'Creators' },
  { id: 'players', x: 86, y: 16, label: 'Players' },
  { id: 'payout', x: 50, y: 52, label: 'Payout' },
]

const LINKS = [
  ['you', 'ops'],
  ['you', 'payout'],
  ['ops', 'creators'],
  ['creators', 'players'],
  ['payout', 'creators'],
  ['ops', 'payout'],
]

function NodeField() {
  const [hot, setHot] = useState('you')
  const byId = Object.fromEntries(NODES.map((node) => [node.id, node]))
  return (
    <div className="border-b border-white/10 px-5 py-3">
      <div className="mb-2 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.22em] text-white/40">
        <span>Live referral graph</span>
        <span className="text-white">{byId[hot].label}</span>
      </div>
      <svg viewBox="0 0 100 64" className="h-[72px] w-full">
        {LINKS.map(([a, b]) => {
          const from = byId[a]
          const to = byId[b]
          const lit = hot === a || hot === b
          return (
            <line
              key={`${a}-${b}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={lit ? '#ffffff' : 'rgba(255,255,255,0.22)'}
              strokeWidth={lit ? 0.7 : 0.35}
            />
          )
        })}
        {NODES.map((node) => {
          const lit = hot === node.id
          return (
            <g key={node.id} onMouseEnter={() => setHot(node.id)} className="cursor-pointer">
              <circle cx={node.x} cy={node.y} r={lit ? 3.4 : 2.2} fill={lit ? '#ffffff' : 'rgba(255,255,255,0.35)'} />
              {lit && <circle cx={node.x} cy={node.y} r="6" fill="none" stroke="#ffffff" strokeOpacity="0.45" />}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export default function AffiliateSystem({ active }) {
  const peak = AFFILIATE_CHART.length - 1
  const nextProgress = Math.min(1, AFFILIATE_NEXT_TIER.current / AFFILIATE_NEXT_TIER.target)

  return (
    <motion.div
      variants={panelVariants}
      initial="hidden"
      animate={active ? 'show' : 'hidden'}
      className="pointer-events-auto relative overflow-hidden rounded-[28px] border border-white/10 bg-white/5 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl"
    >
      <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-white/[0.06] to-transparent" />

      <div className="relative flex items-center justify-between border-b border-white/10 px-5 py-3.5">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.26em] text-white/50">Affiliate Console</span>
        <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-white">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
          </span>
          Live preview
        </span>
      </div>

      <NodeField />

      <div className="relative grid grid-cols-3 divide-x divide-white/10 border-b border-white/10">
        {AFFILIATE_STATS.map((stat, i) => (
          <div key={stat.label} className="px-4 py-4 md:px-5">
            <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/45 md:text-[9.5px]">{stat.label}</div>
            <div className="font-display stretch-semi mt-2 text-[17px] font-bold tracking-tight md:text-[24px]">
              <CountUp stat={stat} active={active} delay={0.5 + i * 0.12} />
            </div>
          </div>
        ))}
      </div>

      <div className="relative hidden border-b border-white/10 px-5 pt-4 pb-3 sm:block">
        <div className="flex items-center justify-between font-mono text-[9.5px] uppercase tracking-[0.2em] text-white/45">
          <span>Commission · last 24 days</span>
          <span className="flex items-center gap-1.5 text-white">
            <TrendingUp size={12} /> Trending up
          </span>
        </div>
        <div className="mt-3 flex h-20 items-end gap-[3px]">
          {AFFILIATE_CHART.map((v, i) => (
            <motion.span
              key={i}
              className={`flex-1 origin-bottom rounded-t-[2px] ${
                i === peak ? 'bg-white shadow-[0_0_18px_rgba(255,255,255,0.7)]' : 'bg-white/25'
              }`}
              style={{ height: `${v}%` }}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: active ? 1 : 0 }}
              transition={{ duration: 0.9, delay: active ? 0.45 + i * 0.025 : 0, ease: EASE_EXPO }}
            />
          ))}
        </div>
      </div>

      <table className="relative w-full text-left">
        <thead>
          <tr className="border-b border-white/10 font-mono text-[9px] uppercase tracking-[0.22em] text-white/40">
            <th className="px-5 py-2.5 font-normal">Tier</th>
            <th className="px-3 py-2.5 font-normal">Referrals</th>
            <th className="px-3 py-2.5 font-normal">Commission</th>
            <th className="hidden px-5 py-2.5 font-normal md:table-cell">Unlocks</th>
          </tr>
        </thead>
        <motion.tbody variants={{ show: { transition: { staggerChildren: 0.08, delayChildren: 0.6 } } }}>
          {AFFILIATE_TIERS.map((row) => {
            const current = row.tier === AFFILIATE_CURRENT_TIER
            return (
              <motion.tr
                key={row.tier}
                variants={rowVariants}
                className={`border-b border-white/[0.07] last:border-b-0 ${
                  current ? 'bg-white text-black shadow-[0_0_40px_rgba(255,255,255,0.25)]' : 'text-white/85'
                }`}
              >
                <td className="px-5 py-3">
                  <span className="font-display stretch-semi text-[13px] font-extrabold uppercase tracking-tight">{row.tier}</span>
                  {current && (
                    <span className="ml-2 rounded-full border border-black/25 px-1.5 py-0.5 font-mono text-[8px] font-bold tracking-[0.2em]">
                      YOU
                    </span>
                  )}
                </td>
                <td className={`px-3 py-3 font-mono text-[11px] ${current ? 'text-black/70' : 'text-white/55'}`}>{row.referrals}</td>
                <td className="px-3 py-3">
                  <span className="font-display stretch-semi text-[16px] font-black tabular-nums">{row.commission}%</span>
                </td>
                <td className={`hidden px-5 py-3 text-[12px] md:table-cell ${current ? 'text-black/70' : 'text-white/50'}`}>{row.perk}</td>
              </motion.tr>
            )
          })}
        </motion.tbody>
      </table>

      <div className="relative border-t border-white/10 px-5 py-4">
        <div className="flex items-center justify-between font-mono text-[9.5px] uppercase tracking-[0.2em] text-white/45">
          <span>Next tier · {AFFILIATE_NEXT_TIER.name}</span>
          <span className="text-white tabular-nums">
            {AFFILIATE_NEXT_TIER.current} / {AFFILIATE_NEXT_TIER.target}
          </span>
        </div>
        <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full origin-left rounded-full bg-white shadow-[0_0_16px_rgba(255,255,255,0.8)]"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: active ? nextProgress : 0 }}
            transition={{ duration: 1.6, delay: active ? 0.9 : 0, ease: EASE_EXPO }}
          />
        </div>
      </div>
    </motion.div>
  )
}
