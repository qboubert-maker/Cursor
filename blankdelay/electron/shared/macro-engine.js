/* BlankDelay — unified macro engine (controller / keyboard / mouse) */
const BlankMacroEngine = (function () {
    const GAMEPAD_BUTTONS = [
        'A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start',
        'LS', 'RS', 'D-Up', 'D-Down', 'D-Left', 'D-Right'
    ];
    const MOUSE_BUTTONS = ['LMB', 'RMB', 'MMB', 'M4', 'M5'];

    const MACRO_SETS = {
        controller: [
            { id: 'rapid-fire', name: 'Rapid Fire', desc: 'Spams fire for AR/SMG in Fortnite', timing: 'RT → LMB repeat', defaultKeys: 'LMB', defaultAccel: 'F1', defaultPad: 7, mode: 'repeat', repeat: 12 },
            { id: 'instant-build', name: 'Instant Build', desc: 'Wall + Floor + Ramp (Q+C+E)', timing: 'LB → Q+C+E', defaultKeys: 'Q+C+E', defaultAccel: 'F2', defaultPad: 4, mode: 'once' },
            { id: 'edit-reset', name: 'Edit Reset', desc: 'Edit confirm + reset', timing: 'B → G+G', defaultKeys: 'G+G', defaultAccel: 'F3', defaultPad: 1, mode: 'once' },
            { id: 'double-edit', name: 'Double Edit', desc: 'Triple edit chain', timing: 'B → G+G+G', defaultKeys: 'G+G+G', defaultAccel: 'F4', defaultPad: 1, mode: 'once' },
            { id: 'piece-control', name: 'Piece Control', desc: 'Fast wall/floor/ramp place', timing: 'RB → Q+C+E', defaultKeys: 'Q+C+E', defaultAccel: 'F5', defaultPad: 5, mode: 'once' },
            { id: 'auto-sprint', name: 'Auto Sprint', desc: 'Hold sprint while trigger held', timing: 'LS → SHIFT hold', defaultKeys: 'KEYDOWN:SHIFT', defaultAccel: 'F6', defaultPad: 10, mode: 'hold', releaseKeys: 'KEYUP:SHIFT' },
            { id: 'quick-switch', name: 'Quick Weapon Switch', desc: 'Slot 1 then 2', timing: 'Y → 1+2', defaultKeys: '1+2', defaultAccel: 'F7', defaultPad: 3, mode: 'once' },
            { id: 'scroll-reset', name: 'Scroll Reset', desc: 'Scroll wheel reset bind', timing: 'RS → scroll', defaultKeys: 'SCROLLDOWN', defaultAccel: 'F8', defaultPad: 11, mode: 'once' }
        ],
        keyboard: [
            { id: 'wall-ramp', name: 'Instant Wall+Ramp', desc: 'Q then E fast place', timing: 'Q+E', defaultKeys: 'Q+E', defaultAccel: 'F1', mode: 'once' },
            { id: 'triple-edit', name: 'Triple Edit', desc: 'Edit chain G+G+G', timing: 'G+G+G', defaultKeys: 'G+G+G', defaultAccel: 'F2', mode: 'once' },
            { id: 'scroll-reset-kb', name: 'Scroll Reset', desc: 'Scroll reset bind', timing: 'Scroll down', defaultKeys: 'SCROLLDOWN', defaultAccel: 'F3', mode: 'once' },
            { id: 'rapid-click', name: 'Rapid Click', desc: 'Fast LMB clicks', timing: 'LMB spam', defaultKeys: 'LMB', defaultAccel: 'F4', mode: 'repeat', repeat: 10 },
            { id: 'side-jump', name: 'Side Jump', desc: 'Space + strafe', timing: 'SPACE+A', defaultKeys: 'SPACE+A', defaultAccel: 'F5', mode: 'once' },
            { id: 'three-piece', name: '3-Piece Combo', desc: 'Wall+Floor+Ramp', timing: 'Q+C+E', defaultKeys: 'Q+C+E', defaultAccel: 'F6', mode: 'once' },
            { id: 'double-move', name: 'Double Movement', desc: 'Diagonal W+A tap', timing: 'W+A', defaultKeys: 'W+A', defaultAccel: 'F7', mode: 'once' },
            { id: 'quick-swap', name: 'Quick Swap', desc: 'Weapon slot swap', timing: '1+2', defaultKeys: '1+2', defaultAccel: 'F8', mode: 'once' },
            { id: 'auto-sprint-kb', name: 'Auto Sprint', desc: 'Hold sprint key', timing: 'SHIFT hold', defaultKeys: 'KEYDOWN:SHIFT', defaultAccel: 'F9', mode: 'hold', releaseKeys: 'KEYUP:SHIFT' },
            { id: 'instant-confirm', name: 'Instant Confirm', desc: 'Edit confirm', timing: 'ENTER', defaultKeys: 'ENTER', defaultAccel: 'F10', mode: 'once' }
        ],
        mouse: [
            { id: 'rapid-click-m', name: 'Rapid Click', desc: 'LMB spam for shotgun', timing: 'LMB repeat', defaultKeys: 'LMB', defaultAccel: 'F1', defaultMouse: 'LMB', mode: 'repeat', repeat: 10 },
            { id: 'ads-shoot', name: 'ADS + Shoot', desc: 'Right click then left', timing: 'RMB+LMB', defaultKeys: 'RMB+LMB', defaultAccel: 'F2', defaultMouse: 'RMB', mode: 'once' },
            { id: 'scroll-reset-m', name: 'Scroll Reset', desc: 'Scroll wheel reset', timing: 'Scroll down', defaultKeys: 'SCROLLDOWN', defaultAccel: 'F3', defaultMouse: 'MMB', mode: 'once' },
            { id: 'weapon-cycle', name: 'Weapon Cycle', desc: 'Scroll to swap', timing: 'Scroll up', defaultKeys: 'SCROLLUP', defaultAccel: 'F4', defaultMouse: 'M4', mode: 'once' },
            { id: 'instant-ads', name: 'Instant ADS', desc: 'Hold ADS while held', timing: 'RMB hold', defaultKeys: 'KEYDOWN:RMB', defaultAccel: 'F5', defaultMouse: 'RMB', mode: 'hold', releaseKeys: 'KEYUP:RMB' },
            { id: 'floor-ramp-click', name: 'Floor+Ramp Click', desc: 'Double build click', timing: 'LMB+LMB', defaultKeys: 'LMB+LMB', defaultAccel: 'F6', defaultMouse: 'LMB', mode: 'once' },
            { id: 'crouch-spam', name: 'Crouch Spam', desc: 'Fast crouch tap', timing: 'C repeat', defaultKeys: 'C', defaultAccel: 'F7', defaultMouse: 'M5', mode: 'repeat', repeat: 6 },
            { id: 'edit-shot', name: 'Edit Shot', desc: 'Edit key + click', timing: 'G+LMB', defaultKeys: 'G+LMB', defaultAccel: 'F8', defaultMouse: 'LMB', mode: 'once' }
        ]
    };

    let currentTab = 'controller';
    let holo = null;
    let pollId = null;
    let inputPollId = null;
    let lastPadState = {};
    let lastMouseState = {};
    let binds = { controller: [], keyboard: [], mouse: [] };
    let licensed = false;
    let speed = 20;
    let engineActive = false;
    let devCache = { controllers: [], mice: [], keyboards: [] };
    let devicePollId = null;
    let gamepadWakeId = null;
    let pnpRefreshId = null;
    let holoRef = null;

    function getConnectedGamepads() {
        if (!navigator.getGamepads) return [];
        const raw = navigator.getGamepads();
        const pads = [];
        for (let i = 0; i < raw.length; i++) {
            if (raw[i] && raw[i].connected) pads.push(raw[i]);
        }
        return pads;
    }

    function controllerIsConnected() {
        return getConnectedGamepads().length > 0 || (devCache.controllers && devCache.controllers.length > 0);
    }

    function bestControllerName() {
        const list = devCache.controllers || [];
        const prefer = list.find(n => /dualsense|dualshock|game controller|gamepad|xbox|wireless controller/i.test(n));
        return prefer || list[0];
    }

    function controllerStatusLabel() {
        const pads = getConnectedGamepads();
        if (pads.length) return 'Connected — ' + pads[0].id.slice(0, 40);
        if (devCache.controllers && devCache.controllers.length) {
            const name = bestControllerName();
            return 'Connected — ' + name + ' (press any button for live input)';
        }
        return 'Not detected';
    }

    function el(id) { return document.getElementById(id); }

    function addLog(msg, level) {
        const log = el('log');
        if (!log) return;
        const line = document.createElement('div');
        line.className = level || '';
        line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
        log.prepend(line);
    }

    function normalizeAccel(key) {
        if (!key) return null;
        if (/^f\d+$/i.test(key)) return key.toUpperCase();
        if (key === ' ') return 'Space';
        if (key.length === 1) return key.toUpperCase();
        return key;
    }

    function switchTab(tab) {
        currentTab = tab;
        document.querySelectorAll('.macro-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
        if (holo) {
            holo.setTab(tab);
            holo.updateModelLabel();
            requestAnimationFrame(() => holo.resizeCanvas && holo.resizeCanvas());
        }
        buildBindUI();
    }

    function getDefs() { return MACRO_SETS[currentTab] || []; }

    function renderDevicesPanel() {
        if (document.getElementById('holo-canvas')) return;
        const panel = el('device-panel');
        if (!panel) return;
        const pads = getConnectedGamepads();
        const pad = pads[0];
        const ctrlOk = controllerIsConnected();
        const mouseOk = devCache.mice && devCache.mice.length > 0;
        const kbOk = devCache.keyboards && devCache.keyboards.length > 0;
        panel.innerHTML = `
            <h3 class="section-title">Connected Devices</h3>
            <div class="device-list">
                <div class="device-row ${ctrlOk ? 'ok' : ''}"><span>Controller</span><span>${controllerStatusLabel()}</span></div>
                <div class="device-row ${mouseOk ? 'ok' : ''}"><span>Mouse</span><span>${devCache.mice[0] || 'Detecting…'}</span></div>
                <div class="device-row ${kbOk ? 'ok' : ''}"><span>Keyboard</span><span>${devCache.keyboards[0] || 'Detecting…'}</span></div>
            </div>
            <p class="field-hint">${ctrlOk ? 'Controller detected. Live holo updates when you press buttons or move sticks.' : 'Plug in your controller via USB or Bluetooth, then press any button once.'}</p>
        `;
        if (holo) {
            holo.setPnpControllers(devCache.controllers || []);
            if (pad) holo.setModel(holo.detectControllerModel(pad, devCache.controllers));
            else if (ctrlOk) holo.setModel(holo.detectControllerModel(null, devCache.controllers));
            else if (currentTab === 'controller') holo.setModel('ps5');
            holo.updateModelLabel();
        }
    }

    function wakeGamepads() {
        if (navigator.getGamepads) navigator.getGamepads();
        renderDevicesPanel();
    }

    async function refreshPnpDevices() {
        try {
            const data = await window.blankDelay.detectDevices();
            if (data) devCache = data;
        } catch (_) {}
        renderDevicesPanel();
    }

    function startDeviceWatch() {
        if (gamepadWakeId) return;
        wakeGamepads();
        gamepadWakeId = setInterval(wakeGamepads, 400);
        if (!pnpRefreshId) pnpRefreshId = setInterval(refreshPnpDevices, 25000);
        window.addEventListener('gamepadconnected', wakeGamepads);
        window.addEventListener('gamepaddisconnected', wakeGamepads);
        refreshPnpDevices();
    }

    function startHolo() {
        if (typeof BlankDeviceHolo === 'undefined') {
            addLog('Holo module failed to load — refresh the app.', 'warn');
            return;
        }
        if (!holo) {
            holo = BlankDeviceHolo.init({ canvasId: 'device-holo', labelId: 'holo-label', tab: currentTab });
            holoRef = holo;
        }
        requestAnimationFrame(() => {
            holo.setTab(currentTab);
            holo.start();
            startDeviceWatch();
        });
    }

    function formatBind(b) {
        let s = `Sends: ${b.keys} · Hotkey: ${b.accelerator || '—'}`;
        if (b.gamepadBtn != null) s += ` · Pad: ${GAMEPAD_BUTTONS[b.gamepadBtn]}`;
        if (b.mouseBtn) s += ` · Mouse: ${b.mouseBtn}`;
        return s;
    }

    function buildBindUI() {
        const grid = el('macro-grid');
        if (!grid) return;
        const defs = getDefs();
        if (!binds[currentTab].length) {
            binds[currentTab] = defs.map(m => ({
                id: m.id, name: m.name, keys: m.defaultKeys, accelerator: m.defaultAccel || null,
                gamepadBtn: m.defaultPad != null ? m.defaultPad : null, mouseBtn: m.defaultMouse || null,
                mode: m.mode || 'once', repeat: m.repeat || 8, releaseKeys: m.releaseKeys || null, tab: currentTab
            }));
        }
        const list = binds[currentTab];
        grid.innerHTML = '';
        defs.forEach((macro, idx) => {
            const b = list[idx];
            const card = document.createElement('div');
            card.className = 'macro-card';
            card.dataset.id = macro.id;
            card.dataset.tab = currentTab;
            const showPad = currentTab === 'controller';
            const showMouse = currentTab === 'mouse';
            card.innerHTML = `
                <h4>${macro.name}</h4>
                <p>${macro.desc}</p>
                <div class="timing">${macro.timing.replace('{speed}', speed)}</div>
                <div class="bind-row">
                    <button type="button" class="btn btn-ghost btn-sm bind-key-btn" data-idx="${idx}">Set Hotkey</button>
                    ${showPad ? `<button type="button" class="btn btn-ghost btn-sm bind-pad-btn" data-idx="${idx}">Set Controller Btn</button>` : ''}
                    ${showMouse ? `<button type="button" class="btn btn-ghost btn-sm bind-mouse-btn" data-idx="${idx}">Set Mouse Btn</button>` : ''}
                </div>
                <div class="bind-display mono" id="bind-${currentTab}-${idx}">${formatBind(b)}</div>
            `;
            card.addEventListener('click', e => {
                if (e.target.closest('button')) return;
                card.classList.toggle('active');
            });
            grid.appendChild(card);
        });
        grid.querySelectorAll('.bind-key-btn').forEach(btn => {
            btn.addEventListener('click', e => { e.stopPropagation(); listenKeyboardBind(parseInt(btn.dataset.idx, 10), btn); });
        });
        grid.querySelectorAll('.bind-pad-btn').forEach(btn => {
            btn.addEventListener('click', e => { e.stopPropagation(); listenGamepadBind(parseInt(btn.dataset.idx, 10), btn); });
        });
        grid.querySelectorAll('.bind-mouse-btn').forEach(btn => {
            btn.addEventListener('click', e => { e.stopPropagation(); listenMouseBind(parseInt(btn.dataset.idx, 10), btn); });
        });
    }

    function updateBindDisplay(idx) {
        const d = el(`bind-${currentTab}-${idx}`);
        const b = binds[currentTab][idx];
        if (d && b) d.textContent = formatBind(b);
    }

    function listenKeyboardBind(idx, btn) {
        btn.textContent = 'Press key…';
        const handler = e => {
            e.preventDefault();
            const accel = normalizeAccel(e.key);
            binds[currentTab][idx].accelerator = accel;
            updateBindDisplay(idx);
            btn.textContent = 'Set Hotkey';
            window.removeEventListener('keydown', handler);
            addLog(`${binds[currentTab][idx].name} hotkey → ${accel}`);
        };
        window.addEventListener('keydown', handler);
        setTimeout(() => {
            window.removeEventListener('keydown', handler);
            if (btn.textContent === 'Press key…') btn.textContent = 'Set Hotkey';
        }, 5000);
    }

    function listenGamepadBind(idx, btn) {
        btn.textContent = 'Press button…';
        const start = Date.now();
        const poll = () => {
            const pad = navigator.getGamepads()?.[0];
            if (pad) {
                for (let i = 0; i < pad.buttons.length; i++) {
                    if (pad.buttons[i].pressed) {
                        binds[currentTab][idx].gamepadBtn = i;
                        updateBindDisplay(idx);
                        btn.textContent = 'Set Controller Btn';
                        if (holo) holo.highlightPadButton(i);
                        addLog(`${binds[currentTab][idx].name} → ${GAMEPAD_BUTTONS[i] || 'Btn ' + i}`);
                        return;
                    }
                }
            }
            if (Date.now() - start < 5000) requestAnimationFrame(poll);
            else btn.textContent = 'Set Controller Btn';
        };
        poll();
    }

    function listenMouseBind(idx, btn) {
        btn.textContent = 'Click mouse btn…';
        const map = { 0: 'LMB', 1: 'MMB', 2: 'RMB', 3: 'M4', 4: 'M5' };
        const handler = e => {
            e.preventDefault();
            const m = map[e.button] || 'LMB';
            binds[currentTab][idx].mouseBtn = m;
            updateBindDisplay(idx);
            btn.textContent = 'Set Mouse Btn';
            if (holo) { holo.highlight(m, true); setTimeout(() => holo.highlight(m, false), 300); }
            window.removeEventListener('mousedown', handler);
            addLog(`${binds[currentTab][idx].name} → ${m}`);
        };
        window.addEventListener('mousedown', handler);
        setTimeout(() => {
            window.removeEventListener('mousedown', handler);
            if (btn.textContent === 'Click mouse btn…') btn.textContent = 'Set Mouse Btn';
        }, 5000);
    }

    async function fireBind(b, fromPad) {
        await window.blankDelay.fireMacro({ keys: b.keys, speed, mode: b.mode || 'once', repeat: b.repeat || 8 });
        if (holo) {
            if (fromPad && b.gamepadBtn != null) holo.highlightPadButton(b.gamepadBtn);
            else holo.highlightKeys(b.keys);
        }
        addLog(`▶ ${b.name} fired`);
    }

    function getAllActiveBinds() {
        const ids = new Set([...document.querySelectorAll('.macro-card.active')].map(c => c.dataset.id));
        return ['controller', 'keyboard', 'mouse'].flatMap(t => binds[t].filter(b => ids.has(b.id)));
    }

    function startInputPoll() {
        stopInputPoll();
        pollId = setInterval(() => {
            const pads = getConnectedGamepads();
            const pad = pads[0];
            if (!pad) return;
            getAllActiveBinds().filter(b => b.tab === 'controller' && b.gamepadBtn != null).forEach(b => {
                const pressed = !!pad.buttons[b.gamepadBtn]?.pressed;
                const key = `${b.id}-${b.gamepadBtn}`;
                if (pressed && !lastPadState[key]) fireBind(b, true);
                if (!pressed && lastPadState[key] && b.mode === 'hold' && b.releaseKeys) {
                    window.blankDelay.fireMacro({ keys: b.releaseKeys, speed: 5, mode: 'once' });
                }
                lastPadState[key] = pressed;
            });
        }, 16);

        inputPollId = setInterval(async () => {
            if (!engineActive || currentTab !== 'mouse') return;
            const state = await window.blankDelay.pollInputState();
            if (!state) return;
            getAllActiveBinds().filter(b => b.tab === 'mouse' && b.mouseBtn).forEach(b => {
                const pressed = !!state.mouse?.[b.mouseBtn];
                const key = `${b.id}-${b.mouseBtn}`;
                if (pressed && !lastMouseState[key]) fireBind(b, false);
                if (!pressed && lastMouseState[key] && b.mode === 'hold' && b.releaseKeys) {
                    window.blankDelay.fireMacro({ keys: b.releaseKeys, speed: 5, mode: 'once' });
                }
                lastMouseState[key] = pressed;
            });
        }, 250);
    }

    function stopInputPoll() {
        if (pollId) clearInterval(pollId);
        if (inputPollId) clearInterval(inputPollId);
        pollId = null;
        inputPollId = null;
        lastPadState = {};
        lastMouseState = {};
    }

    async function activate() {
        const active = getAllActiveBinds();
        if (!active.length) { addLog('Select at least one macro.', 'warn'); return null; }
        const config = {
            type: 'suite', speed,
            binds: active.map(b => ({
                id: b.id, name: b.name, keys: b.keys, accelerator: b.accelerator,
                gamepadBtn: b.gamepadBtn, mouseBtn: b.mouseBtn, tab: b.tab,
                mode: b.mode, repeat: b.repeat, releaseKeys: b.releaseKeys
            })),
            timestamp: Date.now()
        };
        const res = await window.blankDelay.startMacroEngine(config);
        engineActive = true;
        startInputPoll();
        window.blankDelay.onMacroFired?.(data => {
            if (holo && data.keys) holo.highlightKeys(data.keys);
            addLog(`▶ Hotkey fired: ${data.keys}`);
        });
        const fortnite = await window.blankDelay.exportFortniteSettings({
            product: 'macro-suite',
            settings: [
                { label: 'Macro delay', value: speed + 'ms' },
                { label: 'Active macros', value: active.length },
                { label: 'Wall', value: 'Q' }, { label: 'Floor', value: 'C' },
                { label: 'Ramp', value: 'E' }, { label: 'Edit', value: 'G' }
            ],
            macros: active.map(b => ({
                name: `${b.name} (${b.tab})`,
                bind: b.accelerator || b.mouseBtn || (b.gamepadBtn != null ? GAMEPAD_BUTTONS[b.gamepadBtn] : '—'),
                keys: b.keys
            }))
        });
        addLog(`✓ ${active.length} macros live · ${res.registered} hotkeys · gamepad+mouse polling on`, 'ok');
        if (fortnite.file) addLog(`Fortnite guide exported → ${fortnite.file}`, 'ok');
        return res;
    }

    async function deactivate() {
        engineActive = false;
        stopInputPoll();
        await window.blankDelay.stopMacroEngine();
        addLog('All macros deactivated.', 'ok');
    }

    function init(opts) {
        const allowedTabs = opts.allowedTabs || ['controller', 'keyboard', 'mouse'];
        currentTab = allowedTabs.includes(opts.defaultTab) ? opts.defaultTab : allowedTabs[0];
        licensed = false;
        const tabNav = document.querySelector('.macro-tabs');
        document.querySelectorAll('.macro-tab').forEach(btn => {
            const tab = btn.dataset.tab;
            const allowed = allowedTabs.includes(tab);
            btn.hidden = !allowed;
            btn.style.display = allowed ? '' : 'none';
            if (!allowed) return;
            btn.addEventListener('click', () => switchTab(tab));
            btn.classList.toggle('active', tab === currentTab);
        });
        if (tabNav) tabNav.hidden = allowedTabs.length <= 1;
        return {
            unlock: () => {
                licensed = true;
                buildBindUI();
                startHolo();
            },
            isLicensed: () => licensed,
            setSpeed: v => { speed = v; },
            switchTab, activate, deactivate, addLog, getAllActiveBinds, MACRO_SETS
        };
    }

    return { init, GAMEPAD_BUTTONS, MOUSE_BUTTONS, MACRO_SETS };
})();
