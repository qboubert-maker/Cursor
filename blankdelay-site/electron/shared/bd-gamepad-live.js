/* BlankDelay — live gamepad viewer (e7d-style DualSense / Xbox overlays) */
const BdGamepadLive = (function () {
    const COLORS = {
        black: { body: '#111', accent: '#fff', lit: '#fff', dim: 'rgba(255,255,255,0.18)' },
        white: { body: '#f2f2f2', accent: '#111', lit: '#111', dim: 'rgba(0,0,0,0.18)' },
        magenta: { body: '#1a001a', accent: '#ff2bd6', lit: '#ff2bd6', dim: 'rgba(255,43,214,0.25)' },
        lime: { body: '#0a1408', accent: '#57f287', lit: '#57f287', dim: 'rgba(87,242,135,0.25)' },
        grey: { body: '#2a2a2a', accent: '#bbb', lit: '#ddd', dim: 'rgba(255,255,255,0.15)' }
    };

    function detectSkin(id) {
        const s = (id || '').toLowerCase();
        if (s.includes('054c') || s.includes('dualsense') || s.includes('dualshock') || s.includes('playstation') || s.includes('sony')) return 'dualsense';
        if (s.includes('xbox') || s.includes('xinput') || s.includes('045e') || s.includes('microsoft')) return 'xbox';
        return 'dualsense';
    }

    function dualSenseSvg(c) {
        return `<svg viewBox="0 0 520 300" class="bd-gp-svg" xmlns="http://www.w3.org/2000/svg">
            <defs><filter id="bdgpGlow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
            <path class="bd-gp-body" d="M260 40 C335 40 395 62 422 98 C448 128 454 160 440 190 C426 220 396 242 354 256 L332 268 C310 280 288 288 260 288 C232 288 210 280 188 268 L166 256 C124 242 94 220 80 190 C66 160 72 128 98 98 C125 62 185 40 260 40 Z" fill="${c.body}" stroke="${c.accent}" stroke-width="3"/>
            <rect data-btn="touch" x="205" y="78" width="110" height="58" rx="10" fill="none" stroke="${c.dim}" stroke-width="2"/>
            <circle data-btn="10" cx="175" cy="168" r="26" fill="none" stroke="${c.dim}" stroke-width="2"/>
            <circle data-btn="11" cx="345" cy="168" r="26" fill="none" stroke="${c.dim}" stroke-width="2"/>
            <g data-btn="0"><circle cx="378" cy="180" r="12" fill="${c.dim}"/><text x="378" y="184" text-anchor="middle" font-size="10" fill="${c.accent}">✕</text></g>
            <g data-btn="1"><circle cx="402" cy="156" r="12" fill="${c.dim}"/><text x="402" y="160" text-anchor="middle" font-size="10" fill="${c.accent}">○</text></g>
            <g data-btn="2"><circle cx="354" cy="156" r="12" fill="${c.dim}"/><text x="354" y="160" text-anchor="middle" font-size="10" fill="${c.accent}">□</text></g>
            <g data-btn="3"><circle cx="378" cy="132" r="12" fill="${c.dim}"/><text x="378" y="136" text-anchor="middle" font-size="10" fill="${c.accent}">△</text></g>
            <rect data-btn="12" x="136" y="128" width="18" height="14" rx="3" fill="${c.dim}"/>
            <rect data-btn="13" x="136" y="158" width="18" height="14" rx="3" fill="${c.dim}"/>
            <rect data-btn="14" x="120" y="143" width="14" height="14" rx="3" fill="${c.dim}"/>
            <rect data-btn="15" x="156" y="143" width="14" height="14" rx="3" fill="${c.dim}"/>
            <rect data-btn="4" x="95" y="88" width="58" height="14" rx="4" fill="${c.dim}"/>
            <rect data-btn="5" x="367" y="88" width="58" height="14" rx="4" fill="${c.dim}"/>
            <rect data-btn="6" x="95" y="68" width="58" height="12" rx="3" fill="${c.dim}"/>
            <rect data-btn="7" x="367" y="68" width="58" height="12" rx="3" fill="${c.dim}"/>
            <circle data-btn="8" cx="230" cy="120" r="6" fill="${c.dim}"/>
            <circle data-btn="9" cx="290" cy="120" r="6" fill="${c.dim}"/>
            <text x="260" y="292" text-anchor="middle" fill="${c.accent}" font-size="12" font-family="monospace" opacity="0.7">DUALSENSE · LIVE</text>
        </svg>`;
    }

    function xboxSvg(c) {
        return `<svg viewBox="0 0 520 300" class="bd-gp-svg" xmlns="http://www.w3.org/2000/svg">
            <path class="bd-gp-body" d="M260 44 C340 44 398 72 418 112 C434 142 428 178 402 208 C376 236 336 254 296 262 L276 270 C268 274 264 276 260 276 C256 276 252 274 244 270 L224 262 C184 254 144 236 118 208 C92 178 86 142 102 112 C122 72 180 44 260 44 Z" fill="${c.body}" stroke="${c.accent}" stroke-width="3"/>
            <circle data-btn="10" cx="185" cy="165" r="28" fill="none" stroke="${c.dim}" stroke-width="2"/>
            <circle data-btn="11" cx="335" cy="165" r="28" fill="none" stroke="${c.dim}" stroke-width="2"/>
            <g data-btn="0"><circle cx="365" cy="185" r="13" fill="${c.dim}"/><text x="365" y="189" text-anchor="middle" font-size="11" fill="${c.accent}">A</text></g>
            <g data-btn="1"><circle cx="390" cy="160" r="13" fill="${c.dim}"/><text x="390" y="164" text-anchor="middle" font-size="11" fill="${c.accent}">B</text></g>
            <g data-btn="2"><circle cx="340" cy="160" r="13" fill="${c.dim}"/><text x="340" y="164" text-anchor="middle" font-size="11" fill="${c.accent}">X</text></g>
            <g data-btn="3"><circle cx="365" cy="135" r="13" fill="${c.dim}"/><text x="365" y="139" text-anchor="middle" font-size="11" fill="${c.accent}">Y</text></g>
            <rect data-btn="12" x="118" y="138" width="18" height="14" rx="3" fill="${c.dim}"/>
            <rect data-btn="13" x="118" y="168" width="18" height="14" rx="3" fill="${c.dim}"/>
            <rect data-btn="14" x="102" y="153" width="14" height="14" rx="3" fill="${c.dim}"/>
            <rect data-btn="15" x="138" y="153" width="14" height="14" rx="3" fill="${c.dim}"/>
            <rect data-btn="4" x="100" y="92" width="54" height="14" rx="4" fill="${c.dim}"/>
            <rect data-btn="5" x="366" y="92" width="54" height="14" rx="4" fill="${c.dim}"/>
            <rect data-btn="6" x="100" y="72" width="54" height="12" rx="3" fill="${c.dim}"/>
            <rect data-btn="7" x="366" y="72" width="54" height="12" rx="3" fill="${c.dim}"/>
            <circle data-btn="8" cx="230" cy="118" r="7" fill="${c.dim}"/>
            <circle data-btn="9" cx="290" cy="118" r="7" fill="${c.dim}"/>
            <text x="260" y="292" text-anchor="middle" fill="${c.accent}" font-size="12" font-family="monospace" opacity="0.7">XBOX · LIVE</text>
        </svg>`;
    }

    function init(mountEl, opts) {
        if (!mountEl) return null;
        const o = opts || {};
        let colorKey = o.color || 'black';
        let skin = o.skin || 'auto';
        let gp = null;
        let raf = 0;

        mountEl.innerHTML = `
            <div class="bd-gp-viewer" data-bg="black">
                <div class="bd-gp-toolbar">
                    <select id="bd-gp-skin"><option value="auto">Auto Skin</option><option value="dualsense">DualSense / PS5</option><option value="xbox">Xbox</option></select>
                    <select id="bd-gp-color">
                        <option value="black">Black</option><option value="white">White</option>
                        <option value="magenta">Magenta</option><option value="lime">Lime</option><option value="grey">Grey</option>
                    </select>
                    <span class="bd-gp-status" id="bd-gp-status">Connect a controller</span>
                </div>
                <div class="bd-gp-stage" id="bd-gp-stage">
                    <div class="bd-gp-wait" id="bd-gp-wait">
                        <div class="pulse-ring"></div>
                        <strong>Connect Controller</strong>
                        <p>Press any button on your pad to activate the live display</p>
                    </div>
                    <div class="bd-gp-canvas" id="bd-gp-canvas" hidden></div>
                </div>
                <div class="bd-gp-meta mono" id="bd-gp-meta"></div>
            </div>`;

        const stage = mountEl.querySelector('#bd-gp-canvas');
        const wait = mountEl.querySelector('#bd-gp-wait');
        const status = mountEl.querySelector('#bd-gp-status');
        const meta = mountEl.querySelector('#bd-gp-meta');
        const skinSel = mountEl.querySelector('#bd-gp-skin');
        const colorSel = mountEl.querySelector('#bd-gp-color');
        colorSel.value = colorKey;

        function renderShell() {
            const c = COLORS[colorKey] || COLORS.black;
            const id = gp?.id || '';
            const use = skin === 'auto' ? detectSkin(id) : skin;
            stage.innerHTML = use === 'xbox' ? xboxSvg(c) : dualSenseSvg(c);
            mountEl.querySelector('.bd-gp-viewer').style.setProperty('--gp-lit', c.lit);
            mountEl.querySelector('.bd-gp-viewer').style.setProperty('--gp-dim', c.dim);
        }

        function pads() {
            if (!navigator.getGamepads) return [];
            return Array.from(navigator.getGamepads()).filter((g) => g && g.connected);
        }

        function tick() {
            const list = pads();
            const next = list[0] || null;
            if (next && (!gp || gp.id !== next.id)) {
                gp = next;
                wait.hidden = true;
                stage.hidden = false;
                status.textContent = 'Connected';
                status.classList.add('ok');
                meta.textContent = next.id;
                renderShell();
                if (o.onConnect) o.onConnect(next);
            } else if (!next && gp) {
                gp = null;
                wait.hidden = false;
                stage.hidden = true;
                status.textContent = 'Connect a controller';
                status.classList.remove('ok');
                meta.textContent = '';
                if (o.onDisconnect) o.onDisconnect();
            }

            if (gp && stage) {
                const g = pads()[0] || gp;
                for (let i = 0; i < 17; i++) {
                    const nodes = stage.querySelectorAll(`[data-btn="${i}"]`);
                    const pressed = !!(g.buttons[i] && (g.buttons[i].pressed || g.buttons[i].value > 0.15));
                    nodes.forEach((n) => n.classList.toggle('lit', pressed));
                }
                // sticks
                const ls = stage.querySelector('[data-btn="10"]');
                const rs = stage.querySelector('[data-btn="11"]');
                if (ls) ls.setAttribute('transform', `translate(${(g.axes[0] || 0) * 10},${(g.axes[1] || 0) * 10})`);
                if (rs) rs.setAttribute('transform', `translate(${(g.axes[2] || 0) * 10},${(g.axes[3] || 0) * 10})`);
                if (o.onPad) o.onPad(g);
            }
            raf = requestAnimationFrame(tick);
        }

        skinSel.addEventListener('change', () => { skin = skinSel.value; if (gp) renderShell(); });
        colorSel.addEventListener('change', () => { colorKey = colorSel.value; if (gp) renderShell(); });
        window.addEventListener('gamepadconnected', () => {});
        window.addEventListener('gamepaddisconnected', () => {});

        tick();
        return {
            destroy() { cancelAnimationFrame(raf); },
            getPad() { return gp; }
        };
    }

    return { init, COLORS };
})();
