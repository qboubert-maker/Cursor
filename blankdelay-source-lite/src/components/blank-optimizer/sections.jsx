const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }

export const SECTIONS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    blurb: 'Your games — launch with Blank Optimizer',
    icon: (
      <svg viewBox="0 0 24 24" {...stroke}><rect x="4" y="4" width="6.5" height="6.5" rx="1.6" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6" /></svg>
    ),
  },
  {
    id: 'tweaks',
    label: 'Tweaks',
    blurb: 'Windows tweaks tuned for low input delay',
    icon: (
      <svg viewBox="0 0 24 24" {...stroke}><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></svg>
    ),
  },
  {
    id: 'controller',
    label: 'Controller',
    blurb: 'Blank DualSense',
    icon: (
      <svg viewBox="0 0 24 24" {...stroke}><path d="M7 8h10a4 4 0 0 1 4 4v1.5a3.5 3.5 0 0 1-6.3 2.1L14 14.5h-4l-.7 1.1A3.5 3.5 0 0 1 3 13.5V12a4 4 0 0 1 4-4z" /><path d="M7.5 11v3M6 12.5h3" /><circle cx="16" cy="11.5" r=".6" fill="currentColor" /><circle cx="17.5" cy="13.5" r=".6" fill="currentColor" /></svg>
    ),
  },
  {
    id: 'keyboard',
    label: 'Keyboard',
    blurb: 'Set a delay on a key',
    icon: (
      <svg viewBox="0 0 24 24" {...stroke}><rect x="2.5" y="6" width="19" height="12" rx="2" /><path d="M6 10h.01M9 10h.01M12 10h.01M15 10h.01M18 10h.01M7.5 13.5h9" /></svg>
    ),
  },
  {
    id: 'socials',
    label: 'Socials',
    blurb: 'TikTok, Instagram, YouTube, and Discord',
    icon: (
      <svg viewBox="0 0 24 24" {...stroke}><circle cx="6" cy="12" r="2.2" /><circle cx="17" cy="6.5" r="2.2" /><circle cx="17" cy="17.5" r="2.2" /><path d="M8 11.1 14.8 7.6M8 12.9l6.8 3.5" /></svg>
    ),
  },
  {
    id: 'clips',
    label: 'Clips',
    blurb: 'Record gameplay and save clips',
    icon: (
      <svg viewBox="0 0 24 24" {...stroke}><rect x="3.5" y="5.5" width="17" height="13" rx="2" /><path d="M10 9.2v5.6l5-2.8z" /></svg>
    ),
  },
  {
    id: 'team',
    label: 'Team',
    blurb: 'The people behind Blank Optimizer',
    icon: (
      <svg viewBox="0 0 24 24" {...stroke}><circle cx="8" cy="9" r="2.2" /><circle cx="16" cy="9" r="2.2" /><path d="M4.5 17.5c.6-2 2.2-3 3.5-3s2.9 1 3.5 3M12.5 17.5c.6-2 2.2-3 3.5-3s2.9 1 3.5 3" /></svg>
    ),
  },
  {
    id: 'settings',
    label: 'Settings',
    blurb: 'Keyboard, DualShock 4, and Xbox drivers',
    icon: (
      <svg viewBox="0 0 24 24" {...stroke}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
    ),
  },
]
