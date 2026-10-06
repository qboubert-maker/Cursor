/* BlankDelay — shared license portal for all desktop products */
(function () {
    const MARK_SVG = '<svg viewBox="0 0 32 32"><circle cx="8" cy="16" r="3.5" fill="currentColor"/><path fill="currentColor" d="M11 16h4l14-6-3 6 3 6-14-6z"/></svg>';

    function ensureOverlayLayers() {
        if (!document.getElementById('bg-vignette')) {
            const v = document.createElement('div');
            v.className = 'bd-bg-vignette';
            v.id = 'bg-vignette';
            const canvas = document.getElementById('bg-canvas');
            if (canvas?.parentNode) canvas.parentNode.insertBefore(v, canvas.nextSibling);
            else document.body.prepend(v);
        }
        if (!document.getElementById('cursor-glow')) {
            const c = document.createElement('div');
            c.className = 'bd-cursor-glow';
            c.id = 'cursor-glow';
            document.body.appendChild(c);
        }
        document.addEventListener('mousemove', e => {
            const glow = document.getElementById('cursor-glow');
            if (!glow) return;
            if (!glow._pending) {
                glow._pending = true;
                requestAnimationFrame(() => {
                    glow._pending = false;
                    glow.style.left = glow._lx + 'px';
                    glow.style.top = glow._ly + 'px';
                });
            }
            glow._lx = e.clientX;
            glow._ly = e.clientY;
            glow.style.opacity = document.body.classList.contains('bd-licensed') ? '0.35' : '1';
        });
    }

    function buildPortalHtml(cfg) {
        const feats = cfg.features.map(f => `<span>${f}</span>`).join('');
        return `
        <div class="bd-license-screen" id="bd-license-screen">
            <div class="bd-license-aura"></div>
            <div class="bd-license-ring bd-license-ring--1"></div>
            <div class="bd-license-ring bd-license-ring--2"></div>
            <div class="bd-license-portal">
                <div class="bd-license-icon-wrap">
                    <div class="bd-license-icon-glow"></div>
                    <span class="mark bd-license-mark">${MARK_SVG}</span>
                </div>
                <p class="bd-license-eyebrow">${cfg.eyebrow}</p>
                <h2 class="bd-license-title">BLANK DELAY <span>${cfg.title}</span></h2>
                <p class="bd-license-tagline">${cfg.tagline}</p>
                <div class="bd-key-field">
                    <label for="license-key">License Key</label>
                    <div class="bd-key-input-wrap">
                        <span class="bd-key-icon">${MARK_SVG}</span>
                        <input id="license-key" type="text" placeholder="BD-XXXX-XXXX-XXXX" autocomplete="off" spellcheck="false">
                        <div class="bd-key-shine"></div>
                    </div>
                    <p class="field-hint bd-key-hint" id="key-hint"></p>
                </div>
                <button type="button" class="btn bd-activate-btn" id="license-btn">
                    <span class="bd-btn-text">Activate License</span>
                    <span class="bd-btn-glow"></span>
                </button>
                <p class="license-msg" id="license-msg"></p>
                <div class="bd-license-features">${feats}</div>
            </div>
        </div>`;
    }

    async function init(opts) {
        const mount = document.getElementById('bd-license-portal');
        if (!mount) return null;

        const cfg = {
            eyebrow: mount.dataset.eyebrow || 'BlankDelay',
            title: mount.dataset.title || 'PRODUCT',
            tagline: mount.dataset.tagline || 'Enter your license key to unlock',
            features: (mount.dataset.features || 'Licensed,Secure,Live').split(',').map(s => s.trim()).filter(Boolean)
        };

        ensureOverlayLayers();
        mount.outerHTML = buildPortalHtml(cfg);

        const licenseMsg = document.getElementById('license-msg');
        const keyHint = document.getElementById('key-hint');
        const btn = document.getElementById('license-btn');
        const keyInput = document.getElementById('license-key');
        const vignette = document.getElementById('bg-vignette');

        if (vignette) vignette.style.opacity = '0.35';

        keyInput?.addEventListener('keydown', e => {
            if (e.key === 'Enter') btn?.click();
        });

        return new Promise(resolve => {
            btn?.addEventListener('click', async () => {
                if (btn.disabled || btn.classList.contains('is-loading')) return;
                const key = keyInput?.value?.trim();
                if (!key) {
                    licenseMsg.textContent = 'Enter a key.';
                    licenseMsg.className = 'license-msg error';
                    return;
                }
                btn.disabled = true;
                btn.classList.add('is-loading');
                licenseMsg.textContent = '';
                let result;
                try {
                    result = await window.blankDelay.validateKey(key);
                } catch (err) {
                    result = { valid: false, msg: err.message || 'Validation failed.' };
                }
                btn.classList.remove('is-loading');
                btn.disabled = false;

                if (result.valid) {
                    licenseMsg.textContent = '✓ ' + result.msg;
                    licenseMsg.className = 'license-msg success';
                    document.body.classList.add('bd-licensed');
                    const screen = document.getElementById('bd-license-screen');
                    const main = document.getElementById('bd-app-main');
                    setTimeout(() => {
                        screen?.classList.add('panel-hidden');
                        if (main) main.hidden = false;
                        if (vignette) vignette.style.opacity = '0.2';
                        if (opts.onUnlock) opts.onUnlock(result);
                        resolve(result);
                    }, opts.instant ? 0 : 280);
                } else {
                    licenseMsg.textContent = '✗ ' + result.msg;
                    licenseMsg.className = 'license-msg error';
                    document.querySelector('.bd-key-input-wrap')?.classList.add('bd-key-error');
                    setTimeout(() => document.querySelector('.bd-key-input-wrap')?.classList.remove('bd-key-error'), 500);
                }
            });
        });
    }

    window.BdLicensePortal = { init };
})();
