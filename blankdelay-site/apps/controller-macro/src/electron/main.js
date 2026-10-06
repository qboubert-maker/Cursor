'use strict';

const { app, BrowserWindow, ipcMain, shell, powerSaveBlocker, Tray, Menu, nativeImage, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const singletonLock = require('./singleton-lock');
const { registerLicenseIpc, getLicenseStatus } = require('./license-service');
const tapLength = require('./tap-length');

app.setName('BlankDelay Controller Macro');
app.setAppUserModelId('com.blankdelay.controller');

// Chromium sharing the GPU with Fortnite is what makes the sticks trail behind
// the pad. Nothing here needs acceleration — the UI is flat CSS.
app.disableHardwareAcceleration();
try { app.commandLine.appendSwitch('disable-gpu'); } catch { /* ignore */ }
try { app.commandLine.appendSwitch('disable-gpu-compositing'); } catch { /* ignore */ }

// Two copies = two ViGEm pads = the game reading conflicting sticks. Electron's
// own lock is per userData, which a portable build sidesteps.
const globalLock = singletonLock.acquire();
if (!globalLock.ok) {
  // dialog before app.ready throws "JavaScript error occurred in the main process"
  const msg = `Another copy of BlankDelay Controller Macro is already running${globalLock.otherPid ? ` (PID ${globalLock.otherPid})` : ''}.\n\nRight-click its tray icon → Fully close, then open this one.\n\nTwo copies = two virtual pads → choppy FPS and ruined sticks.`;
  app.whenReady().then(() => {
    try { dialog.showErrorBox('BlankDelay Controller Macro', msg); } catch { /* ignore */ }
    app.exit(0);
  }).catch(() => app.exit(0));
}

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {Tray | null} */
let tray = null;
/** True while tearing down the settings UI for tray (not a full quit). */
let parkingUi = false;
/** User chose Fully close — allow window destroy + process exit. */
let allowDestroy = false;
let quitting = false;

/** @type {import('./drivers') | null} */
let drivers = null;
/** @type {import('./hidhide') | null} */
let hidhide = null;
/** @type {import('./vigem-pad') | null} */
let vigemPad = null;
/** @type {import('./native-input') | null} */
let nativeInput = null;
/** @type {import('./macro-engine') | null} */
let macroEngine = null;
/** @type {import('./game-focus') | null} */
let gameFocus = null;
/** @type {ReturnType<typeof setInterval> | null} */
let gameFocusTimer = null;

let armedTargets = [];
let pipelineReady = false;
/** @type {any} */
let lastInput = null;
/** @type {any} */
let lastOut = null;
/** @type {ReturnType<typeof setTimeout> | null} */
let disconnectTimer = null;
/** @type {ReturnType<typeof setTimeout> | null} */
let dualPadTimer = null;
/** @type {ReturnType<typeof setInterval> | null} */
let keepaliveTimer = null;
let padLost = false;
/** @type {number | null} */
let powerBlockerId = null;
/** Block dual-pad until boot heal finishes (avoids cloak restore race). */
let dualPadAllowed = false;

const CLOAK_PREF_PATH = () => path.join(app.getPath('userData'), 'cloak-pref.json');
const MACRO_PREF_PATH = () => path.join(app.getPath('userData'), 'macro-pref.json');

function loadCloakWanted() {
  try {
    const raw = fs.readFileSync(CLOAK_PREF_PATH(), 'utf8').replace(/^\uFEFF/, '');
    const parsed = JSON.parse(raw);
    if (typeof parsed?.wanted === 'boolean') return parsed.wanted;
  } catch { /* default on — macros need the virtual pad */ }
  return true;
}

function saveCloakWanted(wanted) {
  try {
    const file = CLOAK_PREF_PATH();
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify({ wanted: !!wanted }, null, 2)}\n`, 'utf8');
    fs.renameSync(tmp, file);
  } catch (err) {
    console.warn('[hidhide] cloak pref save failed:', err?.message || err);
  }
}

function loadMacroPref() {
  try {
    const raw = fs.readFileSync(MACRO_PREF_PATH(), 'utf8').replace(/^\uFEFF/, '');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveMacroPref(cfg) {
  try {
    const file = MACRO_PREF_PATH();
    const tmp = `${file}.tmp`;
    const payload = {
      ...cfg,
      tapLength: cfg?.tapLength || tapLength.getConfig(),
    };
    fs.writeFileSync(tmp, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    fs.renameSync(tmp, file);
  } catch (err) {
    console.warn('[macros] pref save failed:', err?.message || err);
  }
}

function restoreMacroPref() {
  const saved = loadMacroPref();
  if (!saved || typeof saved !== 'object') return;
  try {
    loadMacros().applyConfig(saved);
    if (saved.tapLength) tapLength.setLengthsFromConfig(saved.tapLength);
    if (tapLength.hasFloors()) ensureHires();
    console.log('[macros] restored from', MACRO_PREF_PATH(), 'tap-length:', tapLength.status().backend);
  } catch (err) {
    console.warn('[macros] restore failed:', err?.message || err);
  }
}

/** Shipped defaults: Edit=R3, Select=R2, Use=Square, Build=D-pad Up, Reset=Circle. */
const CORE_MACRO_SEED = {
  drag: { enabled: true, trigger: 11, dragDelayUs: 1 },
  pickup: { enabled: true, trigger: 5, tapDelayUs: 0 },
  build: { enabled: true, trigger: 15, tapDelayUs: 1 },
  reset: { enabled: true, trigger: 4, tapDelayUs: 1 },
  binds: { edit: 11, select: 7, use: 2, build: 12, reset: 1 },
};

/**
 * Seed the defaults on a fresh profile only. Re-applying them on every boot is
 * what threw away binds the moment the app restarted.
 */
function ensureCoreMacrosLive() {
  const eng = loadMacros();
  const saved = loadMacroPref();
  const hasSaved = !!(saved && typeof saved === 'object' && saved.binds);
  const next = hasSaved
    ? (eng.getConfig?.() || eng.applyConfig({}))
    : eng.applyConfig(CORE_MACRO_SEED);
  saveMacroPref({
    doubleEdit: next.doubleEdit,
    drag: next.drag,
    pickup: next.pickup,
    build: next.build,
    reset: next.reset,
    binds: {
      edit: next.binds?.edit,
      select: next.binds?.select,
      use: next.binds?.use,
      build: next.binds?.build,
      reset: next.binds?.reset,
    },
    tapLength: (saved && saved.tapLength) || tapLength.getConfig(),
  });
  console.log('[macros] core live', {
    seeded: !hasSaved,
    drag: next.drag,
    pickup: next.pickup,
    build: next.build,
    reset: next.reset,
    binds: {
      edit: next.binds?.edit,
      select: next.binds?.select,
      use: next.binds?.use,
      build: next.binds?.build,
      reset: next.binds?.reset,
    },
  });
  return next;
}

/** Prefer on so Drag / Build / Pickup can reach the game via ViGEm. */
let cloakWanted = true;
/** @type {ReturnType<typeof setInterval> | null} */
let cloakWatchdog = null;
let cloakCheckBusy = false;
let cloakTicks = 0;

const BUTTON_EPSILON = 0.02;
const AXIS_EPSILON = 0.008;

function loadDrivers() {
  if (drivers) return drivers;
  // eslint-disable-next-line global-require
  drivers = require('./drivers');
  return drivers;
}

function loadGameFocus() {
  if (gameFocus) return gameFocus;
  // eslint-disable-next-line global-require
  gameFocus = require('./game-focus');
  return gameFocus;
}

function ensureInputPriority() {
  try {
    // eslint-disable-next-line global-require
    const os = require('os');
    const p = os.constants?.priority;
    // Highest available without realtime starvation of the game process.
    const level = p?.PRIORITY_HIGHEST ?? p?.PRIORITY_HIGH ?? p?.PRIORITY_ABOVE_NORMAL ?? p?.PRIORITY_NORMAL;
    if (level == null) return;
    os.setPriority(process.pid, level);
    console.log('[input] process priority elevated for zero-feel pad path');
  } catch {
    /* ignore */
  }
}

/**
 * Fortnite in the foreground means the settings window is pure overhead — its
 * renderer keeps painting the visualizer and competing with the game for
 * GPU/CPU, which shows up as sticks lagging behind the pad. Tear Chromium down
 * and let the tray hold the session; input / ViGEm / macros live in this
 * process and are untouched.
 */
function startGameFocusWatch() {
  if (gameFocusTimer) return;
  gameFocusTimer = setInterval(() => {
    if (quitting || allowDestroy) return;
    if (!loadGameFocus().isGameForeground()) return;
    if (mainWindow && !mainWindow.isDestroyed()) {
      console.log('[fps] Fortnite focused — parking settings UI');
      try { hideToBackground(); } catch { /* ignore */ }
    }
    try { releaseHiresIfIdle(); } catch { /* ignore */ }
    ensureInputPriority();
  }, 750);
  if (typeof gameFocusTimer.unref === 'function') gameFocusTimer.unref();
}

function stopGameFocusWatch() {
  if (!gameFocusTimer) return;
  clearInterval(gameFocusTimer);
  gameFocusTimer = null;
}

function loadHidHide() {
  if (hidhide) return hidhide;
  // eslint-disable-next-line global-require
  hidhide = require('./hidhide');
  return hidhide;
}

function loadVigem() {
  if (vigemPad) return vigemPad;
  // eslint-disable-next-line global-require
  vigemPad = require('./vigem-pad');
  return vigemPad;
}

function loadNativeInput() {
  if (nativeInput) return nativeInput;
  // eslint-disable-next-line global-require
  nativeInput = require('./native-input');
  return nativeInput;
}

function loadMacros() {
  if (macroEngine) return macroEngine;
  // eslint-disable-next-line global-require
  macroEngine = require('./macro-engine');
  return macroEngine;
}

function loadHires() {
  try {
    // eslint-disable-next-line global-require
    return require('./hires-timer');
  } catch {
    return null;
  }
}

function asStickByteLocal(v) {
  if (v == null || v === '') return 128;
  const n = Number(v);
  if (!Number.isFinite(n)) return 128;
  return Math.max(0, Math.min(255, n | 0));
}

const BUTTON_COUNT_SNAP = 24;
const snapPool = [null, null];
let snapFlip = 0;

function snapshotOut(report) {
  snapFlip ^= 1;
  let snap = snapPool[snapFlip];
  if (!snap) {
    snap = {
      buttons: new Array(BUTTON_COUNT_SNAP).fill(0),
      axes: [0, 0, 0, 0],
      stickBytes: [128, 128, 128, 128],
    };
    snapPool[snapFlip] = snap;
  }
  const srcB = report.buttons || [];
  const dstB = snap.buttons;
  const n = Math.max(srcB.length, BUTTON_COUNT_SNAP);
  for (let i = 0; i < n; i += 1) dstB[i] = Number(srcB[i]) || 0;
  const srcA = report.axes || [0, 0, 0, 0];
  snap.axes[0] = Number(srcA[0]) || 0;
  snap.axes[1] = Number(srcA[1]) || 0;
  snap.axes[2] = Number(srcA[2]) || 0;
  snap.axes[3] = Number(srcA[3]) || 0;
  if (Array.isArray(report.stickBytes) && report.stickBytes.length >= 4) {
    snap.stickBytes[0] = asStickByteLocal(report.stickBytes[0]);
    snap.stickBytes[1] = asStickByteLocal(report.stickBytes[1]);
    snap.stickBytes[2] = asStickByteLocal(report.stickBytes[2]);
    snap.stickBytes[3] = asStickByteLocal(report.stickBytes[3]);
  }
  return snap;
}

function buttonsChanged(report) {
  if (!lastOut) return true;
  const n = Math.max(report.buttons?.length || 0, lastOut.buttons?.length || 0, 22);
  for (let i = 0; i < n; i += 1) {
    if (Math.abs((report.buttons[i] || 0) - (lastOut.buttons[i] || 0)) > BUTTON_EPSILON) return true;
  }
  return false;
}

function sticksChanged(report) {
  if (!lastOut) return true;
  const a = report.stickBytes;
  const b = lastOut.stickBytes;
  if (Array.isArray(a) && a.length >= 4 && Array.isArray(b) && b.length >= 4) {
    for (let i = 0; i < 4; i += 1) {
      if (asStickByteLocal(a[i]) !== asStickByteLocal(b[i])) return true;
    }
    return false;
  }
  for (let i = 0; i < 4; i += 1) {
    if (Math.abs((Number(report.axes?.[i]) || 0) - (Number(lastOut.axes?.[i]) || 0)) > AXIS_EPSILON) {
      return true;
    }
  }
  return false;
}

/**
 * Dumb-cable forward. Every change gets a priority button flush so presses
 * are not queued behind stick math — critical for high-ping "zero feel".
 */
function submitFast(report) {
  const vigem = loadVigem();
  if (!vigem.isConnected()) return;
  const btnEdge = buttonsChanged(report);
  if (!btnEdge && !sticksChanged(report)) return;
  vigem.applyReport(report, { buttonsPriority: true });
  lastOut = snapshotOut(report);
}

function ensureHires() {
  try { loadHires()?.enable?.(); } catch { /* ignore */ }
}

function releaseHiresIfIdle() {
  try {
    // Keep 1ms multimedia timer for the entire dual-pad session — dropping
    // it mid-game reintroduces ~15ms setTimeout quantization on tap floors.
    if (cloakWanted) return;
    const eng = loadMacros();
    if (!eng.anyRunning?.() && !tickTimer
      && !doubleEditFollowUp && !dragFollowUp
      && !pickupFollowUp && !buildFollowUp && !oneShotFollowUp
      && !tapLengthFollowUp
      && !tapLength.hasFloors()) {
      loadHires()?.disable?.();
    }
  } catch { /* ignore */ }
}

/** @type {ReturnType<typeof setTimeout> | null} */
let dragFollowUp = null;
/** @type {ReturnType<typeof setTimeout> | null} */
let doubleEditFollowUp = null;
/** @type {ReturnType<typeof setTimeout> | null} */
let pickupFollowUp = null;
/** @type {ReturnType<typeof setTimeout> | null} */
let buildFollowUp = null;
/** @type {ReturnType<typeof setTimeout> | null} */
let oneShotFollowUp = null;
/** @type {ReturnType<typeof setTimeout> | null} */
let tapLengthFollowUp = null;
let tapLengthFollowUpDue = 0;

/** @type {ReturnType<typeof setInterval> | null} */
let tickTimer = null;
/** 8ms hold tick — crisp macros at half the main-thread wakeups of 4ms. */
const MACRO_TICK_MS = 8;
/** Double Edit stages are poll-sized, so a missed wake must cost ~2ms, not 8. */
const MACRO_TICK_FAST_MS = 2;
let tickEveryMs = MACRO_TICK_MS;

function stopTicker() {
  if (!tickTimer) return;
  clearInterval(tickTimer);
  tickTimer = null;
  releaseHiresIfIdle();
}

function startTicker(everyMs = MACRO_TICK_MS) {
  if (tickTimer && tickEveryMs === everyMs) return;
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
  ensureHires();
  tickEveryMs = everyMs;
  tickTimer = setInterval(() => {
    if (!lastInput || !loadMacros().anyRunning?.()) {
      stopTicker();
      return;
    }
    pump(lastInput);
  }, everyMs);
  if (typeof tickTimer.unref === 'function') tickTimer.unref();
}

function hrUs() {
  const [s, ns] = process.hrtime();
  return s * 1e6 + ns / 1e3;
}

/**
 * setTimeout only resolves whole milliseconds and still runs late. Double Edit
 * stages are poll-sized, so rounding every boundary up is a whole extra poll
 * per tile. Sleep the bulk, then spin the last sub-millisecond.
 */
const DE_SPIN_CAP_US = 1500;

function spinUntilDue(waitUsFn) {
  const guard = hrUs() + DE_SPIN_CAP_US;
  for (;;) {
    const waitUs = waitUsFn();
    if (waitUs == null || waitUs <= 0) return;
    if (waitUs > DE_SPIN_CAP_US) return;
    if (hrUs() >= guard) return;
  }
}

/** Drag select join wake. */
function scheduleDragFollowUp() {
  const eng = loadMacros();
  const waitMs = eng.dragSelectWaitMs?.();
  if (waitMs == null || !lastInput) {
    if (dragFollowUp) {
      clearTimeout(dragFollowUp);
      dragFollowUp = null;
    }
    releaseHiresIfIdle();
    return;
  }
  if (dragFollowUp) return;
  ensureHires();
  dragFollowUp = setTimeout(() => {
    dragFollowUp = null;
    if (lastInput) pump(lastInput);
    releaseHiresIfIdle();
  }, waitMs);
}

/** Double Edit stage wake — lands on the µs boundary, not the next whole ms. */
function scheduleDoubleEditFollowUp() {
  const eng = loadMacros();
  const waitUs = eng.doubleEditWaitUs?.();
  if (waitUs == null || !lastInput) {
    if (doubleEditFollowUp) {
      clearTimeout(doubleEditFollowUp);
      doubleEditFollowUp = null;
    }
    releaseHiresIfIdle();
    return;
  }
  if (doubleEditFollowUp) return;
  ensureHires();
  const sleepMs = Math.max(0, Math.floor((waitUs - DE_SPIN_CAP_US) / 1000));
  doubleEditFollowUp = setTimeout(() => {
    doubleEditFollowUp = null;
    spinUntilDue(() => eng.doubleEditWaitUs?.());
    if (lastInput) pump(lastInput);
    releaseHiresIfIdle();
  }, sleepMs);
}

/** Pickup spam wake (allows 0ms). */
function schedulePickupFollowUp() {
  const eng = loadMacros();
  const waitMs = eng.pickupWaitMs?.();
  if (waitMs == null || !lastInput) {
    if (pickupFollowUp) {
      clearTimeout(pickupFollowUp);
      pickupFollowUp = null;
    }
    releaseHiresIfIdle();
    return;
  }
  if (pickupFollowUp) return;
  if (waitMs < 16) ensureHires();
  pickupFollowUp = setTimeout(() => {
    pickupFollowUp = null;
    if (lastInput) pump(lastInput);
    releaseHiresIfIdle();
  }, waitMs);
}

/** Build / Reset / Pickaxe pull-out release wake. */
function scheduleBuildFollowUp() {
  const eng = loadMacros();
  const waits = [eng.buildWaitMs?.(), eng.resetWaitMs?.(), eng.pickaxeWaitMs?.()]
    .filter((w) => w != null && Number.isFinite(w));
  const waitMs = waits.length ? Math.min(...waits) : null;
  if (waitMs == null || !lastInput) {
    if (buildFollowUp) {
      clearTimeout(buildFollowUp);
      buildFollowUp = null;
    }
    if (oneShotFollowUp) {
      clearTimeout(oneShotFollowUp);
      oneShotFollowUp = null;
    }
    releaseHiresIfIdle();
    return;
  }
  if (buildFollowUp || oneShotFollowUp) return;
  ensureHires();
  buildFollowUp = setTimeout(() => {
    buildFollowUp = null;
    oneShotFollowUp = null;
    if (lastInput) pump(lastInput);
    releaseHiresIfIdle();
  }, waitMs);
  oneShotFollowUp = buildFollowUp;
}

function clearMacroTimers() {
  [dragFollowUp, doubleEditFollowUp, pickupFollowUp, buildFollowUp].forEach((t) => {
    if (t) clearTimeout(t);
  });
  dragFollowUp = null;
  doubleEditFollowUp = null;
  pickupFollowUp = null;
  buildFollowUp = null;
  oneShotFollowUp = null;
  stopTicker();
}

/**
 * Floor short physical taps BEFORE macros. Never touch post-macro output —
 * that used to re-pin Build / weapon binds after justReleased.
 *
 * Follow-ups must re-pump the last PHYSICAL report (not the floored copy) —
 * otherwise forced holds never see the real release and buttons stick / re-arm.
 */
function scheduleTapLengthFollowUp(waitMs) {
  if (waitMs == null || !Number.isFinite(waitMs)) {
    if (tapLengthFollowUp) {
      clearTimeout(tapLengthFollowUp);
      clearImmediate(tapLengthFollowUp);
      tapLengthFollowUp = null;
      tapLengthFollowUpDue = 0;
    }
    releaseHiresIfIdle();
    return;
  }
  const delay = Math.max(0, Number(waitMs));
  const due = Date.now() + delay;
  if (tapLengthFollowUp && tapLengthFollowUpDue && due >= tapLengthFollowUpDue) return;
  if (tapLengthFollowUp) {
    clearTimeout(tapLengthFollowUp);
    clearImmediate(tapLengthFollowUp);
  }
  tapLengthFollowUpDue = due;
  const fire = () => {
    tapLengthFollowUp = null;
    tapLengthFollowUpDue = 0;
    if (lastInput) pump(lastInput);
    releaseHiresIfIdle();
  };
  // Sub-ms floors still need the 1ms multimedia timer or Windows quantizes to ~15ms.
  ensureHires();
  if (delay < 1) {
    tapLengthFollowUp = setImmediate(fire);
    return;
  }
  tapLengthFollowUp = setTimeout(fire, delay);
}

function withTapLengthInput(report) {
  const floored = tapLength.applyToReport(report);
  scheduleTapLengthFollowUp(floored.nextWakeMs);
  return floored.report;
}

function submitOut(report, { force = false } = {}) {
  const inputApi = loadNativeInput();
  if (inputApi.isXboxFastLive?.() && inputApi.getStatus?.()?.source === 'xbox') {
    inputApi.setXboxMainDrive?.(true);
    inputApi.writeXboxFastOutput?.(report);
    lastOut = snapshotOut(report);
    return;
  }
  if (force) {
    loadVigem().applyReport(report, { buttonsPriority: true });
    lastOut = snapshotOut(report);
    return;
  }
  submitFast(report);
}

/**
 * Physical report → tap-length floor → macro engine → ViGEm.
 * Pump body drives Drag / Pickup / Build.
 */
function pump(report) {
  const inputApi = loadNativeInput();
  const xboxFast = !!(inputApi.isXboxFastLive?.() && inputApi.getStatus?.()?.source === 'xbox');
  const vigem = loadVigem();
  // Virtual pad must be live — either main ViGEm (PS) or Xbox zero-hop worker.
  if (!cloakWanted || (!xboxFast && !vigem.isConnected())) return;

  const eng = loadMacros();

  try {
    // Always keep the latest PHYSICAL pad state for follow-ups / ticker.
    lastInput = report;

    const needsMacro = eng.needsProcess(report);
    const needsTap = tapLength.isActive(report) || tapLength.hasFloors();

    // Xbox zero-hop: worker owns ViGEm for passthrough + Rust tap floors.
    // Main only seizes output while macros need the report.
    if (xboxFast && !needsMacro) {
      inputApi.setXboxMainDrive?.(false);
      stopTicker();
      return;
    }

    if (xboxFast && needsMacro) {
      inputApi.setXboxMainDrive?.(true);
    }

    // Fast path: idle look/strafe — USB → ViGEm with no engine hop.
    if (!needsTap && !needsMacro) {
      if (!xboxFast) submitFast(report);
      stopTicker();
      return;
    }

    // Lengthen short physical taps on the way in (Rust hot path when loaded).
    const floored = withTapLengthInput(report);

    // Tap-length only — skip the macro engine so floored buttons stay max-speed.
    if (!eng.needsProcess(floored)) {
      submitOut(floored);
      stopTicker();
      return;
    }

    let out = eng.process(floored);
    const oneShotArmed = !!eng.anyOneShotJustArmed?.();
    // Snapshot which one-shots armed on THIS report before any re-process bumps
    // stageReports past 1 (that used to skip the rising-edge clear).
    const armedKeys = ['reset', 'pickaxe', 'build'].filter((key) => (
      !!eng.isOneShotJustArmed?.(key)
    ));

    // Skip the first paint when a one-shot just armed — clear→down below owns
    // those submits so we do not waste a pre-edge DOWN frame.
    if (!oneShotArmed) submitOut(out);

    // One-shots FIRST — clear→down before Drag/DE re-process can bump reports.
    // Hold for the press floor on follow-up / ticker; never clear→down→up here.
    if (oneShotArmed && armedKeys.length) {
      const cfg = eng.getConfig?.() || {};
      const cleared = snapshotOut(out);
      let edge = false;
      armedKeys.forEach((key) => {
        const bind = cfg.binds?.[key];
        if (!Number.isFinite(bind)) return;
        cleared.buttons[bind] = 0;
        edge = true;
      });
      if (edge) submitOut(cleared, { force: true });
      submitOut(out, { force: true });
      out = eng.process(floored);
      submitOut(out, { force: true });
      out = eng.process(floored);
      submitOut(out, { force: true });
    }

    // Drag: commit edit-alone only. Select joins on a later pump after the
    // poll-visible delay — never in this same arming pump (that missed tiles).
    const dragJustEditAlone = !!eng.consumeDragJustEditAlone?.();
    if (dragJustEditAlone) {
      submitOut(out, { force: true });
      submitOut(out, { force: true });
    }

    // Double Edit: after a stage completes, paint the next stage immediately.
    // Re-commit when tile arms so select's rising edge always hits the bus.
    if (eng.isDoubleEditNeedsNextStage?.()) {
      out = eng.process(floored);
      submitOut(out, { force: true });
      const st = eng.getState?.()?.doubleEdit;
      if (st?.stage === 'tile') {
        submitOut(out, { force: true });
      }
    }

    // Never release a one-shot on the same pump that armed it.
    if (!oneShotArmed && eng.anyOneShotReleaseDue?.()) {
      out = eng.process(floored);
      submitOut(out, { force: true });
    }

    if (eng.anyRunning?.()) {
      startTicker(eng.isDoubleEditRunning?.() ? MACRO_TICK_FAST_MS : MACRO_TICK_MS);
    } else {
      stopTicker();
    }
    scheduleDragFollowUp();
    scheduleDoubleEditFollowUp();
    schedulePickupFollowUp();
    scheduleBuildFollowUp();
  } catch (err) {
    console.warn('[pump]', err?.message || err);
  }
}

function virtualTargetFor(source) {
  return source === 'ps' ? 'ds4' : 'x360';
}

function notifyHidHide(payload) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    mainWindow.webContents.send('hidhide:changed', payload);
  } catch {
    /* ignore */
  }
}

function setPipelinePowerLock(on) {
  try {
    if (on) {
      if (powerBlockerId == null || !powerSaveBlocker.isStarted(powerBlockerId)) {
        powerBlockerId = powerSaveBlocker.start('prevent-app-suspension');
      }
    } else if (powerBlockerId != null) {
      if (powerSaveBlocker.isStarted(powerBlockerId)) powerSaveBlocker.stop(powerBlockerId);
      powerBlockerId = null;
    }
  } catch {
    /* ignore */
  }
}

function startKeepalive() {
  if (keepaliveTimer) return;
  // While cloak is on, hold last ViGEm state if HID glitches (OBS/clip tools).
  // Keep this light — never status()/pump on the hot interval.
  keepaliveTimer = setInterval(() => {
    if (!cloakWanted || !padLost || !lastOut) return;
    const inputApi = loadNativeInput();
    if (inputApi.isXboxFastLive?.()) {
      try {
        inputApi.setXboxMainDrive?.(true);
        inputApi.writeXboxFastOutput?.(lastOut);
      } catch (err) {
        console.warn('[keepalive]', err?.message || err);
      }
      return;
    }
    const vigem = loadVigem();
    if (!vigem.isConnected()) {
      try { ensureVirtualPad(); } catch { /* ignore */ }
      return;
    }
    try {
      vigem.applyReport(lastOut);
    } catch (err) {
      console.warn('[keepalive]', err?.message || err);
    }
  }, 50);
  if (typeof keepaliveTimer.unref === 'function') keepaliveTimer.unref();
}

function stopKeepalive() {
  if (!keepaliveTimer) return;
  clearInterval(keepaliveTimer);
  keepaliveTimer = null;
}

function cloneReportHold(report) {
  const buttons = Array.isArray(report?.buttons) ? report.buttons.slice() : [];
  while (buttons.length < 24) buttons.push(0);
  const out = {
    buttons,
    axes: Array.isArray(report?.axes) ? report.axes.slice() : [0, 0, 0, 0],
  };
  if (Array.isArray(report?.stickBytes) && report.stickBytes.length >= 4) {
    out.stickBytes = report.stickBytes.slice(0, 4);
  }
  return out;
}

function retractVirtualPad(reason) {
  const vigem = loadVigem();
  if (!vigem.isConnected()) return false;
  console.warn('[hidhide] virtual pad retracted —', reason);
  try { vigem.unplug(); } catch { /* ignore */ }
  try { loadNativeInput().setVirtualUserIndex(null); } catch { /* ignore */ }
  return true;
}

/**
 * Drop live cloak + ViGEm. Does NOT clear the user's cloak preference —
 * reconnect / boot will re-arm when cloakWanted stays true.
 */
async function tearDownDualPad(reason) {
  armedTargets = [];
  padLost = false;
  stopKeepalive();
  stopCloakWatchdog();
  setPipelinePowerLock(false);
  if (disconnectTimer) {
    clearTimeout(disconnectTimer);
    disconnectTimer = null;
  }
  lastInput = null;
  lastOut = null;
  clearMacroTimers();
  try {
    const eng = loadMacros();
    ['doubleEdit', 'drag', 'pickup', 'build'].forEach((k) => {
      const on = !!eng.getConfig()?.[k]?.enabled;
      eng.setEnabled?.(k, false);
      if (on) eng.setEnabled?.(k, true);
    });
  } catch { /* ignore */ }
  try { loadNativeInput().setXboxMainDrive?.(false); } catch { /* ignore */ }
  try { loadNativeInput().disarmXboxFast?.(); } catch { /* ignore */ }
  retractVirtualPad(reason);
  try {
    await loadHidHide().disable();
  } catch {
    /* ignore */
  }
  notifyHidHide({
    active: false,
    ok: true,
    note: reason || (cloakWanted
      ? 'Controller disconnected. Replug — cloak will re-arm automatically.'
      : 'Cloak off.'),
  });
}

function outputPadLive() {
  const input = loadNativeInput();
  if (input.isXboxFastLive?.()) return true;
  return loadVigem().isConnected();
}

function ensureVirtualPad() {
  const input = loadNativeInput();
  const status = input.getStatus() || {};
  if (!(status.connected || status.instancePath || status.name)) {
    return { connected: false, error: 'No physical controller connected' };
  }
  // Xbox zero-hop worker already owns the virtual x360 — never plug a second pad.
  if (status.source === 'xbox' && input.isXboxFastLive?.()) {
    return { connected: true, target: 'x360', external: true, ok: true };
  }
  const wanted = virtualTargetFor(status.source);
  const vigem = loadVigem();
  if (vigem.isConnected()) {
    const cur = vigem.status();
    if (cur.target === wanted) {
      input.setVirtualUserIndex(cur.userIndex ?? null);
      return { ...cur, reused: true };
    }
    try { vigem.unplug(); } catch { /* ignore */ }
  }
  // Xbox: arm the zero-hop worker (ViGEm lives in-worker).
  if (status.source === 'xbox') {
    input.armXboxFast?.();
    return { connected: false, target: 'x360', pendingFast: true };
  }
  const next = vigem.connect(wanted);
  input.setVirtualUserIndex(next?.userIndex ?? null);
  return next;
}

async function waitXboxFastReady(ms = 2500) {
  const input = loadNativeInput();
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (input.isXboxFastLive?.()) return true;
    await new Promise((r) => setTimeout(r, 15));
  }
  return !!input.isXboxFastLive?.();
}

function startCloakWatchdog() {
  if (cloakWatchdog) return;
  cloakWatchdog = setInterval(async () => {
    if (!cloakWanted || !(loadVigem().isConnected() || loadNativeInput().isXboxFastLive?.()) || !armedTargets.length) return;
    if (cloakCheckBusy) return;
    cloakCheckBusy = true;
    try {
      cloakTicks += 1;
      const hh = loadHidHide();
      let bad = false;
      if (cloakTicks % 6 === 0) {
        bad = !(await hh.verifyArmed?.(armedTargets))?.ok;
      } else {
        bad = (await hh.readCloakActive?.()) === false;
      }
      if (!bad || !outputPadLive()) return;
      console.warn('[hidhide] cloak dropped mid-session — re-hiding physical (keeping ViGEm)');
      const res = await hh.enable(armedTargets, { merge: true });
      if (!res?.ok || !res.active) {
        console.warn('[hidhide] re-cloak failed — will retry. Macro pad stays up.');
      }
    } catch (err) {
      console.warn('[hidhide] watchdog', err?.message || err);
    } finally {
      cloakCheckBusy = false;
    }
  }, 15000);
  if (typeof cloakWatchdog.unref === 'function') cloakWatchdog.unref();
}

function stopCloakWatchdog() {
  if (!cloakWatchdog) return;
  clearInterval(cloakWatchdog);
  cloakWatchdog = null;
  cloakTicks = 0;
}

function scheduleDualPad() {
  if (!dualPadAllowed || !cloakWanted) return;
  if (dualPadTimer) clearTimeout(dualPadTimer);
  dualPadTimer = setTimeout(() => {
    dualPadTimer = null;
    if (!dualPadAllowed || !cloakWanted) return;
    Promise.resolve()
      .then(() => activateDualPad())
      .then((res) => {
        if (res?.ok && res.active) {
          console.log('[hidhide] dual-pad ready — Drag/Pickup/Build can reach the game');
          ensureHires();
          startCloakWatchdog();
        } else if (res && !res.ok) {
          const waitingForPad = /connect your controller/i.test(String(res.error || ''));
          if (waitingForPad) return;
          console.warn('[hidhide] dual-pad FAILED:', res.error);
          // Retry — pad may not have been ready on first attempt.
          setTimeout(() => {
            if (cloakWanted && dualPadAllowed && !loadVigem().isConnected()) {
              scheduleDualPad();
            }
          }, 1500);
        }
        if (res?.ok && res.active) {
          notifyHidHide({
            ...res,
            active: true,
            note: res.note || 'Cloak on — games only see the virtual pad. Macros are live.',
          });
        }
      })
      .catch((err) => console.warn('[hidhide] dual-pad', err?.message || err));
  }, 50);
}

function bindInputPipeline() {
  if (pipelineReady) return;
  const input = loadNativeInput();

  input.on('report', (report) => {
    padLost = false;
    if (disconnectTimer) {
      clearTimeout(disconnectTimer);
      disconnectTimer = null;
    }
    pump(report);
  });

  input.on('xbox-fast-ready', () => {
    input.syncXboxTapLength?.(tapLength.getConfig()?.byButton);
    if (cloakWanted) scheduleDualPad();
  });

  input.on('connected', () => {
    padLost = false;
    if (disconnectTimer) {
      clearTimeout(disconnectTimer);
      disconnectTimer = null;
    }
    console.log('[input] pad connected — scheduling dual-pad');
    // Hide physical FIRST via activateDualPad — never plug ViGEm alone
    // (dual-input = mouse-accel sticks).
    scheduleDualPad();
  });

  input.on('disconnected', (reason) => {
    if (!cloakWanted) return;
    // OBS / Medal / clip tools often glitch the HID handle for <1s.
    // Keep cloak + ViGEm up and hold the last pad state so sticks don't
    // fall through to the physical pad (mouse-accel feel in-game).
    padLost = true;
    console.warn('[input] pad lost (debounced) —', reason || 'unknown', '— holding virtual pad');
    startKeepalive();
    if (disconnectTimer) clearTimeout(disconnectTimer);
    disconnectTimer = setTimeout(() => {
      disconnectTimer = null;
      if (!cloakWanted || !padLost) return;
      const st = loadNativeInput().getStatus() || {};
      if (st.connected) {
        padLost = false;
        return;
      }
      console.warn('[hidhide] pad still gone after wait — restoring games');
      void tearDownDualPad('Controller disconnected — cloak off.');
    }, 2500);
  });

  pipelineReady = true;
}

/**
 * Cloak physical pad + start matching ViGEm target (DS4 for PlayStation, x360 for Xbox).
 */
async function activateDualPad() {
  const hh = loadHidHide();
  const input = loadNativeInput().getStatus() || {};
  if (!(input.connected || input.instancePath || input.name)) {
    return {
      ok: false,
      installed: true,
      active: false,
      error: 'Connect your controller first, then turn cloak on.',
    };
  }

  hh.resetCliCache();

  if (!hh.driverInstalled()) {
    return {
      ok: false,
      installed: false,
      active: false,
      error: 'HidHide is not installed. Use Install on this card first.',
    };
  }

  const primary = String(input.instancePath || '').trim();
  if (!primary || hh.isVirtualDevice?.(primary)) {
    return {
      ok: false,
      installed: true,
      active: false,
      error: 'Could not find the physical pad to hide. Replug the controller and try again.',
    };
  }

  // Already live? Skip re-hide — mid-match re-cloak can flash dual-input.
  if (outputPadLive() && armedTargets.length) {
    const have = armedTargets.some((t) => String(t).toLowerCase() === primary.toLowerCase());
    if (have) {
      const inputApi = loadNativeInput();
      const vigemStatus = inputApi.isXboxFastLive?.()
        ? { connected: true, target: 'x360', external: true }
        : loadVigem().status();
      cloakWanted = true;
      setPipelinePowerLock(true);
      ensureInputPriority();
      startKeepalive();
      startCloakWatchdog();
      inputApi.syncXboxTapLength?.(tapLength.getConfig()?.byButton);
      return {
        ok: true,
        installed: true,
        active: true,
        alreadyArmed: true,
        vigem: vigemStatus,
        target: vigemStatus.target,
        note: 'Cloak on — virtual pad already live for macros.',
      };
    }
  }

  const family = input.source === 'ps' ? 'PlayStation → virtual DS4' : 'Xbox → virtual Xbox 360';

  // Hold restore-games until ViGEm is plugged — otherwise boot heal un-hides
  // the physical pad and Fortnite never sees macro output.
  hh.setSuppressSafeRestore?.(true);
  let res;
  try {
    // 1) Hide physical + cloak on (fast path — exact HID interface).
    res = await hh.enable([primary]);
    if (!(res?.ok && res.active)) {
      armedTargets = [];
      retractVirtualPad(res?.error || 'cloak failed');
      notifyHidHide(res);
      return res;
    }

    armedTargets = [primary];

    // 2) Start matching virtual pad for games BEFORE releasing suppress.
    let vigem = ensureVirtualPad();
    if (vigem.pendingFast) {
      await waitXboxFastReady(2500);
      vigem = ensureVirtualPad();
    }
    if (!vigem.connected) {
      try { await loadDrivers().ensureServicesRunning(); } catch { /* ignore */ }
      if (input.source === 'xbox') await waitXboxFastReady(1500);
      vigem = ensureVirtualPad();
    }
    // Last resort for Xbox if the zero-hop worker never came up.
    if (!vigem.connected && input.source === 'xbox') {
      try {
        const next = loadVigem().connect('x360');
        loadNativeInput().setVirtualUserIndex(next?.userIndex ?? null);
        vigem = next;
      } catch (err) {
        console.warn('[vigem] xbox fallback', err?.message || err);
      }
    }
    if (!vigem.connected) {
      try { await hh.disable(); } catch { /* ignore */ }
      armedTargets = [];
      return {
        ok: false,
        installed: true,
        active: false,
        error: 'Virtual pad failed to start. Install/repair ViGEmBus on the Drivers page, then try again.',
      };
    }

    if (!vigem.reused && !vigem.external) {
      try { loadVigem().reset(); } catch { /* ignore */ }
    }
    loadNativeInput().syncXboxTapLength?.(tapLength.getConfig()?.byButton);

    // 3) Re-assert cloak now that ViGEm is ready (repair any mid-arm clear).
    const verify = await hh.enable([primary], { merge: true });
    if (!(verify?.ok && verify.active)) {
      retractVirtualPad('cloak verify failed');
      armedTargets = [];
      return {
        ok: false,
        installed: true,
        active: false,
        error: verify?.error || 'Cloak failed after virtual pad start. Toggle Cloak off/on on Drivers.',
      };
    }
    res = verify;

    cloakWanted = true;
    saveCloakWanted(true);
    padLost = false;
    setPipelinePowerLock(true);
    ensureInputPriority();
    startKeepalive();
    startCloakWatchdog();
    const payload = {
      ...res,
      ok: true,
      active: true,
      vigem,
      target: vigem.target,
      note: `Cloak on — ${family}. Games only see the virtual pad (macros live).`,
      error: undefined,
    };
    notifyHidHide(payload);
    console.log('[hidhide] armed', {
      target: vigem.target,
      path: primary,
      macros: {
        drag: loadMacros().getConfig().drag?.enabled,
        pickup: loadMacros().getConfig().pickup?.enabled,
        build: loadMacros().getConfig().build?.enabled,
      },
    });

    // 4) Background: hide sibling interfaces (Xbox XInput siblings, etc.).
    hh.expandTargets([primary])
      .then(async (full) => {
        if (!cloakWanted || !full?.length) return;
        armedTargets = full;
        const more = await hh.enable(full, { merge: true });
        if (more?.ok && more.active) {
          const vigemStatus = loadVigem().status();
          notifyHidHide({
            ...more,
            vigem: vigemStatus,
            target: vigemStatus.target,
            note: payload.note,
          });
        }
      })
      .catch((err) => console.warn('[hidhide] sibling hide', err?.message || err));

    return payload;
  } finally {
    hh.setSuppressSafeRestore?.(false);
  }
}

async function deactivateDualPad() {
  cloakWanted = false;
  saveCloakWanted(false);
  clearMacroTimers();
  await tearDownDualPad('Cloak off — your controller is visible to games again.');
  const st = await loadHidHide().getStatus?.() || { ok: true, active: false };
  return { ...st, active: false, note: 'Cloak off — your controller is visible to games again.' };
}

function appIconImage() {
  const ico = path.join(__dirname, '..', 'assets', 'icon.ico');
  const png = path.join(__dirname, '..', 'assets', 'icon.png');
  let icon = nativeImage.createFromPath(ico);
  if (icon.isEmpty()) icon = nativeImage.createFromPath(png);
  return icon;
}

function askCloseChoice() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send('window:close-ask');
  } catch {
    /* ignore */
  }
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function ensureTray() {
  if (tray) return;
  let icon = appIconImage();
  if (icon.isEmpty()) {
    icon = nativeImage.createEmpty();
  } else {
    icon = icon.resize({ width: 16, height: 16 });
  }
  tray = new Tray(icon);
  tray.setToolTip('BlankDelay Controller Macro — macros live (tray → Open)');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open', click: () => showMainWindow() },
    { type: 'separator' },
    { label: 'Fully close', click: () => quitApp() },
  ]));
  tray.on('double-click', () => showMainWindow());
}

function destroyTray() {
  if (!tray) return;
  try { tray.destroy(); } catch { /* ignore */ }
  tray = null;
}

/** Hide UI to tray; keep ViGEm / macros / HidHide alive. */
function hideToBackground() {
  ensureTray();
  parkUiForGame();
}

/**
 * Destroy the Chromium settings window (Close).
 * Input / ViGEm / macros stay in the main process.
 */
function parkUiForGame() {
  ensureTray();
  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = null;
    return;
  }
  const win = mainWindow;
  mainWindow = null;
  parkingUi = true;
  // destroy() skips Chromium's graceful teardown, so pending localStorage
  // writes (a bind set seconds ago) would never reach disk.
  try { win.webContents?.session?.flushStorageData?.(); } catch { /* ignore */ }
  setImmediate(() => {
    try {
      if (win && !win.isDestroyed()) win.destroy();
    } catch { /* ignore */ }
    parkingUi = false;
  });
}

function quitApp() {
  allowDestroy = true;
  destroyTray();
  app.quit();
}

function createWindow() {
  const icon = appIconImage();
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 680,
    frame: false,
    fullscreenable: true,
    maximizable: true,
    title: 'BlankDelay Controller Macro',
    backgroundColor: '#04060f',
    show: false,
    icon: icon.isEmpty() ? undefined : icon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });
  if (!icon.isEmpty() && process.platform === 'win32') {
    try { mainWindow.setIcon(icon); } catch { /* ignore */ }
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^(https?:\/\/|mailto:)/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));
  mainWindow.once('ready-to-show', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.show();
    mainWindow.focus();
  });

  const notifyFullscreen = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    try {
      mainWindow.webContents.send('window:fullscreen-changed', mainWindow.isFullScreen());
    } catch {
      /* ignore */
    }
  };
  mainWindow.on('enter-full-screen', notifyFullscreen);
  mainWindow.on('leave-full-screen', notifyFullscreen);

  // X / Alt+F4 → Close (tray) vs Fully close.
  mainWindow.on('close', (e) => {
    if (allowDestroy || quitting || parkingUi) return;
    e.preventDefault();
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
      askCloseChoice();
    } else {
      hideToBackground();
    }
  });

  mainWindow.on('closed', () => {
    if (!parkingUi) mainWindow = null;
  });
}

function registerIpc() {
  ipcMain.removeHandler('window:minimize');
  ipcMain.removeHandler('window:maximize');
  ipcMain.removeHandler('window:fullscreen');
  ipcMain.removeHandler('window:isFullscreen');
  ipcMain.removeHandler('window:close');
  ipcMain.removeHandler('window:hide');
  ipcMain.removeHandler('window:quit');
  ipcMain.removeHandler('window:show');
  ipcMain.removeHandler('shell:openExternal');
  ipcMain.removeHandler('drivers:status');
  ipcMain.removeHandler('drivers:install');
  ipcMain.removeHandler('drivers:open');
  ipcMain.removeHandler('hidhide:status');
  ipcMain.removeHandler('hidhide:set');
  ipcMain.removeHandler('vigem:status');
  ipcMain.removeHandler('input:status');
  ipcMain.removeHandler('macro:config');
  ipcMain.removeHandler('macro:getConfig');
  ipcMain.removeHandler('macro:status');
  ipcMain.removeHandler('macro:debug');
  ipcMain.removeHandler('tapLength:status');
  ipcMain.removeHandler('license:unlocked');

  registerLicenseIpc(ipcMain);

  ipcMain.handle('license:unlocked', async () => {
    dualPadAllowed = true;
    if (cloakWanted) scheduleDualPad();
    return { ok: true, licensed: true, reason: 'blank' };
  });

  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:maximize', () => {
    if (!mainWindow) return;
    if (mainWindow.isFullScreen()) {
      mainWindow.setFullScreen(false);
      return;
    }
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.handle('window:fullscreen', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return false;
    const next = !mainWindow.isFullScreen();
    try {
      // Frameless Windows builds can ignore setFullScreen while maximized.
      if (next && mainWindow.isMaximized()) mainWindow.unmaximize();
      mainWindow.setFullScreen(next);
      mainWindow.webContents.send('window:fullscreen-changed', mainWindow.isFullScreen());
    } catch {
      /* ignore */
    }
    return mainWindow.isFullScreen();
  });
  ipcMain.handle('window:isFullscreen', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return false;
    return mainWindow.isFullScreen();
  });
  ipcMain.handle('window:close', () => {
    askCloseChoice();
    return true;
  });
  ipcMain.handle('window:hide', () => {
    hideToBackground();
    return true;
  });
  ipcMain.handle('window:quit', () => {
    quitApp();
    return true;
  });
  ipcMain.handle('window:show', () => {
    showMainWindow();
    return true;
  });
  ipcMain.handle('shell:openExternal', async (_event, url) => {
    const next = String(url || '');
    if (!/^https?:\/\//i.test(next)) return { ok: false, error: 'invalid-url' };
    await shell.openExternal(next);
    return { ok: true };
  });

  ipcMain.handle('drivers:status', async () => {
    try {
      return await loadDrivers().getStatus();
    } catch (err) {
      console.error('[drivers:status]', err);
      throw err;
    }
  });

  ipcMain.handle('drivers:install', async (_e, ids) => {
    const mod = loadDrivers();
    const result = await mod.installMissing(ids);
    try {
      await mod.ensureServicesRunning();
      if (Array.isArray(ids) ? ids.includes('hidhide') : true) {
        await mod.ensureHidHideDeviceReady?.();
      }
    } catch (err) {
      console.warn('[drivers] post-install', err?.message || err);
    }
    try {
      await loadHidHide().postInstallHeal?.();
    } catch {
      /* ignore */
    }
    return {
      ...result,
      status: await mod.getStatus(),
    };
  });

  ipcMain.handle('drivers:open', async (_e, id) => {
    if (String(id || '') === 'ds4') return loadDrivers().openDs4();
    return { ok: false, error: 'unsupported' };
  });

  ipcMain.handle('hidhide:status', async () => {
    try {
      const st = await loadHidHide().getStatus();
      const vigem = loadVigem().status();
      return {
        ...st,
        vigem,
        target: vigem.connected ? vigem.target : st.target,
        note: cloakWanted && vigem.connected
          ? (vigem.target === 'ds4'
            ? 'Cloak on — PlayStation pad hidden, virtual DS4 live for games.'
            : 'Cloak on — Xbox pad hidden, virtual Xbox 360 live for games.')
          : st.note,
      };
    } catch (err) {
      console.error('[hidhide:status]', err);
      return {
        ok: false,
        installed: false,
        active: false,
        error: err?.message || String(err),
      };
    }
  });

  ipcMain.handle('hidhide:set', async (_e, on) => {
    try {
      if (on) return await activateDualPad();
      return await deactivateDualPad();
    } catch (err) {
      console.error('[hidhide:set]', err);
      return {
        ok: false,
        installed: !!loadHidHide().driverInstalled?.(),
        active: false,
        error: err?.message || String(err),
      };
    }
  });

  ipcMain.handle('vigem:status', () => loadVigem().status());
  ipcMain.handle('input:status', () => loadNativeInput().getStatus());

  ipcMain.handle('macro:config', (_e, partial) => {
    try {
      const p = partial || {};
      if (p.tapLength) {
        tapLength.setLengthsFromConfig(p.tapLength);
        loadNativeInput().syncXboxTapLength?.(tapLength.getConfig()?.byButton || p.tapLength.byButton);
      }
      const cfg = loadMacros().applyConfig(p);
      const tapCfg = tapLength.getConfig();
      // Persist so Drag/Pickup/Reset + per-button ms stay armed across restarts.
      saveMacroPref({
        doubleEdit: cfg.doubleEdit,
        drag: cfg.drag,
        pickup: cfg.pickup,
        build: cfg.build,
        reset: cfg.reset,
        binds: {
          edit: cfg.binds?.edit,
          select: cfg.binds?.select,
          use: cfg.binds?.use,
          build: cfg.binds?.build,
          reset: cfg.binds?.reset,
        },
        tapLength: {
          ...tapCfg,
          armedByButton: tapCfg.armedByButton || p.tapLength?.armedByButton || {},
        },
      });
      const anyCore = !!(cfg.drag?.enabled || cfg.pickup?.enabled || cfg.build?.enabled || cfg.reset?.enabled);
      const anyTap = tapLength.hasFloors();
      // Bind timing + macros only reach games through the virtual pad.
      cloakWanted = true;
      saveCloakWanted(true);
      if (anyTap) ensureHires();
      if (dualPadAllowed) scheduleDualPad();
      console.log('[macros] config', {
        drag: cfg.drag,
        pickup: cfg.pickup,
        build: cfg.build,
        reset: cfg.reset,
        tapLength: { backend: tapCfg.backend, floors: anyTap, rust: tapCfg.backend === 'rust' },
        vigem: loadVigem().isConnected(),
        cloakWanted,
      });
      return { ok: true, ...cfg, tapLength: tapCfg };
    } catch (err) {
      console.error('[macro:config]', err);
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle('macro:debug', () => {
    try {
      const cfg = loadMacros().getConfig();
      const st = loadMacros().getState();
      const vigem = loadVigem().status();
      const input = loadNativeInput().getStatus();
      return {
        ok: true,
        cloakWanted,
        dualPadAllowed,
        vigemConnected: !!vigem.connected,
        vigemTarget: vigem.target,
        inputConnected: !!input?.connected,
        inputName: input?.name || null,
        armedTargets,
        macros: {
          drag: { ...cfg.drag, stage: st.drag?.stage },
          pickup: { ...cfg.pickup, stage: st.pickup?.stage },
          build: { ...cfg.build, stage: st.build?.stage },
          reset: { ...cfg.reset, stage: st.reset?.stage },
        },
        binds: {
          edit: cfg.binds?.edit,
          select: cfg.binds?.select,
          use: cfg.binds?.use,
          build: cfg.binds?.build,
          reset: cfg.binds?.reset,
        },
      };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle('macro:getConfig', () => {
    try {
      return { ok: true, ...loadMacros().getConfig(), tapLength: tapLength.getConfig() };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle('tapLength:status', () => tapLength.status());

  ipcMain.handle('macro:status', () => {
    try {
      return { ok: true, state: loadMacros().getState(), config: loadMacros().getConfig() };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  registerIpc();

  try {
    loadDrivers().onProgress((payload) => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      mainWindow.webContents.send('drivers:progress', payload);
    });
  } catch (err) {
    console.error('[drivers] failed to load module', err);
  }

  app.on('second-instance', () => {
    showMainWindow();
  });

  app.whenReady().then(async () => {
    cloakWanted = loadCloakWanted();
    // Macros need cloak — never boot with cloakWanted false by accident.
    if (cloakWanted !== false) cloakWanted = true;
    dualPadAllowed = false;
    restoreMacroPref();
    ensureCoreMacrosLive();

    try {
      bindInputPipeline();
      loadNativeInput().start();
    } catch (err) {
      console.error('[native-input] start', err);
    }

    createWindow();
    startGameFocusWatch();

    try {
      await loadDrivers().ensureServicesRunning();
    } catch {
      /* ignore */
    }

    // CRITICAL: do NOT restore-games when the user wants cloak. That cleared
    // HidHide before ViGEm plugged and left Fortnite on the physical pad —
    // Drag / Pickup / Build looked completely dead.
    if (!cloakWanted) {
      try {
        await loadHidHide().ensureSafeForGames?.();
      } catch (err) {
        console.warn('[hidhide] boot restore', err?.message || err);
      }
    } else {
      console.log('[hidhide] cloak wanted — skipping boot restore until licensed');
    }

    // BlankDelay Controller Macro — dual-pad / macros available without a license gate.
    dualPadAllowed = true;
    if (cloakWanted) scheduleDualPad();
  });

  app.on('before-quit', (event) => {
    if (quitting) return;
    quitting = true;
    allowDestroy = true;
    destroyTray();
    cloakWanted = false;
    padLost = false;
    stopCloakWatchdog();
    stopGameFocusWatch();
    stopKeepalive();
    setPipelinePowerLock(false);
    if (disconnectTimer) {
      clearTimeout(disconnectTimer);
      disconnectTimer = null;
    }
    try { loadNativeInput().stop(); } catch { /* ignore */ }
    try { loadVigem().disconnect(); } catch { /* ignore */ }

    // Uncloaking spawns a helper process. Hold the quit until it lands, or the
    // pad can stay hidden from every game after exit on a slow machine.
    event.preventDefault();
    let exited = false;
    const finish = () => {
      if (exited) return;
      exited = true;
      try { singletonLock.release(); } catch { /* ignore */ }
      try { app.exit(0); } catch { process.exit(0); }
    };
    const deadline = setTimeout(finish, 4000);
    Promise.resolve()
      .then(() => loadHidHide().restorePadsForGames?.())
      .catch(() => { /* exit regardless */ })
      .then(() => {
        clearTimeout(deadline);
        finish();
      });
  });

  app.on('window-all-closed', () => {
    // Park destroys the settings window on purpose — keep macros alive via tray.
    if (allowDestroy) {
      if (process.platform !== 'darwin') app.quit();
      return;
    }
    ensureTray();
  });

  app.on('activate', () => {
    showMainWindow();
  });
}
