'use strict';

/**
 * Double Edit — Rust cdylib hot path with identical JS fallback.
 *
 * Hold trigger → open → tile → settle → confirm (loop).
 */

const fs = require('fs');
const path = require('path');
const { unpacked } = require('./unpacked');

const BUTTON_COUNT = 24;
const BTN_DOWN = 0.35;
const TRIGGER_ON = 0.45;
const TRIGGER_OFF = 0.20;

const DE_POLL_US = 8334;
const DE_OPEN_US = 4000;
const DE_TILE_US = DE_POLL_US * 2 + 1000;
const DE_SETTLE_US = 700;
const DE_CONFIRM_MIN_US = 1;
const DE_TILE_BREATHE_US = 3500;
const DE_SELECT_JOIN_US = 2500;
const DE_TILE_MIN_REPORTS = 8;
const DE_OPEN_MIN_REPORTS = 3;
const DE_SETTLE_MIN_REPORTS = 2;

const EDIT_CYCLE = ['open', 'tile', 'settle', 'confirm'];
const EDIT_HELD = new Set(['open', 'tile', 'settle']);

function nowUsJs() {
  return Number(process.hrtime.bigint() / 1000n);
}

function dllCandidates() {
  return [
    path.join(__dirname, 'double_edit.dll'),
    path.join(__dirname, 'native', 'double-edit', 'target', 'release', 'double_edit.dll'),
    path.join(__dirname, 'native', 'double-edit', 'target', 'debug', 'double_edit.dll'),
  ].map(unpacked);
}

function findDll() {
  for (const p of dllCandidates()) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      /* ignore */
    }
  }
  return null;
}

/* ---------------- JS fallback ---------------- */

class JsEngine {
  constructor() {
    this.cfg = {
      enabled: false,
      trigger: 6,
      tapDelayUs: 1,
      edit: 11,
      select: 7,
    };
    this.st = {
      stage: 'idle',
      triggerLatched: false,
      stageReports: 0,
      stageArmedUs: null,
      dueUs: 0,
      breatheUntilUs: 0,
      selectJoinUs: 0,
      cycles: 0,
      needsNextStage: false,
    };
  }

  setEnabled(on) {
    this.cfg.enabled = !!on;
    if (!on) this.goIdle();
  }

  setTrigger(t) {
    this.cfg.trigger = Number.isFinite(Number(t)) ? Number(t) : -1;
  }

  setTapDelayUs(us) {
    const n = Number(us);
    this.cfg.tapDelayUs = Number.isFinite(n) ? Math.max(DE_CONFIRM_MIN_US, n | 0) : DE_CONFIRM_MIN_US;
  }

  setBinds(edit, select) {
    this.cfg.edit = Number.isFinite(Number(edit)) ? Number(edit) : -1;
    this.cfg.select = Number.isFinite(Number(select)) ? Number(select) : -1;
  }

  reset() {
    this.goIdle();
  }

  goIdle() {
    this.st.stage = 'idle';
    this.st.stageReports = 0;
    this.st.stageArmedUs = null;
    this.st.dueUs = 0;
    this.st.breatheUntilUs = 0;
    this.st.selectJoinUs = 0;
    this.st.needsNextStage = false;
    this.st.triggerLatched = false;
  }

  selectMayJoin(us) {
    return !this.st.selectJoinUs || us >= this.st.selectJoinUs;
  }

  resetClock() {
    this.st.stageReports = 0;
    this.st.stageArmedUs = null;
    this.st.dueUs = 0;
  }

  stageUs(stage) {
    if (stage === 'open') return DE_OPEN_US;
    if (stage === 'tile') return DE_TILE_US;
    if (stage === 'settle') return DE_SETTLE_US;
    if (stage === 'confirm') return Math.max(this.cfg.tapDelayUs || 0, DE_CONFIRM_MIN_US);
    return DE_SETTLE_US;
  }

  minReports(stage) {
    if (stage === 'tile') return DE_TILE_MIN_REPORTS;
    if (stage === 'open') return DE_OPEN_MIN_REPORTS;
    if (stage === 'settle') return DE_SETTLE_MIN_REPORTS;
    return 1;
  }

  triggerHeld(buttons) {
    if (!this.cfg.enabled || !Number.isFinite(this.cfg.trigger)) {
      this.st.triggerLatched = false;
      return false;
    }
    const raw = Number(buttons[this.cfg.trigger] || 0);
    if (this.st.triggerLatched) {
      if (raw < TRIGGER_OFF) this.st.triggerLatched = false;
    } else if (raw >= TRIGGER_ON) {
      this.st.triggerLatched = true;
    }
    return this.st.triggerLatched;
  }

  paint(buttons, us) {
    const { edit, select } = this.cfg;
    if (Number.isFinite(edit)) {
      if (EDIT_HELD.has(this.st.stage)) buttons[edit] = 1;
      else if (this.st.stage === 'confirm') buttons[edit] = 0;
    }
    if (Number.isFinite(select)) {
      if (this.st.stage === 'tile' && this.selectMayJoin(us)) buttons[select] = 1;
      else if (this.st.stage !== 'idle') buttons[select] = 0;
    }
  }

  wireOk(buttons, us) {
    const editOn = Number(buttons[this.cfg.edit] || 0) >= BTN_DOWN;
    const selectOn = Number(buttons[this.cfg.select] || 0) >= BTN_DOWN;
    if (this.st.stage === 'open' || this.st.stage === 'settle') return editOn && !selectOn;
    if (this.st.stage === 'tile') {
      if (!this.selectMayJoin(us)) return editOn && !selectOn;
      return editOn && selectOn;
    }
    if (this.st.stage === 'confirm') return !editOn && !selectOn;
    return false;
  }

  tileSelectLive(buttons, us) {
    return this.st.stage === 'tile'
      && this.selectMayJoin(us)
      && Number(buttons[this.cfg.edit] || 0) >= BTN_DOWN
      && Number(buttons[this.cfg.select] || 0) >= BTN_DOWN;
  }

  advance(us) {
    const prev = this.st.stage;
    const next = (EDIT_CYCLE.indexOf(this.st.stage) + 1) % EDIT_CYCLE.length;
    this.st.stage = EDIT_CYCLE[next];
    this.resetClock();
    this.st.breatheUntilUs = prev === 'tile' ? us + DE_TILE_BREATHE_US : 0;
    this.st.selectJoinUs = prev === 'open' ? us + DE_SELECT_JOIN_US : 0;
    if (next === 0) this.st.cycles += 1;
    this.st.needsNextStage = this.st.stage === 'open' || this.st.stage === 'confirm';
  }

  stageCode() {
    if (this.st.stage === 'open') return 1;
    if (this.st.stage === 'tile') return 2;
    if (this.st.stage === 'settle') return 3;
    if (this.st.stage === 'confirm') return 4;
    return 0;
  }

  wantBurst() {
    if (this.st.stage === 'tile' || (this.st.stage === 'settle' && this.st.breatheUntilUs > 0)) {
      return 6;
    }
    if (this.st.stage === 'open') return 3;
    return 0;
  }

  process(buttons, us = nowUsJs()) {
    this.st.needsNextStage = false;
    if (!this.cfg.enabled || !Number.isFinite(this.cfg.edit) || !Number.isFinite(this.cfg.select)) {
      this.goIdle();
      return -1;
    }

    const held = this.triggerHeld(buttons);
    if (held || this.st.stage !== 'idle') {
      if (Number.isFinite(this.cfg.trigger)) buttons[this.cfg.trigger] = 0;
    }

    if (!held) {
      this.goIdle();
      return -1;
    }

    if (this.st.stage === 'idle') {
      [this.st.stage] = EDIT_CYCLE;
      this.resetClock();
      this.st.breatheUntilUs = 0;
      this.st.selectJoinUs = 0;
    }

    if (this.st.stage === 'settle' && this.st.breatheUntilUs && us < this.st.breatheUntilUs) {
      buttons[this.cfg.edit] = 1;
      buttons[this.cfg.select] = 1;
      return this.st.breatheUntilUs - us;
    }
    if (this.st.breatheUntilUs && us >= this.st.breatheUntilUs) this.st.breatheUntilUs = 0;

    this.paint(buttons, us);
    if (!this.wireOk(buttons, us)) {
      this.paint(buttons, us);
      if (!this.wireOk(buttons, us)) return this.waitUs(us);
    }

    // Tile latch clock only while edit+select are both down.
    if (this.st.stage === 'tile' && !this.tileSelectLive(buttons, us)) {
      return this.waitUs(us);
    }

    this.st.stageReports += 1;
    if (this.st.stageArmedUs == null) {
      this.st.stageArmedUs = us;
      this.st.dueUs = us + this.stageUs(this.st.stage);
    }

    const stageUs = this.stageUs(this.st.stage);
    const heldUs = us - this.st.stageArmedUs;
    const qualified = this.st.stage === 'tile'
      ? this.st.stageReports >= this.minReports(this.st.stage)
      : (this.st.stageReports >= this.minReports(this.st.stage) || heldUs >= stageUs * 2);
    if (us >= this.st.dueUs && qualified) this.advance(us);

    return this.waitUs(us);
  }

  waitUs(us = nowUsJs()) {
    if (!this.cfg.enabled || this.st.stage === 'idle') return -1;
    if (this.st.stage === 'tile' && !this.selectMayJoin(us)) {
      return Math.max(0, this.st.selectJoinUs - us);
    }
    if (this.st.breatheUntilUs && this.st.stage === 'settle') {
      return Math.max(0, this.st.breatheUntilUs - us);
    }
    if (!this.st.dueUs) return 1000;
    return Math.max(0, this.st.dueUs - us);
  }

  needsNextStage() {
    if (!this.cfg.enabled || this.st.stage === 'idle') return false;
    // Keep edit-alone after open, and tile paint after tile, for a full pump.
    if (this.st.stage === 'tile' || this.st.stage === 'settle') return false;
    if (this.st.stageArmedUs == null && this.st.dueUs === 0) return true;
    return !!this.st.needsNextStage;
  }

  isRunning() {
    return this.st.stage !== 'idle';
  }
}

/* ---------------- Rust binding ---------------- */

function tryLoadRust() {
  const dll = findDll();
  if (!dll) return null;
  try {
    // eslint-disable-next-line global-require
    const koffi = require('koffi');
    const lib = koffi.load(dll);
    const api = {
      setEnabled: lib.func('de_set_enabled', 'void', ['uint8']),
      setTrigger: lib.func('de_set_trigger', 'void', ['int32']),
      setTapDelayUs: lib.func('de_set_tap_delay_us', 'void', ['uint32']),
      setBinds: lib.func('de_set_binds', 'void', ['int32', 'int32']),
      reset: lib.func('de_reset', 'void', []),
      process: lib.func('de_process', 'int64', ['void *', 'uint32', 'uint64']),
      needsNextStage: lib.func('de_needs_next_stage', 'uint8', []),
      isRunning: lib.func('de_is_running', 'uint8', []),
      waitUs: lib.func('de_wait_us', 'int64', ['uint64']),
      cycles: lib.func('de_cycles', 'uint64', []),
      nowUs: lib.func('de_now_us', 'uint64', []),
      stage: lib.func('de_stage', 'uint8', []),
      stageReports: lib.func('de_stage_reports', 'uint32', []),
      wantBurst: lib.func('de_want_burst', 'uint8', []),
    };
    const buf = Buffer.alloc(BUTTON_COUNT * 4);
    return {
      backend: 'rust',
      dll,
      setEnabled: (on) => api.setEnabled(on ? 1 : 0),
      setTrigger: (t) => api.setTrigger(Number(t)),
      setTapDelayUs: (us) => api.setTapDelayUs(Math.max(0, Number(us) || 0) >>> 0),
      setBinds: (edit, select) => api.setBinds(Number(edit), Number(select)),
      reset: () => api.reset(),
      processButtons(buttons, us) {
        const t = us != null ? us : api.nowUs();
        for (let i = 0; i < BUTTON_COUNT; i += 1) {
          buf.writeFloatLE(Number(buttons[i] || 0), i * 4);
        }
        const wake = api.process(buf, BUTTON_COUNT, t);
        for (let i = 0; i < BUTTON_COUNT; i += 1) {
          buttons[i] = buf.readFloatLE(i * 4);
        }
        return Number(wake);
      },
      needsNextStage: () => api.needsNextStage() !== 0,
      isRunning: () => api.isRunning() !== 0,
      waitUs: (us) => Number(api.waitUs(us != null ? us : api.nowUs())),
      cycles: () => Number(api.cycles()),
      nowUs: () => Number(api.nowUs()),
      stage: () => api.stage(),
      stageReports: () => api.stageReports(),
      wantBurst: () => api.wantBurst(),
    };
  } catch (err) {
    console.warn('[double-edit] rust load failed, using JS:', err?.message || err);
    return null;
  }
}

const rust = tryLoadRust();
const js = new JsEngine();
const engine = rust || {
  backend: 'js',
  dll: null,
  setEnabled: (on) => js.setEnabled(on),
  setTrigger: (t) => js.setTrigger(t),
  setTapDelayUs: (us) => js.setTapDelayUs(us),
  setBinds: (edit, select) => js.setBinds(edit, select),
  reset: () => js.reset(),
  processButtons: (buttons, us) => js.process(buttons, us),
  needsNextStage: () => js.needsNextStage(),
  isRunning: () => js.isRunning(),
  waitUs: (us) => js.waitUs(us),
  cycles: () => js.st.cycles,
  nowUs: () => nowUsJs(),
  stage: () => js.stageCode(),
  stageReports: () => js.st.stageReports,
  wantBurst: () => js.wantBurst(),
};

let lastConfig = null;

function applyConfig(partial = {}) {
  const de = partial.doubleEdit || partial;
  const binds = partial.binds || {};
  if (de && typeof de === 'object') {
    if ('enabled' in de) engine.setEnabled(!!de.enabled);
    if ('trigger' in de) engine.setTrigger(de.trigger);
    if ('tapDelayUs' in de) engine.setTapDelayUs(de.tapDelayUs);
  }
  const edit = binds.edit != null ? binds.edit : lastConfig?.binds?.edit;
  const select = binds.select != null ? binds.select : lastConfig?.binds?.select;
  if (edit != null || select != null) {
    engine.setBinds(
      edit != null ? edit : 11,
      select != null ? select : 7,
    );
  }
  lastConfig = {
    doubleEdit: {
      enabled: !!de?.enabled,
      trigger: Number(de?.trigger),
      tapDelayUs: Number(de?.tapDelayUs),
    },
    binds: {
      edit: Number(edit != null ? edit : 11),
      select: Number(select != null ? select : 7),
    },
  };
  return status();
}

function cloneReport(input) {
  const buttons = (input.buttons || []).slice();
  while (buttons.length < BUTTON_COUNT) buttons.push(0);
  const out = {
    buttons,
    axes: (input.axes || [0, 0, 0, 0]).slice(),
  };
  if (Array.isArray(input.stickBytes) && input.stickBytes.length >= 4) {
    out.stickBytes = [0, 1, 2, 3].map((i) => {
      const raw = input.stickBytes[i];
      if (raw == null || raw === '') return 128;
      const n = Number(raw);
      if (!Number.isFinite(n)) return 128;
      return Math.max(0, Math.min(255, n | 0));
    });
  }
  return out;
}

function process(input, us = engine.nowUs()) {
  const out = cloneReport(input);
  engine.processButtons(out.buttons, us);
  return out;
}

function needsProcess(input) {
  if (engine.isRunning()) return true;
  const cfg = lastConfig?.doubleEdit;
  if (!cfg?.enabled || !Number.isFinite(cfg.trigger)) return false;
  return Number(input?.buttons?.[cfg.trigger] || 0) >= TRIGGER_ON;
}

function doubleEditWaitUs() {
  const wait = engine.waitUs();
  if (wait < 0) return null;
  return wait;
}

function doubleEditWaitMs() {
  const wait = doubleEditWaitUs();
  if (wait == null) return null;
  return Math.max(0, Math.ceil(wait / 1000));
}

function status() {
  return {
    backend: engine.backend,
    dll: engine.dll,
    running: engine.isRunning(),
    cycles: engine.cycles(),
    stage: engine.stage?.() ?? 0,
    config: lastConfig,
  };
}

module.exports = {
  applyConfig,
  process,
  needsProcess,
  needsNextStage: () => engine.needsNextStage(),
  isRunning: () => engine.isRunning(),
  wantBurst: () => (engine.wantBurst ? engine.wantBurst() : 0),
  stage: () => (engine.stage ? engine.stage() : 0),
  doubleEditWaitMs,
  doubleEditWaitUs,
  reset: () => engine.reset(),
  status,
  BUTTON_COUNT,
};
