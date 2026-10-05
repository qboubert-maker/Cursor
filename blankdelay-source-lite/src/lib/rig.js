import { motionValue } from 'framer-motion'

export const LOGO_URL = encodeURI('/Blank Delay Logo.png')

// Smoothed (scrubbed) master-timeline progress. GSAP writes it, Framer Motion reads it,
// so the HTML overlay and the 3D scene share exactly the same clock.
export const scrollProgress = motionValue(0)

// Mutable scene state tweened by the GSAP ScrollTrigger timeline and consumed every
// frame inside useFrame — scrolling never re-renders React.
export const rig = {
  camX: 0,
  camY: 0.55,
  camZ: 15.5,
  lookX: 0,
  lookY: 0.12,
  lookZ: 0,
  fov: 32,
  roll: 0,
  yaw: 0.36,
  float: 1,
  panel: 0,
  glow: 0.65,
  logo: 1,
  flash: 0,
  speed: 0,
  travel: 0,
  fog: 0.022,
  clouds: 1,
  shell: 1,
  network: 0,
  social: 0,
  burst: 0,
  mark: 1,
  controllers: 0,
  padSpread: 0,
  padSpin: 0,
  padLift: 0,
  desk: 0,
  scan: 0,
  suck: 0,
  kernel: 0,
  kernelOpen: 0,
  fps: 0,
  fpsCount: 0,
  utility: 0,
  gpuIn: 0,
  gpuMacro: 0,
  gpuLock: 0,
  gpuExit: 0,
  aim: 0,
  aimChaos: 1,
  aimSnap: 0,
  aimLock: 0,
  aimBurst: 0,
  multi: 0,
  multiSpin: 0,
  multiFan: 0,
  aboutDissolve: 0,
  about: 0,
  aboutLock: 0,
  parallax: 1,
  frame: 1,
  panX: 0,
  logoX: 0,
  logoY: 0.62,
  logoZ: 2.42,
}

// Screen-space projections of 3D hotspots, written by the scene each frame and read by
// the overlay's leader lines through requestAnimationFrame (no React state involved).
export const anchors = {
  cpu: { x: -1000, y: -1000, visible: false },
  gpu: { x: -1000, y: -1000, visible: false },
}

export const SECTIONS = [
  { id: 'hero', label: 'Home', index: '01', range: [0, 0.223] },
  { id: 'affiliates', label: 'Affiliates', index: '02', range: [0.223, 0.358] },
  { id: 'socials', label: 'Socials', index: '03', range: [0.358, 0.462] },
  { id: 'controllers', label: 'Controllers', index: '04', range: [0.462, 0.63] },
  { id: 'desk', label: 'Peripherals', index: '05', range: [0.63, 0.669] },
  { id: 'kernel', label: 'Zero Delay', index: '06', range: [0.669, 0.694] },
  { id: 'fps', label: 'FPS Boost', index: '07', range: [0.694, 0.703] },
  { id: 'utility', label: 'Utility', index: '08', range: [0.703, 0.733] },
  { id: 'aim', label: 'Aim', index: '09', range: [0.733, 0.855] },
  { id: 'games', label: 'Games', index: '10', range: [0.855, 0.925] },
  { id: 'about', label: 'About', index: '11', range: [0.925, 0.988] },
  { id: 'products', label: 'Products', index: '12', range: [0.988, 1] },
]

// Scroll positions where each chapter's content is fully assembled.
// Socials lands inside the settled Connect With Us hold (panel is opaque from 0.418–0.455).
export const SECTION_TARGETS = [0, 0.291, 0.436, 0.596, 0.65, 0.682, 0.699, 0.729, 0.845, 0.916, 0.958, 0.995]

export const sectionFromProgress = (p) =>
  p < 0.223 ? 0 : p < 0.358 ? 1 : p < 0.462 ? 2 : p < 0.63 ? 3 : p < 0.669 ? 4 : p < 0.694 ? 5 : p < 0.703 ? 6 : p < 0.733 ? 7 : p < 0.855 ? 8 : p < 0.925 ? 9 : p < 0.988 ? 10 : 11

// Hover/click target for the social particle logos. 0 idle, 1 TikTok, 2 Instagram, 3 YouTube, 4 Discord.
export const socialRig = { id: 0, locked: 0 }

export const EASE_EXPO = [0.16, 1, 0.3, 1]

// World anchor for the social particle marks. They stay hidden until a channel is hovered.
export const LOGO_STAGE = { x: 1.85, y: 0.02, z: 0 }
