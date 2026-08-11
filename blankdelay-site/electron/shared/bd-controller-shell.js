/* BlankDelay — controller/keyboard macro shell (live preview + full macro customization) */
const BdControllerShell = (function () {
    const MARK_SVG = '<svg viewBox="0 0 32 32"><circle cx="8" cy="16" r="3.5" fill="currentColor"/><path fill="currentColor" d="M11 16h4l14-6-3 6 3 6-14-6z"/></svg>';
    const GP = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start', 'LS', 'RS', 'D-Up', 'D-Down', 'D-Left', 'D-Right'];
    const KB = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'];

    const PS_HOTSPOTS = [
        { idx: 0, x: 72.7, y: 44, label: '✕' }, { idx: 1, x: 77.3, y: 52, label: '○' },
        { idx: 2, x: 68.1, y: 52, label: '□' }, { idx: 3, x: 72.7, y: 36, label: '△' },
        { idx: 4, x: 17, y: 29, label: 'L1' }, { idx: 5, x: 72, y: 29, label: 'R1' },
        { idx: 6, x: 17, y: 23, label: 'L2' }, { idx: 7, x: 72, y: 23, label: 'R2' },
        { idx: 10, x: 33.7, y: 56, label: 'L3' }, { idx: 11, x: 66.3, y: 56, label: 'R3' },
        { idx: 12, x: 27.9, y: 48, label: '↑' }, { idx: 13, x: 27.9, y: 56, label: '↓' },
        { idx: 14, x: 24.2, y: 52, label: '←' }, { idx: 15, x: 31.5, y: 52, label: '→' }
    ];
    const XB_HOTSPOTS = [
        { idx: 0, x: 70.2, y: 45, label: 'A' }, { idx: 1, x: 75, y: 53, label: 'B' },
        { idx: 2, x: 65.4, y: 53, label: 'X' }, { idx: 3, x: 70.2, y: 37, label: 'Y' },
        { idx: 4, x: 23, y: 43, label: 'LB' }, { idx: 5, x: 64.4, y: 43, label: 'RB' },
        { idx: 6, x: 23, y: 35, label: 'LT' }, { idx: 7, x: 64.4, y: 35, label: 'RT' },
        { idx: 10, x: 35.6, y: 55, label: 'LS' }, { idx: 11, x: 64.4, y: 55, label: 'RS' },
        { idx: 12, x: 23, y: 43, label: '↑' }, { idx: 13, x: 23, y: 57, label: '↓' },
        { idx: 14, x: 15, y: 50, label: '←' }, { idx: 15, x: 31, y: 50, label: '→' }
    ];

    function el(id) { return document.getElementById(id); }

    function init(opts) {
        const mount = el(opts.mountId);
        if (!mount) return null;

        const productLabel = opts.productLabel || 'Controller Macro';
        const isKeyboardMode = opts.mode === 'keyboard';
        const TRIGGERS = isKeyboardMode ? KB : GP;
        const ASSET = '../shared/assets/';

        const ROWS = [
            { id: 'instant-build', name: 'Instant Build', bindIdx: isKeyboardMode ? 0 : 3, keys: 'Q+E+R', mode: 'once', enabled: false },
            { id: 'crouch-spam', name: 'Crouch Spam', bindIdx: isKeyboardMode ? 1 : 1, keys: 'LCTRL', mode: 'repeat', repeat: 12, enabled: false },
            { id: 'weapon-switcher', name: 'Weapon Switcher', bindIdx: isKeyboardMode ? 2 : 2, keys: '1+2', mode: 'once', enabled: false },
            { id: 'edit-reset', name: 'Edit Reset', bindIdx: isKeyboardMode ? 3 : 4, keys: 'G', mode: 'once', enabled: false },
            { id: 'wall-ramp', name: 'Wall + Ramp', bindIdx: isKeyboardMode ? 4 : 5, keys: 'Q+R', mode: 'once', enabled: false }
        ];
        const PREFIRE = { id: 'prefire', name: 'Prefire Macro', bindIdx: isKeyboardMode ? 5 : 5, keys: 'LMB', mode: 'once', enabled: false };
        const DRAG = { enabled: false, pullShotgunAfter: false, delayMs: 5 };
        const SETTINGS = { delay: 5, jitter: 0, loops: 8, game: 'fortnite' };
        let masterOn = false;
        let currentDevice = 'ps5';
        let hotspotEls = [];
        let pollTimer = null;

        const stageBlock = isKeyboardMode
            ? `<div class="bd-cs-stage" id="bd-cs-stage">
                    <div class="bd-cs-live-badge"><span class="pulse"></span> LIVE KEYBOARD</div>
                    <div class="bd-cs-stage-label">Live Keyboard Preview</div>
                    <div class="bd-cs-controller-wrap">
                        <img id="bd-cs-img-kb" src="${ASSET}keyboard.svg" alt="Keyboard">
                        <div class="bd-cs-hotspots" id="bd-cs-hotspots"></div>
                    </div>
               </div>`
            : `<div class="bd-cs-stage" id="bd-cs-stage">
                    <div class="bd-cs-live-badge"><span class="pulse"></span> LIVE CONTROLLER</div>
                    <div class="bd-cs-stage-label">Live Controller Preview</div>
                    <div class="bd-cs-controller-wrap">
                        <img id="bd-cs-img-ps" src="${ASSET}ps5-controller.svg" alt="PlayStation controller">
                        <img id="bd-cs-img-xb" src="${ASSET}xbox-controller.svg" alt="Xbox controller" class="hidden2">
                        <div class="bd-cs-hotspots" id="bd-cs-hotspots"></div>
                    </div>
                    <div class="bd-cs-connect" id="bd-cs-connect">Connect a controller to see live input</div>
               </div>
               <div class="bd-cs-device-switch">
                    <button type="button" class="bd-cs-device-btn ps active" id="bd-cs-btn-ps" title="PlayStation">
                        <img src="${ASSET}platforms/playstation.svg" alt="PlayStation">
                        <span>PS4 / PS5</span>
                    </button>
                    <button type="button" class="bd-cs-device-btn xb" id="bd-cs-btn-xb" title="Xbox">
                        <img src="${ASSET}platforms/xbox.svg" alt="Xbox">
                        <span>Xbox</span>
                    </button>
               </div>`;

        mount.innerHTML = `
            <div class="bd-cs-wrap">
                <div class="bd-cs-topbar">
                    <div class="brand2"><span class="mark4">${MARK_SVG}</span> BLANKDELAY <span style="opacity:.4">|</span> <span class="sub2">${productLabel}</span></div>
                    <span class="status-pill" id="bd-cs-status">Ready</span>
                </div>
                <div class="bd-cs-body">
                    <div class="bd-cs-left">${stageBlock}</div>
                    <div class="bd-cs-right">
                        <div class="bd-cs-panel">
                            <div class="bd-cs-panel-tabs">
                                <button type="button" class="active" data-tab="macros">Macro Toggle</button>
                                <button type="button" data-tab="prefire">Prefire Macro</button>
                                <button type="button" data-tab="keybinds">Game Keybinds</button>
                                <button type="button" data-tab="settings">Settings</button>
                            </div>
                            <div class="bd-cs-panel-body">
                                <div class="bd-cs-panel-section active" data-sec="macros">
                                    <div class="bd-cs-toggle-master">
                                        <div class="tm-left">
                                            <div class="bd-cs-switch" id="bd-cs-master-switch"></div>
                                            <div><strong>Macro Toggle</strong><div class="bd-cs-hint">Master switch for all macros (F9 panic toggle while focused)</div></div>
                                        </div>
                                        <span class="bd-cs-bind-pill">F9</span>
                                    </div>
                                    <div class="bd-cs-section-label">Customize Macros</div>
                                    <div id="bd-cs-rows"></div>
                                    <div class="bd-cs-drag-section">
                                        <h4>Drag Macro</h4>
                                        <div class="bd-cs-check-row">
                                            <span class="cl">Drag Macro Switch <span class="bd-cs-hint">${isKeyboardMode ? 'LMB rapid-fire while held' : 'RT rapid-fire while held'}</span></span>
                                            <div class="bd-cs-switch" id="bd-cs-drag-switch"></div>
                                        </div>
                                        <div class="bd-cs-check-row">
                                            <span class="cl">Pull out shotgun after drag</span>
                                            <div class="bd-cs-switch" id="bd-cs-drag-shotgun-switch"></div>
                                        </div>
                                        <div class="bd-cs-slider-row">
                                            <span class="cl" style="min-width:120px">Drag Macro Delay</span>
                                            <input type="range" id="bd-cs-drag-delay" min="1" max="60" value="5">
                                            <span class="sv" id="bd-cs-drag-delay-val">5ms</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="bd-cs-panel-section" data-sec="prefire">
                                    <div class="bd-cs-toggle-master">
                                        <div class="tm-left">
                                            <div class="bd-cs-switch" id="bd-cs-prefire-switch"></div>
                                            <div><strong>Prefire Macro</strong><div class="bd-cs-hint">Quick shot the instant you peek</div></div>
                                        </div>
                                        <span class="bd-cs-bind-pill" id="bd-cs-prefire-bind">${TRIGGERS[PREFIRE.bindIdx]}</span>
                                    </div>
                                    <div class="bd-cs-field-row">
                                        <label>Trigger button</label>
                                        <select id="bd-cs-prefire-trigger">${TRIGGERS.map((n, i) => `<option value="${i}" ${i === PREFIRE.bindIdx ? 'selected' : ''}>${n}</option>`).join('')}</select>
                                        <label>Output keys</label>
                                        <input type="text" id="bd-cs-prefire-keys" value="${PREFIRE.keys}">
                                    </div>
                                </div>
                                <div class="bd-cs-panel-section" data-sec="keybinds">
                                    <p class="bd-cs-hint" style="margin-bottom:12px">Match these in Fortnite Settings → Keyboard Controls.</p>
                                    <div class="bd-cs-keybind-list" id="bd-cs-keybind-list"></div>
                                </div>
                                <div class="bd-cs-panel-section" data-sec="settings">
                                    <div class="bd-cs-field-row"><label>Game profile</label><select id="bd-cs-game-select"><option value="fortnite">Fortnite</option><option value="universal">Universal</option></select></div>
                                    <div class="bd-cs-slider-row"><span class="cl" style="min-width:120px">Macro delay</span><input type="range" id="bd-cs-delay-slider" min="1" max="60" value="5"><span class="sv" id="bd-cs-delay-val">5ms</span></div>
                                    <div class="bd-cs-slider-row"><span class="cl" style="min-width:120px">Random jitter</span><input type="range" id="bd-cs-jitter-slider" min="0" max="30" value="0"><span class="sv" id="bd-cs-jitter-val">0ms</span></div>
                                    <div class="bd-cs-field-row"><label>Loop count</label><input type="text" id="bd-cs-loops" value="8" style="width:60px"></div>
                                </div>
                            </div>
                        </div>
                        <div class="bd-cs-log" id="bd-cs-log"><div>${productLabel} ready — customize macros below, then enable Macro Toggle.</div></div>
                    </div>
                </div>
            </div>`;

        const rowsEl = el('bd-cs-rows');
        const hotspotsRoot = el('bd-cs-hotspots');

        function renderHotspots() {
            if (!hotspotsRoot || isKeyboardMode) return;
            const map = currentDevice === 'xbox' ? XB_HOTSPOTS : PS_HOTSPOTS;
            hotspotsRoot.innerHTML = map.map((h) =>
                `<div class="bd-cs-hotspot" data-idx="${h.idx}" style="left:${h.x}%;top:${h.y}%" title="${h.label}"><span>${h.label}</span></div>`
            ).join('');
            hotspotEls = hotspotsRoot.querySelectorAll('.bd-cs-hotspot');
        }

        function renderRows() {
            rowsEl.innerHTML = '';
            ROWS.forEach((r) => {
                const row = document.createElement('div');
                row.className = 'bd-cs-macro-row expanded';
                row.innerHTML = `
                    <div class="bd-cs-macro-row-head">
                        <div class="bd-cs-switch${r.enabled ? ' on' : ''}" data-row-toggle="${r.id}"></div>
                        <span class="rname">${r.name}</span>
                        <span class="bd-cs-bind-pill">${TRIGGERS[r.bindIdx]}</span>
                    </div>
                    <div class="bd-cs-macro-row-body">
                        <div class="bd-cs-field-row">
                            <label>Trigger</label>
                            <select data-row-trigger="${r.id}">${TRIGGERS.map((n, i) => `<option value="${i}" ${i === r.bindIdx ? 'selected' : ''}>${n}</option>`).join('')}</select>
                            <label>Output</label>
                            <input type="text" data-row-keys="${r.id}" value="${r.keys}">
                            <label>Mode</label>
                            <select data-row-mode="${r.id}">
                                <option value="once" ${r.mode === 'once' ? 'selected' : ''}>Tap</option>
                                <option value="repeat" ${r.mode === 'repeat' ? 'selected' : ''}>Repeat</option>
                            </select>
                            ${r.mode === 'repeat' ? `<label>Loops</label><input type="number" data-row-repeat="${r.id}" value="${r.repeat || 8}" min="1" max="99" style="width:56px">` : ''}
                        </div>
                    </div>`;
                rowsEl.appendChild(row);
            });
            wireRowInputs();
            renderKeybinds();
            if (isKeyboardMode && masterOn) syncKeyboardEngine();
        }

        function wireRowInputs() {
            rowsEl.querySelectorAll('[data-row-toggle]').forEach((sw) => {
                sw.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const r = ROWS.find((x) => x.id === sw.dataset.rowToggle);
                    r.enabled = !r.enabled;
                    sw.classList.toggle('on', r.enabled);
                    log(`${r.name} ${r.enabled ? 'ON' : 'OFF'}`, 'ok');
                    if (isKeyboardMode && masterOn) syncKeyboardEngine();
                });
            });
            rowsEl.querySelectorAll('[data-row-trigger]').forEach((sel) => {
                sel.addEventListener('change', () => {
                    const r = ROWS.find((x) => x.id === sel.dataset.rowTrigger);
                    r.bindIdx = Number(sel.value);
                    renderRows();
                });
            });
            rowsEl.querySelectorAll('[data-row-keys]').forEach((inp) => {
                inp.addEventListener('input', () => {
                    ROWS.find((x) => x.id === inp.dataset.rowKeys).keys = inp.value.trim().toUpperCase();
                    renderKeybinds();
                    if (isKeyboardMode && masterOn) syncKeyboardEngine();
                });
            });
            rowsEl.querySelectorAll('[data-row-mode]').forEach((sel) => {
                sel.addEventListener('change', () => {
                    ROWS.find((x) => x.id === sel.dataset.rowMode).mode = sel.value;
                    renderRows();
                });
            });
            rowsEl.querySelectorAll('[data-row-repeat]').forEach((inp) => {
                inp.addEventListener('change', () => {
                    ROWS.find((x) => x.id === inp.dataset.rowRepeat).repeat = Math.max(1, parseInt(inp.value, 10) || 8);
                });
            });
        }

        function renderKeybinds() {
            const list = el('bd-cs-keybind-list');
            if (!list) return;
            list.innerHTML = [...ROWS, PREFIRE].map((r) =>
                `<div class="bd-cs-keybind-row"><span>${r.name} <span class="bd-cs-hint">(${TRIGGERS[r.bindIdx]})</span></span><span class="kb-out">${r.keys}</span></div>`
            ).join('');
        }

        renderHotspots();
        renderRows();

        mount.querySelectorAll('.bd-cs-panel-tabs button').forEach((btn) => {
            btn.addEventListener('click', () => {
                mount.querySelectorAll('.bd-cs-panel-tabs button').forEach((b) => b.classList.toggle('active', b === btn));
                mount.querySelectorAll('.bd-cs-panel-section').forEach((s) => s.classList.toggle('active', s.dataset.sec === btn.dataset.tab));
            });
        });

        if (!isKeyboardMode) {
            const imgPs = el('bd-cs-img-ps');
            const imgXb = el('bd-cs-img-xb');
            el('bd-cs-btn-ps').addEventListener('click', () => {
                currentDevice = 'ps5';
                imgPs.classList.remove('hidden2'); imgXb.classList.add('hidden2');
                el('bd-cs-btn-ps').classList.add('active'); el('bd-cs-btn-xb').classList.remove('active');
                renderHotspots();
            });
            el('bd-cs-btn-xb').addEventListener('click', () => {
                currentDevice = 'xbox';
                imgXb.classList.remove('hidden2'); imgPs.classList.add('hidden2');
                el('bd-cs-btn-xb').classList.add('active'); el('bd-cs-btn-ps').classList.remove('active');
                renderHotspots();
            });
        }

        const masterSwitch = el('bd-cs-master-switch');
        async function setMaster(on) {
            masterOn = on;
            masterSwitch.classList.toggle('on', on);
            el('bd-cs-status').textContent = on ? 'Macros Live' : 'Ready';
            log(on ? 'Macro Toggle ON — macros armed.' : 'Macro Toggle OFF.', 'ok');
            if (isKeyboardMode) {
                if (on) await syncKeyboardEngine();
                else await window.blankDelay.stopMacroEngine();
            }
        }
        masterSwitch.addEventListener('click', () => setMaster(!masterOn));
        window.addEventListener('keydown', (e) => { if (e.key === 'F9') setMaster(!masterOn); });

        el('bd-cs-prefire-switch').addEventListener('click', function () {
            PREFIRE.enabled = !PREFIRE.enabled;
            this.classList.toggle('on', PREFIRE.enabled);
            if (isKeyboardMode && masterOn) syncKeyboardEngine();
        });
        el('bd-cs-prefire-trigger').addEventListener('change', (e) => {
            PREFIRE.bindIdx = Number(e.target.value);
            el('bd-cs-prefire-bind').textContent = TRIGGERS[PREFIRE.bindIdx];
            renderKeybinds();
        });
        el('bd-cs-prefire-keys').addEventListener('input', (e) => { PREFIRE.keys = e.target.value.trim().toUpperCase(); renderKeybinds(); });

        el('bd-cs-drag-switch').addEventListener('click', function () { DRAG.enabled = !DRAG.enabled; this.classList.toggle('on', DRAG.enabled); });
        el('bd-cs-drag-shotgun-switch').addEventListener('click', function () { DRAG.pullShotgunAfter = !DRAG.pullShotgunAfter; this.classList.toggle('on', DRAG.pullShotgunAfter); });
        el('bd-cs-drag-delay').addEventListener('input', (e) => { DRAG.delayMs = Number(e.target.value); el('bd-cs-drag-delay-val').textContent = DRAG.delayMs + 'ms'; });

        el('bd-cs-game-select').addEventListener('change', (e) => { SETTINGS.game = e.target.value; });
        el('bd-cs-delay-slider').addEventListener('input', (e) => { SETTINGS.delay = Number(e.target.value); el('bd-cs-delay-val').textContent = SETTINGS.delay + 'ms'; });
        el('bd-cs-jitter-slider').addEventListener('input', (e) => { SETTINGS.jitter = Number(e.target.value); el('bd-cs-jitter-val').textContent = SETTINGS.jitter + 'ms'; });
        el('bd-cs-loops').addEventListener('change', (e) => { SETTINGS.loops = Math.max(1, parseInt(e.target.value, 10) || 8); });

        function log(msg, type) {
            const box = el('bd-cs-log');
            const line = document.createElement('div');
            line.className = type || '';
            line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
            box.prepend(line);
        }

        function jitteredDelay() { return SETTINGS.delay + (SETTINGS.jitter ? Math.floor(Math.random() * SETTINGS.jitter) : 0); }

        function fireRow(r) {
            window.blankDelay.fireMacro({ keys: r.keys, speed: jitteredDelay(), mode: r.mode || 'once', repeat: r.repeat || SETTINGS.loops });
            log(`${r.name} → ${r.keys}`, 'ok');
        }

        async function syncKeyboardEngine() {
            const binds = [];
            ROWS.forEach((r) => { if (r.enabled) binds.push({ accelerator: TRIGGERS[r.bindIdx], keys: r.keys, delayMs: jitteredDelay(), mode: r.mode, repeat: r.repeat || SETTINGS.loops }); });
            if (PREFIRE.enabled) binds.push({ accelerator: TRIGGERS[PREFIRE.bindIdx], keys: PREFIRE.keys, delayMs: jitteredDelay(), mode: PREFIRE.mode, repeat: SETTINGS.loops });
            const res = await window.blankDelay.startMacroEngine({ type: 'keyboard', speed: SETTINGS.delay, game: SETTINGS.game, binds, timestamp: Date.now() });
            log(`${res?.registered || 0} hotkey(s) armed.`, 'ok');
        }

        const lastPressed = {};
        let dragHoldStart = null, dragShotgunFired = false, lastDragFire = 0;

        function pads() {
            if (!navigator.getGamepads) return [];
            const out = [];
            const arr = navigator.getGamepads();
            for (let i = 0; i < arr.length; i++) if (arr[i]?.connected) out.push(arr[i]);
            return out;
        }

        function updateHotspots(gp) {
            if (!gp || !hotspotEls.length) return;
            el('bd-cs-connect').textContent = gp.id ? `Connected: ${gp.id}` : 'Controller connected';
            hotspotEls.forEach((node) => {
                const idx = Number(node.dataset.idx);
                const pressed = !!gp.buttons[idx]?.pressed;
                node.classList.toggle('lit', pressed);
            });
        }

        function runDragTick(pressed) {
            if (pressed) {
                if (!dragHoldStart) dragHoldStart = Date.now();
                const now = Date.now();
                if (now - lastDragFire >= DRAG.delayMs) {
                    window.blankDelay.fireMacro({ keys: 'LMB', speed: 4, mode: 'once' });
                    lastDragFire = now;
                }
                if (DRAG.pullShotgunAfter && !dragShotgunFired && now - dragHoldStart > 550) {
                    window.blankDelay.fireMacro({ keys: '5', speed: 4, mode: 'once' });
                    dragShotgunFired = true;
                }
            } else {
                dragHoldStart = null; dragShotgunFired = false; lastDragFire = 0;
            }
        }

        if (!isKeyboardMode) {
            pollTimer = setInterval(() => {
                const gp = pads()[0];
                updateHotspots(gp);
                if (!masterOn || !gp) return;
                ROWS.forEach((r) => {
                    if (!r.enabled) return;
                    const pressed = !!gp.buttons[r.bindIdx]?.pressed;
                    const key = 'row_' + r.id;
                    if (pressed && !lastPressed[key]) fireRow(r);
                    lastPressed[key] = pressed;
                });
                if (PREFIRE.enabled) {
                    const pressed = !!gp.buttons[PREFIRE.bindIdx]?.pressed;
                    if (pressed && !lastPressed.prefire) fireRow(PREFIRE);
                    lastPressed.prefire = pressed;
                }
                if (DRAG.enabled) runDragTick(!!gp.buttons[7]?.pressed);
            }, 16);
        } else {
            pollTimer = setInterval(async () => {
                if (!masterOn || !DRAG.enabled) return;
                const state = await window.blankDelay.pollInputState();
                runDragTick(!!(state?.mouse && state.mouse.LMB));
            }, 60);
        }

        window.blankDelay.onMacroFired?.((d) => log(`Hotkey ${d.accelerator} → ${d.keys}`, 'ok'));
        window.blankDelay.onMacroPanic?.(() => { setMaster(false); log('F12 panic stop.', 'warn'); });

        return { setMaster, log, destroy: () => clearInterval(pollTimer) };
    }

    return { init, GP, KB };
})();
