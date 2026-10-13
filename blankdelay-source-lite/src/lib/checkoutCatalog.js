export const CHECKOUT_PRODUCTS = {
  'fps-boost': {
    id: 'fps-boost',
    name: 'FPS Boost',
    price: 1599,
    description: 'Shatter your frame cap. Pure system optimization for maximum refresh rate dominance.',
    badge: 'Performance',
    downloadName: 'Blank-Delay-FPS-Boost.zip',
    features: ['Timer resolution', 'Core unparking', 'GPU scheduling', 'Even frame delivery'],
  },
  'controller-optimizer': {
    id: 'controller-optimizer',
    name: 'Controller Optimizer',
    price: 1999,
    description: 'PS5 and Xbox in one app. One driver on at a time, so games see a single controller.',
    badge: 'Hardware',
    downloadName: 'Blank-Delay-Controller-Optimizer.zip',
    features: ['PlayStation view', 'Xbox view', 'One driver at a time'],
  },
  'controller-macro': {
    id: 'controller-macro',
    name: 'Controller Macro',
    price: 2599,
    description: 'Hardware-level polling rate override. Absolute sub-1ms input latency for PS5 and Xbox.',
    badge: 'Hardware',
    downloadName: 'Blank-Delay-Controller-Macro.zip',
    features: ['USB polling override', 'Deadzone calibration', 'Frame-perfect pad macros'],
  },
  'keyboard-optimizer': {
    id: 'keyboard-optimizer',
    name: 'Keyboard Optimizer',
    price: 1999,
    description: 'Pushes a keyboard and mouse to their maximum polling rate, with timing from 0 to 10 milliseconds.',
    badge: 'Peripherals',
    downloadName: 'Blank-Delay-Keyboard-Optimizer.zip',
    features: ['Maximum polling rate', '0 to 10 milliseconds', 'Every keyboard and mouse'],
  },
  'keyboard-macro': {
    id: 'keyboard-macro',
    name: 'Keyboard Macro',
    price: 2599,
    description: 'Sub-millisecond execution. Bound to your keyboard and mouse.',
    badge: 'Peripherals',
    downloadName: 'Blank-Delay-Keyboard-Macro.zip',
    features: ['Input chaining', 'Per-game profiles', 'Hotkey layers'],
  },
  'zero-delay-os': {
    id: 'zero-delay-os',
    name: 'Zero Delay',
    price: 1599,
    description: 'Kernel-level optimization. Uncapped FPS. Zero input latency. The ultimate software override.',
    badge: 'Software',
    downloadName: 'Blank-Delay-OS.zip',
    features: ['Kernel scheduling', 'Input path override', 'One-click apply and revert'],
  },
  'blank-optimizer': {
    id: 'blank-optimizer',
    name: 'The Blank Optimizer',
    price: 1999,
    description:
      'The Blank Optimizer comes with a Controller Optimizer and a Keyboard Optimizer, plus every tweak in the store. Blank Delay clipping software is included, so you can capture your favorite in-game moments.',
    badge: 'On sale',
    downloadName: 'The-Blank-Optimizer.exe',
    features: ['Controller Optimizer', 'Keyboard Optimizer', 'Every store tweak', 'Blank Delay clipping software'],
  },
  'premium-utility': {
    id: 'premium-utility',
    name: 'Premium Utility',
    price: 3299,
    description: 'Hardware-level driver and registry tuning. Maximum GPU power state override for Nvidia and AMD Radeon.',
    badge: 'Drivers',
    downloadName: 'Blank-Delay-Premium-Utility.zip',
    features: ['GPU power state override', 'Private profiles', 'Early builds'],
  },
  'aim-bundle': {
    id: 'aim-bundle',
    name: 'Elite Aim Bundle',
    price: 1599,
    description: 'Algorithmic precision. Custom crosshair overlays. Perfect tracking. Feel the zero-latency override.',
    badge: 'Crosshair',
    features: ['FPS Boost', 'Controller macro', 'Keyboard macro', 'One license'],
  },
}

export const formatPrice = (cents) =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })

export const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())

export function makeOrderId() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  let id = 'BD-'
  for (let i = 0; i < bytes.length; i++) id += alphabet[bytes[i] % alphabet.length]
  return id
}
