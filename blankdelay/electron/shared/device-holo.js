/* BlankDelay - live reactive holo visualizer */
const BlankDeviceHolo = (function () {
    const GP = HoloModels.GP;
    const STICK_RANGE = 16;
    let tab = 'controller', model = 'ps5', running = false;
    let root, labelEl, flashEl, readoutEl, fxCanvas, fxCtx, svgEl;
    let rafId = null, scanPhase = 0, lastReadout = '';
    let pnpControllers = [];
    let gamepadConnected = false;

    function getPads() {
        if (!navigator.getGamepads) return [];
        const raw = navigator.getGamepads();
        const pads = [];
        for (let i = 0; i < raw.length; i++) {
            if (raw[i] && raw[i].connected) pads.push(raw[i]);
        }
        return pads;
    }

    function detectControllerModel(pad, pnpNames) {
        const id = (pad && pad.id || '').toLowerCase();
        const names = (pnpNames || []).join(' ').toLowerCase();
        const src = id + ' ' + names;
        if (/(dualsense|edge|ps5|054c|wireless controller)/i.test(src)) return 'ps5';
        if (/(dualshock|ps4|054c)/i.test(src)) return 'ps4';
        if (/(xbox|xinput|045e|gamepad)/i.test(src)) return 'xbox';
        if (pad) return 'generic';
        if (/(dualsense|dualshock|wireless controller|ps5|ps4)/i.test(names)) return 'ps5';
        if (/(xbox)/i.test(names)) return 'xbox';
        if (pnpNames && pnpNames.length) return 'ps5';
        return 'none';
    }

    function renderModel() {
        if (!root) return;
        let html = '';
        if (tab === 'keyboard') html = HoloModels.keyboard();
        else if (tab === 'mouse') html = HoloModels.mouse();
        else if (model === 'xbox' || model === 'generic') html = HoloModels.xbox();
        else html = HoloModels.ps5Edge();
        root.innerHTML = html;
        svgEl = root.querySelector('.holo-svg');
        updateModelLabel();
    }

    function setBtnLit(id, on) {
        if (!svgEl) return;
        const el = svgEl.querySelector('#btn-' + id) || svgEl.querySelector('#key-' + id);
        if (el) el.classList.toggle('lit', !!on);
    }

    function clearAllLit() {
        if (!svgEl) return;
        svgEl.querySelectorAll('.lit').forEach(e => e.classList.remove('lit'));
    }

    function updateSticks(lx, ly, rx, ry) {
        if (!svgEl) return;
        const lCap = svgEl.querySelector('#stick-l-cap');
        const rCap = svgEl.querySelector('#stick-r-cap');
        if (lCap) lCap.setAttribute('transform', 'translate(' + (lx * STICK_RANGE) + ',' + (ly * STICK_RANGE) + ')');
        if (rCap) rCap.setAttribute('transform', 'translate(' + (rx * STICK_RANGE) + ',' + (ry * STICK_RANGE) + ')');
    }

    function updateReadout(text) {
        if (!readoutEl || text === lastReadout) return;
        lastReadout = text;
        readoutEl.textContent = text;
    }

    function pollController(pad) {
        const pnpOk = pnpControllers.length > 0;
        if (!pad && !pnpOk) {
            updateReadout('No controller — plug in USB or Bluetooth');
            clearAllLit();
            updateSticks(0, 0, 0, 0);
            return;
        }
        if (!pad && pnpOk) {
            updateReadout('Connected: ' + pnpControllers[0] + ' — press any button for live input');
            const barL = svgEl && svgEl.querySelector('#bar-l');
            const barR = svgEl && svgEl.querySelector('#bar-r');
            if (barL) barL.setAttribute('opacity', '0.85');
            if (barR) barR.setAttribute('opacity', '0.85');
            return;
        }
        const lx = pad.axes[0] || 0, ly = pad.axes[1] || 0;
        const rx = pad.axes[2] || 0, ry = pad.axes[3] || 0;
        updateSticks(lx, ly, rx, ry);
        const pressed = [];
        pad.buttons.forEach((b, i) => {
            const name = GP[i];
            if (name) setBtnLit(name, b.pressed);
            if (b.pressed && name) pressed.push(name);
        });
        const barL = svgEl && svgEl.querySelector('#bar-l');
        const barR = svgEl && svgEl.querySelector('#bar-r');
        const active = pressed.length || Math.abs(lx) > 0.15 || Math.abs(ly) > 0.15 || Math.abs(rx) > 0.15 || Math.abs(ry) > 0.15;
        if (barL) barL.setAttribute('opacity', active ? '1' : '0.55');
        if (barR) barR.setAttribute('opacity', active ? '1' : '0.55');
        updateReadout('LS ' + lx.toFixed(2) + ', ' + ly.toFixed(2) + '  RS ' + rx.toFixed(2) + ', ' + ry.toFixed(2) + (pressed.length ? '  |  ' + pressed.join(' ') : ''));
    }

    function drawFx() {
        if (!fxCtx || !fxCanvas || !running) return;
        const w = fxCanvas.width = fxCanvas.clientWidth;
        const h = fxCanvas.height = fxCanvas.clientHeight;
        fxCtx.clearRect(0, 0, w, h);
        scanPhase = (scanPhase + 0.7) % (h + 60);
        const g = fxCtx.createLinearGradient(0, scanPhase - 28, 0, scanPhase + 28);
        g.addColorStop(0, 'transparent');
        g.addColorStop(0.5, 'rgba(0,162,255,0.06)');
        g.addColorStop(1, 'transparent');
        fxCtx.fillStyle = g;
        fxCtx.fillRect(0, scanPhase - 28, w, 56);
    }

    function tick() {
        if (!running) return;
        if (tab === 'controller') {
            const pads = getPads();
            const pad = pads[0] || null;
            if (pad) gamepadConnected = true;
            pollController(pad);
        }
        drawFx();
        rafId = requestAnimationFrame(tick);
    }

    function highlightKeys(keys) {
        keys.split('+').forEach(k => { setBtnLit(k.trim().toUpperCase(), true); setTimeout(() => setBtnLit(k.trim().toUpperCase(), false), 300); });
        flashAt(50, 50);
    }

    function highlightPadButton(idx) {
        const n = GP[idx];
        if (n) { setBtnLit(n, true); setTimeout(() => setBtnLit(n, false), 300); }
        flashAt(50, 45);
    }

    function highlight(id, on) { setBtnLit(id, on); }

    function flashAt(x, y) {
        if (!flashEl) return;
        flashEl.style.setProperty('--fx', x + '%');
        flashEl.style.setProperty('--fy', y + '%');
        flashEl.classList.add('on');
        setTimeout(() => flashEl.classList.remove('on'), 140);
    }

    function setTab(t) { tab = t; clearAllLit(); renderModel(); updateModelLabel(); }

    function setModel(m) {
        model = (m === 'ps4') ? 'ps5' : m;
        if (tab === 'controller') renderModel();
        updateModelLabel();
    }

    function setPnpControllers(list) {
        pnpControllers = list || [];
        if (tab === 'controller' && !getPads().length && pnpControllers.length) {
            const m = detectControllerModel(null, pnpControllers);
            if (m !== 'none') model = m;
            renderModel();
        }
    }

    function updateModelLabel() {
        const names = { ps5: 'PlayStation DualSense Edge', ps4: 'PlayStation DualSense', xbox: 'Xbox Controller', generic: 'Xbox / Generic', none: 'Plug in your controller' };
        const tabs = { controller: 'Controller', keyboard: 'Keyboard', mouse: 'Mouse' };
        if (!labelEl) return;
        if (tab === 'controller') {
            const connected = gamepadConnected || pnpControllers.length > 0;
            labelEl.innerHTML = 'Live <strong>' + tabs[tab] + '</strong> &middot; ' + (names[model] || names.ps5) + (connected ? ' <span class="holo-conn">CONNECTED</span>' : '');
        } else {
            labelEl.innerHTML = 'Live <strong>' + tabs[tab] + '</strong> &middot; interactive preview';
        }
    }

    function bindLocalInput() {
        window.addEventListener('keydown', e => {
            if (tab === 'keyboard') setBtnLit(e.key.length === 1 ? e.key.toUpperCase() : e.key.toUpperCase(), true);
        });
        window.addEventListener('keyup', e => {
            if (tab === 'keyboard') setBtnLit(e.key.length === 1 ? e.key.toUpperCase() : e.key.toUpperCase(), false);
        });
        window.addEventListener('mousedown', e => {
            if (tab !== 'mouse') return;
            const m = { 0: 'LMB', 1: 'MMB', 2: 'RMB', 3: 'M4', 4: 'M5' };
            setBtnLit(m[e.button] || 'LMB', true);
        });
        window.addEventListener('mouseup', e => {
            if (tab !== 'mouse') return;
            const m = { 0: 'LMB', 1: 'MMB', 2: 'RMB', 3: 'M4', 4: 'M5' };
            setBtnLit(m[e.button] || 'LMB', false);
        });
        window.addEventListener('gamepadconnected', e => {
            gamepadConnected = true;
            const m = detectControllerModel(e.gamepad, pnpControllers);
            if (m !== 'none') model = m;
            renderModel();
            updateModelLabel();
        });
        window.addEventListener('gamepaddisconnected', () => {
            if (!getPads().length) gamepadConnected = false;
            updateModelLabel();
        });
    }

    function start() {
        running = true;
        renderModel();
        if (!rafId) tick();
    }

    function resizeCanvas() {}

    function init(opts) {
        root = document.getElementById('holo-svg-root');
        labelEl = document.getElementById(opts.labelId || 'holo-label');
        flashEl = document.querySelector('.holo-flash');
        readoutEl = document.getElementById('holo-readout');
        fxCanvas = document.getElementById(opts.canvasId || 'device-holo');
        fxCtx = fxCanvas ? fxCanvas.getContext('2d') : null;
        tab = opts.tab || 'controller';
        model = 'ps5';
        bindLocalInput();
        return { setTab, setModel, setPnpControllers, detectControllerModel, start, highlightKeys, highlightPadButton, highlight, flashAt, updateModelLabel, resizeCanvas, getPads };
    }

    return { init, GP };
})();