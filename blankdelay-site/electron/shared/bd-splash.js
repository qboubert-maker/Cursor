/* BlankDelay — splash + key activation controller (all products) */
(function () {
    const MARK_SVG = '<svg viewBox="0 0 32 32"><circle cx="8" cy="16" r="3.5" fill="currentColor"/><path fill="currentColor" d="M11 16h4l14-6-3 6 3 6-14-6z"/></svg>';

    function buildHtml(cfg) {
        return `
        <div class="bd-splash-corner bd-splash-corner-tl">
            <span class="mark2">${MARK_SVG}</span> BLANKDELAY <span style="opacity:.4">|</span> ${cfg.shortName}
        </div>
        <div class="bd-splash-corner bd-splash-corner-br">
            <span>BLANKDELAY</span><span class="accent2">&nbsp;${cfg.shortName}</span>
        </div>
        <div class="bd-splash-power">Powered by BlankDelay Systems</div>

        <div class="bd-splash-stage" id="bd-splash-stage">
            <div class="bd-splash-word" id="bd-splash-logo">
                <span class="w-blank">BLANK</span><span class="w-delay">DELAY</span>
            </div>
            <div class="bd-splash-product">${cfg.title}</div>
            <div class="bd-splash-tagline">${cfg.tagline}</div>
            <button type="button" class="bd-splash-tap" id="bd-splash-tap">Tap logo to continue</button>
        </div>

        <div class="bd-splash-key-wrap" id="bd-splash-key-wrap" hidden>
            <div class="bd-splash-key-card">
                <div class="bd-splash-key-mark">${MARK_SVG}</div>
                <h2>${cfg.title}</h2>
                <p class="sub">Enter your license key to unlock ${cfg.shortName}</p>
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

        function showKeyScreen() {
            stage.style.display = 'none';
            keyWrap.hidden = false;
            keyInput.focus();
        }
        function showLogoScreen() {
            keyWrap.hidden = true;
            stage.style.display = 'flex';
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
                    document.body.classList.add('bd-licensed');
                    const screen = document.getElementById('bd-splash-screen');
                    const main = document.getElementById('bd-app-main');
                    setTimeout(() => {
                        screen?.classList.add('panel-hidden');
                        if (main) main.hidden = false;
                        if (o.onUnlock) o.onUnlock(result);
                        resolve(result);
                    }, o.instant ? 0 : 650);
                } else {
                    msg.textContent = result.msg || 'Invalid license key.';
                    msg.className = 'bd-splash-key-msg error';
                }
            });
        });
    }

    window.BdSplash = { init };
})();
