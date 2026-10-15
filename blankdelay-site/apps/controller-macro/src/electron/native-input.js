'use strict';

/**
 * Main-process controller reader.
 *
 * Chromium refuses to hand gamepad data to an unfocused window, so the Web
 * Gamepad API is useless once a game takes over the screen. Everything here
 * runs in the main process instead, where no focus rule applies:
 *
 *   PlayStation pads — HID on the main process (event-driven, no worker hop).
 *                      Button edges go USB → pump → ViGEm with zero postMessage
 *                      delay. Settings UI is destroyed while Fortnite is focused
 *                      so Chromium cannot starve this path in-game.
 *   Xbox pads        — 8000Hz spin worker writes ViGEm directly (zero-hop).
 *                      SharedArrayBuffer notifies main only for macros / UI.
 *
 * Both paths normalise into the standard Gamepad API shape that vigem-pad.js
 * already speaks: buttons[0..21] plus axes [lx, ly, rx, ry] with +Y down.
 *
 * Extra indices 18–21 are back paddles / Edge Fn (ViGEm has no paddle slots,
 * so the macro engine remaps them onto real face/bumper buttons for output).
 */

const path = require('path');
const { Worker } = require('worker_threads');
const EventEmitter = require('events');
const koffi = require('koffi');
const { unpacked } = require('./unpacked');

const SONY_VID = 0x054c;
const MS_VID = 0x045e;
const RESCAN_MS = 250; // fast reopen after OBS / USB glitches
/**
 * XInput poll target. DualSense is event-driven (USB pace) on main.
 * Xbox: uncapped spin worker writes ViGEm directly (zero main-thread hop).
 * Main only wakes on button/trigger edges (macros) — sticks stay zero-hop.
 */
const INPUT_POLL_HZ = 0; // 0 = uncapped in worker
const XINPUT_POLL_HZ = INPUT_POLL_HZ;
const XINPUT_PERIOD_NS = BigInt(Math.max(1, Math.round(1e9 / Math.max(XINPUT_POLL_HZ, 8000))));
const BUTTON_COUNT = 24;
const XINPUT_SAB_INTS = 16;
const FLAG_DISC = 1;
const FLAG_MAIN = 2;
const FLAG_READY = 4;

// Windows tags the HID interface of every XInput-capable pad with &IG_xx
const XINPUT_HID_RE = /&ig_[0-9a-f]{2}/i;

// PlayStation product IDs that use the DualSense report layout
const DUALSENSE_PIDS = new Set([0x0ce6, 0x0df2, 0x0e5f]);
const DUALSENSE_EDGE_PID = 0x0df2;
// ...and the DualShock 4 layout
const DS4_PIDS = new Set([0x05c4, 0x09cc, 0x0ba0]);

// Xbox Elite / paddled pads (Microsoft). Used to open a HID sidecar for paddles
// that XInput never exposes.
const XBOX_ELITE_PIDS = new Set([
  0x02e3, // Xbox One Elite
  0x0b00, 0x0b05, 0x0b22, 0x0b28, // Elite Series 2 / variants
]);

// Paddle / Fn slots (beyond the standard 0..17 Gamepad set).
// 22/23 reserved for 6-paddle controllers; decoded when hardware exposes them.
const BTN_PADDLE_L1 = 18;
const BTN_PADDLE_R1 = 19;
const BTN_PADDLE_L2 = 20;
const BTN_PADDLE_R2 = 21;
const BTN_PADDLE_L3 = 22;
const BTN_PADDLE_R3 = 23;

const XINPUT_BITS = {
  12: 0x0001, // dpad up
  13: 0x0002, // dpad down
  14: 0x0004, // dpad left
  15: 0x0008, // dpad right
  9: 0x0010,  // start
  8: 0x0020,  // back
  10: 0x0040, // left thumb
  11: 0x0080, // right thumb
  4: 0x0100,  // left shoulder
  5: 0x0200,  // right shoulder
  16: 0x0400, // guide (getStateEx only)
  0: 0x1000,  // A
  1: 0x2000,  // B
  2: 0x4000,  // X
  3: 0x8000,  // Y
};
const XINPUT_BIT_LIST = Object.keys(XINPUT_BITS).map((k) => [Number(k), XINPUT_BITS[k]]);

// hat index -> [up, down, left, right]
const HAT = [
  [1, 0, 0, 0], [1, 0, 0, 1], [0, 0, 0, 1], [0, 1, 0, 1],
  [0, 1, 0, 0], [0, 1, 1, 0], [0, 0, 1, 0], [1, 0, 1, 0],
  [0, 0, 0, 0],
];

const emitter = new EventEmitter();

let HID = null;
let device = null;
let deviceInfo = null;
let layout = null;
let source = null;
let xinputIndex = null;
let virtualUserIndex = null;
let xinputWorker = null;
let xinputGeneration = 0;
let xinputMainAlive = false;
let xinputLastPacket = -1;
let xinputSab = null;
let xinputView = null;
const xinputScratch = {};
/** @type {ReturnType<typeof blankReport>[] | null} */
let xinputReports = null;
let xinputReportFlip = 0;
let rescanTimer = 0;
let running = false;
let reportCount = 0;
let lastReportAt = 0;

let syncGetState = null;
let xboxPaddleHid = null;
let xboxPaddleOverlay = [0, 0, 0, 0, 0, 0];

/** DualSense HID worker (coalesce off the Electron main thread). */
let psWorker = null;
let psWorkerGeneration = 0;

function stopPsWorker() {
  psWorkerGeneration += 1;
  if (psWorker) {
    try { psWorker.postMessage({ type: 'stop' }); } catch (_) { /* ignore */ }
    try { psWorker.terminate(); } catch (_) { /* ignore */ }
    psWorker = null;
  }
}

function blankReport() {
  return { buttons: new Array(BUTTON_COUNT).fill(0), axes: [0, 0, 0, 0] };
}

function stick(raw) {
  // 0..255 with 128 at rest
  const v = (Number(raw) - 128) / 127.5;
  if (v > 1) return 1;
  if (v < -1) return -1;
  return v;
}

function axis16(raw) {
  const v = Number(raw) / 32767;
  if (v > 1) return 1;
  if (v < -1) return -1;
  return v;
}

/**
 * DualSense and DualShock 4 share a shape but not their offsets, and both
 * shift by a couple of bytes over Bluetooth. Resolve that from the report id.
 *
 * @param {Buffer} buf
 * @param {'dualsense'|'ds4'} kind
 * @param {{ productId?: number }} [opts]
 */
function decodeSony(buf, kind, opts = {}) {
  const id = buf[0];
  let o;
  let dsLayout = kind;

  if (kind === 'dualsense') {
    if (id === 0x01) o = 1;
    else if (id === 0x31) o = 2; // bluetooth
    else return null;
  } else {
    if (id === 0x01) o = 1;
    else if (id === 0x11) o = 3; // bluetooth
    else return null;
    dsLayout = 'ds4';
  }

  const report = blankReport();
  const b = report.buttons;

  // Keep the raw Sony HID bytes. ViGEm DS4 expects this exact layout; converting
  // through float and back was centering at 127.5 and warping aim sense.
  report.stickBytes = [
    buf[o] & 0xff,
    buf[o + 1] & 0xff,
    buf[o + 2] & 0xff,
    buf[o + 3] & 0xff,
  ];
  report.axes[0] = stick(report.stickBytes[0]);
  report.axes[1] = stick(report.stickBytes[1]);
  report.axes[2] = stick(report.stickBytes[2]);
  report.axes[3] = stick(report.stickBytes[3]);

  let f0;
  let f1;
  let f2;
  let l2;
  let r2;

  if (dsLayout === 'dualsense') {
    l2 = buf[o + 4] / 255;
    r2 = buf[o + 5] / 255;
    f0 = buf[o + 7];
    f1 = buf[o + 8];
    f2 = buf[o + 9];
  } else {
    f0 = buf[o + 4];
    f1 = buf[o + 5];
    f2 = buf[o + 6];
    l2 = buf[o + 7] / 255;
    r2 = buf[o + 8] / 255;
  }

  b[2] = f0 & 0x10 ? 1 : 0; // square
  b[0] = f0 & 0x20 ? 1 : 0; // cross
  b[1] = f0 & 0x40 ? 1 : 0; // circle
  b[3] = f0 & 0x80 ? 1 : 0; // triangle

  b[4] = f1 & 0x01 ? 1 : 0; // L1
  b[5] = f1 & 0x02 ? 1 : 0; // R1
  b[8] = f1 & 0x10 ? 1 : 0; // create / share
  b[9] = f1 & 0x20 ? 1 : 0; // options
  b[10] = f1 & 0x40 ? 1 : 0; // L3
  b[11] = f1 & 0x80 ? 1 : 0; // R3

  b[16] = f2 & 0x01 ? 1 : 0; // PS
  b[17] = f2 & 0x02 ? 1 : 0; // touchpad click

  // DualSense Edge: Fn1/Fn2 + rear paddles live in buttons[2] bits 4–7
  if (dsLayout === 'dualsense' && opts.productId === DUALSENSE_EDGE_PID) {
    b[BTN_PADDLE_L1] = f2 & 0x40 ? 1 : 0; // left paddle
    b[BTN_PADDLE_R1] = f2 & 0x80 ? 1 : 0; // right paddle
    b[BTN_PADDLE_L2] = f2 & 0x10 ? 1 : 0; // Fn1
    b[BTN_PADDLE_R2] = f2 & 0x20 ? 1 : 0; // Fn2
  }

  // Prefer the analog value; fall back to the digital bit for BT edge cases
  b[6] = l2 > 0.02 ? l2 : (f1 & 0x04 ? 1 : 0);
  b[7] = r2 > 0.02 ? r2 : (f1 & 0x08 ? 1 : 0);

  const [up, down, left, right] = HAT[f0 & 0x0f] || HAT[8];
  b[12] = up;
  b[13] = down;
  b[14] = left;
  b[15] = right;

  return report;
}

/**
 * Best-effort Elite paddle decode. Firmware shuffles the byte; try the common
 * layouts and accept the first that looks like a paddle nibble.
 */
function decodeXboxPaddleByte(buf) {
  const blank = [0, 0, 0, 0, 0, 0];
  if (!buf || buf.length < 15) return blank;

  const apply = (p) => {
    // SDL Elite 2 mapping: P1=0x01 (R upper), P2=0x02 (R lower),
    // P3=0x04 (L upper), P4=0x08 (L lower). P5/P6 stay 0 until decoded.
    return [
      p & 0x04 ? 1 : 0, // L1 ← P3
      p & 0x01 ? 1 : 0, // R1 ← P1
      p & 0x08 ? 1 : 0, // L2 ← P4
      p & 0x02 ? 1 : 0, // R2 ← P2
      0,
      0,
    ];
  };

  const candidates = [];
  if (buf.length > 22) candidates.push(buf[22]);
  if (buf.length > 18) candidates.push(buf[18]);
  if (buf.length > 14) candidates.push(buf[14]);
  if (buf.length > 17) candidates.push(buf[17]);

  for (const p of candidates) {
    const n = Number(p) & 0x0f;
    if (n) return apply(n);
  }
  // All zero — still return zeros (no paddle held)
  return blank;
}

function mergeXboxPaddles(report) {
  report.buttons[BTN_PADDLE_L1] = xboxPaddleOverlay[0];
  report.buttons[BTN_PADDLE_R1] = xboxPaddleOverlay[1];
  report.buttons[BTN_PADDLE_L2] = xboxPaddleOverlay[2];
  report.buttons[BTN_PADDLE_R2] = xboxPaddleOverlay[3];
  report.buttons[BTN_PADDLE_L3] = xboxPaddleOverlay[4] || 0;
  report.buttons[BTN_PADDLE_R3] = xboxPaddleOverlay[5] || 0;
  return report;
}

function decodeXInputFromView(report, view) {
  const b = report.buttons;
  for (let i = 0; i < BUTTON_COUNT; i += 1) b[i] = 0;
  const mask = view[1] | 0;
  for (let i = 0; i < XINPUT_BIT_LIST.length; i += 1) {
    const [index, bit] = XINPUT_BIT_LIST[i];
    b[index] = mask & bit ? 1 : 0;
  }
  const trig = view[2] | 0;
  b[6] = (trig & 0xff) / 255;
  b[7] = ((trig >> 8) & 0xff) / 255;
  report.axes[0] = axis16(view[3]);
  report.axes[1] = -axis16(view[4]);
  report.axes[2] = axis16(view[5]);
  report.axes[3] = -axis16(view[6]);
  return report;
}

function decodeXInputInto(report, state) {
  const b = report.buttons;
  for (let i = 0; i < BUTTON_COUNT; i += 1) b[i] = 0;
  const g = state.Gamepad || state.gamepad || state;
  const mask = Number(g.wButtons) || 0;
  for (let i = 0; i < XINPUT_BIT_LIST.length; i += 1) {
    const [index, bit] = XINPUT_BIT_LIST[i];
    b[index] = mask & bit ? 1 : 0;
  }
  b[6] = Number(g.bLeftTrigger) / 255;
  b[7] = Number(g.bRightTrigger) / 255;
  report.axes[0] = axis16(g.sThumbLX);
  report.axes[1] = -axis16(g.sThumbLY);
  report.axes[2] = axis16(g.sThumbRX);
  report.axes[3] = -axis16(g.sThumbRY);
  return report;
}

function decodeXInput(state) {
  return decodeXInputInto(blankReport(), state);
}

/** Skip ViGEm / Nefarius clones so we never bind to our own virtual pad. */
function isLikelyVirtualHid(d) {
  const p = String(d?.path || '').toLowerCase();
  const prod = String(d?.product || '').toLowerCase();
  const mfg = String(d?.manufacturer || '').toLowerCase();
  if (p.includes('vigem') || prod.includes('vigem') || mfg.includes('vigem')) return true;
  if (mfg.includes('nefarius') || prod.includes('nefarius')) return true;
  // ViGEm x360
  if (d?.vendorId === 0x045e && (d.productId === 0x028e || d.productId === 0x02a1)) return true;
  return false;
}

function findSonyPad() {
  const all = HID.devices().filter((d) => (
    !isLikelyVirtualHid(d)
    && d.vendorId === SONY_VID
    && (d.usage === 5 || d.usagePage === 1)
    && (DUALSENSE_PIDS.has(d.productId) || DS4_PIDS.has(d.productId))
  ));
  // Prefer DualSense (physical) over DS4 — ViGEm often enumerates as DS4.
  return all.find((d) => DUALSENSE_PIDS.has(d.productId))
    || all.find((d) => DS4_PIDS.has(d.productId))
    || null;
}

function closeDevice() {
  stopPsWorker();
  if (device) {
    try { device.close(); } catch (_) { /* already gone */ }
  }
  device = null;
  deviceInfo = null;
  layout = null;
  closeXboxPaddleHid();
}

function closeXboxPaddleHid() {
  if (xboxPaddleHid) {
    try { xboxPaddleHid.close(); } catch (_) { /* already gone */ }
  }
  xboxPaddleHid = null;
  xboxPaddleOverlay = [0, 0, 0, 0, 0, 0];
}

function openSony(info) {
  const kind = DUALSENSE_PIDS.has(info.productId) ? 'dualsense' : 'ds4';
  stopPsWorker();

  try {
    device = new HID.HID(info.path);
  } catch (err) {
    device = null;
    deviceInfo = null;
    layout = null;
    source = null;
    emitter.emit('error', err);
    return;
  }

  deviceInfo = info;
  layout = kind;
  source = 'ps';
  let lastSig = '';
  let lastStick = null;
  let lastBtnKey = '';

  // Direct HID → emit. While aiming/moving, every stick LSB posts (no chop).
  // Only drop 1-LSB ADC noise when BOTH sticks are inside the rest gate.
  const REST2 = 14 * 14;
  device.on('data', (buf) => {
    if (source !== 'ps' || !device) return;
    const report = decodeSony(buf, kind, { productId: info.productId });
    if (!report) return;
    const s = report.stickBytes;
    const b = report.buttons;
    let btnKey = '';
    for (let i = 0; i < BUTTON_COUNT; i += 1) {
      const v = Number(b[i] || 0);
      if (i === 6 || i === 7) btnKey += ((v * 15 + 0.5) | 0);
      else btnKey += v >= 0.35 ? '1' : '0';
    }
    const key = `${s[0]},${s[1]},${s[2]},${s[3]}|${btnKey}`;
    if (key === lastSig) return;
    if (lastStick && btnKey === lastBtnKey) {
      const lx = (s[0] & 0xff) - 128;
      const ly = (s[1] & 0xff) - 128;
      const rx = (s[2] & 0xff) - 128;
      const ry = (s[3] & 0xff) - 128;
      const atRest = (lx * lx + ly * ly) <= REST2 && (rx * rx + ry * ry) <= REST2;
      if (atRest) {
        let maxD = 0;
        for (let i = 0; i < 4; i += 1) {
          const d = Math.abs((s[i] & 0xff) - lastStick[i]);
          if (d > maxD) maxD = d;
        }
        if (maxD <= 1) return;
      }
      // Not at rest: never drop — 1-LSB updates keep aim smooth (not choppy).
    }
    lastSig = key;
    lastBtnKey = btnKey;
    lastStick = [s[0] & 0xff, s[1] & 0xff, s[2] & 0xff, s[3] & 0xff];
    reportCount += 1;
    lastReportAt = Date.now();
    emitter.emit('report', report);
  });

  device.on('error', (err) => {
    // OBS / clip tools often steal or reset the HID handle briefly.
    // Do NOT emit a zero report — that nukes sticks mid-game and feels like
    // mouse accel when the physical pad flashes back through.
    console.warn('[input] DualSense HID error', err?.message || err);
    closeDevice();
    source = null;
    emitter.emit('disconnected', err?.message || 'ps-hid');
    // Rescan immediately — interval alone can leave a 250ms hole.
    setTimeout(() => {
      try { if (running && !source) scan(); } catch { /* ignore */ }
    }, 30);
  });

  console.log('[input] DualSense HID direct (zero-hop buttons)');
  emitter.emit('connected', describe());
}

/** Prefer Elite-named / known-PID Microsoft HID interfaces for paddle bytes. */
function findXboxPaddleHid() {
  try {
    const all = HID.devices();
    const scored = all
      .filter((d) => d.vendorId === MS_VID && (d.usage === 5 || d.usagePage === 1))
      .map((d) => {
        const name = String(d.product || '').toLowerCase();
        let score = 0;
        if (XBOX_ELITE_PIDS.has(d.productId)) score += 4;
        if (/elite|paddle|series 2/.test(name)) score += 3;
        // Prefer non-XUSB fake interfaces when both exist
        if (!XINPUT_HID_RE.test(String(d.path || ''))) score += 1;
        return { d, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);
    return scored[0]?.d || null;
  } catch (_) {
    return null;
  }
}

function openXboxPaddleHid() {
  closeXboxPaddleHid();
  const info = findXboxPaddleHid();
  if (!info) return false;
  try {
    const dev = new HID.HID(info.path);
    dev.on('data', (buf) => {
      xboxPaddleOverlay = decodeXboxPaddleByte(buf);
    });
    dev.on('error', () => {
      closeXboxPaddleHid();
    });
    xboxPaddleHid = dev;
    return true;
  } catch (_) {
    xboxPaddleHid = null;
    return false;
  }
}

function loadSyncGetState() {
  if (syncGetState) return syncGetState;

  koffi.struct('XINPUT_GAMEPAD', {
    wButtons: 'uint16',
    bLeftTrigger: 'uint8',
    bRightTrigger: 'uint8',
    sThumbLX: 'int16',
    sThumbLY: 'int16',
    sThumbRX: 'int16',
    sThumbRY: 'int16',
  });
  koffi.struct('XINPUT_STATE', {
    dwPacketNumber: 'uint32',
    Gamepad: 'XINPUT_GAMEPAD',
  });

  const names = ['xinput1_4.dll', 'xinput1_3.dll', 'xinput9_1_0.dll'];
  let lastErr;
  for (const name of names) {
    try {
      const lib = koffi.load(name);
      syncGetState = lib.func('uint32 __stdcall XInputGetState(uint32 index, _Out_ XINPUT_STATE *state)');
      return syncGetState;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('XInput DLL not found');
}

function readXInputSync(index) {
  const get = loadSyncGetState();
  const state = {};
  const code = get(index, state);
  if (code !== 0) {
    const err = new Error(`XInputGetState failed (${code})`);
    err.code = code;
    throw err;
  }
  return state;
}

function findXInputPad() {
  for (let i = 0; i < 4; i += 1) {
    // Skip the slot our own emulated pad sits in, or we read back what we wrote
    if (i === virtualUserIndex) continue;
    try {
      readXInputSync(i);
      return i;
    } catch (_) {
      /* slot empty */
    }
  }
  return null;
}

/**
 * XInput reports button state but no device path, and HidHide needs a path to
 * cloak anything. Every XInput pad also publishes a HID interface tagged
 * &IG_xx, so match on that to recover one.
 *
 * Scans only run while no pad is bound, and the virtual pad is unplugged the
 * moment a physical one drops, so whatever turns up here is the player's.
 */
function findXInputHid() {
  try {
    return HID.devices().find((d) => (
      !isLikelyVirtualHid(d)
      && XINPUT_HID_RE.test(String(d.path || ''))
      && (d.usage === 5 || d.usagePage === 1)
    )) || null;
  } catch (_) {
    return null;
  }
}

function stopXInput() {
  xinputMainAlive = false;
  xinputGeneration += 1;
  if (xinputWorker) {
    try { xinputWorker.postMessage({ type: 'stop' }); } catch (_) { /* gone */ }
    try { xinputWorker.terminate(); } catch (_) { /* gone */ }
    xinputWorker = null;
  }
  xinputIndex = null;
  xinputLastPacket = -1;
  closeXboxPaddleHid();
  if (layout === 'xinput') {
    deviceInfo = null;
    layout = null;
  }
}

/** @param {number|null} index XInput slot held by our emulated pad, if any */
function setVirtualUserIndex(index) {
  virtualUserIndex = Number.isInteger(index) && index >= 0 ? index : null;
}

function onXInputWorkerMessage(msg) {
  if (!msg || typeof msg !== 'object') return;

  if (msg.type === 'disconnected') {
    stopXInput();
    source = null;
    emitter.emit('disconnected');
    emitter.emit('report', blankReport());
    return;
  }

  if (msg.type !== 'state') return;

  reportCount += 1;
  lastReportAt = Date.now();
  emitter.emit('report', mergeXboxPaddles(decodeXInput(msg)));
}

/**
 * 8000Hz spin worker writes ViGEm directly. SharedArrayBuffer wakes main for
 * macros / tap-length config sync only.
 */
function resolveTapLengthDll() {
  const candidates = [
    path.join(__dirname, 'native', 'tap_length.dll'),
    path.join(__dirname, 'native', 'tap-length', 'target', 'release', 'tap_length.dll'),
    unpacked(path.join(__dirname, 'native', 'tap_length.dll')),
  ];
  const fs = require('fs');
  for (const p of candidates) {
    try { if (p && fs.existsSync(p)) return p; } catch (_) { /* ignore */ }
  }
  return null;
}

function startXInputShared(index) {
  xinputMainAlive = false;
  xinputGeneration += 1;
  if (xinputWorker) {
    try { xinputWorker.postMessage({ type: 'stop' }); } catch (_) { /* gone */ }
    try { xinputWorker.terminate(); } catch (_) { /* gone */ }
    xinputWorker = null;
  }

  const gen = xinputGeneration;
  xinputIndex = index;
  xinputMainAlive = true;
  xinputLastPacket = -1;
  if (!xinputReports) xinputReports = [blankReport(), blankReport()];

  xinputSab = new SharedArrayBuffer(XINPUT_SAB_INTS * 4);
  xinputView = new Int32Array(xinputSab);
  Atomics.store(xinputView, 0, 0);
  Atomics.store(xinputView, 7, 0);

  const tapLengthDll = resolveTapLengthDll();

  try {
    xinputWorker = new Worker(unpacked(path.join(__dirname, 'xinput-poll-worker.js')), {
      workerData: {
        index,
        hz: XINPUT_POLL_HZ,
        sab: xinputSab,
        tapLengthDll,
      },
    });
  } catch (err) {
    emitter.emit('error', err);
    startXInputMainFallback(index, gen);
    return;
  }

  xinputWorker.on('error', (err) => {
    if (gen !== xinputGeneration) return;
    emitter.emit('error', err);
    stopXInput();
    source = null;
    emitter.emit('disconnected', err?.message || String(err));
    emitter.emit('report', blankReport());
  });

  xinputWorker.on('exit', () => {
    if (gen !== xinputGeneration) return;
    xinputWorker = null;
  });

  xinputWorker.on('message', (msg) => {
    if (gen !== xinputGeneration) return;
    if (msg?.type === 'disconnected') {
      stopXInput();
      source = null;
      emitter.emit('disconnected');
      emitter.emit('report', blankReport());
      return;
    }
    if (msg?.type === 'vigem-ready') {
      if (Number.isInteger(msg.userIndex)) setVirtualUserIndex(msg.userIndex);
      lastReportAt = Date.now();
      emitter.emit('xbox-fast-ready', msg);
      return;
    }
    if (msg?.type === 'error') {
      emitter.emit('error', new Error(msg.message || 'xbox-fast worker error'));
    }
  });

  const waitAsync = typeof Atomics.waitAsync === 'function'
    ? Atomics.waitAsync.bind(Atomics)
    : null;

  const emitFromView = () => {
    const flags = Atomics.load(xinputView, 7);
    if (flags & FLAG_DISC) {
      stopXInput();
      source = null;
      emitter.emit('disconnected');
      emitter.emit('report', blankReport());
      return false;
    }
    reportCount += 1;
    lastReportAt = Date.now();
    xinputReportFlip ^= 1;
    const report = decodeXInputFromView(xinputReports[xinputReportFlip], xinputView);
    emitter.emit('report', mergeXboxPaddles(report));
    return true;
  };

  const loop = async () => {
    let lastSeq = Atomics.load(xinputView, 0);
    while (xinputMainAlive && gen === xinputGeneration && layout === 'xinput') {
      let seq = Atomics.load(xinputView, 0);
      if (seq === lastSeq) {
        if (waitAsync) {
          const res = waitAsync(xinputView, 0, lastSeq);
          if (res.async) {
            try { await res.value; } catch (_) { /* stopped */ }
          }
        } else {
          await new Promise((r) => setImmediate(r));
        }
        seq = Atomics.load(xinputView, 0);
        if (seq === lastSeq) continue;
      }
      lastSeq = seq;
      if (!emitFromView()) return;
    }
  };

  void loop();
}

/** Fallback if SharedArrayBuffer worker cannot start. */
function startXInputMainFallback(index, gen) {
  xinputIndex = index;
  xinputMainAlive = true;
  xinputLastPacket = -1;
  if (!xinputReports) xinputReports = [blankReport(), blankReport()];

  let getState;
  try {
    getState = loadSyncGetState();
  } catch (err) {
    emitter.emit('error', err);
    stopXInput();
    return;
  }

  let next = process.hrtime.bigint();
  const tick = () => {
    if (!xinputMainAlive || gen !== xinputGeneration || layout !== 'xinput') return;
    const now = process.hrtime.bigint();
    if (now >= next) {
      next = now + XINPUT_PERIOD_NS;
      try {
        const code = getState(index, xinputScratch);
        if (code !== 0) {
          stopXInput();
          source = null;
          emitter.emit('disconnected');
          emitter.emit('report', blankReport());
          return;
        }
        const packet = xinputScratch.dwPacketNumber;
        if (packet !== xinputLastPacket) {
          xinputLastPacket = packet;
          reportCount += 1;
          lastReportAt = Date.now();
          xinputReportFlip ^= 1;
          const report = decodeXInputInto(xinputReports[xinputReportFlip], xinputScratch);
          emitter.emit('report', mergeXboxPaddles(report));
        }
      } catch (err) {
        emitter.emit('error', err);
        stopXInput();
        source = null;
        emitter.emit('disconnected', err?.message || String(err));
        emitter.emit('report', blankReport());
        return;
      }
    }
    setImmediate(tick);
  };
  setImmediate(tick);
}

function startXInputMain(index) {
  startXInputShared(index);
}

function startXInputWorker(index) {
  startXInputShared(index);
}

function scan() {
  if (!running || source) return;

  try {
    const sony = findSonyPad();
    if (sony) {
      openSony(sony);
      return;
    }
  } catch (err) {
    emitter.emit('error', err);
  }

  try {
    const index = findXInputPad();
    if (index != null) {
      deviceInfo = findXInputHid();
      layout = 'xinput';
      source = 'xbox';
      openXboxPaddleHid();
      emitter.emit('connected', describe());
      startXInputWorker(index);
    }
  } catch (_) {
    /* no XInput pad */
  }
}

/**
 * node-hid hands back an interface path; HidHide wants a device instance path.
 *   \\?\HID#VID_054C&PID_0DF2&MI_03#8&1a669fd3&0&0000#{4d1e55b2-...}
 *   -> HID\VID_054C&PID_0DF2&MI_03\8&1a669fd3&0&0000
 */
function toInstancePath(hidPath) {
  if (!hidPath) return null;
  const parts = String(hidPath)
    .replace(/^\\\\[.?]\\/, '')
    .split('#')
    .filter((p) => p && !p.startsWith('{'));
  return parts.length ? parts.join('\\') : null;
}

function describe() {
  return {
    source,
    layout,
    name: deviceInfo?.product || (source === 'xbox' ? 'Xbox Controller' : null),
    vendorId: deviceInfo?.vendorId ?? null,
    productId: deviceInfo?.productId ?? null,
    devicePath: deviceInfo?.path || null,
    instancePath: toInstancePath(deviceInfo?.path),
    xinputIndex,
    connected: !!source,
  };
}

function start() {
  if (running) return describe();
  running = true;

  try {
    // eslint-disable-next-line global-require
    HID = require('node-hid');
  } catch (err) {
    running = false;
    emitter.emit('error', err);
    return describe();
  }

  scan();
  rescanTimer = setInterval(() => {
    if (!source) scan();
  }, RESCAN_MS);

  return describe();
}

function stop() {
  running = false;
  if (rescanTimer) clearInterval(rescanTimer);
  rescanTimer = 0;
  stopXInput();
  closeDevice();
  source = null;
}

function getStatus() {
  return {
    ...describe(),
    reports: reportCount,
    lastReportAt,
    stale: isXboxFastLive() ? 0 : (lastReportAt ? Date.now() - lastReportAt : null),
    xboxFast: isXboxFastLive(),
  };
}

function isXboxFastLive() {
  if (layout !== 'xinput' || !xinputView || !xinputMainAlive) return false;
  const flags = Atomics.load(xinputView, 7);
  return !!(flags & FLAG_READY) && !(flags & FLAG_DISC);
}

function setXboxMainDrive(on) {
  if (!xinputView) return;
  if (on) Atomics.or(xinputView, 7, FLAG_MAIN);
  else Atomics.and(xinputView, 7, ~FLAG_MAIN);
}

function writeXboxFastOutput(report) {
  if (!xinputView || !report) return;
  const b = report.buttons || [];
  let w = 0;
  for (let i = 0; i < XINPUT_BIT_LIST.length; i += 1) {
    const [idx, bit] = XINPUT_BIT_LIST[i];
    if ((Number(b[idx]) || 0) >= 0.35) w |= bit;
  }
  const lt = Math.max(0, Math.min(255, Math.round((Number(b[6]) || 0) * 255)));
  const rt = Math.max(0, Math.min(255, Math.round((Number(b[7]) || 0) * 255)));
  const ax = report.axes || [0, 0, 0, 0];
  const lx = Math.max(-32768, Math.min(32767, Math.round((Number(ax[0]) || 0) * 32767)));
  const ly = Math.max(-32768, Math.min(32767, Math.round(-(Number(ax[1]) || 0) * 32767)));
  const rx = Math.max(-32768, Math.min(32767, Math.round((Number(ax[2]) || 0) * 32767)));
  const ry = Math.max(-32768, Math.min(32767, Math.round(-(Number(ax[3]) || 0) * 32767)));
  xinputView[9] = w;
  xinputView[10] = (lt & 0xff) | ((rt & 0xff) << 8);
  xinputView[11] = lx;
  xinputView[12] = ly;
  xinputView[13] = rx;
  xinputView[14] = ry;
}

function syncXboxTapLength(byButton) {
  if (!xinputWorker) return;
  try {
    xinputWorker.postMessage({ type: 'tapLength', byButton: byButton || {} });
  } catch (_) { /* ignore */ }
}

function armXboxFast() {
  if (!xinputWorker) return false;
  try {
    xinputWorker.postMessage({ type: 'arm' });
    return true;
  } catch (_) {
    return false;
  }
}

function disarmXboxFast() {
  if (!xinputWorker) return;
  try {
    xinputWorker.postMessage({ type: 'disarm' });
  } catch (_) { /* ignore */ }
  if (xinputView) Atomics.and(xinputView, 7, ~(FLAG_READY | FLAG_MAIN));
}

module.exports = {
  start,
  stop,
  getStatus,
  setVirtualUserIndex,
  toInstancePath,
  isXboxFastLive,
  setXboxMainDrive,
  writeXboxFastOutput,
  syncXboxTapLength,
  armXboxFast,
  disarmXboxFast,
  BUTTON_COUNT,
  BTN_PADDLE_L1,
  BTN_PADDLE_R1,
  BTN_PADDLE_L2,
  BTN_PADDLE_R2,
  BTN_PADDLE_L3,
  BTN_PADDLE_R3,
  on: emitter.on.bind(emitter),
  off: emitter.off.bind(emitter),
  once: emitter.once.bind(emitter),
};
