import { Gamepad2, Keyboard, Zap } from 'lucide-react'

export const DISCORD_URL = import.meta.env.VITE_DISCORD_URL || 'https://discord.gg/zGPeKmB9sd'

export const SOCIALS = [
  {
    id: 'tiktok',
    label: 'TikTok',
    channels: [
      { label: 'Main TikTok', href: 'https://www.tiktok.com/@blankwym?_r=1&_t=ZT-9AGGIBKR5pO' },
      { label: 'Blank Delay TikTok', href: 'https://www.tiktok.com/@blankdelay?_r=1&_t=ZP-9AGGjfKRuFL' },
    ],
  },
  {
    id: 'instagram',
    label: 'Instagram',
    channels: [{ label: 'BlankDelay Instagram', href: 'https://www.instagram.com/blankdelay?stkn=MTY2NTY4bnhwbTZueQ==' }],
  },
  {
    id: 'youtube',
    label: 'YouTube',
    channels: [
      { label: 'BlankDelay YT', href: 'https://youtube.com/@blankdelayy?si=FiT_rX-5jjRYdcKO' },
      { label: 'Main YouTube Channel', href: 'https://youtube.com/@whyblankk?si=GBwxYH3dJfjMs9BU' },
      { label: 'Second Main Channel', href: 'https://youtube.com/@whyblankk?si=GBwxYH3dJfjMs9BU' },
      { label: 'Blank 1v1 Map Channel', href: 'https://youtube.com/@blank1v1map?si=4bjyduWR3Zj1Fwow' },
    ],
  },
  {
    id: 'discord',
    label: 'Discord',
    channels: [{ label: 'Join Discord', href: DISCORD_URL }],
  },
]

export const PRODUCTS = [
  {
    id: 'fps-boost',
    index: '01',
    icon: Zap,
    title: 'FPS Boost',
    tagline: 'System-level kernel tweaks for maximum frames.',
    body: 'We rebuild the path between your CPU, GPU and display: scheduler priority, timer resolution, core parking and power states tuned for one thing — more frames, delivered evenly.',
    tags: ['Timer resolution', 'Core unparking', 'GPU scheduling', 'Service debloat', 'Power plan'],
    visual: 'fps',
  },
  {
    id: 'controller-macro',
    index: '02',
    icon: Gamepad2,
    title: 'Controller Macro',
    tagline: 'Hardware-level polling rate overrides.',
    body: 'Push your pad past its factory polling limit and bind frame-perfect macros directly at the input layer.',
    tags: ['USB polling override', 'Deadzone calibration', 'Macro remap'],
    visual: 'polling',
  },
  {
    id: 'keyboard-macro',
    index: '03',
    icon: Keyboard,
    title: 'Keyboard Macro',
    tagline: 'Sub-millisecond execution.',
    body: 'Chain complex inputs into a single keystroke. Executed in under a millisecond, every single time.',
    tags: ['Input chaining', 'Per-game profiles', 'Hotkey layers'],
    visual: 'keys',
  },
]

export const AFFILIATE_TIERS = [
  { tier: 'Initiate', referrals: '0 – 24', commission: 10, perk: 'Personal link & live tracking' },
  { tier: 'Operator', referrals: '25 – 99', commission: 15, perk: 'Priority payouts & creator kit' },
  { tier: 'Elite', referrals: '100 – 249', commission: 20, perk: 'Monthly bonus pool' },
  { tier: 'Override', referrals: '250+', commission: 25, perk: 'Private channel & custom codes' },
]

export const AFFILIATE_CURRENT_TIER = 'Elite'

export const AFFILIATE_NEXT_TIER = { name: 'Override', current: 186, target: 250 }

export const AFFILIATE_STATS = [
  { label: 'Earnings · 30D', value: 12480.2, prefix: '$', decimals: 2 },
  { label: 'Active referrals', value: 186, decimals: 0 },
  { label: 'Conversion', value: 8.6, suffix: '%', decimals: 1 },
]

export const AFFILIATE_HIGHLIGHTS = [
  { value: '25%', label: 'Top-tier commission' },
  { value: 'Real-time', label: 'Click & sale tracking' },
  { value: 'Weekly', label: 'Payout cycle' },
]

export const AFFILIATE_CHART = [
  22, 28, 25, 34, 30, 41, 38, 36, 47, 44, 52, 49, 58, 55, 61, 57, 66, 72, 69, 78, 74, 83, 88, 96,
]

export const SUPPORT_POINTS = [
  { title: 'Live ticket support', body: 'Real humans, fast answers.' },
  { title: 'Guided setup', body: 'We tune it with you, step by step.' },
  { title: 'Early access drops', body: 'New builds hit Discord first.' },
]
