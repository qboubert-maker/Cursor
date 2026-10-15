/* BlankDelay — live gamepad viewer (gamepad.e7d.io style: skins, colors, live buttons/sticks/triggers) */
const BdGamepadLive = (function () {
    const COLORS = {
        black:  { body: '#141414', edge: '#4a4a4a', face: '#1e1e1e', text: '#e8e8e8', lit: '#ffffff', dim: 'rgba(255,255,255,0.16)' },
        white:  { body: '#ededed', edge: '#b8b8b8', face: '#f7f7f7', text: '#1a1a1a', lit: '#1a1a1a', dim: 'rgba(0,0,0,0.14)' },
        blue:   { body: '#12203a', edge: '#3d6bb5', face: '#16294a', text: '#dce9ff', lit: '#5aa9ff', dim: 'rgba(90,169,255,0.18)' },
        red:    { body: '#2a1212', edge: '#b54040', face: '#3a1717', text: '#ffdede', lit: '#ff5a5a', dim: 'rgba(255,90,90,0.18)' },
        green:  { body: '#122a18', edge: '#3fa85e', face: '#17381f', text: '#dcffe6', lit: '#57f287', dim: 'rgba(87,242,135,0.18)' },
        purple: { body: '#1e1233', edge: '#7a4fc0', face: '#271741', text: '#ecdcff', lit: '#a970ff', dim: 'rgba(169,112,255,0.18)' }
    };

    const SKINS = {
        dualsense: 'DualSense · PS5',
        dualshock: 'DualShock · PS4',
        xbox: 'Xbox Controller'
    };

    function detectSkin(id) {
        const s = (id || '').toLowerCase();
        if (s.includes('0ce6') || s.includes('dualsense')) return 'dualsense';
        if (s.includes('05c4') || s.includes('09cc') || s.includes('dualshock')) return 'dualshock';
        if (s.includes('054c') || s.includes('sony') || s.includes('playstation')) return 'dualsense';
        if (s.includes('xbox') || s.includes('xinput') || s.includes('045e') || s.includes('microsoft')) return 'xbox';
        return 'dualsense';
    }

    /* Shared helpers: every skin exposes the same data-btn / data-axis hooks
       so the live update loop does not need to know which skin is drawn. */
    function shoulders(c) {
        return `
            <rect data-btn="6" x="96" y="52" width="66" height="17" rx="7" fill="${c.face}" stroke="${c.edge}" stroke-width="1.5"/>
            <rect data-btn="7" x="358" y="52" width="66" height="17" rx="7" fill="${c.face}" stroke="${c.edge}" stroke-width="1.5"/>
            <rect data-btn="4" x="100" y="74" width="58" height="15" rx="6" fill="${c.face}" stroke="${c.edge}" stroke-width="1.5"/>
            <rect data-btn="5" x="362" y="74" width="58" height="15" rx="6" fill="${c.face}" stroke="${c.edge}" stroke-width="1.5"/>
            <text x="129" y="65" text-anchor="middle" font-size="9" fill="${c.text}" opacity="0.75">L2</text>
            <text x="391" y="65" text-anchor="middle" font-size="9" fill="${c.text}" opacity="0.75">R2</text>`;
    }

    function dpad(c, cx, cy) {
        return `
            <rect data-btn="12" x="${cx - 9}" y="${cy - 30}" width="18" height="21" rx="4" fill="${c.face}" stroke="${c.edge}" stroke-width="1.5"/>
            <rect data-btn="13" x="${cx - 9}" y="${cy + 9}" width="18" height="21" rx="4" fill="${c.face}" stroke="${c.edge}" stroke-width="1.5"/>
            <rect data-btn="14" x="${cx - 30}" y="${cy - 9}" width="21" height="18" rx="4" fill="${c.face}" stroke="${c.edge}" stroke-width="1.5"/>
            <rect data-btn="15" x="${cx + 9}" y="${cy - 9}" width="21" height="18" rx="4" fill="${c.face}" stroke="${c.edge}" stroke-width="1.5"/>`;
    }

    function stick(c, id, axis, cx, cy) {
        return `
            <g>
                <circle cx="${cx}" cy="${cy}" r="30" fill="${c.face}" stroke="${c.edge}" stroke-width="1.5" opacity="0.6"/>
                <g data-axis="${axis}">
                    <circle data-btn="${id}" cx="${cx}" cy="${cy}" r="22" fill="${c.body}" stroke="${c.edge}" stroke-width="2"/>
                </g>
            </g>`;
    }

    function faceButtons(c, cx, cy, labels) {
        return `
            <g data-btn="3"><circle cx="${cx}" cy="${cy - 26}" r="14" fill="${c.face}" stroke="${c.edge}" stroke-width="1.5"/><text x="${cx}" y="${cy - 22}" text-anchor="middle" font-size="12" fill="${c.text}">${labels[3]}</text></g>
            <g data-btn="1"><circle cx="${cx + 26}" cy="${cy}" r="14" fill="${c.face}" stroke="${c.edge}" stroke-width="1.5"/><text x="${cx + 26}" y="${cy + 4}" text-anchor="middle" font-size="12" fill="${c.text}">${labels[1]}</text></g>
            <g data-btn="0"><circle cx="${cx}" cy="${cy + 26}" r="14" fill="${c.face}" stroke="${c.edge}" stroke-width="1.5"/><text x="${cx}" y="${cy + 30}" text-anchor="middle" font-size="12" fill="${c.text}">${labels[0]}</text></g>
            <g data-btn="2"><circle cx="${cx - 26}" cy="${cy}" r="14" fill="${c.face}" stroke="${c.edge}" stroke-width="1.5"/><text x="${cx - 26}" y="${cy + 4}" text-anchor="middle" font-size="12" fill="${c.text}">${labels[2]}</text></g>`;
    }

    function triggerBars(c) {
        return `
            <g class="bd-gp-trigbar">
                <rect x="96" y="36" width="66" height="7" rx="3.5" fill="${c.dim}"/>
                <rect data-trigger="6" x="96" y="36" width="0" height="7" rx="3.5" fill="${c.lit}"/>
                <rect x="358" y="36" width="66" height="7" rx="3.5" fill="${c.dim}"/>
                <rect data-trigger="7" x="358" y="36" width="0" height="7" rx="3.5" fill="${c.lit}"/>
            </g>`;
    }

    function dualSenseSvg(c, label) {
        return `<svg viewBox="0 0 520 320" class="bd-gp-svg" xmlns="http://www.w3.org/2000/svg">
            ${triggerBars(c)}
            <path d="M260 92 C318 92 352 100 372 112 C404 130 424 168 428 206 C432 244 416 268 388 272 C360 276 340 256 326 232 C316 214 300 206 260 206 C220 206 204 214 194 232 C180 256 160 276 132 272 C104 268 88 244 92 206 C96 168 116 130 148 112 C168 100 202 92 260 92 Z"
                  fill="${c.body}" stroke="${c.edge}" stroke-width="2.5"/>
            ${shoulders(c)}
            <rect data-btn="17" x="222" y="104" width="76" height="34" rx="7" fill="${c.face}" stroke="${c.edge}" stroke-width="1.5"/>
            <text x="260" y="126" text-anchor="middle" font-size="8" fill="${c.text}" opacity="0.5">TOUCHPAD</text>
            ${faceButtons(c, 372, 152, ['✕', '○', '□', '△'])}
            ${dpad(c, 148, 152)}
            ${stick(c, 10, 'left', 205, 190)}
            ${stick(c, 11, 'right', 315, 190)}
            <g data-btn="8"><rect x="186" y="112" width="9" height="16" rx="2" fill="${c.face}" stroke="${c.edge}" stroke-width="1.2"/></g>
            <g data-btn="9"><rect x="325" y="112" width="9" height="16" rx="2" fill="${c.face}" stroke="${c.edge}" stroke-width="1.2"/></g>
            <g data-btn="16"><circle cx="260" cy="196" r="9" fill="${c.face}" stroke="${c.edge}" stroke-width="1.5"/></g>
            <text x="260" y="308" text-anchor="middle" fill="${c.text}" font-size="10" font-family="monospace" opacity="0.55">${label}</text>
        </svg>`;
    }

    function dualShockSvg(c, label) {
        return `<svg viewBox="0 0 520 320" class="bd-gp-svg" xmlns="http://www.w3.org/2000/svg">
            ${triggerBars(c)}
            <path d="M260 96 C310 96 342 102 364 114 C398 132 418 170 420 208 C422 246 404 266 378 268 C352 270 334 250 322 228 C312 210 298 202 260 202 C222 202 208 210 198 228 C186 250 168 270 142 268 C116 266 98 246 100 208 C102 170 122 132 156 114 C178 102 210 96 260 96 Z"
                  fill="${c.body}" stroke="${c.edge}" stroke-width="2.5"/>
            ${shoulders(c)}
            <rect data-btn="17" x="228" y="108" width="64" height="24" rx="6" fill="${c.face}" stroke="${c.edge}" stroke-width="1.5"/>
            <text x="260" y="124" text-anchor="middle" font-size="7" fill="${c.text}" opacity="0.5">TOUCHPAD</text>
            ${faceButtons(c, 366, 150, ['✕', '○', '□', '△'])}
            ${dpad(c, 152, 150)}
            ${stick(c, 10, 'left', 208, 194)}
            ${stick(c, 11, 'right', 312, 194)}
            <g data-btn="8"><rect x="192" y="114" width="9" height="15" rx="2" fill="${c.face}" stroke="${c.edge}" stroke-width="1.2"/></g>
            <g data-btn="9"><rect x="319" y="114" width="9" height="15" rx="2" fill="${c.face}" stroke="${c.edge}" stroke-width="1.2"/></g>
            <g data-btn="16"><circle cx="260" cy="192" r="8" fill="${c.face}" stroke="${c.edge}" stroke-width="1.5"/></g>
            <text x="260" y="308" text-anchor="middle" fill="${c.text}" font-size="10" font-family="monospace" opacity="0.55">${label}</text>
        </svg>`;
    }

    function xboxSvg(c, label) {
        return `<svg viewBox="0 0 520 320" class="bd-gp-svg" xmlns="http://www.w3.org/2000/svg">
            ${triggerBars(c)}
            <path d="M260 98 C300 98 330 104 352 116 C390 136 416 178 420 218 C424 254 404 274 376 274 C350 274 334 252 320 230 C310 214 292 206 260 206 C228 206 210 214 200 230 C186 252 170 274 144 274 C116 274 96 254 100 218 C104 178 130 136 168 116 C190 104 220 98 260 98 Z"
                  fill="${c.body}" stroke="${c.edge}" stroke-width="2.5"/>
            ${shoulders(c)}
            ${faceButtons(c, 366, 158, ['A', 'B', 'X', 'Y'])}
            ${stick(c, 10, 'left', 156, 150)}
            ${dpad(c, 210, 200)}
            ${stick(c, 11, 'right', 306, 196)}
            <g data-btn="8"><circle cx="228" cy="140" r="8" fill="${c.face}" stroke="${c.edge}" stroke-width="1.2"/></g>
            <g data-btn="9"><circle cx="292" cy="140" r="8" fill="${c.face}" stroke="${c.edge}" stroke-width="1.2"/></g>
            <g data-btn="16"><circle cx="260" cy="126" r="11" fill="${c.face}" stroke="${c.edge}" stroke-width="1.5"/></g>
            <text x="260" y="308" text-anchor="middle" fill="${c.text}" font-size="10" font-family="monospace" opacity="0.55">${label}</text>
        </svg>`;
    }

    function buildSvg(skinKey, c, label) {
        if (skinKey === 'xbox') return xboxSvg(c, label);
        if (skinKey === 'dualshock') return dualShockSvg(c, label);
        return dualSenseSvg(c, label);
    }

    function init(mountEl, opts) {
        if (!mountEl) return null;
        const o = opts || {};
        let colorKey = COLORS[o.color] ? o.color : 'black';
        let skinPref = o.skin || 'auto';
        let pad = null;
        let raf = 0;
        let connected = false;

        mountEl.innerHTML = `
            <div class="bd-gp-viewer">
                <div class="bd-gp-head">
                    <div class="bd-gp-head-left">
                        <span class="bd-gp-title">Live Controller Display</span>
                        <span class="bd-gp-status" id="bd-gp-status"><span class="dot"></span> Connect Controller</span>
                    </div>
                    <div class="bd-gp-controls">
                        <label>Controller
                            <select id="bd-gp-skin">
                                <option value="auto">Auto Detect</option>
                                <option value="dualsense">DualSense · PS5</option>
                                <option value="dualshock">DualShock · PS4</option>
                                <option value="xbox">Xbox</option>
                            </select>
                        </label>
                        <label>Color
                            <select id="bd-gp-color">
                                <option value="black">Black</option>
                                <option value="white">White</option>
                                <option value="blue">Blue</option>
                                <option value="red">Red</option>
                                <option value="green">Green</option>
                                <option value="purple">Purple</option>
                            </select>
                        </label>
                    </div>
                </div>
                <div class="bd-gp-stage">
                    <div class="bd-gp-canvas" id="bd-gp-canvas"></div>
                    <div class="bd-gp-overlay" id="bd-gp-overlay">
                        <div class="pulse-ring"></div>
                        <strong>Connect Your Controller</strong>
                        <p>Plug in or pair your pad, then press any button to go live</p>
                    </div>
                </div>
                <div class="bd-gp-footer">
                    <span class="bd-gp-meta mono" id="bd-gp-meta">No controller detected</span>
                    <span class="bd-gp-press mono" id="bd-gp-press">—</span>
                </div>
            </div>`;

        const canvas = mountEl.querySelector('#bd-gp-canvas');
        const overlay = mountEl.querySelector('#bd-gp-overlay');
        const statusEl = mountEl.querySelector('#bd-gp-status');
        const metaEl = mountEl.querySelector('#bd-gp-meta');
        const pressEl = mountEl.querySelector('#bd-gp-press');
        const skinSel = mountEl.querySelector('#bd-gp-skin');
        const colorSel = mountEl.querySelector('#bd-gp-color');
        skinSel.value = skinPref;
        colorSel.value = colorKey;

        function activeSkin() {
            return skinPref === 'auto' ? detectSkin(pad?.id || '') : skinPref;
        }

        /* The pad is always drawn — the customer sees their controller immediately
           and the overlay only sits on top until a real pad reports in. */
        function render() {
            const c = COLORS[colorKey] || COLORS.black;
            const skinKey = activeSkin();
            canvas.innerHTML = buildSvg(skinKey, c, SKINS[skinKey] || 'CONTROLLER');
            const viewer = mountEl.querySelector('.bd-gp-viewer');
            viewer.style.setProperty('--gp-lit', c.lit);
            viewer.style.setProperty('--gp-dim', c.dim);
            viewer.dataset.color = colorKey;
        }

        function pads() {
            if (!navigator.getGamepads) return [];
            return Array.from(navigator.getGamepads()).filter((g) => g && g.connected);
        }

        function setConnected(on, g) {
            if (connected === on) return;
            connected = on;
            overlay.hidden = on;
            mountEl.querySelector('.bd-gp-viewer').classList.toggle('is-live', on);
            statusEl.innerHTML = on ? '<span class="dot"></span> Live' : '<span class="dot"></span> Connect Controller';
            statusEl.classList.toggle('ok', on);
            metaEl.textContent = on ? (g?.id || 'Controller connected') : 'No controller detected';
            if (on && o.onConnect) o.onConnect(g);
            if (!on && o.onDisconnect) o.onDisconnect();
        }

        function paint(g) {
            const held = [];
            for (let i = 0; i < 18; i++) {
                const nodes = canvas.querySelectorAll(`[data-btn="${i}"]`);
                if (!nodes.length) continue;
                const b = g.buttons[i];
                const on = !!(b && (b.pressed || b.value > 0.12));
                nodes.forEach((n) => n.classList.toggle('lit', on));
                if (on) held.push(i);
            }
            [6, 7].forEach((idx) => {
                const bar = canvas.querySelector(`[data-trigger="${idx}"]`);
                if (!bar) return;
                const v = g.buttons[idx] ? g.buttons[idx].value : 0;
                bar.setAttribute('width', String(Math.max(0, Math.min(1, v)) * 66));
            });
            const ls = canvas.querySelector('[data-axis="left"]');
            const rs = canvas.querySelector('[data-axis="right"]');
            if (ls) ls.setAttribute('transform', `translate(${(g.axes[0] || 0) * 11},${(g.axes[1] || 0) * 11})`);
            if (rs) rs.setAttribute('transform', `translate(${(g.axes[2] || 0) * 11},${(g.axes[3] || 0) * 11})`);
            pressEl.textContent = held.length ? 'Pressed: ' + held.join(', ') : '—';
        }

        function tick() {
            const list = pads();
            const g = list[0] || null;
            if (g) {
                const skinChanged = pad && detectSkin(pad.id) !== detectSkin(g.id);
                pad = g;
                setConnected(true, g);
                if (skinChanged && skinPref === 'auto') render();
                paint(g);
                if (o.onPad) o.onPad(g);
            } else {
                pad = null;
                setConnected(false);
                canvas.querySelectorAll('.lit').forEach((n) => n.classList.remove('lit'));
            }
            raf = requestAnimationFrame(tick);
        }

        skinSel.addEventListener('change', () => { skinPref = skinSel.value; render(); });
        colorSel.addEventListener('change', () => { colorKey = colorSel.value; render(); });

        render();
        tick();

        return {
            destroy() { cancelAnimationFrame(raf); },
            getPad() { return pad; },
            setColor(k) { if (COLORS[k]) { colorKey = k; colorSel.value = k; render(); } },
            setSkin(k) { skinPref = k; skinSel.value = k; render(); }
        };
    }

    return { init, COLORS, SKINS, detectSkin };
})();

// Top-level `const` is a lexical global, not a window property, so other modules
// that feature-detect via `window.BdGamepadLive` need this explicit export.
window.BdGamepadLive = BdGamepadLive;
