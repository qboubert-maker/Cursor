'use strict';

/**
 * Drivers page — bundled ViGEmBus / HidHide install flow.
 */
(function (global) {
  function init() {
    const api = global.aphrodite?.drivers;
    const grid = document.getElementById('driversGrid');
    const installAll = document.getElementById('driversInstallAll');
    const footer = document.getElementById('driversFooter');
    if (!grid) return;

    if (!api) {
      if (footer) {
        footer.textContent = 'Driver install needs the desktop app. Close other windows and run npm start.';
      }
      return;
    }

    const cards = new Map();
    grid.querySelectorAll('[data-driver]').forEach((card) => {
      cards.set(card.dataset.driver, card);
    });

    let busy = false;
    let cloakBusy = false;
    let hidhideInstalled = false;

    const cloakToggle = document.getElementById('hidhideToggle');
    const cloakStateEl = document.getElementById('hidhideCloakState');
    const cloakNoteEl = document.getElementById('hidhideCloakNote');
    const hidhideCard = cards.get('hidhide');
    const hidhideApi = global.aphrodite?.hidhide;

    const sourceLabel = (src) => {
      if (src === 'bundled') return 'Bundled';
      if (src === 'cached') return 'Downloaded';
      return 'GitHub';
    };

    const paintCloak = (status) => {
      const active = !!status?.active;
      const installed = !!status?.installed || hidhideInstalled;
      hidhideInstalled = installed;

      if (hidhideCard) {
        hidhideCard.classList.toggle('is-cloak-on', active);
      }
      if (cloakStateEl) {
        const target = status?.target || status?.vigem?.target;
        const targetLabel = target === 'ds4' ? 'DS4' : (target === 'x360' ? 'Xbox' : null);
        cloakStateEl.textContent = cloakBusy
          ? 'Updating…'
          : (active
            ? (targetLabel ? `On · ${targetLabel}` : 'On · hiding pads')
            : 'Off');
      }
      if (cloakToggle) {
        cloakToggle.classList.toggle('is-on', active);
        cloakToggle.classList.toggle('is-busy', cloakBusy);
        cloakToggle.setAttribute('aria-pressed', active ? 'true' : 'false');
        cloakToggle.disabled = cloakBusy || busy || !installed;
      }
      if (cloakNoteEl) {
        if (!installed) {
          cloakNoteEl.textContent = 'Install HidHide first, then use this switch to turn cloak on or off.';
        } else if (status?.error) {
          cloakNoteEl.textContent = status.error;
        } else if (status?.note) {
          cloakNoteEl.textContent = status.note;
        } else if (active) {
          cloakNoteEl.textContent = 'Cloak is on — games only see the virtual pad.';
        } else {
          cloakNoteEl.textContent = 'Cloak arms when your pad connects so macros reach the game. Toggle off only if you want the physical pad visible.';
        }
      }
    };

    const refreshCloak = async () => {
      if (!hidhideApi?.status) {
        paintCloak({ installed: hidhideInstalled, active: false });
        return null;
      }
      try {
        const status = await hidhideApi.status();
        paintCloak(status);
        return status;
      } catch (err) {
        console.error('[hidhide]', err);
        if (cloakNoteEl) cloakNoteEl.textContent = String(err?.message || err);
        return null;
      }
    };

    const paintCard = (id, info) => {
      const card = cards.get(id);
      if (!card || !info) return;
      const status = card.querySelector('[data-driver-status]');
      const source = card.querySelector('[data-driver-source]');
      const btn = card.querySelector('[data-driver-install]');

      card.classList.toggle('is-ready', !!info.installed);
      card.classList.toggle('is-missing', !info.installed);

      if (status) status.textContent = info.installed ? 'Installed' : 'Not installed';
      if (source) source.textContent = sourceLabel(info.source);
      if (btn) {
        btn.textContent = info.installed ? 'Installed' : 'Install';
        btn.disabled = busy || !!info.installed;
      }

      if (id === 'hidhide') {
        hidhideInstalled = !!info.installed;
        if (cloakToggle) cloakToggle.disabled = cloakBusy || busy || !info.installed;
      }
    };

    const paint = (status) => {
      busy = !!status?.busy;
      const drivers = status?.drivers || {};
      ['vigem', 'hidhide'].forEach((id) => {
        if (drivers[id]) paintCard(id, drivers[id]);
      });

      const missing = Array.isArray(status?.missingRequired)
        ? status.missingRequired
        : (Array.isArray(status?.missing)
          ? status.missing.filter((id) => id === 'vigem' || id === 'hidhide')
          : []);

      if (installAll) {
        installAll.hidden = false;
        installAll.disabled = busy || !!status?.allReady;
        installAll.textContent = busy
          ? 'Installing…'
          : (status?.allReady ? 'Drivers ready' : 'Install all');
      }

      if (footer && !busy && status?.allReady) {
        footer.textContent = 'PlayStation & Xbox drivers are ready. No extra platform packs needed.';
      } else if (footer && !busy && missing.length) {
        footer.textContent = status?.elevated
          ? 'Missing drivers will install without an extra Windows prompt (app is already elevated).'
          : 'Install all uses one Windows approval for both drivers — PlayStation and Xbox share the same set.';
      } else if (footer && !busy) {
        footer.textContent = 'Install both drivers to use macros. Approve the Windows prompt once.';
      }
    };

    const showProgress = (payload) => {
      const id = payload?.id;
      const message = payload?.message || '';
      if (footer && !id && message) footer.textContent = message;
      if (!id) {
        if (payload?.phase === 'done' || payload?.phase === 'error' || payload?.phase === 'reboot') {
          cards.forEach((card) => card.classList.remove('is-busy'));
        }
        return;
      }

      cards.forEach((card, key) => {
        const progress = card.querySelector('[data-driver-progress]');
        const note = card.querySelector('[data-driver-note]');
        const bar = card.querySelector('[data-driver-bar]');
        const active = id === key;
        const running = active && payload?.phase && !['done', 'error', 'reboot'].includes(payload.phase);

        card.classList.toggle('is-busy', !!running && active);

        if (!progress || !active) return;
        if (message) {
          progress.hidden = false;
          if (note) note.textContent = message;
          if (bar) {
            const pct = Number.isFinite(payload?.percent) ? payload.percent : (running ? 35 : 100);
            bar.style.width = `${Math.max(0, Math.min(100, pct))}%`;
          }
        }
        if (!running && !busy && payload?.phase === 'done') {
          progress.hidden = true;
        }
      });
    };

    const refresh = async () => {
      try {
        const status = await api.status();
        paint(status);
        await refreshCloak();
        return status;
      } catch (err) {
        console.error('[drivers]', err);
        if (footer) footer.textContent = String(err?.message || err);
        return null;
      }
    };

    const runInstall = async (ids) => {
      if (busy) return;
      busy = true;
      paint({ busy: true, drivers: {}, missing: ids || ['vigem', 'hidhide'], allReady: false });
      cards.forEach((card) => {
        const btn = card.querySelector('[data-driver-install]');
        if (btn) btn.disabled = true;
      });
      if (installAll) {
        installAll.hidden = false;
        installAll.disabled = true;
        installAll.textContent = 'Installing…';
      }

      try {
        const target = Array.isArray(ids) && ids.length ? ids : ['vigem', 'hidhide'];
        const result = await api.install(target);
        if (result?.status) paint(result.status);
        else await refresh();

        if (footer) {
          if (result?.cancelled) {
            footer.textContent = 'Windows approval was cancelled. Click Install all once and approve to finish.';
          } else if (result?.reboot) {
            footer.textContent = 'Drivers installed. Restart Windows, then reopen the app.';
          } else if (result?.error) {
            footer.textContent = result.error;
          } else if (result?.ok) {
            footer.textContent = 'PlayStation & Xbox drivers are ready.';
          }
        }
      } catch (err) {
        console.error('[drivers] install', err);
        if (footer) footer.textContent = String(err?.message || err);
        await refresh();
      } finally {
        busy = false;
        await refresh();
      }
    };

    const runCloakToggle = async () => {
      if (!hidhideApi?.set || cloakBusy || busy || !hidhideInstalled) return;
      const next = !cloakToggle?.classList.contains('is-on');
      cloakBusy = true;
      if (cloakToggle) cloakToggle.disabled = true;
      if (cloakNoteEl) {
        cloakNoteEl.textContent = next
          ? 'Turning cloak on…'
          : 'Turning cloak off…';
      }
      try {
        const result = await hidhideApi.set(next);
        paintCloak(result);
        if (result?.error && cloakNoteEl) cloakNoteEl.textContent = result.error;
      } catch (err) {
        console.error('[hidhide] set', err);
        if (cloakNoteEl) cloakNoteEl.textContent = String(err?.message || err);
        await refreshCloak();
      } finally {
        cloakBusy = false;
        await refreshCloak();
      }
    };

    cards.forEach((card, id) => {
      card.querySelector('[data-driver-install]')?.addEventListener('click', () => {
        void runInstall([id]);
      });
    });

    installAll?.addEventListener('click', () => {
      void runInstall();
    });

    cloakToggle?.addEventListener('click', (e) => {
      e.stopPropagation();
      void runCloakToggle();
    });

    api.onProgress?.(showProgress);

    const page = document.querySelector('[data-page="settings"]');
    if (page) {
      const obs = new MutationObserver(() => {
        if (!page.hidden) void refresh();
      });
      obs.observe(page, { attributes: true, attributeFilter: ['hidden'] });
    }

    void refresh();
  }

  global.AphroditeSettings = { init };
})(typeof window !== 'undefined' ? window : globalThis);
