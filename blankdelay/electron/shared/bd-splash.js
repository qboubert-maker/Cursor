/* BlankDelay — splash + key activation controller (all products) */
(function () {
    const MARK_SVG = '<svg viewBox="0 0 32 32"><circle cx="8" cy="16" r="3.5" fill="currentColor"/><path fill="currentColor" d="M11 16h4l14-6-3 6 3 6-14-6z"/></svg>';

    function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

    function buildHtml(cfg) {
        return `
        <div class="bd-splash-corner bd-splash-corner-tl">
            <span class="mark2">${MARK_SVG}</span>
            <div class="bd-splash-corner-text">
                <span class="bd-splash-corner-brand">BLANKDELAY</span>
                <span class="bd-splash-corner-product">${cfg.shortName}</span>
            </div>
        </div>
        <div class="bd-splash-corner bd-splash-corner-br">
            <span class="bd-splash-corner-brand">BLANKDELAY</span>
            <span class="accent2">${cfg.shortName}</span>
        </div>
        <div class="bd-splash-power">Powered by BlankDelay Systems</div>

        <div class="bd-splash-stage" id="bd-splash-stage">
            <div class="bd-splash-word" id="bd-splash-logo">
                <span class="w-blank">BLANK</span><span class="w-delay">DELAY</span>
            </div>
            <div class="bd-splash-divider"></div>
            <div class="bd-splash-product">${cfg.title}</div>
            <div class="bd-splash-tagline">${cfg.tagline}</div>
            <button type="button" class="bd-splash-tap" id="bd-splash-tap">Tap to continue</button>
        </div>

        <div class="bd-splash-key-wrap" id="bd-splash-key-wrap" hidden>
            <div class="bd-splash-key-brand">
                <span class="kb-name">BLANK<span class="accent3">DELAY</span></span>
                <span class="kb-product">${cfg.shortName}</span>
            </div>
            <div class="bd-splash-key-card">
                <div class="bd-splash-key-mark">${MARK_SVG}</div>
                <h2>Activate ${cfg.shortName}</h2>
                <p class="sub">Enter the license key from your purchase email</p>
                <div class="bd-splash-key-input-wrap">
                    <input id="bd-splash-key-input" type="text" placeholder="BD-XXXX-XXXX-XXXX" autocomplete="off" spellcheck="false">
                </div>
                <button type="button" class="bd-splash-activate" id="bd-splash-activate-btn">Validate Key</button>
                <div class="bd-splash-validated" id="bd-splash-validated" hidden>✓ <span id="bd-splash-validated-text">Key validated</span></div>
                <p class="bd-splash-key-msg" id="bd-splash-key-msg"></p>
                <div class="bd-splash-back" id="bd-splash-back">← Back</div>
            </div>
        </div>`;
    }

    async function transitionToKey(stage, keyWrap) {
        stage.classList.add('bd-splash-exit');
        window.BdSplashFx?.burstAt(stage.querySelector('.bd-splash-word'), 42, 5);
        await wait(420);
        stage.style.display = 'none';
        keyWrap.hidden = false;
        keyWrap.classList.add('bd-splash-enter');
        window.BdSplashFx?.spawnAmbient?.();
        await wait(30);
        keyWrap.classList.remove('bd-splash-enter');
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

        window.BdSplashFx?.mount?.(screen);

        async function showKeyScreen() {
            window.BdSplashFx?.burstAt(tapBtn, 28, 4);
            await transitionToKey(stage, keyWrap);
            keyInput.focus();
        }

        async function showLogoScreen() {
            keyWrap.classList.add('bd-splash-exit');
            await wait(320);
            keyWrap.hidden = true;
            keyWrap.classList.remove('bd-splash-exit', 'bd-splash-enter');
            stage.style.display = 'flex';
            stage.classList.remove('bd-splash-exit');
            stage.classList.add('bd-splash-enter');
            await wait(30);
            stage.classList.remove('bd-splash-enter');
        }

        logo.addEventListener('click', showKeyScreen);
        tapBtn.addEventListener('click', showKeyScreen);
        backLink.addEventListener('click', showLogoScreen);
        keyInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') activateBtn.click(); });

        return new Promise((resolve) => {
            activateBtn.addEventListener('click', async () => {
                if (activateBtn.disabled) return;
                const key = (keyInput.value || '').trim();
                if (!key) {
                    msg.textContent = 'Enter a key.';
                    msg.className = 'bd-splash-key-msg error';
                    return;
                }
                activateBtn.disabled = true;
                activateBtn.textContent = 'Validating…';
                msg.textContent = '';
                let result;
                try {
                    result = await window.blankDelay.validateKey(key);
                } catch (err) {
                    result = { valid: false, msg: err.message || 'Validation failed.' };
                }
                activateBtn.disabled = false;
                activateBtn.textContent = 'Validate Key';

                if (result.valid) {
                    validatedText.textContent = `Key validated: ${key.toUpperCase()}`;
                    validated.hidden = false;
                    msg.textContent = '';
                    window.BdSplashFx?.burstAt(activateBtn, 36, 5);
                    const main = document.getElementById('bd-app-main');
                    await wait(o.instant ? 0 : 520);
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
