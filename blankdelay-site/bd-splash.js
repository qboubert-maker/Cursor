/* BlankDelay — splash + Discord key gate (nova/Blank Optimizer style) for all products */
(function () {
    const MARK_SVG = '<svg viewBox="0 0 32 32"><circle cx="8" cy="16" r="3.5" fill="currentColor"/><path fill="currentColor" d="M11 16h4l14-6-3 6 3 6-14-6z"/></svg>';
    const DISCORD_KEYS_URL = 'https://discord.gg/5gyVpYMY9';

    function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

    function formatKey(raw) {
        const compact = String(raw || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (compact.startsWith('BLANK')) {
            const rest = compact.slice(5);
            const a = rest.slice(0, 4);
            const b = rest.slice(4, 8);
            if (!a) return 'BLANK';
            return b ? `BLANK-${a}-${b}` : `BLANK-${a}`;
        }
        if (compact.startsWith('BD')) {
            const rest = compact.slice(2);
            const a = rest.slice(0, 4);
            const b = rest.slice(4, 8);
            const c = rest.slice(8, 12);
            if (!a) return 'BD';
            if (!b) return `BD-${a}`;
            if (!c) return `BD-${a}-${b}`;
            return `BD-${a}-${b}-${c}`;
        }
        return String(raw || '').trim().toUpperCase();
    }

    function buildHtml(cfg) {
        return `
        <canvas class="bd-splash-particles" id="bd-splash-particles" aria-hidden="true"></canvas>
        <div class="bd-splash-topbar">
            <div class="bd-splash-topbar-brand">
                <span class="mark2">${MARK_SVG}</span>
                <span class="bd-splash-topbar-name">BlankDelay</span>
                <span class="bd-splash-topbar-div"></span>
                <span class="bd-splash-topbar-suite">${cfg.shortName}</span>
            </div>
        </div>

        <div class="bd-splash-stage" id="bd-splash-stage">
            <div class="bd-splash-orbits" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
            <button type="button" class="bd-splash-logo-btn" id="bd-splash-logo" aria-label="Tap to continue">
                <span class="bd-splash-logo-halo" aria-hidden="true"></span>
                <span class="bd-splash-logo-ring" aria-hidden="true"></span>
                <span class="bd-splash-logo-ring bd-splash-logo-ring--rev" aria-hidden="true"></span>
                <span class="bd-splash-logo-mark">${MARK_SVG}</span>
            </button>
            <p class="bd-splash-product">${cfg.title}</p>
            <p class="bd-splash-tagline"><span>Optimize</span><span class="dot"></span><span>Accelerate</span><span class="dot"></span><span>Dominate</span></p>
            <button type="button" class="bd-splash-tap" id="bd-splash-tap">Tap logo to continue</button>
        </div>

        <div class="bd-splash-footer">
            <span>powered by BlankDelay</span>
            <span class="sep"></span>
            <span>${cfg.shortName}</span>
        </div>

        <div class="bd-splash-key-wrap" id="bd-splash-key-wrap" hidden>
            <div class="bd-splash-key-backdrop" id="bd-splash-key-backdrop"></div>
            <div class="bd-splash-key-card glass-strong">
                <div class="key-stripe"></div>
                <button type="button" class="bd-splash-key-close" id="bd-splash-back" aria-label="Close">×</button>
                <div class="bd-splash-key-header">
                    <div class="bd-splash-key-mark">${MARK_SVG}</div>
                    <div>
                        <div class="gate-brand">BlankDelay · ${cfg.shortName}</div>
                        <h2>Activate your key</h2>
                    </div>
                </div>
                <p class="sub">Paste your <strong>BLANK-XXXX-XXXX</strong> key from <a href="${DISCORD_KEYS_URL}" target="_blank" rel="noopener">Discord</a> or your purchase email. Legacy BD- keys still work.</p>
                <div class="bd-splash-key-input-wrap">
                    <input id="bd-splash-key-input" type="password" placeholder="BLANK-XXXX-XXXX" autocomplete="off" spellcheck="false">
                    <button type="button" class="bd-splash-key-toggle" id="bd-splash-key-toggle" aria-label="Show key">Show</button>
                </div>
                <button type="button" class="bd-splash-activate" id="bd-splash-activate-btn">Verify &amp; unlock</button>
                <a class="bd-splash-discord" href="${DISCORD_KEYS_URL}" target="_blank" rel="noopener">Get a key on Discord</a>
                <div class="bd-splash-validated" id="bd-splash-validated" hidden>✓ <span id="bd-splash-validated-text">Key validated</span></div>
                <p class="bd-splash-key-msg" id="bd-splash-key-msg"></p>
            </div>
        </div>`;
    }

    async function transitionToKey(stage, keyWrap) {
        stage.classList.add('bd-splash-exit');
        window.BdSplashFx?.burstAt(stage.querySelector('.bd-splash-logo-btn'), 42, 5);
        await wait(380);
        stage.style.visibility = 'hidden';
        keyWrap.hidden = false;
        keyWrap.classList.add('bd-splash-enter', 'is-open');
        window.BdSplashFx?.spawnAmbient?.();
    }

    async function transitionToApp(screen, main, onUnlock, result) {
        window.BdSplashFx?.burstCenter(64, 6);
        screen.classList.add('bd-splash-unlock');
        await wait(700);
        screen.classList.add('panel-hidden');
        if (main) {
            main.hidden = false;
            main.classList.add('bd-app-enter');
        }
        document.body.classList.add('bd-licensed');
        window.BdSplashFx?.destroy?.();
        if (onUnlock) onUnlock(result);
    }

    async function init(opts) {
        const o = opts || {};
        const mount = document.getElementById('bd-splash-root');
        if (!mount) return null;

        const cfg = {
            title: mount.dataset.title || 'PRODUCT',
            shortName: mount.dataset.shortName || mount.dataset.title || 'Product',
            tagline: mount.dataset.tagline || 'Optimize · Accelerate · Dominate'
        };

        mount.outerHTML = `<div class="bd-splash-screen" id="bd-splash-screen">${buildHtml(cfg)}</div>`;

        const screen = document.getElementById('bd-splash-screen');
        const stage = document.getElementById('bd-splash-stage');
        const logo = document.getElementById('bd-splash-logo');
        const tapBtn = document.getElementById('bd-splash-tap');
        const keyWrap = document.getElementById('bd-splash-key-wrap');
        const keyInput = document.getElementById('bd-splash-key-input');
        const activateBtn = document.getElementById('bd-splash-activate-btn');
        const validated = document.getElementById('bd-splash-validated');
        const validatedText = document.getElementById('bd-splash-validated-text');
        const msg = document.getElementById('bd-splash-key-msg');
        const backLink = document.getElementById('bd-splash-back');
        const backdrop = document.getElementById('bd-splash-key-backdrop');
        const toggle = document.getElementById('bd-splash-key-toggle');

        window.BdSplashFx?.mount?.(screen);

        async function showKeyScreen() {
            window.BdSplashFx?.burstAt(tapBtn, 28, 4);
            await transitionToKey(stage, keyWrap);
            keyInput.focus();
        }

        async function showLogoScreen() {
            keyWrap.classList.add('bd-splash-exit');
            keyWrap.classList.remove('is-open');
            await wait(280);
            keyWrap.hidden = true;
            keyWrap.classList.remove('bd-splash-exit', 'bd-splash-enter');
            stage.style.visibility = 'visible';
            stage.classList.remove('bd-splash-exit');
            stage.classList.add('bd-splash-enter');
            await wait(30);
            stage.classList.remove('bd-splash-enter');
        }

        logo.addEventListener('click', showKeyScreen);
        tapBtn.addEventListener('click', showKeyScreen);
        backLink.addEventListener('click', showLogoScreen);
        backdrop?.addEventListener('click', showLogoScreen);
        toggle?.addEventListener('click', () => {
            const show = keyInput.type === 'password';
            keyInput.type = show ? 'text' : 'password';
            toggle.textContent = show ? 'Hide' : 'Show';
        });
        keyInput.addEventListener('input', () => {
            keyInput.value = formatKey(keyInput.value);
        });
        keyInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') activateBtn.click(); });

        return new Promise((resolve) => {
            activateBtn.addEventListener('click', async () => {
                if (activateBtn.disabled) return;
                const key = formatKey(keyInput.value || '');
                if (!key) {
                    msg.textContent = 'Enter a key.';
                    msg.className = 'bd-splash-key-msg error';
                    return;
                }
                activateBtn.disabled = true;
                activateBtn.textContent = 'Verifying…';
                msg.textContent = '';
                let result;
                try {
                    result = await window.blankDelay.validateKey(key);
                } catch (err) {
                    result = { valid: false, msg: err.message || 'Validation failed.' };
                }
                activateBtn.disabled = false;
                activateBtn.textContent = 'Verify & unlock';

                if (result.valid) {
                    validatedText.textContent = `Key validated: ${key}`;
                    validated.hidden = false;
                    msg.textContent = '';
                    window.BdSplashFx?.burstAt(activateBtn, 36, 5);
                    const main = document.getElementById('bd-app-main');
                    await wait(o.instant ? 0 : 480);
                    await transitionToApp(screen, main, o.onUnlock, result);
                    resolve(result);
                } else {
                    msg.textContent = result.msg || 'Invalid license key.';
                    msg.className = 'bd-splash-key-msg error';
                }
            });
        });
    }

    window.BdSplash = { init };
})();
