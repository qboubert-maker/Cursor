'use strict';

(function (global) {
  const STORAGE_KEY = 'aphrodite.binds.v1';
  const BTN_DOWN = 0.35;

  const MACRO_BINDS = [
    { id: 0, group: 'Face', ps: ['✕', 'Cross'], xbox: ['A', 'A Button'] },
    { id: 1, group: 'Face', ps: ['○', 'Circle'], xbox: ['B', 'B Button'] },
    { id: 2, group: 'Face', ps: ['▢', 'Square'], xbox: ['X', 'X Button'] },
    { id: 3, group: 'Face', ps: ['△', 'Triangle'], xbox: ['Y', 'Y Button'] },
    { id: 4, group: 'Bumper', ps: ['L1', 'L1'], xbox: ['LB', 'Left Bumper'] },
    { id: 5, group: 'Bumper', ps: ['R1', 'R1'], xbox: ['RB', 'Right Bumper'] },
    { id: 6, group: 'Trigger', ps: ['L2', 'L2'], xbox: ['LT', 'Left Trigger'] },
    { id: 7, group: 'Trigger', ps: ['R2', 'R2'], xbox: ['RT', 'Right Trigger'] },
    { id: 8, group: 'System', ps: ['Create', 'Create'], ps4: ['Share', 'Share'], xbox: ['View', 'View Button'] },
    { id: 9, group: 'System', ps: ['Options', 'Options'], xbox: ['Menu', 'Menu Button'] },
    { id: 10, group: 'Stick', ps: ['L3', 'Left Stick Click'], xbox: ['LS', 'Left Stick Click'] },
    { id: 11, group: 'Stick', ps: ['R3', 'Right Stick Click'], xbox: ['RS', 'Right Stick Click'] },
    { id: 12, group: 'D-Pad', ps: ['↑', 'D-Pad Up'], xbox: ['↑', 'D-Pad Up'] },
    { id: 13, group: 'D-Pad', ps: ['↓', 'D-Pad Down'], xbox: ['↓', 'D-Pad Down'] },
    { id: 14, group: 'D-Pad', ps: ['←', 'D-Pad Left'], xbox: ['←', 'D-Pad Left'] },
    { id: 15, group: 'D-Pad', ps: ['→', 'D-Pad Right'], xbox: ['→', 'D-Pad Right'] },
    { id: 16, group: 'System', ps: ['PS', 'PS Button'], xbox: ['Guide', 'Xbox Button'] },
    { id: 17, group: 'System', ps: ['Touch', 'Touchpad'], xbox: ['Share', 'Share Button'] },
    { id: 18, group: 'Paddle', ps: ['L4', 'Left Paddle'], xbox: ['P3', 'Left Paddle (P3)'] },
    { id: 19, group: 'Paddle', ps: ['R4', 'Right Paddle'], xbox: ['P1', 'Right Paddle (P1)'] },
    { id: 20, group: 'Paddle', ps: ['Fn1', 'Fn1'], xbox: ['P4', 'Left Paddle (P4)'] },
    { id: 21, group: 'Paddle', ps: ['Fn2', 'Fn2'], xbox: ['P2', 'Right Paddle (P2)'] },
    { id: 22, group: 'Paddle', ps: ['L5', 'Left Paddle 5'], xbox: ['P5', 'Paddle P5'] },
    { id: 23, group: 'Paddle', ps: ['R5', 'Right Paddle 5'], xbox: ['P6', 'Paddle P6'] },
  ];

  const BIND_BY_ID = new Map(MACRO_BINDS.map((b) => [b.id, b]));
  const DEFAULTS = {
    edit: 11,
    select: 7,
    use: 2,
    build: 12,
    reset: 1,
  };

  const MODEL_FAMILY = {
    ps5: 'playstation',
    ps4: 'playstation',
    'xbox-series': 'xbox',
    'xbox-one': 'xbox',
  };

  let bindModel = 'ps5';
  let connectedFamily = null;
  let listenBtn = null;
  let listenBaseline = null;
  let listenRaf = 0;
  let ready = false;

  function getBind(id) {
    return BIND_BY_ID.get(Number(id)) || MACRO_BINDS[0];
  }

  function iconFamily() {
    if (connectedFamily === 'playstation' || connectedFamily === 'xbox') return connectedFamily;
    return MODEL_FAMILY[bindModel] === 'xbox' ? 'xbox' : 'playstation';
  }

  function bindLabels(bind) {
    const family = iconFamily();
    if (family === 'xbox') return bind.xbox;
    if (bindModel === 'ps4' && bind.ps4) return bind.ps4;
    return bind.ps;
  }

  function bindIconHtml(bindId) {
    if (!global.AphroditeBindIcons) return '';
    return global.AphroditeBindIcons.iconFor(bindId, iconFamily());
  }

  function platformTip() {
    if (connectedFamily === 'playstation') return 'DualSense connected · press a button';
    if (connectedFamily === 'xbox') return 'Xbox pad connected · press a button';
    const label = {
      ps5: 'DualSense layout',
      ps4: 'DualShock 4 layout',
      'xbox-series': 'Xbox Series layout',
      'xbox-one': 'Xbox One layout',
    }[bindModel] || 'Controller layout';
    return `${label} · or press a button`;
  }

  function loadSaved() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULTS };
      const parsed = JSON.parse(raw);
      return {
        edit: Number.isFinite(Number(parsed.edit)) ? Number(parsed.edit) : DEFAULTS.edit,
        select: Number.isFinite(Number(parsed.select)) ? Number(parsed.select) : DEFAULTS.select,
        use: Number.isFinite(Number(parsed.use)) ? Number(parsed.use) : DEFAULTS.use,
        build: Number.isFinite(Number(parsed.build)) ? Number(parsed.build) : DEFAULTS.build,
        reset: Number.isFinite(Number(parsed.reset)) ? Number(parsed.reset) : DEFAULTS.reset,
      };
    } catch {
      return { ...DEFAULTS };
    }
  }

  /**
   * The main process owns the durable copy (macro-pref.json). Seed local state
   * from it before the UI paints so a saved bind is what you see on launch.
   */
  function hydrate(binds) {
    if (!binds || typeof binds !== 'object') return;
    const next = {};
    ['edit', 'select', 'use', 'build', 'reset'].forEach((role) => {
      const v = Number(binds[role]);
      next[role] = Number.isFinite(v) ? v : DEFAULTS[role];
    });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  function saveBinds() {
    const next = {};
    document.querySelectorAll('#bindsGrid [data-bind-role]').forEach((btn) => {
      const role = btn.dataset.bindRole;
      if (!role) return;
      next[role] = Number(btn.dataset.bindId);
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    try {
      global.AphroditeMacros?.save?.();
    } catch {
      /* ignore */
    }
  }

  function applyBind(btn, bindId, opts = {}) {
    const bind = getBind(bindId);
    const [key, name] = bindLabels(bind);
    btn.dataset.bindId = String(bind.id);
    const keyEl = btn.querySelector('.macro-bind__key');
    const nameEl = btn.querySelector('.macro-bind__name');
    const icon = bindIconHtml(bind.id);
    if (keyEl) {
      if (icon) {
        keyEl.innerHTML = icon;
        keyEl.classList.add('has-icon');
        keyEl.setAttribute('title', key);
      } else {
        keyEl.textContent = key;
        keyEl.classList.remove('has-icon');
        keyEl.removeAttribute('title');
      }
    }
    if (nameEl) nameEl.textContent = name;
    if (!opts.silent) {
      if (btn.closest('#bindsGrid')) saveBinds();
      if (typeof btn._aphroditeOnBind === 'function') btn._aphroditeOnBind(Number(btn.dataset.bindId));
    }
  }

  function refreshAllLabels() {
    document.querySelectorAll('.macro-bind[data-bind-id]').forEach((btn) => {
      applyBind(btn, btn.dataset.bindId || 0, { silent: true });
    });
    renderPicker();
  }

  function wireButton(btn, opts = {}) {
    if (!btn || btn.dataset.bindWired === '1') return;
    btn.dataset.bindWired = '1';
    if (typeof opts.onChange === 'function') btn._aphroditeOnBind = opts.onChange;
    applyBind(btn, btn.dataset.bindId || 0, { silent: true });
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      startListen(btn);
    });
  }

  const picker = () => document.getElementById('macroBindPicker');
  const pickerList = () => document.getElementById('macroBindPickerList');
  const pickerTip = () => document.getElementById('macroBindPickerTip');

  function stopListen() {
    if (listenRaf) {
      cancelAnimationFrame(listenRaf);
      listenRaf = 0;
    }
    listenBaseline = null;
    if (listenBtn) {
      listenBtn.classList.remove('is-listening');
      const hint = listenBtn.querySelector('.macro-bind__hint');
      if (hint) hint.textContent = 'Change';
      listenBtn = null;
    }
    const el = picker();
    if (el) {
      el.hidden = true;
      el.classList.remove('is-open');
    }
  }

  function syncPickerActive() {
    const list = pickerList();
    if (!list || !listenBtn) return;
    const activeId = Number(listenBtn.dataset.bindId);
    list.querySelectorAll('[data-pick-bind]').forEach((el) => {
      el.classList.toggle('is-active', Number(el.dataset.pickBind) === activeId);
    });
  }

  function openPicker() {
    const el = picker();
    const list = pickerList();
    if (!el || !list) return;
    el.hidden = false;
    el.classList.add('is-open');
    const tip = pickerTip();
    if (tip) tip.textContent = platformTip();
    syncPickerActive();
  }

  function captureBaseline() {
    const pads = navigator.getGamepads?.() || [];
    const baseline = new Map();
    for (const pad of pads) {
      if (!pad) continue;
      const pressed = [];
      for (let i = 0; i < pad.buttons.length; i += 1) {
        const btn = pad.buttons[i];
        const value = typeof btn === 'object' ? Number(btn.value || 0) : Number(btn || 0);
        pressed[i] = value >= BTN_DOWN || !!btn?.pressed;
      }
      baseline.set(pad.index, pressed);
    }
    return baseline;
  }

  function pollListen() {
    if (!listenBtn) return;
    const pads = navigator.getGamepads?.() || [];
    for (const pad of pads) {
      if (!pad) continue;
      const prev = listenBaseline?.get(pad.index) || [];
      for (let i = 0; i < pad.buttons.length; i += 1) {
        if (!BIND_BY_ID.has(i)) continue;
        const btn = pad.buttons[i];
        const value = typeof btn === 'object' ? Number(btn.value || 0) : Number(btn || 0);
        const down = value >= BTN_DOWN || !!btn?.pressed;
        if (down && !prev[i]) {
          applyBind(listenBtn, i);
          stopListen();
          return;
        }
      }
    }
    listenBaseline = captureBaseline();
    listenRaf = requestAnimationFrame(pollListen);
  }

  function startListen(btn) {
    if (listenBtn && listenBtn !== btn) stopListen();
    else if (listenBtn === btn) {
      stopListen();
      return;
    }
    listenBtn = btn;
    btn.classList.add('is-listening');
    const hint = btn.querySelector('.macro-bind__hint');
    if (hint) hint.textContent = 'Listening…';
    openPicker();
    listenBaseline = captureBaseline();
    listenRaf = requestAnimationFrame(pollListen);
  }

  function renderPicker() {
    const list = pickerList();
    if (!list) return;
    const family = iconFamily();
    const groups = [];
    MACRO_BINDS.forEach((bind) => {
      const last = groups[groups.length - 1];
      if (!last || last.name !== bind.group) groups.push({ name: bind.group, binds: [bind] });
      else last.binds.push(bind);
    });

    list.innerHTML = groups.map((group) => `
      <div class="macro-bind-picker__section">
        <div class="macro-bind-picker__section-label">${group.name}</div>
        ${group.binds.map((bind) => {
          const [, name] = bindLabels(bind);
          const icon = bindIconHtml(bind.id);
          return `
          <button type="button" class="macro-bind-pick" role="option" data-pick-bind="${bind.id}" data-family="${family}">
            <span class="macro-bind-pick__icon">${icon}</span>
            <span class="macro-bind-pick__name">${name}</span>
          </button>`;
        }).join('')}
      </div>`).join('');
  }

  function detectConnectedFamily() {
    const pads = navigator.getGamepads?.() || [];
    for (const pad of pads) {
      if (!pad) continue;
      const id = `${pad.id || ''}`.toLowerCase();
      if (/xbox|xinput|microsoft/.test(id)) {
        connectedFamily = 'xbox';
        return;
      }
      if (/dualsense|dualshock|wireless controller|playstation|sony/.test(id)) {
        connectedFamily = 'playstation';
        return;
      }
    }
    connectedFamily = null;
  }

  function init() {
    if (ready) return;
    const grid = document.getElementById('bindsGrid');
    if (!grid) return;
    ready = true;

    const saved = loadSaved();
    grid.querySelectorAll('[data-bind-role]').forEach((btn) => {
      const role = btn.dataset.bindRole;
      const id = saved[role] ?? DEFAULTS[role] ?? 0;
      btn.dataset.bindId = String(id);
      wireButton(btn);
    });

    renderPicker();

    const list = pickerList();
    list?.addEventListener('click', (e) => {
      const opt = e.target.closest('[data-pick-bind]');
      if (!opt || !listenBtn) return;
      applyBind(listenBtn, opt.dataset.pickBind);
      stopListen();
    });

    picker()?.addEventListener('click', (e) => {
      if (e.target === picker() || e.target.classList.contains('macro-bind-picker__bloom')) {
        stopListen();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && listenBtn) stopListen();
    });

    window.addEventListener('gamepadconnected', () => {
      detectConnectedFamily();
      refreshAllLabels();
    });
    window.addEventListener('gamepaddisconnected', () => {
      detectConnectedFamily();
      refreshAllLabels();
    });

    detectConnectedFamily();
    refreshAllLabels();
  }

  function setModel(modelId) {
    if (!MODEL_FAMILY[modelId]) return;
    bindModel = modelId;
    if (ready) refreshAllLabels();
  }

  function getBinds() {
    const out = { ...DEFAULTS };
    document.querySelectorAll('#bindsGrid [data-bind-role]').forEach((btn) => {
      const role = btn.dataset.bindRole;
      if (role) out[role] = Number(btn.dataset.bindId);
    });
    return out;
  }

  global.AphroditeBinds = { init, hydrate, setModel, getBinds, stopListen, wireButton, refreshAllLabels };
})(typeof window !== 'undefined' ? window : globalThis);
