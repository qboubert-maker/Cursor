'use strict';

/**
 * Macro engine — Pick-up, Double Edit, Drag, Reset, Pickaxe and Build.
 *
 * Every timing is expressed in microseconds:
 *
 *   pickup     { trigger, tapDelayUs }              spams binds.use
 *   shooting   { trigger, tapDelayUs }              one bind: rapid-fire that same button
 *   doubleEdit { trigger, tapDelayUs }              one bind: spam edit→select→confirm
 *   drag       { trigger, dragDelayUs }             holds binds.edit, adds binds.select
 *   reset      { trigger, tapDelayUs }              one press: tap binds.reset only
 *   pickaxe    { trigger, tapDelayUs }              one press: tap binds.pickaxe
 *   build      { trigger, tapDelayUs }              one press: tap binds.build
 *   timing     { pressUs }                          how long every synthetic press lasts
 *
 * Each delay is the gap between presses; the press itself is always pressUs.
 * That split is what keeps a macro both fast and reliable — shrink the gap for
 * speed, and the press stays long enough for the game to actually poll it.
 *
 * A macro owns a trigger bind and presses shared game binds. Macros add
 * presses; they do not take the player's away. A step only ever writes a 1, so
 * anything the player is physically holding still reaches the game while a
 * macro runs.
 *
 * Runs in the main process off the native input stream, so it keeps firing
 * while a game holds focus. Triggers are read from the physical report and
 * output is written into a copy, which means a macro can drive a button the
 * player is not touching without ever fighting one they are.
 */

const EventEmitter = require('events');

const BTN_DOWN = 0.35;
// Analog triggers (L2/R2) chatter around a single threshold and would cancel a
 // mid-edit cycle. Latch on / off with hysteresis so a held L2 stays held.
const TRIGGER_ON = 0.45;
const TRIGGER_OFF = 0.20;

// Shortest press the engine will emit. A game only sees the pad when it polls,
// so anything briefer than its poll interval can land entirely between two
// reads and never register — 10ms clears 120Hz. Tunable because only the
// player knows what frame rate they run at.
// Global Press length default — 1µs; macros that need a fatter press (pickup)
// keep their own locked floors. Used only by legacy spam helpers.
const DEFAULT_PRESS_US = 1;

// Double Edit pick timings (µs) — derived from one game poll, not fixed.
//
// A game only sees the pad when it polls (once a frame). Wire states that
// decide whether a tile lands must outlast one poll at the target refresh:
//
//   • OPEN    edit alone   — 120 Hz floor (must be editing before select).
//   • TILE    edit+select  — 120 Hz+ floor (the pick; kept fattest on purpose).
//   • CONFIRM both up      — ~150 Hz floor (edit-low so the next open rises).
//
// SETTLE only separates pick → confirm. TILE_BREATHE is unused: the tile
// stage already holds select for a full poll, so an extra post-tile hold only
// slowed the cycle. Wake margin covers setTimeout jitter on held stages.
const DE_POLL_US = 6500;         // base window (~154 Hz)
const DE_POLL_MIN_US = 4000;     // 250 Hz+ frame poll
const DE_POLL_MAX_US = 20000;    // 50 Hz frame poll
const DE_MARGIN_US = 1000;       // stage-wake jitter on held pulses
const DE_OPEN_FLOOR_US = 8334;   // one 120 Hz poll — edit mode before select
const DE_TILE_FLOOR_US = 8600;   // pick — slightly over 120 Hz so select latches
const DE_CONFIRM_FLOOR_US = 7200;// edit-low rising-edge reopen (~139 Hz)
const DE_STAGE_FLOOR_US = DE_OPEN_FLOOR_US; // exported alias / legacy name
const DE_OPEN_US = DE_OPEN_FLOOR_US;
const DE_TILE_US = DE_TILE_FLOOR_US;
const DE_SETTLE_US = 300;
const DE_CONFIRM_MIN_US = 1;
const DE_TILE_BREATHE_US = 0;    // tile stage already owns the select latch
// Qualified output reports required before a stage may advance (clock jumps).
// Wall clock is the guarantee; these only stop a stage advancing on a pump
// that re-processes the same microsecond. Anything higher stalls short stages
// on a report-starved PC, which is what made picks land late and unevenly.
const DE_TILE_MIN_REPORTS = 2;
const DE_OPEN_MIN_REPORTS = 2;
const DE_SETTLE_MIN_REPORTS = 1;

// Drag: edit is held continuously, then select joins. Select must never ride
// the same ViGEm submit as the first edit press — that is what misses tiles.
// 1ms edit-alone is enough for a separate pump + high-Hz game poll.
const DRAG_SELECT_MIN_US = 1000;

// Pick-up: own press/gap — not scaled by the global Press length slider.
// Positive Tap speed = gap between Interact taps. 0 / negative = turbo gap
// (committed Interact-up only — never same-pump re-press).
const PICKUP_PRESS_US = 1000;
const PICKUP_PRESS_FLOOR_US = 1000;
const PICKUP_GAP_MIN_US = 0;

// Shooting: rapid-fire the bound button while held. Floors sit under the 1ms
// ticker so each pump can flip on→off→on — as fast as the output path allows.
const SHOOT_PRESS_US = 1;
const SHOOT_GAP_MIN_US = 1;

// One-shot taps: rising edge → one committed tap, then idle (hold does not spam).
// Speed is NOT from a long hold. It is:
//   1) instant down commit (+ rising-edge clear) on the virtual pad
//   2) at least ONESHOT_MIN_REPORTS qualified downs so ViGEm sees the edge
//   3) release when the wall-clock floor is due (follow-up / ticker)
//
// Reset / Pickaxe / Build default to turbo 0.0 ms (1µs in the slider).
// A short hidden visibility window (below) + main.js commit wakes keep
// pull-out consistent without a fat press-length slider. Triggers are only
// consumed while the synthetic tap is live; after that the physical bind
// passes through so holding Build still works.
const PULLOUT_PRESS_MIN_US = 1;
const BUILD_PRESS_MIN_US = 1;
// Turbo still latches this long so Fortnite can poll the down (slider stays 0.0).
// Must outlast one 60Hz poll (16.7ms) for Build/Pickaxe. Reset uses a shorter
// visibility window so pull-out feels snappier.
const PULLOUT_VISIBLE_US = 20000;
const RESET_VISIBLE_US = 8334; // one 120 Hz poll
const ONESHOT_PRESS_MIN_US = PULLOUT_PRESS_MIN_US;
// Enough ViGEm downs for the game to see the edge — wall-clock floor still
// owns the length (do not raise floors / change speed).
const ONESHOT_MIN_REPORTS = 2;
const ONESHOT_KEYS = ['reset', 'pickaxe', 'build'];
const PULLOUT_KEYS = ['reset', 'pickaxe', 'build'];
// Old fat pull-out defaults → turbo 0.0 ms.
const LEGACY_PULLOUT_US = new Set([2000, 5000, 8334, 16668]);
const LEGACY_BUILD_US = new Set([2000, 5000, 8334, 16668]);
// 1µs is the turbo UI default (0.0 ms) — do not treat it as legacy.
const LEGACY_DRAG_US = new Set([2000, 1000, 8334]);

// Legacy reset stage exports (reset is now a plain one-shot tap).
const RESET_OPEN_US = 0;
const RESET_PULSE_US = ONESHOT_PRESS_MIN_US;
const RESET_SETTLE_US = 0;
const RESET_CONFIRM_MIN_US = ONESHOT_PRESS_MIN_US;
const RESET_OPEN_MIN_REPORTS = 1;
const RESET_PULSE_MIN_REPORTS = 2;
const RESET_SETTLE_MIN_REPORTS = 1;

// Extra physical buttons (Edge paddles/Fn, Xbox Elite / 6-paddle pads).
// ViGEm has no paddle slots, so these remap onto standard 0–17 buttons.
const BTN_PADDLE_L1 = 18;
const BTN_PADDLE_R1 = 19;
const BTN_PADDLE_L2 = 20;
const BTN_PADDLE_R2 = 21;
const BTN_PADDLE_L3 = 22; // L5 / P5 on 6-paddle controllers
const BTN_PADDLE_R3 = 23; // R5 / P6 on 6-paddle controllers
const BUTTON_COUNT = 24;
const PADDLE_INDEXES = [
  BTN_PADDLE_L1, BTN_PADDLE_R1, BTN_PADDLE_L2, BTN_PADDLE_R2, BTN_PADDLE_L3, BTN_PADDLE_R3,
];

// Production XInput bitmask -> standard Gamepad API index
const XINPUT_TO_INDEX = {
  4096: 0, 8192: 1, 16384: 2, 32768: 3,
  256: 4, 512: 5, 65536: 6, 131072: 7,
  32: 8, 16: 9, 64: 10, 128: 11,
  1: 12, 2: 13, 4: 14, 8: 15,
  1024: 16, 262144: 17,
};

const DEFAULTS = {
  binds: {
    edit: XINPUT_TO_INDEX[128],      // R3
    select: XINPUT_TO_INDEX[131072], // RT / R2 — tile select while editing
    shoot: XINPUT_TO_INDEX[131072],  // RT / R2 — gun fire (Shooting macro)
    use: XINPUT_TO_INDEX[16384],     // X / Square
    reset: XINPUT_TO_INDEX[8192],    // B / Circle — Fortnite reset edit
    pickaxe: XINPUT_TO_INDEX[32768], // Y / Triangle — harvesting tool
    build: XINPUT_TO_INDEX[1],       // D-pad Up — wall / pull out builds
    floor: XINPUT_TO_INDEX[4],       // D-pad Left — floor piece
    cone: XINPUT_TO_INDEX[8],        // D-pad Right — cone / pyramid
    ramp: XINPUT_TO_INDEX[2],        // D-pad Down — ramp / stairs
    sprint: XINPUT_TO_INDEX[64],     // L3 — sprint
  },
  // Unassigned paddles still reach the game as real buttons (ViGEm has no
  // paddle slots). Defaults: left paddle → D-pad Up, right paddle → R1.
  paddles: {
    [BTN_PADDLE_L1]: 12, // → D-pad Up
    [BTN_PADDLE_R1]: 5,  // → R1 / RB
    [BTN_PADDLE_L2]: null,
    [BTN_PADDLE_R2]: null,
    [BTN_PADDLE_L3]: null,
    [BTN_PADDLE_R3]: null,
  },
  timing: { pressUs: DEFAULT_PRESS_US },
  pickup: { enabled: true, trigger: XINPUT_TO_INDEX[512], tapDelayUs: 0 },
  // Trigger defaults to a paddle so holding R2 for edit-select does not turbo.
  shooting: { enabled: false, trigger: BTN_PADDLE_L1, tapDelayUs: SHOOT_GAP_MIN_US },
  doubleEdit: {
    enabled: false,
    trigger: XINPUT_TO_INDEX[65536],
    tapDelayUs: DE_CONFIRM_MIN_US,
    pollUs: DE_POLL_US,
  },
  // UI shows 0.0 ms; dragDelayFloorUs() still enforces edit-alone before select.
  drag: { enabled: true, trigger: XINPUT_TO_INDEX[128], dragDelayUs: 1 },
  reset: { enabled: true, trigger: XINPUT_TO_INDEX[256], tapDelayUs: PULLOUT_PRESS_MIN_US },
  pickaxe: { enabled: false, trigger: XINPUT_TO_INDEX[2], tapDelayUs: PULLOUT_PRESS_MIN_US },
  build: { enabled: false, trigger: XINPUT_TO_INDEX[8], tapDelayUs: BUILD_PRESS_MIN_US },
};

const MACRO_KEYS = ['pickup', 'shooting', 'doubleEdit', 'drag', 'reset', 'pickaxe', 'build'];

const emitter = new EventEmitter();

const config = {
  binds: { ...DEFAULTS.binds },
  paddles: { ...DEFAULTS.paddles },
  timing: { ...DEFAULTS.timing },
  pickup: { ...DEFAULTS.pickup },
  shooting: { ...DEFAULTS.shooting },
  doubleEdit: { ...DEFAULTS.doubleEdit },
  drag: { ...DEFAULTS.drag },
  reset: { ...DEFAULTS.reset },
  pickaxe: { ...DEFAULTS.pickaxe },
  build: { ...DEFAULTS.build },
};

function oneShotState() {
  return {
    stage: 'idle',
    dueUs: 0,
    cycles: 0,
    triggerLatched: false,
    stageReports: 0,
    stageArmedUs: null,
    edgeReady: true,
    // True on the report that completed the tap — must reach ViGEm as a
    // release even when the physical bind / paddle remap still wants it down.
    justReleased: false,
    // Set only when the game bind itself was still held as the synthetic tap
    // ended — eat that button until the finger lifts so a still-down finger
    // cannot fire a 2nd rising edge (gun skip / build toggle).
    blockBindUntilUp: false,
  };
}

const state = {
  pickup: { stage: 'idle', dueUs: 0, cycles: 0, triggerLatched: false },
  shooting: { stage: 'idle', dueUs: 0, cycles: 0, triggerLatched: false },
  doubleEdit: {
    stage: 'idle',
    dueUs: 0,
    cycles: 0,
    triggerLatched: false,
    stageReports: 0,
    stageArmedUs: null,
    breatheUntilUs: 0,
  },
  drag: {
    stage: 'idle',
    dueUs: 0,
    cycles: 0,
    triggerLatched: false,
    sawEditAlone: false,
    editAloneEmitted: false,
    justEditAlone: false,
  },
  reset: oneShotState(),
  pickaxe: oneShotState(),
  build: oneShotState(),
  // Edge firmware often injects a face/dpad bind on the same report as a paddle.
  // Track those injects so remap can suppress jump/etc. while the paddle is held.
  paddlePrevHeld: Object.fromEntries(PADDLE_INDEXES.map((i) => [i, false])),
  paddleInject: Object.fromEntries(PADDLE_INDEXES.map((i) => [i, []])),
  prevButtons: null,
};

function nowUs() {
  const [s, ns] = process.hrtime();
  return s * 1e6 + ns / 1e3;
}

// How long a synthetic press is held. Purely the press floor — the per-macro
// delay is the gap between presses, and letting it stretch the press too made
// every macro slower the moment you widened the gap.
function pressUs() {
  return config.timing.pressUs;
}

// Gap between spam presses. Do not clamp to Press length — that made every
// turbo gap as slow as the press slider and killed "0 ms" speed.
function gapUs(delay) {
  return Math.max(Number(delay) || 0, 1);
}

function isDown(report, index) {
  if (!report || !Number.isFinite(index)) return false;
  return Number(report.buttons?.[index] || 0) >= BTN_DOWN;
}

// Hysteresis so analog triggers do not cancel a macro mid-cycle.
function isTriggerHeld(key, input) {
  const cfg = config[key];
  const st = state[key];
  if (!(cfg.enabled && Number.isFinite(cfg.trigger))) {
    st.triggerLatched = false;
    return false;
  }
  const raw = Number(input.buttons?.[cfg.trigger] || 0);
  if (st.triggerLatched) {
    if (raw < TRIGGER_OFF) st.triggerLatched = false;
  } else if (raw >= TRIGGER_ON) {
    st.triggerLatched = true;
  }
  return st.triggerLatched;
}

function emit(key) {
  emitter.emit('status', {
    key,
    enabled: config[key].enabled,
    stage: state[key].stage,
    running: state[key].stage !== 'idle',
    cycles: state[key].cycles,
  });
}

/* ---- Square-wave one button while the trigger is held ---- */
function stepSpam(key, button, input, out, us) {
  const cfg = config[key];
  const st = state[key];

  if (!isTriggerHeld(key, input)) {
    if (st.stage !== 'idle') {
      st.stage = 'idle';
      emit(key);
    }
    return;
  }

  if (st.stage === 'idle') {
    st.stage = 'tapDown';
    st.dueUs = us;
    emit(key);
  }

  if (us >= st.dueUs) {
    if (st.stage === 'tapDown') {
      st.stage = 'tapUp';
      st.dueUs = us + pressUs();
    } else {
      st.stage = 'tapDown';
      st.dueUs = us + gapUs(cfg.tapDelayUs);
      st.cycles += 1;
    }
  }

  if (st.stage === 'tapUp') out.buttons[button] = 1;
}

/* ---- Pick-up: spam Interact with locked press/gap (ignores Press length) ---- */
function pickupPressUs(cfg) {
  // Always keep a full pickup press — negative Tap speed only removes gap time.
  // Thinning under ~2ms made -5.0 ms feel dead in-game.
  return PICKUP_PRESS_US;
}

function pickupGapUs(cfg) {
  const pace = Number(cfg.tapDelayUs);
  // 0 and negative = turbo: no timed gap, just a committed Interact-up report.
  if (!Number.isFinite(pace) || pace <= 0) return 0;
  return pace;
}

function stepPickup(input, out, us) {
  const cfg = config.pickup;
  const st = state.pickup;
  const button = config.binds.use;

  if (!Number.isFinite(button)) {
    if (st.stage !== 'idle') {
      st.stage = 'idle';
      emit('pickup');
    }
    return;
  }

  if (!isTriggerHeld('pickup', input)) {
    if (st.stage !== 'idle') {
      st.stage = 'idle';
      emit('pickup');
    }
    return;
  }

  if (st.stage === 'idle') {
    st.stage = 'tapDown';
    st.dueUs = us;
    emit('pickup');
  }

  if (us >= st.dueUs) {
    if (st.stage === 'tapDown') {
      st.stage = 'tapUp';
      st.dueUs = us + pickupPressUs(cfg);
    } else {
      st.stage = 'tapDown';
      st.dueUs = us + pickupGapUs(cfg);
      st.cycles += 1;
    }
  }

  if (st.stage === 'tapUp') out.buttons[button] = 1;
}

function isPickupRunning() {
  return state.pickup.stage !== 'idle';
}

/** µs until the next pickup press/release boundary, or null if idle. */
function pickupWaitUs() {
  const st = state.pickup;
  if (!config.pickup.enabled || st.stage === 'idle') return null;
  if (!st.dueUs) return 1000;
  return Math.max(0, st.dueUs - nowUs());
}

function pickupWaitMs() {
  const waitUs = pickupWaitUs();
  if (waitUs == null) return null;
  // Sub-ms / already-due → 0 so main can wake on the next macrotask after the
  // Interact-up report has been committed (never same-pump re-press).
  return Math.max(0, Math.ceil(waitUs / 1000));
}

/* ---- Shooting: rapid-fire binds.shoot while the trigger is held ---- */
//
// Guns only — never runs while editing (Double Edit / Drag / edit held) so it
// cannot turbo the Select/fire bind in the middle of a tile pick.
function isEditingBusy(input) {
  if (state.doubleEdit.stage !== 'idle') return true;
  if (state.drag.stage !== 'idle') return true;
  if (config.doubleEdit.enabled && isTriggerHeld('doubleEdit', input)) return true;
  if (config.drag.enabled && isTriggerHeld('drag', input)) return true;
  const edit = config.binds.edit;
  if (Number.isFinite(edit) && Number(input.buttons?.[edit] || 0) >= BTN_DOWN) return true;
  return false;
}

function stepShooting(input, out, us) {
  const cfg = config.shooting;
  const st = state.shooting;
  const button = config.binds.shoot;

  const stop = () => {
    if (st.stage !== 'idle') {
      st.stage = 'idle';
      emit('shooting');
    }
  };

  if (!Number.isFinite(button)) {
    stop();
    return;
  }

  // Editing wins — release any in-flight turbo so Select stays clean.
  if (isEditingBusy(input)) {
    stop();
    return;
  }

  if (!isTriggerHeld('shooting', input)) {
    stop();
    return;
  }

  if (st.stage === 'idle') {
    st.stage = 'tapDown';
    st.dueUs = us;
    emit('shooting');
  }

  if (us >= st.dueUs) {
    if (st.stage === 'tapDown') {
      st.stage = 'tapUp';
      st.dueUs = us + SHOOT_PRESS_US;
    } else {
      st.stage = 'tapDown';
      st.dueUs = us + Math.max(cfg.tapDelayUs || 0, SHOOT_GAP_MIN_US);
      st.cycles += 1;
    }
  }

  if (st.stage === 'tapUp') out.buttons[button] = 1;
}

/* ---- Double Edit: one bind → spam open / pick / confirm ---- */
//
// Hold the trigger and the engine repeats a full single-tile edit:
//
//   open    — edit down   (enter edit mode)
//   tile    — select down (pick; locked fat so tiles latch)
//   settle  — select up   (latch pick while still in edit)
//   confirm — both up     (Between edits slider only; never thins the pick)
//
// Stage clocks only run while the intended wire state is painted. When a
// stage completes, this report keeps that paint — the next stage arms on the
// following pump so the pick / open / settle pulses are never cut short.
const EDIT_CYCLE = ['open', 'tile', 'settle', 'confirm'];
const EDIT_HELD = new Set(['open', 'tile', 'settle']);

/**
 * One game poll, as set by the Pick window slider. Lower = faster cycle, and
 * safe as long as it still covers the player's frame time.
 */
function dePollUs(cfg) {
  const n = Number(cfg?.pollUs);
  if (!Number.isFinite(n) || n <= 0) return DE_POLL_US;
  return Math.min(DE_POLL_MAX_US, Math.max(DE_POLL_MIN_US, n));
}

function editStageUs(stage, cfg) {
  const paced = dePollUs(cfg) + DE_MARGIN_US;
  switch (stage) {
    case 'open':
      // Must be in edit mode before select joins — keep a full 120 Hz poll.
      return Math.max(paced, DE_OPEN_FLOOR_US);
    case 'tile':
      // Select latch is the miss-critical edge — fattest stage on purpose.
      return Math.max(paced, DE_TILE_FLOOR_US);
    case 'settle':
      return DE_SETTLE_US;
    case 'confirm': {
      // Between edits may lengthen. Edit-low only needs a clean rising edge
      // into the next open — not a second full 120 Hz wake margin.
      const pace = Number(cfg.tapDelayUs) || 0;
      return Math.max(pace, DE_CONFIRM_FLOOR_US, DE_CONFIRM_MIN_US);
    }
    default:
      return DE_SETTLE_US;
  }
}

function deMinReports(stage) {
  if (stage === 'tile') return DE_TILE_MIN_REPORTS;
  if (stage === 'open') return DE_OPEN_MIN_REPORTS;
  if (stage === 'settle') return DE_SETTLE_MIN_REPORTS;
  return 1;
}

function deResetStageClock(st) {
  st.stageReports = 0;
  st.stageArmedUs = null;
  st.dueUs = 0;
}

function deAdvance(st, cfg, us) {
  const prev = st.stage;
  const next = (EDIT_CYCLE.indexOf(st.stage) + 1) % EDIT_CYCLE.length;
  st.stage = EDIT_CYCLE[next];
  deResetStageClock(st);
  // After a tile pick, keep select held briefly so the game can sample it
  // before settle clears select — without stretching the rest of the cycle.
  st.breatheUntilUs = prev === 'tile' ? us + DE_TILE_BREATHE_US : 0;
  if (next === 0) st.cycles += 1;
  emit('doubleEdit');
}

function dePaint(st, out, edit, select) {
  // Force both binds every stage so physical R2/L3 cannot leak into the pulse.
  if (EDIT_HELD.has(st.stage)) out.buttons[edit] = 1;
  else if (st.stage === 'confirm') out.buttons[edit] = 0;

  if (st.stage === 'tile') out.buttons[select] = 1;
  else if (st.stage !== 'idle') out.buttons[select] = 0;
}

function deWireOk(st, out, edit, select) {
  const editOn = Number(out.buttons[edit] || 0) >= BTN_DOWN;
  const selectOn = Number(out.buttons[select] || 0) >= BTN_DOWN;
  switch (st.stage) {
    case 'open':
    case 'settle':
      return editOn && !selectOn;
    case 'tile':
      return editOn && selectOn;
    case 'confirm':
      return !editOn && !selectOn;
    default:
      return false;
  }
}

function stepDoubleEdit(input, out, us) {
  const cfg = config.doubleEdit;
  const st = state.doubleEdit;
  const { edit, select } = config.binds;

  if (!Number.isFinite(edit) || !Number.isFinite(select)) {
    if (st.stage !== 'idle') {
      st.stage = 'idle';
      deResetStageClock(st);
      st.breatheUntilUs = 0;
      emit('doubleEdit');
    }
    return;
  }

  if (!isTriggerHeld('doubleEdit', input)) {
    if (st.stage !== 'idle') {
      st.stage = 'idle';
      deResetStageClock(st);
      st.breatheUntilUs = 0;
      emit('doubleEdit');
    }
    return;
  }

  if (st.stage === 'idle') {
    [st.stage] = EDIT_CYCLE;
    deResetStageClock(st);
    st.breatheUntilUs = 0;
    emit('doubleEdit');
  }

  // Post-tile breathe: keep edit+select on the wire so the pick clears a poll
  // before settle lifts select. Do not arm the settle clock yet.
  if (st.stage === 'settle' && st.breatheUntilUs && us < st.breatheUntilUs) {
    out.buttons[edit] = 1;
    out.buttons[select] = 1;
    return;
  }
  if (st.breatheUntilUs && us >= st.breatheUntilUs) st.breatheUntilUs = 0;

  dePaint(st, out, edit, select);

  if (!deWireOk(st, out, edit, select)) {
    // Re-assert paint. Never wipe stage progress — restarting the tile clock
    // on one bad frame (paddle remap race) starved picks for some players.
    dePaint(st, out, edit, select);
    if (!deWireOk(st, out, edit, select)) return;
  }

  st.stageReports = (st.stageReports || 0) + 1;
  if (st.stageArmedUs == null) {
    st.stageArmedUs = us;
    st.dueUs = us + editStageUs(st.stage, cfg);
  }

  // Wall clock is the real guarantee; the report count only stops a stage from
  // advancing on a pump that double-processes the same microsecond. On a
  // report-starved PC (low-Hz pad, throttled timers) the count can never be
  // met, so once the pulse has lasted well past its floor, let it advance —
  // that stall is what made tiles go missing for other players.
  const stageUs = editStageUs(st.stage, cfg);
  const heldUs = us - st.stageArmedUs;
  const qualified = st.stageReports >= deMinReports(st.stage) || heldUs >= stageUs * 2;
  if (us >= st.dueUs && qualified) {
    // Advance the stage machine, but keep THIS report painted as the stage
    // that just completed so its full pulse reaches ViGEm / the game.
    deAdvance(st, cfg, us);
  }
}

/* ---- One-shot tap: one press → one committed tap of a game bind ---- */
//
// Used by reset / pickaxe / build. Rising edge fires a single tap, then stops.
// Holding does not spam. Releasing early still finishes the press so a quick
// tap lands. Speed is in the pump path (instant down + release when due).
//
// Reset intentionally does NOT touch Edit — only binds.reset.
function oneShotClear(st) {
  st.stageReports = 0;
  st.stageArmedUs = null;
  st.dueUs = 0;
  // justReleased is set by the release path; do not clear it here.
}

/** Global Press length — master cap for Reset / Pickaxe / Build / Drag taps. */
function pressCapUs() {
  const n = Number(config.timing?.pressUs);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_PRESS_US;
}

function oneShotFloorUs(key, cfg) {
  const floor = key === 'build'
    ? BUILD_PRESS_MIN_US
    : (PULLOUT_KEYS.includes(key) ? PULLOUT_PRESS_MIN_US : ONESHOT_PRESS_MIN_US);
  const requested = Math.max(Number(cfg.tapDelayUs) || 0, floor);
  if (!PULLOUT_KEYS.includes(key)) return requested;
  // Press length may lengthen a pull-out; it must never thin under the floor
  // (0.0ms global Press length used to collapse taps to 1µs and kill the bind).
  const cap = pressCapUs();
  let out = cap > floor
    ? Math.min(Math.max(requested, floor), cap)
    : Math.max(requested, floor);
  // Slider can read 0.0 ms; still hold a short visible window for the game poll.
  const visible = key === 'reset' ? RESET_VISIBLE_US : PULLOUT_VISIBLE_US;
  if (out < visible) out = visible;
  return out;
}

function dragDelayFloorUs(cfg) {
  // Never cap by global Press length — that collapsed the edit-alone gap to
  // 1µs when Press length was turbo and made Drag miss every tile.
  return Math.max(Number(cfg.dragDelayUs) || 0, DRAG_SELECT_MIN_US);
}

function stepOneShotTap(key, bindIndex, input, out, us) {
  const cfg = config[key];
  const st = state[key];

  if (!Number.isFinite(bindIndex)) {
    if (st.stage !== 'idle') {
      st.stage = 'idle';
      oneShotClear(st);
      st.justReleased = false;
      st.blockBindUntilUp = false;
      st.edgeReady = true;
      emit(key);
    }
    return;
  }

  const physicalBindDown = Number(input.buttons?.[bindIndex] || 0) >= BTN_DOWN;
  const held = isTriggerHeld(key, input);

  // Synthetic tap finished while the player still had the game bind itself
  // down — keep eating that one button until the finger lifts so the game does
  // not read a second rising edge (build toggles shut, weapon slot skips).
  // A trigger parked on some *other* button is handled by edgeReady alone:
  // gagging the bind for the whole trigger hold is what ate real D-pad presses
  // (hold cone, roll to wall → the wall never came out).
  if (st.blockBindUntilUp) {
    if (physicalBindDown) out.buttons[bindIndex] = 0;
    else st.blockBindUntilUp = false;
  }
  if (!held) st.edgeReady = true;
  if (st.blockBindUntilUp) return;

  if (st.stage === 'idle') {
    if (!held) {
      st.edgeReady = true;
      return;
    }
    if (!st.edgeReady) return;
    st.edgeReady = false;
    st.stage = 'down';
    st.justReleased = false;
    st.blockBindUntilUp = false;
    oneShotClear(st);
    emit(key);
  }

  // Finish the tap even if the trigger was released mid-press.
  out.buttons[bindIndex] = 1;

  st.stageReports = (st.stageReports || 0) + 1;
  const floor = oneShotFloorUs(key, cfg);
  if (st.stageArmedUs == null) {
    st.stageArmedUs = us;
    st.dueUs = us + floor;
  }

  // Wall-clock floor + qualified downs — never release early if the arming
  // pump double-processes faster than a game poll.
  const heldUs = us - st.stageArmedUs;
  if (us >= st.dueUs && heldUs >= floor && st.stageReports >= ONESHOT_MIN_REPORTS) {
    st.stage = 'idle';
    oneShotClear(st);
    st.cycles += 1;
    st.justReleased = true;
    out.buttons[bindIndex] = 0;
    // Only the bind itself can hand the game a second rising edge, so only it
    // gets gagged. A trigger still held on another button just has to stop us
    // re-arming until it goes up.
    st.blockBindUntilUp = physicalBindDown;
    st.edgeReady = !physicalBindDown && !held;
    emit(key);
  }
}

function stepReset(input, out, us) {
  stepOneShotTap('reset', config.binds.reset, input, out, us);
}

function stepPickaxe(input, out, us) {
  stepOneShotTap('pickaxe', config.binds.pickaxe, input, out, us);
}

function stepBuild(input, out, us) {
  stepOneShotTap('build', config.binds.build, input, out, us);
}

function oneShotWaitUs(key) {
  const st = state[key];
  if (!config[key]?.enabled || st.stage === 'idle') return null;
  if (!st.dueUs) return 1000;
  return Math.max(0, st.dueUs - nowUs());
}

function oneShotWaitMs(key) {
  const waitUs = oneShotWaitUs(key);
  if (waitUs == null) return null;
  // Pull-outs: never release on the arming macrotask.
  if (PULLOUT_KEYS.includes(key) && waitUs <= 0) return 1;
  return Math.max(0, Math.ceil(waitUs / 1000));
}

/* ---- Drag: hold edit, add select once the delay is up, hold both ---- */
function stepDrag(input, out, us) {
  const cfg = config.drag;
  const st = state.drag;
  const { edit, select } = config.binds;

  if (!isTriggerHeld('drag', input)) {
    if (st.stage !== 'idle') {
      st.stage = 'idle';
      st.sawEditAlone = false;
      st.editAloneEmitted = false;
      st.justEditAlone = false;
      emit('drag');
    }
    return;
  }

  if (st.stage === 'idle') {
    st.stage = 'waiting';
    st.sawEditAlone = false;
    st.editAloneEmitted = false;
    st.justEditAlone = false;
    st.dueUs = Number.POSITIVE_INFINITY;
    emit('drag');
  } else if (st.stage === 'waiting' && st.editAloneEmitted && us >= st.dueUs) {
    // Prior process() already returned edit-alone — join select on this report.
    st.stage = 'dragging';
    st.justEditAlone = false;
    st.cycles += 1;
    emit('drag');
  }

  out.buttons[edit] = 1;
  if (st.stage === 'dragging') {
    out.buttons[select] = 1;
  } else if (st.stage === 'waiting') {
    if (!st.sawEditAlone) {
      // Start the clock only once edit-alone is on this report. Floor keeps a
      // short edit-only window so tiles latch; slider may only lengthen it.
      st.sawEditAlone = true;
      st.justEditAlone = true;
      st.dueUs = us + dragDelayFloorUs(cfg);
    }
    // First waiting report stays edit-only; later pumps join after dueUs.
    st.editAloneEmitted = true;
  }
}

/** True once after edit-alone arms — main re-commits that edge before select. */
function consumeDragJustEditAlone() {
  const st = state.drag;
  if (!config.drag.enabled || !st.justEditAlone) return false;
  st.justEditAlone = false;
  return true;
}

/**
 * Run every macro against one physical report and return what the virtual
 * pad should show.
 */
function shouldConsumeTrigger(key, input) {
  const cfg = config[key];
  if (!cfg?.enabled || !Number.isFinite(cfg.trigger)) return false;
  const st = state[key];
  const running = st.stage !== 'idle';
  const held = isTriggerHeld(key, input);
  // Enabled-but-idle macros must not eat their bind on every report — that is
  // what killed R2/Select while editing when Shooting’s trigger was also R2.
  if (!held && !running) return false;

  // Shooting shares the Select/fire button. While editing, pause turbo and let
  // the physical Select/R2 through so tiles still work.
  if (key === 'shooting' && isEditingBusy(input)) return false;

  // Pull-outs (esp. Build): only suppress the trigger while the synthetic tap
  // is down. After the one-shot ends, pass the physical button through so
  // holding Build (trigger === build bind) still pulls out / keeps build mode.
  // Eating the bind for the whole hold made Build feel dead after one tap.
  if (PULLOUT_KEYS.includes(key)) return running;

  return true;
}

function processReport(input, us = nowUs()) {
  const buttons = (input.buttons || []).slice();
  while (buttons.length < BUTTON_COUNT) buttons.push(0);

  const out = {
    buttons,
    axes: (input.axes || [0, 0, 0, 0]).slice(),
  };
  // PlayStation HID stick bytes pass through untouched so aim sense matches the
  // physical pad. Macros never rewrite sticks — only buttons.
  if (Array.isArray(input.stickBytes) && input.stickBytes.length >= 4) {
    out.stickBytes = [0, 1, 2, 3].map((i) => {
      const raw = input.stickBytes[i];
      if (raw == null || raw === '') return 128;
      const n = Number(raw);
      if (!Number.isFinite(n)) return 128;
      return Math.max(0, Math.min(255, n | 0));
    });
  }

  // A trigger belongs to the macro, not the game — but only while that macro
  // is actually using it. Clearing before the steps run still lets a macro
  // assert the very same button as part of its sequence (drag on edit, etc.).
  MACRO_KEYS.forEach((key) => {
    if (shouldConsumeTrigger(key, input)) out.buttons[config[key].trigger] = 0;
  });

  stepPickup(input, out, us);
  stepShooting(input, out, us);
  stepDoubleEdit(input, out, us);
  stepDrag(input, out, us);
  stepReset(input, out, us);
  stepPickaxe(input, out, us);
  stepBuild(input, out, us);

  // Triggers are consumed before the steps run, but a pull-out arms *inside*
  // its own step, so on that first report the physical trigger was still live.
  // With both on a D-pad that leaves the hat reading a diagonal (trigger +
  // synthetic bind) and the game registers neither. Re-consume now that the
  // tap is known to be down — pull-outs never assert their own trigger.
  PULLOUT_KEYS.forEach((key) => {
    const cfg = config[key];
    if (!cfg.enabled || state[key].stage === 'idle') return;
    const trigger = Number(cfg.trigger);
    if (!Number.isFinite(trigger) || trigger === Number(config.binds[key])) return;
    out.buttons[trigger] = 0;
  });

  // Manual edit (edit held, Double Edit / Drag idle): always pass physical
  // Select through so R2 tile picks work even if a macro trigger shares R2.
  const deIdle = state.doubleEdit.stage === 'idle';
  const dragIdle = state.drag.stage === 'idle';
  const editBtn = config.binds.edit;
  const selectBtn = config.binds.select;
  const manualEdit = deIdle && dragIdle
    && Number.isFinite(editBtn)
    && Number(input.buttons?.[editBtn] || 0) >= BTN_DOWN;
  if (manualEdit && Number.isFinite(selectBtn)) {
    const physicalSelect = Number(input.buttons?.[selectBtn] || 0);
    if (physicalSelect >= BTN_DOWN) {
      out.buttons[selectBtn] = Math.max(Number(out.buttons[selectBtn] || 0), physicalSelect);
    }
  }

  const deSt = state.doubleEdit;
  const deLive = deSt.stage !== 'idle';
  const deEdit = config.binds.edit;
  const deSelect = config.binds.select;
  // After a stage completes we advance but keep that report’s paint. Armed
  // clock is cleared — do not let later remaps / re-paint clobber it.
  const deHoldCompletedPaint = deLive && deSt.stageArmedUs == null && (deSt.stageReports || 0) === 0;

  // Buttons painted by live one-shots / drag must survive paddle D-pad wipes.
  // After a one-shot release, do NOT protect that bind on this report — the
  // release edge must reach the game. Never re-pin Build from physical hold
  // right after release (that was a 2nd rising edge → skip / toggle fail).
  const protectedMacroButtons = new Set();
  const justReleasedBinds = new Set();
  const blockedBinds = new Set();
  ONESHOT_KEYS.forEach((key) => {
    const bind = config.binds?.[key];
    if (!Number.isFinite(bind)) return;
    if (state[key]?.blockBindUntilUp) blockedBinds.add(Number(bind));
    if (state[key]?.justReleased) {
      justReleasedBinds.add(Number(bind));
      return;
    }
    if (state[key]?.stage === 'down') {
      protectedMacroButtons.add(Number(bind));
    }
  });
  if (state.drag.stage === 'waiting' || state.drag.stage === 'dragging') {
    if (Number.isFinite(editBtn)) protectedMacroButtons.add(Number(editBtn));
    if (state.drag.stage === 'dragging' && Number.isFinite(selectBtn)) {
      protectedMacroButtons.add(Number(selectBtn));
    }
  }

  // ViGEm cannot expose paddles — OR any still-held paddle onto its remap
  // target so the game sees a real button. Paddles used as macro triggers are
  // already consumed above and must not also fire their remap.
  const prevButtons = state.prevButtons;
  PADDLE_INDEXES.forEach((src) => {
    const held = Number(input.buttons?.[src] || 0) >= BTN_DOWN;
    const wasHeld = !!state.paddlePrevHeld[src];
    const asTrigger = MACRO_KEYS.some((key) => {
      const cfg = config[key];
      return cfg.enabled && Number(cfg.trigger) === src;
    });

    // Rising edge: remember face/dpad/bumper buttons that also rose — those are
    // almost always DualSense Edge profile injects (e.g. paddle → Cross/jump).
    // A hat direction already down when the paddle landed is stale for the same
    // reason: it cannot share the hat with the paddle's own direction.
    if (held && !wasHeld) {
      const stale = [];
      for (let i = 0; i < 18; i += 1) {
        if (Number(input.buttons?.[i] || 0) < BTN_DOWN) continue;
        const rose = !!prevButtons && Number(prevButtons[i] || 0) < BTN_DOWN;
        if (rose || (i >= 12 && i <= 15)) stale.push(i);
      }
      state.paddleInject[src] = stale;
    } else if (held) {
      // Stale only for as long as it stays down. Once the player lets that
      // button go the next press is theirs — pruning here is what lets weapon
      // slots and build pieces work again during a long paddle hold.
      state.paddleInject[src] = (state.paddleInject[src] || []).filter(
        (i) => Number(input.buttons?.[i] || 0) >= BTN_DOWN,
      );
    } else {
      state.paddleInject[src] = [];
    }
    state.paddlePrevHeld[src] = held;

    let dest = config.paddles?.[src];
    // If this paddle IS the Sprint game bind, force remap to Sprint's intended
    // face button when paddles[] was left empty / wrongly set to jump (Cross).
    const sprintBind = config.binds.sprint;
    if (Number(src) === Number(sprintBind) && Number.isFinite(sprintBind) && sprintBind >= 18) {
      // Sprint assigned directly to this paddle — prefer explicit paddle map,
      // never Edit, never a stale Cross/jump inject target.
      if (!Number.isFinite(dest) || Number(dest) === Number(deEdit) || Number(dest) === 0) {
        dest = null;
      }
    }

    // Suppress Edge firmware injects only when this paddle is actually doing
    // something (remap or macro trigger). Eating Cross/D-pad while an unmapped
    // paddle was merely touched broke menu confirm and gun/D-pad taps.
    if (held && (asTrigger || Number.isFinite(dest))) {
      (state.paddleInject[src] || []).forEach((i) => {
        if (Number(i) === Number(dest)) return;
        if (protectedMacroButtons.has(Number(i))) return;
        out.buttons[i] = 0;
      });
    }

    if (held && !asTrigger && Number.isFinite(dest) && dest >= 0 && dest < 18) {
      // While Double Edit owns edit/select, paddles must not force those binds
      // (e.g. paddle→R2 would pin select down through settle and miss tiles).
      if (deLive && (dest === deEdit || dest === deSelect)) {
        out.buttons[src] = 0;
        return;
      }
      // Stale profile directions are already suppressed above. Anything else
      // on the hat was pressed *after* the paddle went down, so it is the
      // player's own weapon slot / build piece and wins — blending both into a
      // diagonal, or wiping the hat every report the way this used to, is what
      // made D-pad presses vanish for the whole paddle hold.
      if (dest >= 12 && dest <= 15) {
        const freshHat = [12, 13, 14, 15].some((i) => (
          i !== dest
          && !(state.paddleInject[src] || []).includes(i)
          && Number(input.buttons?.[i] || 0) >= BTN_DOWN
        ));
        if (freshHat) {
          out.buttons[src] = 0;
          return;
        }
      }
      out.buttons[dest] = Math.max(Number(out.buttons[dest] || 0), 1);
    }
    out.buttons[src] = 0;
  });
  state.prevButtons = (input.buttons || []).slice();

  if (deLive && Number.isFinite(deEdit) && Number.isFinite(deSelect)) {
    if (deHoldCompletedPaint) {
      // Completing report still carries the finished stage’s pulse — re-pin
      // edit/select after paddle remaps so nothing can erase a tile latch.
      if (Number(out.buttons[deEdit] || 0) >= BTN_DOWN) out.buttons[deEdit] = 1;
      if (Number(out.buttons[deSelect] || 0) >= BTN_DOWN) out.buttons[deSelect] = 1;
    } else {
      dePaint(deSt, out, deEdit, deSelect);
    }
  }

  // Re-pin live one-shot / drag paints after paddle remaps (same reason as DE).
  protectedMacroButtons.forEach((bind) => {
    out.buttons[bind] = 1;
  });
  // A hat reports one direction at a time — ViGEm folds buttons 12–15 into
  // dpadHorz/dpadVert. While a one-shot paints a D-pad bind, drop the other
  // three so the press cannot reach the game as an unreadable diagonal.
  ONESHOT_KEYS.forEach((key) => {
    if (!config[key]?.enabled || state[key]?.stage !== 'down') return;
    const bind = Number(config.binds?.[key]);
    if (!(bind >= 12 && bind <= 15)) return;
    for (let i = 12; i <= 15; i += 1) {
      if (i !== bind) out.buttons[i] = 0;
    }
  });
  // Release edges win over paddle remaps / hold-through on this report only.
  justReleasedBinds.forEach((bind) => {
    out.buttons[bind] = 0;
  });
  // Keep eating blocked binds after the synthetic tap (finger still down).
  blockedBinds.forEach((bind) => {
    out.buttons[bind] = 0;
  });
  ONESHOT_KEYS.forEach((key) => {
    if (state[key]) state[key].justReleased = false;
  });

  return out;
}

function anyRunning() {
  // Only real macros — paddlePrevHeld / paddleInject / prevButtons are not stages.
  return MACRO_KEYS.some((key) => state[key]?.stage !== 'idle');
}

/**
 * True only when this report (or leftover latch) actually needs the macro
 * engine. "Any macro enabled in config" used to force ~1000 DualSense pumps
 * through process() while just looking — that alone cost major in-game FPS.
 * Paddle remaps are gated separately in pump via paddleNeeded.
 */
function needsProcess(input) {
  if (anyRunning()) return true;
  for (let i = 0; i < ONESHOT_KEYS.length; i += 1) {
    if (state[ONESHOT_KEYS[i]]?.blockBindUntilUp) return true;
  }
  for (let i = 0; i < MACRO_KEYS.length; i += 1) {
    const key = MACRO_KEYS[i];
    const cfg = config[key];
    if (!cfg?.enabled) continue;
    if (state[key]?.triggerLatched) return true;
    if (!input || !Number.isFinite(cfg.trigger)) continue;
    if (Number(input.buttons?.[cfg.trigger] || 0) >= BTN_DOWN) return true;
  }
  return false;
}

/** Ms until drag may join select, or null if no follow-up is needed. */
function dragSelectWaitMs() {
  const st = state.drag;
  if (!config.drag.enabled || st.stage !== 'waiting' || !st.sawEditAlone) return null;
  if (!Number.isFinite(st.dueUs)) return null;
  const waitUs = Math.max(0, st.dueUs - nowUs());
  // Keep at least 1ms so select never joins on the arming macrotask.
  if (waitUs <= 0) return 1;
  return Math.max(1, Math.ceil(waitUs / 1000));
}

/** Ms until the next Double Edit stage boundary, or null if idle. */
function doubleEditWaitMs() {
  const waitUs = doubleEditWaitUs();
  if (waitUs == null) return null;
  return Math.max(0, Math.ceil(waitUs / 1000));
}

/** µs until the next Double Edit stage boundary, or null if idle. */
function doubleEditWaitUs() {
  const st = state.doubleEdit;
  if (!config.doubleEdit.enabled || st.stage === 'idle') return null;
  if (st.breatheUntilUs && st.stage === 'settle') {
    return Math.max(0, st.breatheUntilUs - nowUs());
  }
  if (!st.dueUs) return 1000; // not armed yet — wake on the next ticker beat
  return Math.max(0, st.dueUs - nowUs());
}

function isDoubleEditRunning() {
  return state.doubleEdit.stage !== 'idle';
}

/**
 * True right after a stage advances (clock reset, next stage not painted yet).
 * Main double-applies so the next stage starts immediately without a 1ms wait —
 * except settle after a tile pick, which must not replace select on the same
 * millisecond or the game can miss the latch.
 */
function isDoubleEditNeedsNextStage() {
  const st = state.doubleEdit;
  if (!(config.doubleEdit.enabled
    && st.stage !== 'idle'
    && st.stageArmedUs == null
    && st.dueUs === 0)) {
    return false;
  }
  // Let the completed tile (edit+select) report breathe before settle.
  if (st.stage === 'settle') return false;
  return true;
}


function resetWaitMs() {
  return oneShotWaitMs('reset');
}

function resetWaitUs() {
  return oneShotWaitUs('reset');
}

function isResetRunning() {
  return state.reset.stage !== 'idle';
}

function isShootingRunning() {
  return state.shooting.stage !== 'idle';
}

function isDragRunning() {
  return state.drag.stage !== 'idle';
}

/** True after an edit-alone report was emitted and select has not joined yet. */
function isDragPendingSelect() {
  const st = state.drag;
  return config.drag.enabled && st.stage === 'waiting' && st.editAloneEmitted;
}

function pickaxeWaitMs() {
  return oneShotWaitMs('pickaxe');
}

function buildWaitMs() {
  return oneShotWaitMs('build');
}

function isPickaxeRunning() {
  return state.pickaxe.stage !== 'idle';
}

function isBuildRunning() {
  return state.build.stage !== 'idle';
}

/** True on the first down report of a one-shot — main re-commits the edge. */
function isOneShotJustArmed(key) {
  const st = state[key];
  return !!(config[key]?.enabled && st?.stage === 'down' && (st.stageReports || 0) === 1);
}

/** True when any reset/pickaxe/build tap just armed this report. */
function anyOneShotJustArmed() {
  return ONESHOT_KEYS.some((key) => isOneShotJustArmed(key));
}

/** True when a one-shot press floor is due and should release now. */
function isOneShotReleaseDue(key) {
  if (!config[key]?.enabled || state[key]?.stage === 'idle') return false;
  const waitUs = oneShotWaitUs(key);
  if (waitUs == null) return false;
  const st = state[key];
  const floor = oneShotFloorUs(key, config[key]);
  const heldUs = st.stageArmedUs != null ? (nowUs() - st.stageArmedUs) : 0;
  return waitUs <= 0 && heldUs >= floor && (st.stageReports || 0) >= ONESHOT_MIN_REPORTS;
}

function anyOneShotReleaseDue() {
  return ONESHOT_KEYS.some((key) => isOneShotReleaseDue(key));
}

/** @deprecated use isOneShotJustArmed('build') */
function isBuildJustArmed() {
  return isOneShotJustArmed('build');
}

function setEnabled(key, on) {
  if (!config[key]) return;
  config[key].enabled = !!on;
  // Always reset when turning off — even if already idle. Leaving edgeReady
  // false after a completed hold blocked the next Build/Drag arm until the
  // physical button was released (looked like pull-out / drag "not working").
  if (!on) {
    state[key].stage = 'idle';
    state[key].triggerLatched = false;
    if (state[key].stageReports != null) state[key].stageReports = 0;
    if (state[key].stageArmedUs !== undefined) state[key].stageArmedUs = null;
    if (state[key].edgeReady !== undefined) state[key].edgeReady = true;
    if (state[key].justReleased != null) state[key].justReleased = false;
    if (state[key].blockBindUntilUp != null) state[key].blockBindUntilUp = false;
    if (state[key].sawEditAlone != null) state[key].sawEditAlone = false;
    if (state[key].editAloneEmitted != null) state[key].editAloneEmitted = false;
    if (state[key].justEditAlone != null) state[key].justEditAlone = false;
  }
  emit(key);
}

function updateMacro(key, partial) {
  if (!config[key] || !partial) return;
  Object.entries(partial).forEach(([k, v]) => {
    if (k === 'enabled') {
      setEnabled(key, v);
      return;
    }
    if (Number.isFinite(Number(v))) config[key][k] = Number(v);
  });
}

function updateGroup(group, partial) {
  if (!partial) return;
  Object.entries(partial).forEach(([k, v]) => {
    if (!(k in config[group])) return;
    if (v === null) {
      config[group][k] = null;
      return;
    }
    if (Number.isFinite(Number(v))) config[group][k] = Number(v);
  });
}

function applyConfig(next = {}) {
  if (next.binds) updateGroup('binds', next.binds);
  if (next.paddles) updateGroup('paddles', next.paddles);
  if (next.timing) {
    const timing = { ...next.timing };
    // Legacy Press length floors (0.1ms / 10ms) → turbo 1µs.
    if (Number(timing.pressUs) === 100 || Number(timing.pressUs) === 10000) {
      timing.pressUs = DEFAULT_PRESS_US;
    }
    updateGroup('timing', timing);
  }
  MACRO_KEYS.forEach((key) => {
    if (!next[key]) return;
    let partial = next[key];
    // Snap legacy / sub-floor pull-out timings onto the current 5ms floor.
    if (PULLOUT_KEYS.includes(key)) {
      const n = Number(partial.tapDelayUs);
      const floor = key === 'build' ? BUILD_PRESS_MIN_US : PULLOUT_PRESS_MIN_US;
      const legacy = key === 'build' ? LEGACY_BUILD_US : LEGACY_PULLOUT_US;
      // Snap thin / legacy Build 5ms saves up to the poll-safe floor so older
      // configs stop missing pull-out on 60Hz game polls.
      if (!Number.isFinite(n) || n < floor || legacy.has(n)) {
        partial = { ...partial, tapDelayUs: floor };
      }
    }
    if (key === 'drag' && LEGACY_DRAG_US.has(Number(partial.dragDelayUs))) {
      partial = { ...partial, dragDelayUs: DRAG_SELECT_MIN_US };
    }
    // Keep Double Edit on the 120 Hz-safe pick window (ignore broken/turbo leftovers).
    if (key === 'doubleEdit') {
      const poll = Number(
        partial.pollUs != null ? partial.pollUs : config.doubleEdit?.pollUs
      );
      if (!Number.isFinite(poll) || poll <= 0 || poll < DE_POLL_MIN_US || poll > DE_POLL_MAX_US) {
        partial = { ...partial, pollUs: DE_POLL_US };
      }
    }
    updateMacro(key, partial);
  });
  return getConfig();
}

function getConfig() {
  return JSON.parse(JSON.stringify(config));
}

function getState() {
  const snapshot = {};
  // state also carries paddle bookkeeping (paddlePrevHeld / paddleInject /
  // prevButtons) that has no config entry — walking those threw on every
  // macro:enable, so only report the keys that are actually macros.
  MACRO_KEYS.forEach((key) => {
    snapshot[key] = { ...state[key], enabled: config[key].enabled };
  });
  return snapshot;
}

module.exports = {
  DEFAULTS,
  MACRO_KEYS,
  DEFAULT_PRESS_US,
  DE_POLL_US,
  DE_POLL_MIN_US,
  DE_POLL_MAX_US,
  DE_MARGIN_US,
  DE_STAGE_FLOOR_US,
  DE_OPEN_FLOOR_US,
  DE_TILE_FLOOR_US,
  DE_CONFIRM_FLOOR_US,
  DE_OPEN_US,
  DE_TILE_US,
  DE_SETTLE_US,
  DE_CONFIRM_MIN_US,
  DE_TILE_BREATHE_US,
  DE_TILE_MIN_REPORTS,
  DE_OPEN_MIN_REPORTS,
  DE_SETTLE_MIN_REPORTS,
  DRAG_SELECT_MIN_US,
  PICKUP_PRESS_US,
  PICKUP_PRESS_FLOOR_US,
  PICKUP_GAP_MIN_US,
  SHOOT_PRESS_US,
  SHOOT_GAP_MIN_US,
  RESET_OPEN_US,
  RESET_PULSE_US,
  RESET_SETTLE_US,
  RESET_CONFIRM_MIN_US,
  RESET_OPEN_MIN_REPORTS,
  RESET_PULSE_MIN_REPORTS,
  RESET_SETTLE_MIN_REPORTS,
  ONESHOT_PRESS_MIN_US,
  PULLOUT_PRESS_MIN_US,
  BUILD_PRESS_MIN_US,
  PULLOUT_VISIBLE_US,
  RESET_VISIBLE_US,
  ONESHOT_MIN_REPORTS,
  PULLOUT_KEYS,
  BUTTON_COUNT,
  BTN_PADDLE_L1,
  BTN_PADDLE_R1,
  BTN_PADDLE_L2,
  BTN_PADDLE_R2,
  BTN_PADDLE_L3,
  BTN_PADDLE_R3,
  PADDLE_INDEXES,
  XINPUT_TO_INDEX,
  process: processReport,
  anyRunning,
  needsProcess,
  isDoubleEditRunning,
  isDoubleEditNeedsNextStage,
  isResetRunning,
  isPickupRunning,
  pickupWaitMs,
  pickupWaitUs,
  isShootingRunning,
  isDragRunning,
  isDragPendingSelect,
  consumeDragJustEditAlone,
  isPickaxeRunning,
  isBuildRunning,
  isBuildJustArmed,
  isOneShotJustArmed,
  anyOneShotJustArmed,
  isOneShotReleaseDue,
  anyOneShotReleaseDue,
  dragSelectWaitMs,
  doubleEditWaitMs,
  doubleEditWaitUs,
  resetWaitMs,
  resetWaitUs,
  pickaxeWaitMs,
  buildWaitMs,
  setEnabled,
  updateMacro,
  updateBinds: (partial) => updateGroup('binds', partial),
  applyConfig,
  getConfig,
  getState,
  nowUs,
  on: emitter.on.bind(emitter),
  off: emitter.off.bind(emitter),
};
