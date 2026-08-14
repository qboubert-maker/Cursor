'use strict';

/**
 * Blank Delay — Xbox zero-hop feeder (max-speed).
 *
 * Uncapped spin: raw XInput buffer → ViGEm native update on THIS thread.
 * Main only wakes on button/trigger edges (or while MAIN_DRIVE for macros).
 *
 * Shared Int32 layout:
 *  [0] seqIn
 *  [1] wButtons in
 *  [2] triggers in (lt | rt<<8)
 *  [3..6] thumbs in (LX LY RX RY)
 *  [7] flags: 1=disconnect 2=MAIN_DRIVE 4=READY
 *  [9] wButtons out (when MAIN_DRIVE)
 *  [10] triggers out
 *  [11..14] thumbs out
 */

const { parentPort, workerData } = require('worker_threads');
const koffi = require('koffi');

const sab = workerData?.sab;
const tapDll = workerData?.tapLengthDll || null;
const DOWN = 0.35;
const BUTTON_COUNT = 24;
const THREAD_PRIORITY_TIME_CRITICAL = 15;

if (!sab) {
  parentPort.postMessage({ type: 'error', message: 'missing SharedArrayBuffer' });
  process.exit(1);
}

const view = new Int32Array(sab);
const FLAG_DISC = 1;
const FLAG_MAIN = 2;
const FLAG_READY = 4;

const BIT_LIST = [
  [12, 0x0001], [13, 0x0002], [14, 0x0004], [15, 0x0008],
  [9, 0x0010], [8, 0x0020], [10, 0x0040], [11, 0x0080],
  [4, 0x0100], [5, 0x0200], [16, 0x0400],
  [0, 0x1000], [1, 0x2000], [2, 0x4000], [3, 0x8000],
];

function boostThread() {
  try {
    const k32 = koffi.load('kernel32.dll');
    const GetCurrentThread = k32.func('void * __stdcall GetCurrentThread()');
    const SetThreadPriority = k32.func('bool __stdcall SetThreadPriority(void *hThread, int nPriority)');
    SetThreadPriority(GetCurrentThread(), THREAD_PRIORITY_TIME_CRITICAL);
  } catch (_) { /* ignore */ }
  try {
    const winmm = koffi.load('winmm.dll');
    winmm.func('uint __stdcall timeBeginPeriod(uint period)')(1);
  } catch (_) { /* ignore */ }
}

function loadGetState() {
  const names = ['xinput1_4.dll', 'xinput1_3.dll', 'xinput9_1_0.dll'];
  let lastErr;
  for (const name of names) {
    try {
      const lib = koffi.load(name);
      // Raw 16-byte XINPUT_STATE — no koffi struct marshal per poll.
      return lib.func('uint32 __stdcall XInputGetState(uint32 index, void *state)');
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('XInput DLL not found');
}

boostThread();
const XInputGetState = loadGetState();
const stateBuf = Buffer.allocUnsafe(16);
let index = Number.isInteger(workerData?.index) ? workerData.index : 0;
let running = true;
let lastPacket = 0xffffffff;

/** @type {any} */
let controller = null;
/** @type {any} */
let vigemClient = null;
/** @type {((c: any, t: any, r: any) => number) | null} */
let vigemUpdate = null;
let vigemHandle = null;
let vigemTarget = null;
/** @type {Record<string, number> | null} */
let reportObj = null;

const floatBuf = Buffer.alloc(BUTTON_COUNT * 4);
let tapApply = null;
let tapNow = null;
let tapSet = null;
let tapClear = null;
let hasTapFloors = false;

function tryLoadTap() {
  if (!tapDll) return;
  try {
    const lib = koffi.load(tapDll);
    tapSet = lib.func('void tap_length_set(uint32 index, uint32 us)');
    tapClear = lib.func('void tap_length_clear()');
    tapApply = lib.func('int64 tap_length_apply(_Inout_ float *values, uint32 count, uint64 now_us)');
    tapNow = lib.func('uint64 tap_length_now_us()');
  } catch (err) {
    parentPort.postMessage({ type: 'warn', message: `tap_length: ${err.message}` });
  }
}

function bitsToFloats(wButtons, lt, rt) {
  floatBuf.fill(0);
  for (let i = 0; i < BIT_LIST.length; i += 1) {
    const [idx, bit] = BIT_LIST[i];
    if (wButtons & bit) floatBuf.writeFloatLE(1, idx * 4);
  }
  floatBuf.writeFloatLE(lt / 255, 6 * 4);
  floatBuf.writeFloatLE(rt / 255, 7 * 4);
}

function floatsToButtons() {
  let w = 0;
  for (let i = 0; i < BIT_LIST.length; i += 1) {
    const [idx, bit] = BIT_LIST[i];
    if (floatBuf.readFloatLE(idx * 4) >= DOWN) w |= bit;
  }
  const lt = Math.max(0, Math.min(255, (floatBuf.readFloatLE(6 * 4) * 255) | 0));
  const rt = Math.max(0, Math.min(255, (floatBuf.readFloatLE(7 * 4) * 255) | 0));
  return { wButtons: w, lt, rt };
}

function connectVigem() {
  // eslint-disable-next-line global-require, import/no-unresolved
  const ViGEmClient = require('vigemclient');
  vigemClient = new ViGEmClient();
  let err = vigemClient.connect();
  if (err) throw new Error(String(err.message || err));
  controller = vigemClient.createX360Controller();
  err = controller.connect();
  if (err) throw new Error(String(err.message || err));
  controller.updateMode = 'manual';
  reportObj = controller._report.reportObj;
  controller._report._dpadH = 0;
  controller._report._dpadV = 0;
  try {
    // eslint-disable-next-line global-require, import/no-unresolved
    const native = require('vigemclient/build/Release/vigemclient');
    vigemUpdate = native.vigem_target_x360_update;
    vigemHandle = controller._client._handle;
    vigemTarget = controller._target;
  } catch (_) {
    // Fallback: still manual mode, just goes through the JS wrapper.
    vigemUpdate = null;
    vigemHandle = null;
    vigemTarget = null;
  }
  let userIndex = null;
  try { userIndex = controller.userIndex; } catch (_) { /* ignore */ }
  Atomics.store(view, 7, (Atomics.load(view, 7) | FLAG_READY) & ~FLAG_DISC);
  parentPort.postMessage({ type: 'vigem-ready', userIndex });
}

function submit(wButtons, lt, rt, lx, ly, rx, ry) {
  const ro = reportObj;
  if (!ro || !controller) return;
  ro.wButtons = wButtons & 0xffff;
  ro.bLeftTrigger = lt & 0xff;
  ro.bRightTrigger = rt & 0xff;
  ro.sThumbLX = lx | 0;
  ro.sThumbLY = ly | 0;
  ro.sThumbRX = rx | 0;
  ro.sThumbRY = ry | 0;
  if (vigemUpdate) {
    vigemUpdate(vigemHandle, vigemTarget, ro);
    return;
  }
  controller.update();
}

parentPort.on('message', (msg) => {
  if (!msg || typeof msg !== 'object') return;
  if (msg.type === 'stop') running = false;
  if (msg.type === 'setIndex' && Number.isInteger(msg.index)) index = msg.index;
  if (msg.type === 'disarm') {
    try {
      if (controller) controller.disconnect();
    } catch (_) { /* ignore */ }
    controller = null;
    vigemUpdate = null;
    vigemHandle = null;
    vigemTarget = null;
    reportObj = null;
    Atomics.and(view, 7, ~(FLAG_READY | FLAG_MAIN));
  }
  if (msg.type === 'arm' && !controller) {
    try {
      connectVigem();
    } catch (err) {
      parentPort.postMessage({ type: 'error', message: err.message || String(err) });
    }
  }
  if (msg.type === 'tapLength' && tapSet && tapClear) {
    tapClear();
    hasTapFloors = false;
    const by = msg.byButton || {};
    for (let i = 0; i < BUTTON_COUNT; i += 1) {
      const ms = Number(by[i] ?? by[String(i)] ?? 0);
      const us = Math.max(0, Math.min(10000, Math.round(ms * 1000)));
      tapSet(i, us);
      if (us > 0) hasTapFloors = true;
    }
  }
});

tryLoadTap();
parentPort.postMessage({ type: 'ready', hz: 'uncapped' });

let lastOutW = -1;
let lastOutTrig = -1;
let lastOutLx = 1e9;
let lastOutLy = 1e9;
let lastOutRx = 1e9;
let lastOutRy = 1e9;
let lastMainSig = -1;

while (running) {
  const code = XInputGetState(index, stateBuf);
  if (code !== 0) {
    Atomics.store(view, 7, FLAG_DISC);
    Atomics.add(view, 0, 1);
    Atomics.notify(view, 0, 1);
    parentPort.postMessage({ type: 'disconnected', code });
    break;
  }

  // XINPUT_STATE: packet@0, wButtons@4, lt@6, rt@7, lx@8, ly@10, rx@12, ry@14
  const packet = stateBuf.readUInt32LE(0);
  const packetChanged = packet !== lastPacket;
  const flags = view[7]; // plain load — MAIN/READY change rarely
  const mainDrive = (flags & FLAG_MAIN) !== 0;

  // Hottest path: same XInput packet, passthrough, no tap floors → nothing to do.
  if (!packetChanged && !mainDrive && !hasTapFloors) {
    continue;
  }

  const wIn = stateBuf.readUInt16LE(4);
  const ltIn = stateBuf[6];
  const rtIn = stateBuf[7];
  const lxIn = stateBuf.readInt16LE(8);
  const lyIn = stateBuf.readInt16LE(10);
  const rxIn = stateBuf.readInt16LE(12);
  const ryIn = stateBuf.readInt16LE(14);

  let wButtons;
  let lt;
  let rt;
  let lx;
  let ly;
  let rx;
  let ry;

  if (mainDrive) {
    wButtons = view[9] | 0;
    const trig = view[10] | 0;
    lt = trig & 0xff;
    rt = (trig >> 8) & 0xff;
    lx = view[11] | 0;
    ly = view[12] | 0;
    rx = view[13] | 0;
    ry = view[14] | 0;
  } else {
    wButtons = wIn;
    lt = ltIn;
    rt = rtIn;
    lx = lxIn;
    ly = lyIn;
    rx = rxIn;
    ry = ryIn;

    if (hasTapFloors && tapApply && tapNow && (wButtons | lt | rt | lastOutW | lastOutTrig)) {
      bitsToFloats(wButtons, lt, rt);
      tapApply(floatBuf, BUTTON_COUNT, tapNow());
      const converted = floatsToButtons();
      wButtons = converted.wButtons;
      lt = converted.lt;
      rt = converted.rt;
    }
  }

  const trigPack = lt | (rt << 8);
  const mainSig = mainDrive
    ? ((wButtons << 16) ^ trigPack ^ lx ^ (ly << 1) ^ rx ^ (ry << 1))
    : -1;
  const dirty = packetChanged
    || (mainDrive && mainSig !== lastMainSig)
    || wButtons !== lastOutW
    || trigPack !== lastOutTrig
    || lx !== lastOutLx
    || ly !== lastOutLy
    || rx !== lastOutRx
    || ry !== lastOutRy;

  // Submit to the game FIRST — before any main-thread notify work.
  if (dirty && controller && reportObj) {
    submit(wButtons, lt, rt, lx, ly, rx, ry);
    lastOutW = wButtons;
    lastOutTrig = trigPack;
    lastOutLx = lx;
    lastOutLy = ly;
    lastOutRx = rx;
    lastOutRy = ry;
    if (mainDrive) lastMainSig = mainSig;
  }

  if (packetChanged) {
    lastPacket = packet;
    const prevBtn = view[1] | 0;
    const prevTrig = view[2] | 0;
    view[1] = wIn;
    view[2] = (ltIn & 0xff) | ((rtIn & 0xff) << 8);
    view[3] = lxIn;
    view[4] = lyIn;
    view[5] = rxIn;
    view[6] = ryIn;
    const btnEdge = view[1] !== prevBtn || view[2] !== prevTrig;
    // Stick-only look: update SAB silently. Never wake main.
    if (btnEdge || mainDrive) {
      Atomics.add(view, 0, 1);
      Atomics.notify(view, 0, 1);
    }
  }
}
