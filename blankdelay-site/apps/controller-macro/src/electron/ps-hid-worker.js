'use strict';

/**
 * DualSense / DS4 HID on a worker thread.
 *
 * Event-driven: node-hid 'data' fires on every USB report. Do NOT sync-block
 * this thread (Atomics wait loops freeze libuv) or HID events never arrive
 * and the controller looks completely dead.
 *
 * Posts on real button/stick change only. workerData.hz is API parity with
 * XInput; DualSense cannot exceed its USB report rate (~250–1000Hz).
 */

const { parentPort, workerData } = require('worker_threads');
const HID = require('node-hid');

const BUTTON_COUNT = 24;
const BTN_PADDLE_L1 = 18;
const BTN_PADDLE_R1 = 19;
const BTN_PADDLE_L2 = 20;
const BTN_PADDLE_R2 = 21;
const DUALSENSE_EDGE_PID = 0x0df2;
const TARGET_HZ = Number(workerData?.hz) > 0 ? Number(workerData.hz) : 4000;

const HAT = [
  [1, 0, 0, 0], [1, 0, 0, 1], [0, 0, 0, 1], [0, 1, 0, 1],
  [0, 1, 0, 0], [0, 1, 1, 0], [0, 0, 1, 0], [1, 0, 1, 0],
  [0, 0, 0, 0],
];

const kind = workerData.kind === 'ds4' ? 'ds4' : 'dualsense';
const productId = Number(workerData.productId) || 0;
const devicePath = String(workerData.path || '');

function stick(raw) {
  const v = (Number(raw) - 128) / 127.5;
  if (v > 1) return 1;
  if (v < -1) return -1;
  return v;
}

function decodeSony(buf) {
  if (!buf || buf.length < 10) return null;
  const id = buf[0];
  let o;
  let dsLayout = kind;

  if (kind === 'dualsense') {
    if (id === 0x01) o = 1;
    else if (id === 0x31) o = 2;
    else return null;
  } else {
    if (id === 0x01) o = 1;
    else if (id === 0x11) o = 3;
    else return null;
    dsLayout = 'ds4';
  }

  const buttons = new Array(BUTTON_COUNT).fill(0);
  const stickBytes = [
    buf[o] & 0xff,
    buf[o + 1] & 0xff,
    buf[o + 2] & 0xff,
    buf[o + 3] & 0xff,
  ];
  const axes = stickBytes.map(stick);

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

  buttons[2] = f0 & 0x10 ? 1 : 0;
  buttons[0] = f0 & 0x20 ? 1 : 0;
  buttons[1] = f0 & 0x40 ? 1 : 0;
  buttons[3] = f0 & 0x80 ? 1 : 0;
  buttons[4] = f1 & 0x01 ? 1 : 0;
  buttons[5] = f1 & 0x02 ? 1 : 0;
  buttons[8] = f1 & 0x10 ? 1 : 0;
  buttons[9] = f1 & 0x20 ? 1 : 0;
  buttons[10] = f1 & 0x40 ? 1 : 0;
  buttons[11] = f1 & 0x80 ? 1 : 0;
  buttons[16] = f2 & 0x01 ? 1 : 0;
  buttons[17] = f2 & 0x02 ? 1 : 0;

  if (dsLayout === 'dualsense' && productId === DUALSENSE_EDGE_PID) {
    buttons[BTN_PADDLE_L1] = f2 & 0x40 ? 1 : 0;
    buttons[BTN_PADDLE_R1] = f2 & 0x80 ? 1 : 0;
    buttons[BTN_PADDLE_L2] = f2 & 0x10 ? 1 : 0;
    buttons[BTN_PADDLE_R2] = f2 & 0x20 ? 1 : 0;
  }

  buttons[6] = l2 > 0.02 ? l2 : (f1 & 0x04 ? 1 : 0);
  buttons[7] = r2 > 0.02 ? r2 : (f1 & 0x08 ? 1 : 0);

  const [up, down, left, right] = HAT[f0 & 0x0f] || HAT[8];
  buttons[12] = up;
  buttons[13] = down;
  buttons[14] = left;
  buttons[15] = right;

  return { buttons, axes, stickBytes };
}

function sig(report) {
  const b = report.buttons;
  const s = report.stickBytes;
  let key = `${s[0]},${s[1]},${s[2]},${s[3]}|`;
  for (let i = 0; i < BUTTON_COUNT; i += 1) {
    const v = Number(b[i] || 0);
    if (i === 6 || i === 7) key += ((v * 15 + 0.5) | 0);
    else key += v >= 0.35 ? '1' : '0';
  }
  return key;
}

let device = null;
let running = true;
let lastSig = '';
let lastStick = null;
let lastBtnKey = '';

function btnKeyOf(report) {
  const b = report.buttons;
  let key = '';
  for (let i = 0; i < BUTTON_COUNT; i += 1) {
    const v = Number(b[i] || 0);
    if (i === 6 || i === 7) key += ((v * 15 + 0.5) | 0);
    else key += v >= 0.35 ? '1' : '0';
  }
  return key;
}

try {
  device = new HID.HID(devicePath);
} catch (err) {
  parentPort.postMessage({ type: 'error', message: err?.message || String(err) });
  running = false;
}

parentPort.on('message', (msg) => {
  if (!msg || msg.type !== 'stop') return;
  running = false;
  try { device?.close(); } catch (_) { /* ignore */ }
  device = null;
});

if (device) {
  // Event-driven — never Atomics.wait / busy-spin (that killed HID callbacks).
  // Buttons always post immediately. Drop 1-LSB ADC noise only at true rest so
  // aim travel stays loose (filtering while deflected felt stiff / hard to move).
  device.on('data', (buf) => {
    if (!running) return;
    const report = decodeSony(buf);
    if (!report) return;
    const s = report.stickBytes;
    const btnKey = btnKeyOf(report);
    const key = `${s[0]},${s[1]},${s[2]},${s[3]}|${btnKey}`;
    if (key === lastSig) return;
    if (lastStick && btnKey === lastBtnKey) {
      const lx = (s[0] & 0xff) - 128;
      const ly = (s[1] & 0xff) - 128;
      const rx = (s[2] & 0xff) - 128;
      const ry = (s[3] & 0xff) - 128;
      const atRest = (lx * lx + ly * ly) <= 16 && (rx * rx + ry * ry) <= 16;
      if (atRest) {
        let maxD = 0;
        for (let i = 0; i < 4; i += 1) {
          const d = Math.abs((s[i] & 0xff) - lastStick[i]);
          if (d > maxD) maxD = d;
        }
        if (maxD <= 1) return;
      }
    }
    lastSig = key;
    lastBtnKey = btnKey;
    lastStick = [s[0] & 0xff, s[1] & 0xff, s[2] & 0xff, s[3] & 0xff];
    parentPort.postMessage({ type: 'report', report });
  });
  device.on('error', (err) => {
    parentPort.postMessage({ type: 'error', message: err?.message || String(err) });
    running = false;
    try { device?.close(); } catch (_) { /* ignore */ }
    device = null;
  });

  parentPort.postMessage({ type: 'ready', hz: TARGET_HZ });
}
