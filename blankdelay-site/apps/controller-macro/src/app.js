'use strict';

const MODELS = {
  ps5: {
    family: 'playstation',
    variant: 'ps5',
    src: () => `assets/dualsense.svg?v=${Date.now()}`,
    label: 'PS5 DualSense',
  },
  ps4: {
    family: 'playstation',
    variant: 'ps4',
    src: () => `assets/dualshock4.svg?v=${Date.now()}`,
    label: 'PS4 DualShock',
  },
  'xbox-series': {
    family: 'xbox',
    variant: 'xbox-series-s',
    src: () => `assets/xbox-series.svg?v=${Date.now()}`,
    label: 'Xbox Series',
  },
  'xbox-one': {
    family: 'xbox',
    variant: 'xbox-one',
    src: () => `assets/xbox-one.svg?v=${Date.now()}`,
    label: 'Xbox One',
  },
};

let activeModel = 'ps5';
let openFamily = null;
let viz = null;
let activeView = 'home';
let openTapDelayForIndex = null;

const TAP_DELAY_LABELS = [
  'Cross / A', 'Circle / B', 'Square / X', 'Triangle / Y',
  'L1 / LB', 'R1 / RB', 'L2 / LT', 'R2 / RT',
  'Share / Back', 'Options / Start', 'L3', 'R3',
  'D-Pad Up', 'D-Pad Down', 'D-Pad Left', 'D-Pad Right',
  'PS / Guide', 'Touchpad',
];

/** Per-button tap delay in ms (0–10). Fed into macro config.tapLength. */
const tapDelayMs = {};
/** True once the user has Applied timing for that bind (includes 0.00 ms). */
const tapDelayArmed = {};
for (let i = 0; i < 18; i += 1) {
  tapDelayMs[i] = 0;
  tapDelayArmed[i] = false;
}

// The visualizer repaints the pad SVG every frame off the Gamepad API. While
// the licence gate is up the app sits behind it at display:none, so that work
// only steals frames from the login screen.
function startViz() {
  if (document.documentElement.classList.contains('nova-login-pending')) return;
  viz?.startListening?.();
}

function showPage(view) {
  const next = view || 'home';
  activeView = next;
  const onHome = next === 'home';

  document.querySelectorAll('.page').forEach((page) => {
    page.hidden = page.dataset.page !== next;
  });

  const stage = document.getElementById('padStage');
  if (stage) stage.hidden = !onHome;

  document.querySelectorAll('.blank-dock__item, .pillnav__item').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.view === next);
  });

  document.querySelector('.blank-dock__home, .pillnav__brand')?.classList.toggle('is-home', onHome);
  document.querySelector('.app')?.classList.toggle('is-page', !onHome);

  const mount = document.getElementById('padMount');
  if (mount) {
    if (onHome) {
      mount.classList.remove('is-fps-idle');
      startViz();
      syncPadStatus();
    } else {
      mount.classList.add('is-fps-idle');
      viz?.stopListening?.();
    }
  }

  if (next === 'dev') {
    void refreshDevPanel();
  }

  if (window.SocialParticles) {
    if (next === 'socials') {
      if (window.SocialParticles.remount) window.SocialParticles.remount();
      else {
        window.SocialParticles.mountAll?.();
        window.SocialParticles.start?.();
      }
      requestAnimationFrame(() => window.SocialParticles.resize?.());
    } else {
      window.SocialParticles.stop?.();
    }
  }

  syncVizClickMode();
}

function syncVizClickMode() {
  if (!viz) return;
  const onHome = activeView === 'home';
  viz.setClickMode?.(onHome);
}

function wireControllerClicks() {
  if (!viz) return;
  viz.onPartClick?.((index) => {
    if (activeView === 'home') openTapDelayForIndex?.(index);
  });
  syncVizClickMode();
}

async function pushTapLengthConfig() {
  const api = window.blank?.macros || window.aphrodite?.macros;
  if (!api?.setConfig) return false;
  const byButton = {};
  const armedByButton = {};
  for (let i = 0; i < 18; i += 1) {
    byButton[String(i)] = Math.max(0, Math.min(10, Number(tapDelayMs[i]) || 0));
    armedByButton[String(i)] = !!tapDelayArmed[i];
  }
  try {
    const res = await api.setConfig({
      tapLength: {
        byButton,
        armedByButton,
        unit: 'ms',
        min: 0,
        max: 10,
        step: 0.01,
      },
    });
    if (res?.ok === false) {
      console.warn('[tap-delay] push rejected', res.error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[tap-delay] push', err);
    return false;
  }
}

function hydrateTapDelay(cfg) {
  const src = cfg?.tapLength?.byButton || cfg?.byButton;
  const armedSrc = cfg?.tapLength?.armedByButton || cfg?.armedByButton;
  if (!src || typeof src !== 'object') return;
  for (let i = 0; i < 18; i += 1) {
    const ms = Number(src[i] ?? src[String(i)] ?? 0);
    tapDelayMs[i] = Math.max(0, Math.min(10, Number.isFinite(ms) ? ms : 0));
    if (armedSrc && typeof armedSrc === 'object'
      && (Object.prototype.hasOwnProperty.call(armedSrc, i)
        || Object.prototype.hasOwnProperty.call(armedSrc, String(i)))) {
      tapDelayArmed[i] = !!(armedSrc[i] ?? armedSrc[String(i)]);
    } else if (tapDelayMs[i] > 0) {
      tapDelayArmed[i] = true;
    }
    // else: keep existing armed — never demote Active → Off on a bare reload
  }
}

function bootTapDelayModal() {
  const modal = document.getElementById('tapDelayModal');
  const slider = document.getElementById('tapDelaySlider');
  const valueEl = document.getElementById('tapDelayValue');
  const titleEl = document.getElementById('tapDelayTitle');
  const fillEl = document.getElementById('tapDelayFill');
  const chipEl = document.getElementById('tapDelayChip');
  const applyBtn = modal?.querySelector('[data-tap-delay="apply"]');
  if (!modal || !slider || !valueEl || !titleEl) return;

  let editingIndex = null;
  let appliedTimer = null;

  const paintSlider = () => {
    const ms = (Number(slider.value) || 0) / 100;
    valueEl.textContent = ms.toFixed(2);
    const pct = Math.max(0, Math.min(100, (Number(slider.value) || 0) / 10));
    if (fillEl) fillEl.style.width = `${pct}%`;
  };

  /** Chip = applied/armed state for this bind (0.00 ms Apply still counts). */
  const paintChip = (index) => {
    if (!chipEl) return;
    const on = !!tapDelayArmed[index];
    chipEl.dataset.state = on ? 'on' : 'off';
    chipEl.textContent = on ? 'Active' : 'Off';
  };

  const setApplyIdle = () => {
    if (!applyBtn) return;
    applyBtn.classList.remove('is-activated');
    applyBtn.innerHTML = '<span>Apply</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  };

  const setApplyApplied = () => {
    if (!applyBtn) return;
    applyBtn.classList.add('is-activated');
    applyBtn.innerHTML = '<span>Applied</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg>';
    if (appliedTimer) clearTimeout(appliedTimer);
    appliedTimer = setTimeout(() => {
      appliedTimer = null;
      setApplyIdle();
    }, 1600);
  };

  const close = () => {
    if (appliedTimer) {
      clearTimeout(appliedTimer);
      appliedTimer = null;
    }
    setApplyIdle();
    modal.hidden = true;
    editingIndex = null;
  };

  const open = (index) => {
    const idx = Number(index);
    if (!Number.isFinite(idx) || idx < 0 || idx > 17) return;
    editingIndex = idx;
    titleEl.textContent = TAP_DELAY_LABELS[idx] || `Button ${idx}`;
    const ms = Math.max(0, Math.min(10, Number(tapDelayMs[idx]) || 0));
    slider.value = String(Math.round(ms * 100));
    setApplyIdle();
    paintSlider();
    paintChip(idx);
    modal.hidden = false;
  };

  openTapDelayForIndex = open;

  slider.addEventListener('input', () => {
    setApplyIdle();
    paintSlider();
  });

  modal.addEventListener('click', (e) => {
    const action = e.target.closest('[data-tap-delay]')?.dataset.tapDelay;
    if (!action) return;
    if (action === 'dismiss') {
      close();
      return;
    }
    if (action === 'apply' && editingIndex != null) {
      // 0.00 ms is valid — clears the floor / normal feel, still arms the bind.
      const ms = Math.max(0, Math.min(10, Math.round((Number(slider.value) || 0)) / 100));
      tapDelayMs[editingIndex] = ms;
      tapDelayArmed[editingIndex] = true;
      paintSlider();
      paintChip(editingIndex);
      void pushTapLengthConfig().then((ok) => {
        // Keep Active even if the round-trip omits armed flags.
        tapDelayArmed[editingIndex] = true;
        paintChip(editingIndex);
        if (ok) setApplyApplied();
      });
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) close();
  });
}

async function refreshDevPanel() {
  const api = window.blank || window.aphrodite;
  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value || '—';
  };

  setText('devVersion', '1.0.5');
  setText('devRuntime', 'Electron · BlankDelay Controller Macro');

  try {
    const [input, vigem, hidhide, macros] = await Promise.all([
      api?.input?.status?.().catch(() => null),
      api?.vigem?.status?.().catch(() => null),
      api?.hidhide?.status?.().catch(() => null),
      api?.macros?.debug?.().catch(() => null),
    ]);

    setText(
      'devInputStatus',
      input?.connected
        ? `${input.name || input.model || 'Pad'} · live`
        : (input?.message || 'No pad')
    );
    setText(
      'devVigemStatus',
      vigem?.connected ? `Virtual pad · ${vigem.target || 'ready'}` : (vigem?.message || 'Offline')
    );
    setText(
      'devHidhideStatus',
      hidhide?.cloaked ? 'Cloak on' : (hidhide?.installed ? 'Cloak off' : (hidhide?.message || 'Not installed'))
    );

    const log = document.getElementById('devMacroDebug');
    if (log) {
      log.textContent = macros
        ? JSON.stringify(macros, null, 2)
        : 'Macro debug unavailable.';
    }
  } catch (err) {
    const log = document.getElementById('devMacroDebug');
    if (log) log.textContent = err?.message || String(err);
  }
}

function closeMenus() {
  openFamily = null;
  document.querySelectorAll('.family__menu').forEach((menu) => {
    menu.hidden = true;
  });
  document.querySelectorAll('[data-family-btn]').forEach((btn) => {
    btn.setAttribute('aria-expanded', 'false');
  });
}

function openMenu(family) {
  if (openFamily === family) {
    closeMenus();
    return;
  }
  closeMenus();
  openFamily = family;
  const group = document.querySelector(`.family__group[data-family="${family}"]`);
  const menu = document.getElementById(`menu-${family}`);
  const btn = group?.querySelector('[data-family-btn]');
  if (!menu || !btn) return;
  menu.hidden = false;
  btn.setAttribute('aria-expanded', 'true');
}

function setModelUi(modelId) {
  const cfg = MODELS[modelId];
  if (!cfg) return;
  document.querySelectorAll('[data-family-btn]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.familyBtn === cfg.family);
  });
  document.querySelectorAll('[data-model]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.model === modelId);
  });
}

function setLightbar(connected) {
  const mount = document.getElementById('padMount');
  if (!mount) return;
  const on = !!connected;
  const key = `${activeModel}:${on ? 1 : 0}`;
  if (mount.dataset.lightbarOn === key) return;
  mount.dataset.lightbarOn = key;

  if (activeModel === 'ps5') {
    const withLed = mount.querySelector('#path547-7');
    const withoutLed = mount.querySelector('#path51327-9');
    if (withLed) withLed.style.display = on ? 'inline' : 'none';
    if (withoutLed) withoutLed.style.display = on ? 'none' : 'inline';
    return;
  }

  if (activeModel === 'ps4') {
    const frontOn = mount.querySelector('#rect3340');
    const frontOff = mount.querySelector('#rect1030');
    const rearOn = mount.querySelector('#path2171');
    const rearOff = mount.querySelector('#path1010');
    if (frontOn) frontOn.style.display = on ? 'inline' : 'none';
    if (frontOff) frontOff.style.display = on ? 'none' : 'inline';
    if (rearOn) rearOn.style.display = on ? 'inline' : 'none';
    if (rearOff) rearOff.style.display = on ? 'none' : 'inline';
  }
}

function syncPadStatus() {
  const stage = document.getElementById('padStage');
  const pads = navigator.getGamepads?.() || [];
  const live = [...pads].some((p) => p);
  if (stage) {
    const wasLive = stage.classList.contains('is-live');
    if (wasLive !== live) stage.classList.toggle('is-live', live);
  }
  setLightbar(live);
}

async function loadModel(modelId) {
  const cfg = MODELS[modelId];
  const mount = document.getElementById('padMount');
  if (!cfg || !viz || !mount) return;

  activeModel = modelId;
  setModelUi(modelId);
  window.AphroditeBinds?.setModel?.(modelId);
  closeMenus();
  mount.classList.add('is-loading');
  await viz.load(cfg.variant, cfg.src());
  mount.classList.remove('is-loading');
  mount.dataset.lightbarOn = '';
  startViz();
  syncPadStatus();
  wireControllerClicks();
}

async function boot() {
  try { void window.blank?.licenseUnlocked?.() || void window.aphrodite?.licenseUnlocked?.(); } catch (_) {}
  // macro-pref.json is the durable copy, so read it back before anything paints
  // or pushes — otherwise stale UI state overwrites the binds that were saved.
  try {
    const live = await window.aphrodite?.macros?.getConfig?.();
    if (live?.ok) {
      window.AphroditeBinds?.hydrate?.(live.binds);
      window.AphroditeMacros?.hydrate?.(live);
      hydrateTapDelay(live);
    }
  } catch {
    /* fall back to local state */
  }

  bootTapDelayModal();

  // Macros/binds first — never wait on SVG load or visualizer (that used to
  // skip pushEngineConfig and leave Drag/Pickup/Build disabled in main).
  window.AphroditeBinds?.init?.();
  window.AphroditeBinds?.setModel?.(activeModel);
  window.AphroditeMacros?.init?.();
  window.AphroditeSettings?.init?.();

  const closeChooser = document.getElementById('closeChooser');

  function openCloseChooser() {
    if (!closeChooser) {
      window.aphrodite?.hide?.() || window.aphrodite?.close?.();
      return;
    }
    closeChooser.hidden = false;
  }

  function dismissCloseChooser() {
    if (closeChooser) closeChooser.hidden = true;
  }

  // Home/window chrome only — login topbar binds its own controls in nova-login.js.
  // Binding both would double-toggle fullscreen (enter then exit in one click).
  document.querySelectorAll('[data-win]').forEach((btn) => {
    if (btn.closest('#novaLogin')) return;
    btn.addEventListener('click', () => {
      const action = btn.dataset.win;
      if (action === 'minimize') window.aphrodite?.minimize();
      if (action === 'maximize' || action === 'fullscreen') {
        void window.aphrodite?.fullscreen?.();
      }
      if (action === 'close') openCloseChooser();
    });
  });

  function syncFullscreenUi(on) {
    const active = !!on;
    document.documentElement.classList.toggle('is-fullscreen', active);
    document.body.classList.toggle('is-fullscreen', active);
    document.querySelectorAll('[data-win="fullscreen"]').forEach((btn) => {
      const enter = btn.querySelector('.win__icon--enter, .window-btn__icon--enter');
      const exit = btn.querySelector('.win__icon--exit, .window-btn__icon--exit');
      if (enter) enter.hidden = active;
      if (exit) exit.hidden = !active;
      btn.title = active ? 'Exit fullscreen (F11)' : 'Fullscreen (F11)';
      btn.setAttribute('aria-label', active ? 'Exit fullscreen' : 'Fullscreen');
    });
  }

  window.aphrodite?.onFullscreenChange?.(syncFullscreenUi);
  // Seed once in case we resume already fullscreen.
  void window.aphrodite?.isFullscreen?.().then?.(syncFullscreenUi).catch?.(() => {});

  window.addEventListener('keydown', (e) => {
    if (e.key === 'F11') {
      e.preventDefault();
      void window.aphrodite?.fullscreen?.();
    }
  });

  closeChooser?.addEventListener('click', (e) => {
    const action = e.target.closest('[data-close-chooser]')?.dataset.closeChooser;
    if (!action) return;
    if (action === 'dismiss') {
      dismissCloseChooser();
      return;
    }
    if (action === 'hide') {
      dismissCloseChooser();
      window.aphrodite?.hide?.();
      return;
    }
    if (action === 'quit') {
      dismissCloseChooser();
      window.aphrodite?.quit?.();
    }
  });

  window.aphrodite?.onCloseAsk?.(() => openCloseChooser());

  document.querySelectorAll('[data-view]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showPage(btn.dataset.view || 'home');
    });
  });

  document.getElementById('devRefresh')?.addEventListener('click', () => {
    void refreshDevPanel();
  });

  document.getElementById('blankSocials')?.addEventListener('click', (e) => {
    const link = e.target.closest('[data-external]');
    if (!link) return;
    e.preventDefault();
    const url = link.getAttribute('data-external');
    if (url) (window.blank || window.aphrodite || window.sjay)?.openExternal?.(url);
  });

  showPage('home');

  const mount = document.getElementById('padMount');
  if (!mount || !window.NovaInputOcControllerVisualizer) return;

  document.querySelectorAll('[data-family-btn]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openMenu(btn.dataset.familyBtn);
    });
  });

  document.querySelectorAll('[data-model]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const next = btn.dataset.model;
      if (!next) return;
      loadModel(next).catch((err) => console.error('[model]', err));
    });
  });

  document.addEventListener('click', () => closeMenus());
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const tapModal = document.getElementById('tapDelayModal');
      if (tapModal && !tapModal.hidden) return;
      const chooser = document.getElementById('closeChooser');
      if (chooser && !chooser.hidden) {
        chooser.hidden = true;
        return;
      }
      closeMenus();
    }
  });

  let padBooted = false;
  async function bootPad() {
    if (padBooted) return;
    padBooted = true;
    await window.NovaInputOcControllerVisualizer.preloadSvgs?.([
      'assets/dualsense.svg',
      'assets/dualshock4.svg',
      'assets/xbox-series.svg',
      'assets/xbox-one.svg',
    ]);
    mount.classList.add('is-loading');
    viz = window.NovaInputOcControllerVisualizer.mount(mount);
    startViz();
    await loadModel(activeModel);
    mount.classList.remove('is-loading');
  }

  if (document.documentElement.classList.contains('nova-login-pending')) {
    window.addEventListener('aphrodite:unlocked', () => {
      void bootPad().then(() => {
        startViz();
        syncPadStatus();
      });
    }, { once: true });
  } else {
    await bootPad();
  }

  window.addEventListener('gamepadconnected', () => {
    startViz();
    syncPadStatus();
  });
  window.addEventListener('gamepaddisconnected', syncPadStatus);
  setInterval(syncPadStatus, 2000);
}

boot().catch((err) => console.error('[aphrodite]', err));
