'use strict';

/**
 * Per-button tap length floor (0.00–10.00 ms).
 *
 * Applied to **physical input only** (before the macro engine) so Build
 * pull-out / weapon-switch release edges from macros are never re-pinned.
 *
 * Hot path prefers the Rust cdylib; JS engine is an identical fallback.
 * Config clamp is pure JS (C# helper is optional offline — never on the
 * gameplay / config hot path).
 */

const fs = require('fs');
const path = require('path');

const BUTTON_COUNT = 24;
const MAX_US = 10_000;
const STEP_US = 10; // 0.01 ms
const DOWN = 0.35;

/** Applied/armed flags — survive 0.00 ms floors (Active must not flip Off). */
const armedByButton = Object.create(null);
for (let i = 0; i < BUTTON_COUNT; i += 1) armedByButton[i] = false;

const PHASE_IDLE = 0;
const PHASE_DOWN = 1;
const PHASE_FORCED = 2;

const BUTTON_LABELS = [
  'Cross / A',
  'Circle / B',
  'Square / X',
  'Triangle / Y',
  'L1 / LB',
  'R1 / RB',
  'L2 / LT',
  'R2 / RT',
  'Share / Back',
  'Options / Start',
  'L3',
  'R3',
  'D-Pad Up',
  'D-Pad Down',
  'D-Pad Left',
  'D-Pad Right',
  'PS / Guide',
  'Touchpad',
  'Paddle L1',
  'Paddle R1',
  'Paddle L2',
  'Paddle R2',
  'Paddle L3',
  'Paddle R3',
];

function nowUs() {
  return Number(process.hrtime.bigint() / 1000n);
}

function clampUs(us) {
  const n = Number(us);
  if (!Number.isFinite(n) || n <= 0) return 0;
  const stepped = Math.round(n / STEP_US) * STEP_US;
  return Math.max(0, Math.min(MAX_US, stepped));
}

function msToUs(ms) {
  return clampUs(Math.round(Number(ms) * 1000));
}

function usToMs(us) {
  return Math.round(clampUs(us) / 10) / 100;
}

/* ---------------- JS engine (fallback) ---------------- */

class JsEngine {
  constructor() {
    this.lengthUs = new Uint32Array(BUTTON_COUNT);
    this.downSinceUs = new Array(BUTTON_COUNT).fill(null);
    this.phase = new Uint8Array(BUTTON_COUNT);
  }

  setLength(index, us) {
    if (index < 0 || index >= BUTTON_COUNT) return;
    this.lengthUs[index] = clampUs(us);
  }

  clear() {
    this.lengthUs.fill(0);
    this.reset();
  }

  reset() {
    this.downSinceUs.fill(null);
    this.phase.fill(PHASE_IDLE);
  }

  apply(buttons, tUs = nowUs()) {
    let nextWakeUs = null;
    const out = buttons.slice(0, BUTTON_COUNT);
    while (out.length < BUTTON_COUNT) out.push(0);

    for (let i = 0; i < BUTTON_COUNT; i += 1) {
      const wantDown = (out[i] || 0) >= DOWN;
      const floor = this.lengthUs[i];

      if (floor === 0) {
        this.downSinceUs[i] = null;
        this.phase[i] = wantDown ? PHASE_DOWN : PHASE_IDLE;
        continue;
      }

      const phase = this.phase[i];

      if (phase === PHASE_IDLE) {
        if (wantDown) {
          this.phase[i] = PHASE_DOWN;
          this.downSinceUs[i] = tUs;
          out[i] = 1;
        }
        continue;
      }

      if (phase === PHASE_DOWN) {
        if (wantDown) {
          out[i] = 1;
          continue;
        }
        const start = this.downSinceUs[i];
        if (start != null && (tUs - start) < floor) {
          this.phase[i] = PHASE_FORCED;
          out[i] = 1;
          const due = start + floor;
          if (nextWakeUs == null || due < nextWakeUs) nextWakeUs = due;
        } else {
          this.phase[i] = PHASE_IDLE;
          this.downSinceUs[i] = null;
          out[i] = 0;
        }
        continue;
      }

      // PHASE_FORCED — extending a short physical tap
      if (wantDown) {
        // New press while extending: continue as a held press. Do NOT insert a
        // release gap here — that skipped guns / double-tapped D-pad & Cross.
        this.phase[i] = PHASE_DOWN;
        this.downSinceUs[i] = tUs;
        out[i] = 1;
        continue;
      }

      const start = this.downSinceUs[i];
      if (start != null && (tUs - start) < floor) {
        out[i] = 1;
        const due = start + floor;
        if (nextWakeUs == null || due < nextWakeUs) nextWakeUs = due;
      } else {
        this.phase[i] = PHASE_IDLE;
        this.downSinceUs[i] = null;
        out[i] = 0;
      }
    }

    const nextWakeMs = nextWakeUs == null
      ? null
      : Math.max(0, (nextWakeUs - tUs) / 1000);
    return { buttons: out, nextWakeMs };
  }
}

/* ---------------- Rust via koffi ---------------- */

function asarUnpacked(filePath) {
  if (!filePath || !filePath.includes(`${path.sep}app.asar${path.sep}`)) return null;
  return filePath.replace(`${path.sep}app.asar${path.sep}`, `${path.sep}app.asar.unpacked${path.sep}`);
}

function resolveNativeDll() {
  const candidates = [
    path.join(__dirname, 'native', 'tap_length.dll'),
    asarUnpacked(path.join(__dirname, 'native', 'tap_length.dll')),
    path.join(__dirname, 'native', 'tap-length', 'target', 'release', 'tap_length.dll'),
    path.join(process.resourcesPath || '', 'app.asar.unpacked', 'native', 'tap_length.dll'),
    path.join(process.resourcesPath || '', 'native', 'tap_length.dll'),
  ];
  for (const p of candidates) {
    try {
      if (p && fs.existsSync(p)) return p;
    } catch (_) { /* ignore */ }
  }
  return null;
}

function tryLoadRust() {
  const dll = resolveNativeDll();
  if (!dll) return null;
  try {
    const koffi = require('koffi');
    const lib = koffi.load(dll);
    const set = lib.func('void tap_length_set(uint32 index, uint32 us)');
    const clear = lib.func('void tap_length_clear()');
    const reset = lib.func('void tap_length_reset()');
    const applyFn = lib.func('int64 tap_length_apply(_Inout_ float *values, uint32 count, uint64 now_us)');
    const nowFn = lib.func('uint64 tap_length_now_us()');
    const buf = Buffer.alloc(BUTTON_COUNT * 4);

    return {
      backend: 'rust',
      dll,
      setLength(index, us) { set(index >>> 0, clampUs(us)); },
      clear() { clear(); },
      reset() { reset(); },
      apply(buttons) {
        for (let i = 0; i < BUTTON_COUNT; i += 1) {
          buf.writeFloatLE(Number(buttons[i]) || 0, i * 4);
        }
        const wakeUs = applyFn(buf, BUTTON_COUNT, nowFn());
        const out = new Array(Math.max(buttons.length, BUTTON_COUNT));
        for (let i = 0; i < BUTTON_COUNT; i += 1) out[i] = buf.readFloatLE(i * 4);
        for (let i = BUTTON_COUNT; i < buttons.length; i += 1) out[i] = buttons[i];
        let nextWakeMs = null;
        if (wakeUs === 0) nextWakeMs = 0;
        else if (wakeUs > 0) nextWakeMs = Math.max(0, Number(wakeUs) / 1000);
        return { buttons: out, nextWakeMs };
      },
    };
  } catch (err) {
    console.warn('[tap-length] rust load failed:', err.message);
    return null;
  }
}

/* ---------------- Public API ---------------- */

const js = new JsEngine();
let native = tryLoadRust();
let backend = native ? 'rust' : 'js';
/** Mid-extend / floored-button-down — works for both JS and Rust backends. */
let extendBusy = false;

function engine() {
  return native || {
    backend: 'js',
    setLength: (i, us) => js.setLength(i, us),
    clear: () => js.clear(),
    reset: () => js.reset(),
    apply: (buttons) => js.apply(buttons),
  };
}

function setLengthsFromConfig(tapLength) {
  js.clear();
  if (native) native.clear();
  if (!tapLength || typeof tapLength !== 'object') return getConfig();

  const source = tapLength.byButton || tapLength.us || tapLength;
  if (!source || typeof source !== 'object') return getConfig();

  const unit = String(tapLength.unit || 'ms').toLowerCase();
  for (let i = 0; i < BUTTON_COUNT; i += 1) {
    const raw = source[i] ?? source[String(i)];
    if (raw == null || raw === '') continue;
    const us = unit === 'us' ? clampUs(raw) : msToUs(raw);
    js.setLength(i, us);
    if (native) native.setLength(i, us);
  }

  // Persist Active state. Never clear armed just because the floor is 0.00 ms.
  const armedSrc = tapLength.armedByButton;
  if (armedSrc && typeof armedSrc === 'object') {
    for (let i = 0; i < BUTTON_COUNT; i += 1) {
      if (Object.prototype.hasOwnProperty.call(armedSrc, i)
        || Object.prototype.hasOwnProperty.call(armedSrc, String(i))) {
        armedByButton[i] = !!(armedSrc[i] ?? armedSrc[String(i)]);
      }
    }
  } else {
    for (let i = 0; i < BUTTON_COUNT; i += 1) {
      if (js.lengthUs[i] > 0) armedByButton[i] = true;
    }
  }
  return getConfig();
}

function getConfig() {
  const byButton = {};
  const armed = {};
  for (let i = 0; i < BUTTON_COUNT; i += 1) {
    byButton[String(i)] = usToMs(js.lengthUs[i]);
    armed[String(i)] = !!armedByButton[i];
  }
  return {
    byButton,
    armedByButton: armed,
    unit: 'ms',
    min: 0,
    max: 10,
    step: 0.01,
    backend,
  };
}

/** Floor short physical taps on an input report (call BEFORE macroEngine.process). */
function applyToReport(report) {
  if (!report || !Array.isArray(report.buttons)) {
    return { report, nextWakeMs: null };
  }
  if (!hasFloors()) {
    extendBusy = false;
    return { report, nextWakeMs: null };
  }

  const e = engine();
  const result = e.apply(report.buttons);
  let heldFloor = false;
  for (let i = 0; i < BUTTON_COUNT; i += 1) {
    if (js.lengthUs[i] > 0 && Number(result.buttons[i] || 0) >= DOWN) {
      heldFloor = true;
      break;
    }
  }
  extendBusy = result.nextWakeMs != null || heldFloor;
  return {
    report: { ...report, buttons: result.buttons },
    nextWakeMs: result.nextWakeMs,
  };
}

function reset() {
  extendBusy = false;
  engine().reset();
  js.reset();
}

function status() {
  return {
    backend,
    dll: native?.dll || null,
    buttons: BUTTON_COUNT,
    labels: BUTTON_LABELS,
    config: getConfig(),
  };
}

/** True when any tap-length floor is configured (settings UI / status). */
function hasFloors() {
  for (let i = 0; i < BUTTON_COUNT; i += 1) {
    if (js.lengthUs[i] > 0) return true;
  }
  return false;
}

/**
 * True only when tap-length must run on this report (or is mid-extend).
 * Configured floors alone must NOT keep the slow pump path forever — that was
 * a major FPS drain while looking with any ms delay saved.
 */
function isActive(report) {
  if (!hasFloors()) return false;
  if (extendBusy) return true;
  if (!report || !Array.isArray(report.buttons)) return false;
  for (let i = 0; i < BUTTON_COUNT; i += 1) {
    if (js.lengthUs[i] > 0 && Number(report.buttons[i] || 0) >= DOWN) return true;
  }
  return false;
}

/** Clamp tapLength in-process — never spawn helpers on the hot path. */
function normalizeConfig(config) {
  if (!config || typeof config !== 'object') return config;
  const next = { ...config };
  if (!next.tapLength) return next;

  const byButton = {};
  const src = next.tapLength.byButton || next.tapLength.us || next.tapLength;
  const unit = String(next.tapLength.unit || 'ms').toLowerCase();
  for (let i = 0; i < BUTTON_COUNT; i += 1) {
    const raw = src?.[i] ?? src?.[String(i)] ?? 0;
    byButton[String(i)] = usToMs(unit === 'us' ? raw : msToUs(raw));
  }
  next.tapLength = {
    byButton,
    armedByButton: (() => {
      const armed = {};
      const src = next.tapLength.armedByButton;
      for (let i = 0; i < BUTTON_COUNT; i += 1) {
        if (src && typeof src === 'object') {
          armed[String(i)] = !!(src[i] ?? src[String(i)]);
        } else {
          armed[String(i)] = byButton[String(i)] > 0 || !!armedByButton[i];
        }
      }
      return armed;
    })(),
    unit: 'ms',
    min: 0,
    max: 10,
    step: 0.01,
  };
  setLengthsFromConfig(next.tapLength);
  return next;
}

function reloadNative() {
  native = tryLoadRust();
  backend = native ? 'rust' : 'js';
  setLengthsFromConfig(getConfig());
  return status();
}

module.exports = {
  BUTTON_COUNT,
  BUTTON_LABELS,
  MAX_US,
  STEP_US,
  setLengthsFromConfig,
  getConfig,
  applyToReport,
  reset,
  status,
  isActive,
  hasFloors,
  normalizeConfig,
  reloadNative,
  msToUs,
  usToMs,
  clampUs,
};
