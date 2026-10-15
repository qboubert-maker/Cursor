'use strict';

(function (global) {
  const STORAGE_KEY = 'aphrodite.macros.v1';

  // Engine floors drag to 1ms edit-alone regardless of the UI turbo value.
  const DEFAULTS = {
    doubleEdit: { enabled: false, trigger: 6, tapDelayUs: 1 },
    drag: { enabled: true, trigger: 11, dragDelayUs: 1 },
    pickup: { enabled: true, trigger: 5, tapDelayUs: 0 },
    build: { enabled: true, trigger: 15, tapDelayUs: 1 },
    reset: { enabled: true, trigger: 4, tapDelayUs: 1 },
  };

  let ready = false;

  let pushTries = 0;

  function pushEngineConfig() {
    const api = global.aphrodite?.macros;
    if (!api?.setConfig) {
      if (pushTries < 40) {
        pushTries += 1;
        setTimeout(pushEngineConfig, 100);
      }
      return;
    }
    const macros = readUi();
    const binds = global.AphroditeBinds?.getBinds?.() || {
      edit: 11, select: 7, use: 2, build: 12, reset: 1,
    };
    void api.setConfig({
      doubleEdit: { ...macros.doubleEdit, pollUs: 6500 },
      drag: macros.drag,
      pickup: macros.pickup,
      build: macros.build,
      reset: macros.reset,
      binds: {
        edit: binds.edit,
        select: binds.select,
        use: binds.use,
        build: binds.build,
        reset: binds.reset,
      },
    }).then((res) => {
      if (res?.ok === false) console.warn('[macros] push rejected', res.error);
      else pushTries = 0;
    }).catch?.((err) => {
      console.warn('[macros] push', err);
      if (pushTries < 40) {
        pushTries += 1;
        setTimeout(pushEngineConfig, 150);
      }
    });
  }

  function loadSaved() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return structuredClone(DEFAULTS);
      const parsed = JSON.parse(raw);
      const out = structuredClone(DEFAULTS);
      Object.keys(DEFAULTS).forEach((id) => {
        const src = parsed[id] || {};
        out[id] = {
          ...out[id],
          enabled: !!src.enabled,
          trigger: Number.isFinite(Number(src.trigger)) ? Number(src.trigger) : out[id].trigger,
          tapDelayUs: Number.isFinite(Number(src.tapDelayUs)) ? Number(src.tapDelayUs) : out[id].tapDelayUs,
          dragDelayUs: Number.isFinite(Number(src.dragDelayUs)) ? Number(src.dragDelayUs) : out[id].dragDelayUs,
        };
        // UI turbo is 1µs; engine still floors edit→select at 1ms.
        if (id === 'drag' && (!Number.isFinite(out[id].dragDelayUs) || out[id].dragDelayUs <= 0)) {
          out[id].dragDelayUs = 1;
        }
      });
      return out;
    } catch {
      return structuredClone(DEFAULTS);
    }
  }

  function readUi() {
    const out = structuredClone(DEFAULTS);
    document.querySelectorAll('#macroGrid [data-macro-id]').forEach((card) => {
      const id = card.dataset.macroId;
      if (!out[id]) return;
      const toggle = card.querySelector('[data-macro-toggle]');
      const bindBtn = card.querySelector('[data-macro-bind]');
      const slider = card.querySelector('[data-us-field]');
      out[id].enabled = !!toggle?.classList.contains('is-on');
      out[id].trigger = Number(bindBtn?.dataset.bindId ?? out[id].trigger);
      if (slider) {
        const field = slider.dataset.usField;
        out[id][field] = Number(slider.value);
      }
    });
    return out;
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(readUi()));
    pushEngineConfig();
  }

  /**
   * The main process owns the durable copy (macro-pref.json). Seed local state
   * from it before the UI paints so saved triggers survive a restart.
   */
  function hydrate(cfg) {
    if (!cfg || typeof cfg !== 'object') return;
    const out = structuredClone(DEFAULTS);
    Object.keys(DEFAULTS).forEach((id) => {
      const src = cfg[id];
      if (!src || typeof src !== 'object') return;
      out[id] = {
        ...out[id],
        enabled: !!src.enabled,
        trigger: Number.isFinite(Number(src.trigger)) ? Number(src.trigger) : out[id].trigger,
        tapDelayUs: Number.isFinite(Number(src.tapDelayUs)) ? Number(src.tapDelayUs) : out[id].tapDelayUs,
        dragDelayUs: Number.isFinite(Number(src.dragDelayUs)) ? Number(src.dragDelayUs) : out[id].dragDelayUs,
      };
    });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
    } catch {
      /* ignore */
    }
  }

  function formatUs(us) {
    const ms = Number(us) / 1000;
    if (!Number.isFinite(ms)) return '0.0 ms';
    return `${ms.toFixed(1)} ms`;
  }

  function paintSlider(slider) {
    if (!slider) return;
    const label = slider.closest('.macro-card__field')?.querySelector('[data-us-label]');
    if (label) label.textContent = formatUs(slider.value);
    const min = Number(slider.min);
    const max = Number(slider.max);
    const val = Number(slider.value);
    const pct = max === min ? 0 : ((val - min) / (max - min)) * 100;
    slider.style.setProperty('--macro-fill', `${Math.max(0, Math.min(100, pct))}%`);
  }

  function setCardEnabled(card, on) {
    const toggle = card.querySelector('[data-macro-toggle]');
    const badge = card.querySelector('.macro-card__badge');
    card.classList.toggle('is-live', on);
    if (toggle) {
      toggle.classList.toggle('is-on', on);
      toggle.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    if (badge) badge.textContent = on ? 'On' : 'Off';
  }

  function init() {
    if (ready) return;
    const grid = document.getElementById('macroGrid');
    if (!grid) return;
    ready = true;

    const saved = loadSaved();

    grid.querySelectorAll('[data-macro-id]').forEach((card) => {
      const id = card.dataset.macroId;
      const cfg = saved[id] || DEFAULTS[id];
      if (!cfg) return;

      setCardEnabled(card, !!cfg.enabled);

      const bindBtn = card.querySelector('[data-macro-bind]');
      if (bindBtn) {
        bindBtn.dataset.bindId = String(cfg.trigger);
        global.AphroditeBinds?.wireButton?.(bindBtn, { onChange: () => save() });
      }

      const slider = card.querySelector('[data-us-field]');
      if (slider) {
        const field = slider.dataset.usField;
        if (field && cfg[field] != null) slider.value = String(cfg[field]);
        paintSlider(slider);
        slider.addEventListener('input', () => {
          paintSlider(slider);
          save();
        });
      }

      const toggle = card.querySelector('[data-macro-toggle]');
      toggle?.addEventListener('click', (e) => {
        e.stopPropagation();
        const next = !toggle.classList.contains('is-on');
        setCardEnabled(card, next);
        save();
      });
    });

    pushEngineConfig();
  }

  function getConfig() {
    return readUi();
  }

  global.AphroditeMacros = { init, hydrate, getConfig, save };
})(typeof window !== 'undefined' ? window : globalThis);
