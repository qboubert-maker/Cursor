/* BlankDelay — controller/keyboard macro shell engine (real gamepad polling + OS key injection) */
const BdControllerShell = (function () {
    const MARK_SVG = '<svg viewBox="0 0 32 32"><circle cx="8" cy="16" r="3.5" fill="currentColor"/><path fill="currentColor" d="M11 16h4l14-6-3 6 3 6-14-6z"/></svg>';
    const GP = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start', 'LS', 'RS', 'D-Up', 'D-Down', 'D-Left', 'D-Right'];
    const KB = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11'];

    function el(id) { return document.getElementById(id); }

    function init(opts) {
        const mount = el(opts.mountId);
        if (!mount) return null;

        const productLabel = opts.productLabel || 'Controller Macro';
        const isKeyboardMode = opts.mode === 'keyboard';
        const TRIGGERS = isKeyboardMode ? KB : GP;

        const ROWS = isKeyboardMode
            ? [
                { id: 'instant-build', name: 'Instant Build', bindIdx: 0, keys: '1+2', mode: 'once', enabled: false },
                { id: 'crouch-spam', name: 'Crouch Spam', bindIdx: 1, keys: 'LCTRL', mode: 'repeat', repeat: 10, enabled: false },
                { id: 'weapon-switcher', name: 'Weapon Switcher', bindIdx: 2, keys: '3+4', mode: 'once', enabled: false }
            ]
            : [
                { id: 'instant-build', name: 'Instant Build', bindIdx: 3, keys: '1+2', mode: 'once', enabled: false },
                { id: 'crouch-spam', name: 'Crouch Spam', bindIdx: 1, keys: 'LCTRL', mode: 'repeat', repeat: 10, enabled: false },
                { id: 'weapon-switcher', name: 'Weapon Switcher', bindIdx: 2, keys: '3+4', mode: 'once', enabled: false }
            ];
        const PREFIRE = { id: 'prefire', name: 'Prefire Macro', bindIdx: 5, keys: 'LMB', mode: 'once', enabled: false };
        const DRAG = { enabled: false, pullShotgunAfter: false, delayMs: 5 };
        const SETTINGS = { delay: 5, jitter: 0, loops: 8, game: 'fortnite' };
        let masterOn = false;
        let currentDevice = 'ps5';

        const stageHtml = isKeyboardMode
            ? `<div class="bd-cs-stage" id="bd-cs-stage">
                    <div class="bd-cs-stage-label">Live Input Preview</div>
                    <img id="bd-cs-img-kb" src="../shared/assets/keyboard.svg" alt="Keyboard">
               </div>`
            : `<div class="bd-cs-stage" id="bd-cs-stage">
                    <div class="bd-cs-stage-label">Live Controller Preview</div>
                    <img id="bd-cs-img-ps" src="../shared/assets/ps5-controller.svg" alt="PS5 controller">
                    <img id="bd-cs-img-xb" src="../shared/assets/xbox-controller.svg" alt="Xbox controller" class="hidden2">
               </div>
               <div class="bd-cs-device-switch">
                    <button type="button" class="bd-cs-device-btn ps active" id="bd-cs-btn-ps" title="PlayStation">P</button>
                    <button type="button" class="bd-cs-device-btn xb" id="bd-cs-btn-xb" title="Xbox">X</button>
               </div>`;

        mount.innerHTML = `
            <div class="bd-cs-wrap">
                <div class="bd-cs-topbar">
                    <div class="brand2"><span class="mark4">${MARK_SVG}</span> BLANKDELAY <span style="opacity:.4">|</span> <span class="sub2">${productLabel}</span></div>
                    <span class="status-pill" id="bd-cs-status">Ready</span>
                </div>

                ${stageHtml}

                <div class="bd-cs-panel">
                    <div class="bd-cs-panel-tabs">
                        <button type="button" class="active" data-tab="macros">Macro's</button>
                        <button type="button" data-tab="prefire">Prefire Macro</button>
                        <button type="button" data-tab="keybinds">Game Keybinds</button>
                        <button type="button" data-tab="settings">Settings</button>
                    </div>
                    <div class="bd-cs-panel-body">

                        <div class="bd-cs-panel-section active" data-sec="macros">
                            <div class="bd-cs-toggle-master">
                                <div class="tm-left">
                                    <div class="bd-cs-switch" id="bd-cs-master-switch"></div>
                                    <div><strong>Macro Toggle</strong><div class="bd-cs-hint">Enables/disables every macro feature (F9 while app focused)</div></div>
                                </div>
                                <span class="bd-cs-bind-pill">F9</span>
                            </div>
                            <div id="bd-cs-rows"></div>
                            <div class="bd-cs-drag-section">
                                <h4>Drag Macro</h4>
                                <div class="bd-cs-check-row">
                                    <span class="cl">Drag Macro Switch <span class="bd-cs-hint">${isKeyboardMode ? 'Bind: LMB — rapid-fire while held' : 'Bind: RT — rapid-fire while held'}</span></span>
                                    <div class="bd-cs-switch" id="bd-cs-drag-switch"></div>
                                </div>
                                <div class="bd-cs-check-row">
                                    <span class="cl">Pull out shotgun after</span>
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
                                    <div><strong>Prefire Macro</strong><div class="bd-cs-hint">Fires a quick shot the instant you peek a corner</div></div>
                                </div>
                                <span class="bd-cs-bind-pill" id="bd-cs-prefire-bind">${TRIGGERS[PREFIRE.bindIdx]}</span>
                            </div>
                            <div class="bd-cs-field-row">
                                <label>Trigger</label>
                                <select id="bd-cs-prefire-trigger">${TRIGGERS.map((n, i) => `<option value="${i}" ${i === PREFIRE.bindIdx ? 'selected' : ''}>${n}</option>`).join('')}</select>
                                <label>Output</label>
                                <input type="text" id="bd-cs-prefire-keys" value="${PREFIRE.keys}">
                            </div>
                            <p class="bd-cs-hint">OS-level input — works in any game. Toggle Macro Toggle above to arm all macros.</p>
                        </div>

                        <div class="bd-cs-panel-section" data-sec="keybinds">
                            <p class="bd-cs-hint" style="margin-bottom:12px">Recommended Fortnite keybinds — match these in Settings → Keyboard Controls so macro output lines up.</p>
                            <div class="bd-cs-keybind-list" id="bd-cs-keybind-list"></div>
                        </div>

                        <div class="bd-cs-panel-section" data-sec="settings">
                            <div class="bd-cs-field-row"><label>Game profile</label><select id="bd-cs-game-select"><option value="fortnite">Fortnite</option><option value="universal">Universal (all games)</option></select></div>
                            <div class="bd-cs-slider-row"><span class="cl" style="min-width:120px">Playback delay</span><input type="range" id="bd-cs-delay-slider" min="1" max="60" value="5"><span class="sv" id="bd-cs-delay-val">5ms</span></div>
                            <div class="bd-cs-slider-row"><span class="cl" style="min-width:120px">Random jitter</span><input type="range" id="bd-cs-jitter-slider" min="0" max="30" value="0"><span class="sv" id="bd-cs-jitter-val">0ms</span></div>
                            <div class="bd-cs-field-row"><label>Loop count</label><input type="text" id="bd-cs-loops" value="8" style="width:60px"></div>
                            <p class="bd-cs-hint">Per-game profiles only fire while the target game is focused-friendly. No injection — pure OS input.</p>
                        </div>

                    </div>
                </div>
                <div class="bd-cs-log" id="bd-cs-log"><div>${productLabel} ready — ${isKeyboardMode ? 'enable Macro Toggle to arm F-key hotkeys.' : 'connect a controller and enable Macro Toggle.'}</div></div>
            </div>
        `;

        const rowsEl = el('bd-cs-rows');
        function renderRows() {
            rowsEl.innerHTML = '';
            ROWS.forEach((r) => {
                const row = document.createElement('div');
                row.className = 'bd-cs-macro-row';
                row.innerHTML = `
                    <div class="bd-cs-macro-row-head">
                        <span class="arrow">▶</span>
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
                        </div>
                    </div>
                `;
                row.querySelector('.bd-cs-macro-row-head').addEventListener('click', (e) => {
                    if (e.target.closest('[data-row-toggle]')) return;
                    row.classList.toggle('expanded');
                });
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
                    log(`${r.name} ${r.enabled ? 'enabled' : 'disabled'}`, 'ok');
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
                    const r = ROWS.find((x) => x.id === inp.dataset.rowKeys);
                    r.keys = inp.value.trim().toUpperCase();
                    renderKeybinds();
                    if (isKeyboardMode && masterOn) syncKeyboardEngine();
                });
            });
            rowsEl.querySelectorAll('[data-row-mode]').forEach((sel) => {
                sel.addEventListener('change', () => {
                    const r = ROWS.find((x) => x.id === sel.dataset.rowMode);
                    r.mode = sel.value;
                    if (isKeyboardMode && masterOn) syncKeyboardEngine();
                });
            });
        }

        function renderKeybinds() {
            const list = el('bd-cs-keybind-list');
            if (!list) return;
            const items = [...ROWS, PREFIRE];
            list.innerHTML = items.map((r) => `
                <div class="bd-cs-keybind-row">
                    <span>${r.name} <span class="bd-cs-hint">(${TRIGGERS[r.bindIdx]})</span></span>
                    <span class="kb-out">${r.keys}</span>
                </div>
            `).join('');
        }

        renderRows();

        // ---- Panel tabs ----
        mount.querySelectorAll('.bd-cs-panel-tabs button').forEach((btn) => {
            btn.addEventListener('click', () => {
                mount.querySelectorAll('.bd-cs-panel-tabs button').forEach((b) => b.classList.toggle('active', b === btn));
                mount.querySelectorAll('.bd-cs-panel-section').forEach((s) => s.classList.toggle('active', s.dataset.sec === btn.dataset.tab));
            });
        });

        // ---- Device switcher (controller mode only) ----
        if (!isKeyboardMode) {
            const imgPs = el('bd-cs-img-ps');
            const imgXb = el('bd-cs-img-xb');
            el('bd-cs-btn-ps').addEventListener('click', () => {
                currentDevice = 'ps5';
                imgPs.classList.remove('hidden2'); imgXb.classList.add('hidden2');
                el('bd-cs-btn-ps').classList.add('active'); el('bd-cs-btn-xb').classList.remove('active');
            });
            el('bd-cs-btn-xb').addEventListener('click', () => {
                currentDevice = 'xbox';
                imgXb.classList.remove('hidden2'); imgPs.classList.add('hidden2');
                el('bd-cs-btn-xb').classList.add('active'); el('bd-cs-btn-ps').classList.remove('active');
            });
        }

        // ---- Master toggle ----
        const masterSwitch = el('bd-cs-master-switch');
        async function setMaster(on) {
            masterOn = on;
            masterSwitch.classList.toggle('on', on);
            el('bd-cs-status').textContent = on ? 'Macros Live' : 'Ready';
            log(on ? 'Macro Toggle ON.' : 'Macro Toggle OFF.', 'ok');
            if (isKeyboardMode) {
                if (on) await syncKeyboardEngine();
                else await window.blankDelay.stopMacroEngine();
            }
        }
        masterSwitch.addEventListener('click', () => setMaster(!masterOn));
        window.addEventListener('keydown', (e) => { if (e.key === 'F9') setMaster(!masterOn); });

        // ---- Prefire ----
        const prefireSwitch = el('bd-cs-prefire-switch');
        prefireSwitch.addEventListener('click', () => {
            PREFIRE.enabled = !PREFIRE.enabled;
            prefireSwitch.classList.toggle('on', PREFIRE.enabled);
            log(`Prefire Macro ${PREFIRE.enabled ? 'enabled' : 'disabled'}`, 'ok');
            if (isKeyboardMode && masterOn) syncKeyboardEngine();
        });
        el('bd-cs-prefire-trigger').addEventListener('change', (e) => {
            PREFIRE.bindIdx = Number(e.target.value);
            el('bd-cs-prefire-bind').textContent = TRIGGERS[PREFIRE.bindIdx];
            renderKeybinds();
            if (isKeyboardMode && masterOn) syncKeyboardEngine();
        });
        el('bd-cs-prefire-keys').addEventListener('input', (e) => {
            PREFIRE.keys = e.target.value.trim().toUpperCase();
            renderKeybinds();
            if (isKeyboardMode && masterOn) syncKeyboardEngine();
        });

        // ---- Drag macro ----
        const dragSwitch = el('bd-cs-drag-switch');
        const dragShotgunSwitch = el('bd-cs-drag-shotgun-switch');
        dragSwitch.addEventListener('click', () => { DRAG.enabled = !DRAG.enabled; dragSwitch.classList.toggle('on', DRAG.enabled); log(`Drag Macro ${DRAG.enabled ? 'enabled' : 'disabled'}`, 'ok'); });
        dragShotgunSwitch.addEventListener('click', () => { DRAG.pullShotgunAfter = !DRAG.pullShotgunAfter; dragShotgunSwitch.classList.toggle('on', DRAG.pullShotgunAfter); });
        el('bd-cs-drag-delay').addEventListener('input', (e) => { DRAG.delayMs = Number(e.target.value); el('bd-cs-drag-delay-val').textContent = DRAG.delayMs + 'ms'; });

        // ---- Settings ----
        el('bd-cs-game-select').addEventListener('change', (e) => { SETTINGS.game = e.target.value; });
        el('bd-cs-delay-slider').addEventListener('input', (e) => { SETTINGS.delay = Number(e.target.value); el('bd-cs-delay-val').textContent = SETTINGS.delay + 'ms'; if (isKeyboardMode && masterOn) syncKeyboardEngine(); });
        el('bd-cs-jitter-slider').addEventListener('input', (e) => { SETTINGS.jitter = Number(e.target.value); el('bd-cs-jitter-val').textContent = SETTINGS.jitter + 'ms'; });
        el('bd-cs-loops').addEventListener('change', (e) => { SETTINGS.loops = Math.max(1, parseInt(e.target.value, 10) || 8); });

        function log(msg, type) {
            const box = el('bd-cs-log');
            if (!box) return;
            const line = document.createElement('div');
            line.className = type || '';
            line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
            box.prepend(line);
        }

        function jitteredDelay() {
            return SETTINGS.delay + (SETTINGS.jitter ? Math.floor(Math.random() * SETTINGS.jitter) : 0);
        }

        function fireRow(r) {
            window.blankDelay.fireMacro({ keys: r.keys, speed: jitteredDelay(), mode: r.mode || 'once', repeat: r.repeat || SETTINGS.loops });
            log(`${r.name} → ${r.keys}`, 'ok');
        }

        // ---- Keyboard mode: real global hotkeys via main-process globalShortcut ----
        async function syncKeyboardEngine() {
            const binds = [];
            ROWS.forEach((r) => { if (r.enabled) binds.push({ accelerator: TRIGGERS[r.bindIdx], keys: r.keys, delayMs: jitteredDelay(), mode: r.mode, repeat: r.repeat || SETTINGS.loops }); });
            if (PREFIRE.enabled) binds.push({ accelerator: TRIGGERS[PREFIRE.bindIdx], keys: PREFIRE.keys, delayMs: jitteredDelay(), mode: PREFIRE.mode, repeat: SETTINGS.loops });
            const res = await window.blankDelay.startMacroEngine({ type: 'keyboard', speed: SETTINGS.delay, game: SETTINGS.game, binds, timestamp: Date.now() });
            log(`${res?.registered || 0} global hotkey(s) armed.`, 'ok');
        }
        window.blankDelay.onMacroFired?.((d) => log(`Hotkey ${d.accelerator} → ${d.keys}`, 'ok'));

        // ---- Real gamepad polling loop (controller mode) ----
        const lastPressed = {};
        let dragHoldStart = null;
        let dragShotgunFired = false;
        let lastDragFire = 0;
        let mouseHeld = false;

        function pads() {
            if (!navigator.getGamepads) return [];
            const arr = navigator.getGamepads();
            const out = [];
            for (let i = 0; i < arr.length; i++) if (arr[i]?.connected) out.push(arr[i]);
            return out;
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
                    log('Pulled out shotgun.', 'ok');
                }
            } else {
                dragHoldStart = null;
                dragShotgunFired = false;
                lastDragFire = 0;
            }
        }

        if (!isKeyboardMode) {
            setInterval(() => {
                if (!masterOn) return;
                const gp = pads()[0];
                if (!gp) return;

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
            }, 15);
        } else {
            setInterval(async () => {
                if (!masterOn || !DRAG.enabled) { mouseHeld = false; return; }
                const state = await window.blankDelay.pollInputState();
                runDragTick(!!(state?.mouse && state.mouse.LMB));
            }, 60);
        }

        window.blankDelay.onMacroPanic?.(() => { setMaster(false); log('F12 panic stop.', 'warn'); });

        return { setMaster, log };
    }

    return { init, GP, KB };
})();
