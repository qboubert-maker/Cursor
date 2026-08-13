'use strict';

/**
 * Main-process ViGEm virtual pad.
 *
 * Two target types so every button on both families has somewhere to go:
 *   ds4   — PlayStation layout, includes PS button + touchpad click
 *   x360  — Xbox layout (no touchpad equivalent)
 *
 * Renderer feeds standard-Gamepad-API shaped reports; we translate here.
 */

// Standard Gamepad API button index -> target button name
const X360_BUTTONS = {
  0: 'A',
  1: 'B',
  2: 'X',
  3: 'Y',
  4: 'LEFT_SHOULDER',
  5: 'RIGHT_SHOULDER',
  8: 'BACK',
  9: 'START',
  10: 'LEFT_THUMB',
  11: 'RIGHT_THUMB',
  16: 'GUIDE',
};

const DS4_BUTTONS = {
  0: 'CROSS',
  1: 'CIRCLE',
  2: 'SQUARE',
  3: 'TRIANGLE',
  4: 'SHOULDER_LEFT',
  5: 'SHOULDER_RIGHT',
  6: 'TRIGGER_LEFT',
  7: 'TRIGGER_RIGHT',
  8: 'SHARE',
  9: 'OPTIONS',
  10: 'THUMB_LEFT',
  11: 'THUMB_RIGHT',
  16: 'SPECIAL_PS',
  17: 'SPECIAL_TOUCHPAD',
};

const DOWN = 0.35;

let client = null;
let controller = null;
let targetType = null;
let buttonMap = {};
let connected = false;
let lastError = '';

/**
 * An x360 target takes an XInput slot of its own. The reader has to know which
 * one, or it can end up polling our emulated pad instead of the player's and
 * feed our own output back in as fresh input.
 */
function xinputUserIndex() {
  if (!connected || !controller || targetType !== 'x360') return null;
  try {
    const index = controller.userIndex;
    return Number.isInteger(index) && index >= 0 ? index : null;
  } catch (_) {
    return null;
  }
}

function readStickBytes() {
  if (!connected || !controller?._report?.reportObj) return null;
  const r = controller._report.reportObj;
  return [r.bThumbLX, r.bThumbLY, r.bThumbRX, r.bThumbRY];
}

function status() {
  return {
    connected,
    target: targetType,
    driver: !!client,
    userIndex: xinputUserIndex(),
    error: lastError || null,
    sticks: readStickBytes(),
  };
}

/** Hot-path check — never touch userIndex / stick reads. */
function isConnected() {
  return !!(connected && controller);
}

function tryStartViGEmService() {
  try {
    const { spawnSync } = require('child_process');
    spawnSync('sc.exe', ['start', 'ViGEmBus'], {
      windowsHide: true,
      stdio: 'ignore',
      timeout: 12000,
    });
  } catch (_) {
    /* ignore */
  }
}

function ensureClient() {
  if (client) return client;
  // eslint-disable-next-line global-require, import/no-unresolved
  const ViGEmClient = require('vigemclient');
  const next = new ViGEmClient();
  let err = next.connect();
  if (err) {
    // Driver installed but service not running yet (common right after setup).
    tryStartViGEmService();
    err = next.connect();
  }
  if (err) throw new Error(String(err.message || err));
  client = next;
  return client;
}

/**
 * @param {'ds4'|'x360'} type
 */
function connect(type = 'x360') {
  const wanted = type === 'ds4' ? 'ds4' : 'x360';
  if (connected && controller && targetType === wanted) return status();
  if (connected && controller && targetType !== wanted) disconnectTarget();

  const attempt = () => {
    ensureClient();
    controller = wanted === 'ds4'
      ? client.createDS4Controller()
      : client.createX360Controller();

    const plugErr = controller.connect();
    if (plugErr) throw new Error(String(plugErr.message || plugErr));

    // vigemclient defaults to "auto", which submits a separate driver report
    // for every single button and axis we touch. One logical pad state then
    // reaches the game as a dozen partial states — moving the stick shows up
    // as positions the player never held, because X lands a report before Y.
    // Batch instead and submit once per report.
    controller.updateMode = 'manual';

    targetType = wanted;
    buttonMap = wanted === 'ds4' ? DS4_BUTTONS : X360_BUTTONS;
    refreshButtonEntries();
    connected = true;
    lastError = '';
    reset();
    return status();
  };

  try {
    return attempt();
  } catch (e) {
    // Reset client and retry once after kicking the bus driver.
    try {
      disconnect();
    } catch (_) {
      /* ignore */
    }
    tryStartViGEmService();
    try {
      return attempt();
    } catch (e2) {
      lastError = e2?.message || e?.message || String(e2 || e);
      connected = false;
      controller = null;
      targetType = null;
      return status();
    }
  }
}

function disconnectTarget() {
  if (controller) {
    try {
      reset();
      controller.disconnect();
    } catch (_) {
      /* ignore */
    }
  }
  controller = null;
  targetType = null;
  connected = false;
}

function disconnect() {
  disconnectTarget();
  client = null;
  return status();
}

/**
 * Unplug the virtual pad but keep the ViGEm client alive.
 *
 * The DS4 target enumerates as a Sony HID device, indistinguishable from a
 * real pad by VID/PID alone. Pulling it whenever the physical pad goes away
 * means a rescan can never bind to our own output — and a game has no reason
 * to see a controller when nothing is plugged in anyway.
 */
function unplug() {
  disconnectTarget();
  return status();
}

function setButton(name, down) {
  const btn = controller?.button?.[name];
  if (!btn) return;
  try {
    btn.setValue(!!down);
  } catch (_) {
    /* ignore */
  }
}

function setAxis(name, value) {
  const axis = controller?.axis?.[name];
  if (!axis) return;
  try {
    axis.setValue(value);
  } catch (_) {
    /* ignore */
  }
}

// vigemclient's float DS4 map centers at 127.5 and sends fractional bytes.
// Real DualSense / DS4 hardware uses integer HID bytes centered at 128.
const DS4_STICK_RAW = {
  leftX: 'bThumbLX',
  leftY: 'bThumbLY',
  rightX: 'bThumbRX',
  rightY: 'bThumbRY',
};

/**
 * Stick shaping — raw 1:1 passthrough. No rest gate, no anti-deadzone curve.
 * Any prior LSB gate felt like a high in-game deadzone on look/move.
 */
const STICK_REST_SNAP = 0;
const STICK_DZ_ENTER = 0;
const STICK_DZ_EXIT = 0;
const STICK_LOOK_DZ = 0;
const STICK_LOOK_DZ_ENTER = 0;
const STICK_LOOK_DZ_EXIT = 0;
const STICK_DRIFT_DEADZONE = 0;
const STICK_DRIFT_RADIUS = 0;
const STICK_ANTI_DEADZONE = 0;
const STICK_LOOK_ANTI_DEADZONE = 0;
const STICK_RESPONSE_POWER = 1;
const STICK_REST_LSB = 0;
const STICK_REST_LSB_LOOK = 0;

/** Raw stick bytes last written — skip reshape on button-only reports. */
let lastAppliedSticks = null;

function resetStickRest() {
  lastAppliedSticks = null;
}

/**
 * Shared radial rest gate only. adz=0 keeps physical magnitude 1:1 past the
 * gate so aim matches the real pad (no mouse-accel feel).
 * @param {number} dz
 * @param {number} adz
 */
function expandStickAxisPair(x, y, dz, adz) {
  const bx = asStickByte(x);
  const by = asStickByte(y);
  const dx = bx - 128;
  const dy = by - 128;
  const mag = Math.hypot(dx, dy);
  if (mag <= dz) return [128, 128];

  // Linear passthrough — do not remag/boost. Only snap extremes.
  let ox = bx;
  let oy = by;
  if (adz > 0) {
    const maxMag = 127;
    const span = Math.max(1, maxMag - dz);
    const n = Math.min(1, (mag - dz) / span);
    const outN = adz + n * (1 - adz);
    const scale = (outN * maxMag) / mag;
    ox = Math.max(0, Math.min(255, Math.round(128 + dx * scale)));
    oy = Math.max(0, Math.min(255, Math.round(128 + dy * scale)));
  }
  if (bx <= 2) ox = 0;
  else if (bx >= 253) ox = 255;
  if (by <= 2) oy = 0;
  else if (by >= 253) oy = 255;
  return [ox, oy];
}

function expandMoveStick(x, y) {
  return expandStickAxisPair(x, y, STICK_DZ_ENTER, STICK_ANTI_DEADZONE);
}

function expandLookStick(x, y) {
  return expandStickAxisPair(x, y, STICK_LOOK_DZ, STICK_LOOK_ANTI_DEADZONE);
}

/** @deprecated shared entry — prefer expandMoveStick / expandLookStick */
function expandStickPair(x, y, which) {
  return which === 'right' ? expandLookStick(x, y) : expandMoveStick(x, y);
}

function expandStickBytes(bytes) {
  if (!Array.isArray(bytes) || bytes.length < 4) {
    return [128, 128, 128, 128];
  }
  const left = expandMoveStick(bytes[0], bytes[1]);
  const right = expandLookStick(bytes[2], bytes[3]);
  return [left[0], left[1], right[0], right[1]];
}

/** Inverse of native-input stick(): -1..1 → Sony HID byte with true center 128. */
function toSonyStickByte(v) {
  const n = clampAxis(v);
  return Math.max(0, Math.min(255, Math.round((n + 1) * 127.5)));
}

function asStickByte(v) {
  // null/undefined/'' → Sony center. Number(null) is 0 (full deflection).
  if (v == null || v === '') return 128;
  const n = Number(v);
  if (!Number.isFinite(n)) return 128;
  return Math.max(0, Math.min(255, n | 0));
}

/** Copy stick bytes unchanged (null-safe). Name kept for older call sites. */
function stripStickDrift(bytes) {
  if (!Array.isArray(bytes) || bytes.length < 4) {
    return [128, 128, 128, 128];
  }
  return [
    asStickByte(bytes[0]),
    asStickByte(bytes[1]),
    asStickByte(bytes[2]),
    asStickByte(bytes[3]),
  ];
}

/** Copy float axes unchanged (clamp only). */
function stripStickDriftAxes(axes) {
  const a = Array.isArray(axes) ? axes : [0, 0, 0, 0];
  return [
    clampAxis(a[0]),
    clampAxis(a[1] ?? 0),
    clampAxis(a[2]),
    clampAxis(a[3] ?? 0),
  ];
}

function writeDs4StickByte(name, byte) {
  const raw = DS4_STICK_RAW[name];
  if (!raw || !controller?._report) return false;
  try {
    controller._report.updateAxis(raw, asStickByte(byte));
    return true;
  } catch (_) {
    return false;
  }
}

function setStickAxis(name, value) {
  if (targetType === 'ds4') {
    // Y was already negated by applyReport into ViGEm's +up space; Sony HID
    // bytes are +down, so encode the opposite for Y.
    const isY = name === 'leftY' || name === 'rightY';
    const v = clampAxis(value);
    if (writeDs4StickByte(name, toSonyStickByte(isY ? -v : v))) return;
  }
  setAxis(name, clampAxis(value));
}

/** Physical HID stick bytes → virtual DS4 (raw bytes, no gate / reshape). */
function applyDs4StickBytes(bytes) {
  if (!Array.isArray(bytes) || bytes.length < 4 || !controller?._report) return false;
  try {
    const [b0, b1, b2, b3] = stripStickDrift(bytes);
    controller._report.updateAxis('bThumbLX', b0);
    controller._report.updateAxis('bThumbLY', b1);
    controller._report.updateAxis('bThumbRX', b2);
    controller._report.updateAxis('bThumbRY', b3);
    return true;
  } catch (_) {
    return false;
  }
}

/** DS4 float fallback when HID bytes are missing — raw encode, no gate. */
function applyDs4FloatAxes(axes) {
  if (!controller?._report) return false;
  const a = Array.isArray(axes) ? axes : [0, 0, 0, 0];
  try {
    // Gamepad / Sony HID (+Y down). No ViGEm float Y invert (x360-only).
    const [b0, b1, b2, b3] = stripStickDrift([
      toSonyStickByte(a[0]),
      toSonyStickByte(a[1] ?? 0),
      toSonyStickByte(a[2]),
      toSonyStickByte(a[3] ?? 0),
    ]);
    controller._report.updateAxis('bThumbLX', b0);
    controller._report.updateAxis('bThumbLY', b1);
    controller._report.updateAxis('bThumbRX', b2);
    controller._report.updateAxis('bThumbRY', b3);
    return true;
  } catch (_) {
    return false;
  }
}

function commit() {
  if (!controller) return;
  try {
    controller.update();
  } catch (_) {
    /* target went away mid-write */
  }
}

function reset() {
  resetStickRest();
  if (!controller) return;
  try {
    if (typeof controller.reset === 'function') controller.reset();
  } catch (_) {
    /* ignore */
  }
  Object.values(buttonMap).forEach((name) => setButton(name, false));
  ['leftX', 'leftY', 'rightX', 'rightY'].forEach((axis) => setStickAxis(axis, 0));
  ['leftTrigger', 'rightTrigger', 'dpadHorz', 'dpadVert'].forEach((axis) => setAxis(axis, 0));
  commit();
}

function clampAxis(v) {
  const n = Number(v) || 0;
  if (n > 1) return 1;
  if (n < -1) return -1;
  return n;
}

function clamp01(v) {
  const n = Number(v) || 0;
  if (n > 1) return 1;
  if (n < 0) return 0;
  return n;
}

// Precomputed so the hot path never allocates Object.entries() per report.
let buttonEntries = [];
/** @type {Map<string, boolean>} */
const lastButtonDown = new Map();

function refreshButtonEntries() {
  buttonEntries = Object.keys(buttonMap).map((index) => [Number(index), buttonMap[index]]);
  lastButtonDown.clear();
}

/**
 * @param {{ buttons?: Record<string|number, number|boolean>, axes?: number[], stickBytes?: number[] }} report
 * @param {{ buttonsPriority?: boolean }} [opts]
 */
function applyReport(report = {}, opts = {}) {
  // Hot path — never call status() here (touches native userIndex on x360).
  if (!connected || !controller) return;

  const buttons = report.buttons || {};
  const read = (i) => {
    const raw = buttons[i];
    if (raw == null) return 0;
    return typeof raw === 'boolean' ? (raw ? 1 : 0) : Number(raw) || 0;
  };

  // Buttons + triggers FIRST. Skip unchanged digital buttons (setValue is costly).
  for (let i = 0; i < buttonEntries.length; i += 1) {
    const [index, name] = buttonEntries[i];
    const down = read(index) >= DOWN;
    if (lastButtonDown.get(name) === down) continue;
    lastButtonDown.set(name, down);
    setButton(name, down);
  }

  setAxis('leftTrigger', clamp01(read(6)));
  setAxis('rightTrigger', clamp01(read(7)));

  const up = read(12) >= DOWN;
  const down = read(13) >= DOWN;
  const left = read(14) >= DOWN;
  const right = read(15) >= DOWN;
  let dpadX = 0;
  let dpadY = 0;
  if (left && !right) dpadX = -1;
  else if (right && !left) dpadX = 1;
  if (up && !down) dpadY = 1;
  else if (down && !up) dpadY = -1;
  setAxis('dpadHorz', dpadX);
  setAxis('dpadVert', dpadY);

  const rawSticks = Array.isArray(report.stickBytes) && report.stickBytes.length >= 4
    ? report.stickBytes
    : null;
  const sticksUnchanged = !!(
    rawSticks
    && lastAppliedSticks
    && rawSticks[0] === lastAppliedSticks[0]
    && rawSticks[1] === lastAppliedSticks[1]
    && rawSticks[2] === lastAppliedSticks[2]
    && rawSticks[3] === lastAppliedSticks[3]
  );

  // Button edge: flush immediately. Skip a second update() when sticks are idle
  // so taps are not waiting behind a redundant kernel round-trip.
  if (opts.buttonsPriority) {
    commit();
    if (sticksUnchanged) return;
  }

  if (!sticksUnchanged) {
    if (targetType === 'ds4') {
      if (!applyDs4StickBytes(report.stickBytes)) {
        applyDs4FloatAxes(stripStickDriftAxes(report.axes));
      }
    } else if (rawSticks) {
      const [b0, b1, b2, b3] = stripStickDrift(rawSticks);
      setStickAxis('leftX', (b0 - 128) / 127.5);
      setStickAxis('leftY', -((b1 - 128) / 127.5));
      setStickAxis('rightX', (b2 - 128) / 127.5);
      setStickAxis('rightY', -((b3 - 128) / 127.5));
    } else {
      const axes = stripStickDriftAxes(report.axes);
      setStickAxis('leftX', axes[0]);
      setStickAxis('leftY', -(axes[1] ?? 0));
      setStickAxis('rightX', axes[2]);
      setStickAxis('rightY', -(axes[3] ?? 0));
    }
    if (rawSticks) {
      lastAppliedSticks = [
        asStickByte(rawSticks[0]),
        asStickByte(rawSticks[1]),
        asStickByte(rawSticks[2]),
        asStickByte(rawSticks[3]),
      ];
    }
  }

  commit();
}

module.exports = {
  connect,
  disconnect,
  unplug,
  status,
  isConnected,
  applyReport,
  reset,
  resetStickRest,
  readStickBytes,
  stripStickDrift,
  stripStickDriftAxes,
  expandStickBytes,
  expandStickPair,
  expandMoveStick,
  expandLookStick,
  STICK_DRIFT_DEADZONE,
  STICK_DRIFT_RADIUS,
  STICK_REST_SNAP,
  STICK_ANTI_DEADZONE,
  STICK_RESPONSE_POWER,
  STICK_DZ_ENTER,
  STICK_DZ_EXIT,
  STICK_LOOK_DZ,
  STICK_LOOK_DZ_ENTER,
  STICK_LOOK_DZ_EXIT,
  STICK_LOOK_ANTI_DEADZONE,
  STICK_REST_LSB,
  STICK_REST_LSB_LOOK,
};
