/* BlankDelay - live reactive holo (photo on black, no bg, disconnect = black) */
(function () {
    var IMGS = {
        controller: '../assets/holo/ps5-dualsense-edge.png',
        keyboard: '../assets/holo/razer-keyboard-halo.png',
        mouse: '../assets/holo/honeycomb-gaming-mouse.png'
    };
    var BG_MODE = { controller: 'darkblue', keyboard: 'desk', mouse: 'white' };

    var CTRL_BTNS = [
        { id: 'cross', idx: 0, x: 0.735, y: 0.58, r: 0.032, color: '#3b82f6' },
        { id: 'circle', idx: 1, x: 0.805, y: 0.50, r: 0.032, color: '#ef4444' },
        { id: 'square', idx: 2, x: 0.665, y: 0.50, r: 0.032, color: '#ec4899' },
        { id: 'triangle', idx: 3, x: 0.735, y: 0.42, r: 0.032, color: '#22c55e' },
        { id: 'l1', idx: 4, x: 0.20, y: 0.27, r: 0.042, color: '#57f287' },
        { id: 'r1', idx: 5, x: 0.80, y: 0.27, r: 0.042, color: '#57f287' },
        { id: 'l2', idx: 6, x: 0.20, y: 0.17, r: 0.042, color: '#57f287' },
        { id: 'r2', idx: 7, x: 0.80, y: 0.17, r: 0.042, color: '#57f287' },
        { id: 'share', idx: 8, x: 0.42, y: 0.36, r: 0.024, color: '#57f287' },
        { id: 'options', idx: 9, x: 0.58, y: 0.36, r: 0.024, color: '#57f287' },
        { id: 'ls', idx: 10, x: 0.36, y: 0.62, r: 0.055, color: '#57f287' },
        { id: 'rs', idx: 11, x: 0.64, y: 0.62, r: 0.055, color: '#57f287' },
        { id: 'du', idx: 12, x: 0.27, y: 0.44, r: 0.024, color: '#57f287' },
        { id: 'dd', idx: 13, x: 0.27, y: 0.56, r: 0.024, color: '#57f287' },
        { id: 'dl', idx: 14, x: 0.22, y: 0.50, r: 0.024, color: '#57f287' },
        { id: 'dr', idx: 15, x: 0.32, y: 0.50, r: 0.024, color: '#57f287' },
        { id: 'ps', idx: 16, x: 0.50, y: 0.64, r: 0.028, color: '#57f287' }
    ];

    var KB_KEYS = {
        Q: { x: 0.30, y: 0.44, w: 0.028, h: 0.055 }, W: { x: 0.33, y: 0.44, w: 0.028, h: 0.055 },
        E: { x: 0.36, y: 0.44, w: 0.028, h: 0.055 }, R: { x: 0.39, y: 0.44, w: 0.028, h: 0.055 },
        T: { x: 0.42, y: 0.44, w: 0.028, h: 0.055 }, Y: { x: 0.45, y: 0.44, w: 0.028, h: 0.055 },
        A: { x: 0.30, y: 0.50, w: 0.028, h: 0.055 }, S: { x: 0.33, y: 0.50, w: 0.028, h: 0.055 },
        D: { x: 0.36, y: 0.50, w: 0.028, h: 0.055 }, F: { x: 0.39, y: 0.50, w: 0.028, h: 0.055 },
        G: { x: 0.42, y: 0.50, w: 0.028, h: 0.055 }, H: { x: 0.45, y: 0.50, w: 0.028, h: 0.055 },
        Z: { x: 0.30, y: 0.56, w: 0.028, h: 0.055 }, X: { x: 0.33, y: 0.56, w: 0.028, h: 0.055 },
        C: { x: 0.36, y: 0.56, w: 0.028, h: 0.055 }, V: { x: 0.39, y: 0.56, w: 0.028, h: 0.055 },
        B: { x: 0.42, y: 0.56, w: 0.028, h: 0.055 }, N: { x: 0.45, y: 0.56, w: 0.028, h: 0.055 },
        SPACE: { x: 0.38, y: 0.62, w: 0.12, h: 0.045 },
        SHIFT: { x: 0.28, y: 0.56, w: 0.05, h: 0.045 },
        CTRL: { x: 0.26, y: 0.62, w: 0.035, h: 0.045 },
        ENTER: { x: 0.52, y: 0.50, w: 0.035, h: 0.055 },
        TAB: { x: 0.28, y: 0.38, w: 0.035, h: 0.045 },
        '1': { x: 0.30, y: 0.38, w: 0.025, h: 0.045 }, '2': { x: 0.33, y: 0.38, w: 0.025, h: 0.045 },
        '3': { x: 0.36, y: 0.38, w: 0.025, h: 0.045 }, '4': { x: 0.39, y: 0.38, w: 0.025, h: 0.045 },
        '5': { x: 0.42, y: 0.38, w: 0.025, h: 0.045 }
    };

    var MOUSE_ZONES = {
        0: { x: 0.28, y: 0.12, w: 0.22, h: 0.38, label: 'LMB' },
        2: { x: 0.50, y: 0.12, w: 0.22, h: 0.38, label: 'RMB' },
        1: { x: 0.44, y: 0.06, w: 0.12, h: 0.10, label: 'WHEEL' },
        3: { x: 0.10, y: 0.38, w: 0.08, h: 0.18, label: 'M4' },
        4: { x: 0.82, y: 0.38, w: 0.08, h: 0.18, label: 'M5' }
    };

    var cv, ctx, running = false, tab = 'controller';
    var slX = 0, slY = 0, srX = 0, srY = 0, pB = {};
    var kDown = {}, mDown = {}, gMouse = {};
    var processed = {};
    var pnp = { controllers: [], keyboards: [], mice: [] };
    var padLive = false;

    function gp() {
        if (!navigator.getGamepads) return null;
        var g = navigator.getGamepads();
        for (var i = 0; i < g.length; i++) if (g[i] && g[i].connected) return g[i];
        return null;
    }

    function btnPressed(b) {
        var v = pB[b.idx];
        if (v == null) return false;
        if (typeof v === 'object') return v.pressed || v.value > 0.12;
        return !!v;
    }

    function btnValue(b) {
        var v = pB[b.idx];
        if (v == null) return 0;
        if (typeof v === 'object') return v.value || (v.pressed ? 1 : 0);
        return v ? 1 : 0;
    }

    function isControllerConnected() {
        return padLive || pnp.controllers.length > 0;
    }
    function isKeyboardConnected() { return pnp.keyboards.length > 0; }
    function isMouseConnected() { return pnp.mice.length > 0; }
    function isTabConnected(t) {
        if (t === 'controller') return isControllerConnected();
        if (t === 'keyboard') return isKeyboardConnected();
        return isMouseConnected();
    }

    function stripBg(data, mode) {
        var d = data.data;
        for (var i = 0; i < d.length; i += 4) {
            var r = d[i], g = d[i + 1], b = d[i + 2];
            var lum = 0.299 * r + 0.587 * g + 0.114 * b;
            var kill = false;
            if (mode === 'darkblue') {
                if (lum < 30) kill = true;
                else if (lum < 95 && b > r + 8 && b > g) kill = true;
                else if (r < 25 && g < 35 && b < 55 && lum < 70) kill = true;
            } else if (mode === 'white') {
                if (r > 228 && g > 228 && b > 228) kill = true;
                else if (lum > 240) kill = true;
            } else if (mode === 'desk') {
                if (lum < 28) kill = true;
                else if (r > 90 && g > 45 && b < 75 && r > g && lum < 175) kill = true;
                else if (r > 140 && g > 70 && b < 90 && lum < 200) kill = true;
            }
            if (kill) d[i + 3] = 0;
        }
    }

    function loadProcessed(key, src, mode, cb) {
        var img = new Image();
        img.onload = function () {
            var off = document.createElement('canvas');
            off.width = img.naturalWidth;
            off.height = img.naturalHeight;
            var octx = off.getContext('2d');
            octx.drawImage(img, 0, 0);
            var id = octx.getImageData(0, 0, off.width, off.height);
            stripBg(id, mode);
            octx.putImageData(id, 0, 0);
            processed[key] = { canvas: off, w: off.width, h: off.height };
            if (cb) cb();
        };
        img.onerror = function () { if (cb) cb(); };
        img.src = src;
    }

    function hexGlow(cx, cy, r, color, alpha) {
        var rr = parseInt(color.slice(1, 3), 16), gg = parseInt(color.slice(3, 5), 16), bb = parseInt(color.slice(5, 7), 16);
        var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, 'rgba(' + rr + ',' + gg + ',' + bb + ',' + alpha + ')');
        g.addColorStop(0.45, 'rgba(' + rr + ',' + gg + ',' + bb + ',' + (alpha * 0.35) + ')');
        g.addColorStop(1, 'rgba(' + rr + ',' + gg + ',' + bb + ',0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
    }

    function ring(cx, cy, r, color, lw) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = lw || 3;
        ctx.shadowColor = color;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    function glowRect(x, y, w, h) {
        ctx.save();
        ctx.shadowColor = '#00e5ff';
        ctx.shadowBlur = 22;
        ctx.fillStyle = 'rgba(0,229,255,0.65)';
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 3);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }

    function drawDisconnected(W, H) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = 'rgba(255,60,60,0.85)';
        ctx.font = 'bold 22px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('DISCONNECTED', W / 2, H / 2 - 12);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.font = '11px monospace';
        var msg = tab === 'controller' ? 'Plug in your controller' : tab === 'keyboard' ? 'Plug in your keyboard' : 'Plug in your mouse';
        ctx.fillText(msg, W / 2, H / 2 + 16);
    }

    function drawDeviceImage(W, H, key) {
        var p = processed[key];
        if (!p) return;
        var scale = Math.min(W / p.w, H / p.h) * 0.92;
        var dw = p.w * scale, dh = p.h * scale;
        var dx = (W - dw) / 2, dy = (H - dh) / 2;
        ctx.drawImage(p.canvas, dx, dy, dw, dh);
        return { dx: dx, dy: dy, dw: dw, dh: dh, scale: scale };
    }

    function mapZone(layout, zx, zy) {
        if (!layout) return { x: 0, y: 0 };
        return { x: layout.dx + layout.dw * zx, y: layout.dy + layout.dh * zy };
    }

    function drawControllerReactive(layout) {
        if (!layout) return;
        var W = layout.dw, H = layout.dh;
        var hasInput = Math.abs(slX) > 0.08 || Math.abs(slY) > 0.08 || Math.abs(srX) > 0.08 || Math.abs(srY) > 0.08;
        CTRL_BTNS.forEach(function (b) {
            if (btnPressed(b) && b.id !== 'ls' && b.id !== 'rs') {
                var p = mapZone(layout, b.x, b.y);
                hexGlow(p.x, p.y, layout.dw * b.r * 2.5, b.color, 0.85);
                ring(p.x, p.y, layout.dw * b.r * 1.6, b.color, 2.5);
            }
            if ((b.id === 'l2' || b.id === 'r2') && btnValue(b) > 0.05) {
                var p2 = mapZone(layout, b.x, b.y);
                hexGlow(p2.x, p2.y, layout.dw * b.r * (1.5 + btnValue(b)), b.color, 0.4 + btnValue(b) * 0.5);
            }
        });
        var ls = CTRL_BTNS.find(function (b) { return b.id === 'ls'; });
        var rs = CTRL_BTNS.find(function (b) { return b.id === 'rs'; });
        if (ls) {
            var lp = mapZone(layout, ls.x + slX * 0.045, ls.y + slY * 0.045);
            if (Math.abs(slX) > 0.08 || Math.abs(slY) > 0.08 || btnPressed(ls)) {
                hexGlow(lp.x, lp.y, layout.dw * 0.05, '#57f287', 0.75);
                ring(lp.x, lp.y, layout.dw * 0.038, '#57f287', 3);
            }
        }
        if (rs) {
            var rp = mapZone(layout, rs.x + srX * 0.045, rs.y + srY * 0.045);
            if (Math.abs(srX) > 0.08 || Math.abs(srY) > 0.08 || btnPressed(rs)) {
                hexGlow(rp.x, rp.y, layout.dw * 0.05, '#57f287', 0.75);
                ring(rp.x, rp.y, layout.dw * 0.038, '#57f287', 3);
            }
        }
        if (hasInput || CTRL_BTNS.some(function (b) { return btnPressed(b); })) {
            var bl = mapZone(layout, 0.38, 0.35), br = mapZone(layout, 0.62, 0.35);
            hexGlow(bl.x, bl.y, layout.dw * 0.035, '#00aaff', 0.45);
            hexGlow(br.x, br.y, layout.dw * 0.035, '#00aaff', 0.45);
        }
    }

    function keyPressed(k) {
        return kDown[k] || kDown['Key' + k] || kDown['Digit' + k] ||
            (k === 'SPACE' && kDown['Space']) ||
            (k === 'SHIFT' && (kDown['ShiftLeft'] || kDown['ShiftRight'])) ||
            (k === 'CTRL' && (kDown['ControlLeft'] || kDown['ControlRight'])) ||
            (k === 'ENTER' && kDown['Enter']) ||
            (k === 'TAB' && kDown['Tab']);
    }

    function drawKeyboardReactive(layout) {
        if (!layout) return;
        Object.keys(KB_KEYS).forEach(function (k) {
            if (!keyPressed(k)) return;
            var z = KB_KEYS[k];
            glowRect(layout.dx + layout.dw * z.x, layout.dy + layout.dh * z.y, layout.dw * z.w, layout.dh * z.h);
        });
    }

    function mouseBtnDown(btn) {
        return mDown[btn] || gMouse[btn];
    }

    function drawMouseReactive(layout) {
        if (!layout) return;
        Object.keys(MOUSE_ZONES).forEach(function (k) {
            var btn = parseInt(k, 10);
            if (!mouseBtnDown(btn)) return;
            var z = MOUSE_ZONES[btn];
            var x = layout.dx + layout.dw * z.x, y = layout.dy + layout.dh * z.y;
            var w = layout.dw * z.w, h = layout.dh * z.h;
            ctx.save();
            ctx.shadowColor = '#57f287';
            ctx.shadowBlur = 24;
            ctx.fillStyle = 'rgba(87,242,135,0.5)';
            ctx.strokeStyle = '#57f287';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.roundRect(x, y, w, h, 4);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        });
    }

    function updatePad() {
        var pad = gp();
        if (pad) {
            padLive = true;
            slX = pad.axes[0] || 0;
            slY = pad.axes[1] || 0;
            srX = pad.axes[2] || 0;
            srY = pad.axes[3] || 0;
            pB = {};
            for (var i = 0; i < pad.buttons.length; i++) pB[i] = pad.buttons[i];
        } else {
            padLive = false;
            slX += (-slX) * 0.12;
            slY += (-slY) * 0.12;
            srX += (-srX) * 0.12;
            srY += (-srY) * 0.12;
        }
    }

    function tick() {
        if (!running || !cv || !ctx) return;
        var W = cv.width, H = cv.height;
        if (W < 10 || H < 10) { requestAnimationFrame(tick); return; }

        updatePad();
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);

        if (!isTabConnected(tab)) {
            drawDisconnected(W, H);
            updateUI();
            requestAnimationFrame(tick);
            return;
        }

        var layout = drawDeviceImage(W, H, tab);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        if (tab === 'controller') drawControllerReactive(layout);
        else if (tab === 'keyboard') drawKeyboardReactive(layout);
        else drawMouseReactive(layout);
        ctx.restore();

        updateUI();
        updateReadout();
        requestAnimationFrame(tick);
    }

    function updateReadout() {
        var ro = document.getElementById('holo-readout');
        if (!ro) return;
        var parts = [];
        if (tab === 'controller') {
            CTRL_BTNS.forEach(function (b) {
                if (btnPressed(b)) parts.push(b.id.toUpperCase());
            });
            if (Math.abs(slX) > 0.15 || Math.abs(slY) > 0.15) parts.push('L-Stick');
            if (Math.abs(srX) > 0.15 || Math.abs(srY) > 0.15) parts.push('R-Stick');
            ro.textContent = parts.length ? 'INPUT: ' + parts.join(' · ') : 'Press any controller button';
        } else if (tab === 'keyboard') {
            Object.keys(KB_KEYS).forEach(function (k) {
                if (keyPressed(k)) parts.push(k);
            });
            ro.textContent = parts.length ? 'KEYS: ' + parts.join(' · ') : 'Press any key on your keyboard';
        } else {
            Object.keys(MOUSE_ZONES).forEach(function (k) {
                if (mouseBtnDown(parseInt(k, 10))) parts.push(MOUSE_ZONES[k].label);
            });
            ro.textContent = parts.length ? 'MOUSE: ' + parts.join(' · ') : 'Click any mouse button';
        }
    }

    function resize() {
        if (!cv) return;
        var wrap = document.getElementById('holo-wrap');
        var w = wrap ? wrap.clientWidth : 560;
        cv.width = w;
        cv.height = 360;
        cv.style.width = w + 'px';
        cv.style.height = '360px';
    }

    function bestName(list, prefer) {
        if (!list || !list.length) return '';
        var p = list.find(function (n) { return prefer.test(n); });
        return p || list[0];
    }

    function updateUI() {
        var el = document.getElementById('holo-label');
        if (!el) return;
        var connected = isTabConnected(tab);
        if (tab === 'controller') {
            var nm = bestName(pnp.controllers, /dualsense|wireless controller|game controller/i) || 'Controller';
            el.className = connected ? 'holo-device-label' : 'holo-device-label holo-disconnected-label';
            el.innerHTML = connected
                ? 'Live <strong>Controller</strong> &middot; ' + nm + ' <span class="holo-conn">CONNECTED</span>'
                : '<strong>DISCONNECTED</strong> &middot; Controller not detected';
        } else if (tab === 'keyboard') {
            var kn = bestName(pnp.keyboards, /keyboard/i) || 'Keyboard';
            el.className = connected ? 'holo-device-label' : 'holo-device-label holo-disconnected-label';
            el.innerHTML = connected
                ? 'Live <strong>Keyboard</strong> &middot; ' + kn + ' <span class="holo-conn">CONNECTED</span>'
                : '<strong>DISCONNECTED</strong> &middot; Keyboard not detected';
        } else {
            var mn = bestName(pnp.mice, /mouse/i) || 'Mouse';
            el.className = connected ? 'holo-device-label' : 'holo-device-label holo-disconnected-label';
            el.innerHTML = connected
                ? 'Live <strong>Mouse</strong> &middot; ' + mn + ' <span class="holo-conn">CONNECTED</span>'
                : '<strong>DISCONNECTED</strong> &middot; Mouse not detected';
        }
        updateDevicePanel();
    }

    function updateDevicePanel() {
        var panel = document.getElementById('device-panel');
        if (!panel) return;
        var ctrlOk = isControllerConnected();
        var kbOk = isKeyboardConnected();
        var mouseOk = isMouseConnected();
        panel.innerHTML =
            '<h3 class="section-title">Connected Devices</h3>' +
            '<div class="device-list">' +
            '<div class="device-row ' + (ctrlOk ? 'ok' : '') + '"><span>Controller</span><span>' +
            (ctrlOk ? bestName(pnp.controllers, /dualsense|wireless/i) || 'Connected' : 'Disconnected') + '</span></div>' +
            '<div class="device-row ' + (kbOk ? 'ok' : '') + '"><span>Keyboard</span><span>' +
            (kbOk ? pnp.keyboards[0] : 'Disconnected') + '</span></div>' +
            '<div class="device-row ' + (mouseOk ? 'ok' : '') + '"><span>Mouse</span><span>' +
            (mouseOk ? pnp.mice[0] : 'Disconnected') + '</span></div>' +
            '</div>' +
            '<p class="field-hint">' + (isTabConnected(tab) ? 'Live holo reacts to your real input in real time.' : 'Plug device back in to restore live holo.') + '</p>';
    }

    async function refreshPnp() {
        try {
            if (window.blankDelay && window.blankDelay.detectDevices) {
                var d = await window.blankDelay.detectDevices();
                pnp.controllers = d.controllers || [];
                pnp.keyboards = d.keyboards || [];
                pnp.mice = d.mice || [];
            }
        } catch (e) {}
        updateUI();
    }

    async function pollGlobalMouse() {
        if (!running || tab !== 'mouse') return;
        try {
            if (window.blankDelay && window.blankDelay.pollInputState) {
                var st = await window.blankDelay.pollInputState();
                if (st && st.mouse) {
                    gMouse = {};
                    ['LMB', 'RMB', 'MMB', 'M4', 'M5'].forEach(function (k, i) {
                        if (st.mouse[k]) gMouse[i] = true;
                    });
                } else {
                    gMouse = {};
                }
            }
        } catch (e) { gMouse = {}; }
    }

    function wakeLoop() {
        if (!running) return;
        if (navigator.getGamepads) navigator.getGamepads();
        setTimeout(wakeLoop, 300);
    }

    function switchTab(t) {
        tab = t;
        updateUI();
        var ht = document.getElementById('holo-head-title');
        if (ht) ht.textContent = t === 'controller' ? 'Live Controller' : t === 'keyboard' ? 'Live Keyboard' : 'Live Mouse';
    }

    window.addEventListener('keydown', function (e) {
        kDown[e.code] = true;
        if (e.key && e.key.length === 1) kDown[e.key.toUpperCase()] = true;
    });
    window.addEventListener('keyup', function (e) {
        delete kDown[e.code];
        if (e.key && e.key.length === 1) delete kDown[e.key.toUpperCase()];
    });
    window.addEventListener('mousedown', function (e) { mDown[e.button] = true; });
    window.addEventListener('mouseup', function (e) { delete mDown[e.button]; });
    window.addEventListener('gamepadconnected', function () { padLive = true; updateUI(); });
    window.addEventListener('gamepaddisconnected', function () { padLive = !!gp(); updateUI(); });

    document.querySelectorAll('.macro-tab').forEach(function (b) {
        b.addEventListener('click', function () { switchTab(b.dataset.tab); });
    });

    window.__bdHoloSwitch = switchTab;

    window.initDeviceHolo = function (startTab) {
        cv = document.getElementById('holo-canvas');
        if (!cv) return;
        ctx = cv.getContext('2d');
        var loaded = 0;
        function onLoad() {
            loaded++;
            if (loaded >= 3) {
                running = true;
                resize();
                switchTab(startTab || 'controller');
                tick();
            }
        }
        loadProcessed('controller', IMGS.controller, BG_MODE.controller, onLoad);
        loadProcessed('keyboard', IMGS.keyboard, BG_MODE.keyboard, onLoad);
        loadProcessed('mouse', IMGS.mouse, BG_MODE.mouse, onLoad);
        window.addEventListener('resize', resize);
        wakeLoop();
        refreshPnp();
        setInterval(refreshPnp, 3000);
        setInterval(pollGlobalMouse, 200);
    };
})();
