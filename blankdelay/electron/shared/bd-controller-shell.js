/* BlankDelay — Controller / Keyboard Macro shell (live pad + AHK-style Fortnite macros) */
const BdControllerShell = (function () {
    const MARK_SVG = '<svg viewBox="0 0 32 32"><circle cx="8" cy="16" r="3.5" fill="currentColor"/><path fill="currentColor" d="M11 16h4l14-6-3 6 3 6-14-6z"/></svg>';
    const GP = ['A/✕', 'B/○', 'X/□', 'Y/△', 'LB/L1', 'RB/R1', 'LT/L2', 'RT/R2', 'Share', 'Options', 'LS', 'RS', 'D-Up', 'D-Down', 'D-Left', 'D-Right'];
    const KB = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11'];

    function el(id) { return document.getElementById(id); }

    function init(opts) {
        const mount = el(opts.mountId);
        if (!mount) return null;
        const productLabel = opts.productLabel || 'Controller Macro';
        const isKb = opts.mode === 'keyboard';
        const TRIG = isKb ? KB : GP;

        // Zuhls-style Fortnite macro set (OS SendInput / AHK-equivalent timing)
        const ROWS = [
            { id: 'instant-build', name: 'Instant Build', bindIdx: isKb ? 0 : 3, keys: 'Q+E+C+R', mode: 'once', enabled: false },
            { id: 'crouch-spam', name: 'Crouch Spam', bindIdx: isKb ? 1 : 1, keys: 'LCTRL', mode: 'repeat', repeat: 14, enabled: false },
            { id: 'weapon-switcher', name: 'Weapon Switcher', bindIdx: isKb ? 2 : 2, keys: '1+2', mode: 'once', enabled: false },
            { id: 'double-edit', name: 'Double Edit', bindIdx: isKb ? 3 : 4, keys: 'F+W+E', mode: 'once', enabled: false },
            { id: 'auto-build', name: 'Auto Build Hold', bindIdx: isKb ? 4 : 5, keys: 'Q+W', mode: 'repeat', repeat: 6, enabled: false },
            { id: 'edit-reset', name: 'Edit Reset', bindIdx: isKb ? 5 : 8, keys: 'G', mode: 'once', enabled: false }
        ];
        const PREFIRE = { id: 'prefire', name: 'Prefire Macro', bindIdx: isKb ? 6 : 5, keys: 'LMB', mode: 'once', enabled: false };
        const DRAG = { enabled: false, pullShotgunAfter: true, delayMs: 8, editBind: isKb ? 'F' : 6 };
        const SETTINGS = { delay: 5, jitter: 0, loops: 8, game: 'fortnite', fortniteOnly: true };
        let masterOn = false;
        let fortniteOk = false;
        let lastPressed = {};
        let dragHoldStart = null, dragShotgunFired = false, lastDragFire = 0;
        let bwFlip = false;

        mount.innerHTML = `
        <div class="bd-cs-wrap bd-cs-bw">
            <header class="bd-cs-brandbar">
                <div class="bd-cs-brand">
                    <span class="mark4">${MARK_SVG}</span>
                    <div>
                        <div class="b1">BLANKDELAY</div>
                        <div class="b2">${productLabel}</div>
                    </div>
                </div>
                <div class="bd-cs-brand-right">
                    <span class="bd-cs-live-chip" id="bd-cs-fn-chip"><span class="pulse"></span> Fortnite</span>
                    <span class="status-pill" id="bd-cs-status">Ready</span>
                </div>
            </header>

            <div class="bd-cs-body">
                <aside class="bd-cs-left">
                    ${isKb ? `
                        <div class="bd-cs-stage kb">
                            <div class="bd-cs-live-badge"><span class="pulse"></span> LIVE KEYBOARD</div>
                            <img src="../shared/assets/keyboard.svg" alt="Keyboard">
                            <p class="bd-cs-connect">Press your hotkeys — output fires through BlankDelay SendInput (AHK-style)</p>
                        </div>` : `<div id="bd-gp-mount"></div>`}
                </aside>
                <section class="bd-cs-right">
                    <div class="bd-cs-panel">
                        <div class="bd-cs-panel-tabs">
                            <button type="button" class="active" data-tab="macros">Macro Toggle</button>
                            <button type="button" data-tab="prefire">Prefire</button>
                            <button type="button" data-tab="keybinds">Game Keybinds</button>
                            <button type="button" data-tab="settings">Settings</button>
                        </div>
                        <div class="bd-cs-panel-body">
                            <div class="bd-cs-panel-section active" data-sec="macros">
                                <div class="bd-cs-toggle-master">
                                    <div class="tm-left">
                                        <div class="bd-cs-switch" id="bd-cs-master-switch"></div>
                                        <div><strong>Macro Toggle</strong><div class="bd-cs-hint">Master arm (F9) — AHK-style SendInput for Fortnite</div></div>
                                    </div>
                                    <span class="bd-cs-bind-pill">F9</span>
                                </div>
                                <div class="bd-cs-section-label">Customize Macros</div>
                                <div id="bd-cs-rows"></div>
                                <div class="bd-cs-drag-section">
                                    <h4>Drag Macro</h4>
                                    <div class="bd-cs-check-row"><span class="cl">Drag Macro Switch</span><div class="bd-cs-switch" id="bd-cs-drag-switch"></div></div>
                                    <div class="bd-cs-check-row"><span class="cl">Pull shotgun after drag</span><div class="bd-cs-switch on" id="bd-cs-drag-shotgun-switch"></div></div>
                                    <div class="bd-cs-slider-row"><span class="cl" style="min-width:120px">Drag Delay</span><input type="range" id="bd-cs-drag-delay" min="1" max="40" value="8"><span class="sv" id="bd-cs-drag-delay-val">8ms</span></div>
                                </div>
                            </div>
                            <div class="bd-cs-panel-section" data-sec="prefire">
                                <div class="bd-cs-toggle-master">
                                    <div class="tm-left">
                                        <div class="bd-cs-switch" id="bd-cs-prefire-switch"></div>
                                        <div><strong>Prefire Macro</strong><div class="bd-cs-hint">Quick peek shot</div></div>
                                    </div>
                                    <span class="bd-cs-bind-pill" id="bd-cs-prefire-bind">${TRIG[PREFIRE.bindIdx]}</span>
                                </div>
                                <div class="bd-cs-field-row">
                                    <label>Trigger</label>
                                    <select id="bd-cs-prefire-trigger">${TRIG.map((n,i)=>`<option value="${i}" ${i===PREFIRE.bindIdx?'selected':''}>${n}</option>`).join('')}</select>
                                    <label>Output</label>
                                    <input type="text" id="bd-cs-prefire-keys" value="${PREFIRE.keys}">
                                </div>
                            </div>
                            <div class="bd-cs-panel-section" data-sec="keybinds">
                                <p class="bd-cs-hint" style="margin-bottom:12px">Match Fortnite Settings → Keyboard Controls to these outputs.</p>
                                <div class="bd-cs-keybind-list" id="bd-cs-keybind-list"></div>
                            </div>
                            <div class="bd-cs-panel-section" data-sec="settings">
                                <div class="bd-cs-check-row"><span class="cl">Only fire while Fortnite is focused</span><div class="bd-cs-switch on" id="bd-cs-fn-only"></div></div>
                                <div class="bd-cs-slider-row"><span class="cl" style="min-width:120px">Macro delay</span><input type="range" id="bd-cs-delay-slider" min="1" max="40" value="5"><span class="sv" id="bd-cs-delay-val">5ms</span></div>
                                <div class="bd-cs-slider-row"><span class="cl" style="min-width:120px">Jitter</span><input type="range" id="bd-cs-jitter-slider" min="0" max="20" value="0"><span class="sv" id="bd-cs-jitter-val">0ms</span></div>
                            </div>
                        </div>
                    </div>
                    <div class="bd-cs-log" id="bd-cs-log"><div>${productLabel} ready — connect device, customize macros, arm Macro Toggle.</div></div>
                </section>
            </div>
        </div>`;

        // B/W reactive color flip on click
        mount.addEventListener('click', (e) => {
            if (e.target.closest('input,select,button,.bd-cs-switch')) return;
            bwFlip = !bwFlip;
            mount.querySelector('.bd-cs-wrap')?.classList.toggle('invert', bwFlip);
        });

        const rowsEl = el('bd-cs-rows');
        function renderRows() {
            rowsEl.innerHTML = ROWS.map((r) => `
                <div class="bd-cs-macro-row expanded">
                    <div class="bd-cs-macro-row-head">
                        <div class="bd-cs-switch${r.enabled?' on':''}" data-row-toggle="${r.id}"></div>
                        <span class="rname">${r.name}</span>
                        <span class="bd-cs-bind-pill">${TRIG[r.bindIdx]}</span>
                    </div>
                    <div class="bd-cs-macro-row-body">
                        <div class="bd-cs-field-row">
                            <label>Trigger</label>
                            <select data-row-trigger="${r.id}">${TRIG.map((n,i)=>`<option value="${i}" ${i===r.bindIdx?'selected':''}>${n}</option>`).join('')}</select>
                            <label>Output</label>
                            <input type="text" data-row-keys="${r.id}" value="${r.keys}">
                            <label>Mode</label>
                            <select data-row-mode="${r.id}"><option value="once" ${r.mode==='once'?'selected':''}>Tap</option><option value="repeat" ${r.mode==='repeat'?'selected':''}>Repeat</option></select>
                        </div>
                    </div>
                </div>`).join('');
            wireRows();
            renderKeybinds();
            if (isKb && masterOn) syncKb();
        }
        function wireRows() {
            rowsEl.querySelectorAll('[data-row-toggle]').forEach((sw) => sw.addEventListener('click', (e) => {
                e.stopPropagation();
                const r = ROWS.find((x) => x.id === sw.dataset.rowToggle);
                r.enabled = !r.enabled; sw.classList.toggle('on', r.enabled); log(r.name + (r.enabled ? ' ON' : ' OFF'), 'ok');
                if (isKb && masterOn) syncKb();
            }));
            rowsEl.querySelectorAll('[data-row-trigger]').forEach((sel) => sel.addEventListener('change', () => {
                ROWS.find((x) => x.id === sel.dataset.rowTrigger).bindIdx = Number(sel.value); renderRows();
            }));
            rowsEl.querySelectorAll('[data-row-keys]').forEach((inp) => inp.addEventListener('input', () => {
                ROWS.find((x) => x.id === inp.dataset.rowKeys).keys = inp.value.trim().toUpperCase(); renderKeybinds();
            }));
            rowsEl.querySelectorAll('[data-row-mode]').forEach((sel) => sel.addEventListener('change', () => {
                ROWS.find((x) => x.id === sel.dataset.rowMode).mode = sel.value;
            }));
        }
        function renderKeybinds() {
            el('bd-cs-keybind-list').innerHTML = [...ROWS, PREFIRE].map((r) =>
                `<div class="bd-cs-keybind-row"><span>${r.name} <span class="bd-cs-hint">(${TRIG[r.bindIdx]})</span></span><span class="kb-out">${r.keys}</span></div>`
            ).join('');
        }
        renderRows();

        mount.querySelectorAll('.bd-cs-panel-tabs button').forEach((btn) => {
            btn.addEventListener('click', () => {
                mount.querySelectorAll('.bd-cs-panel-tabs button').forEach((b) => b.classList.toggle('active', b === btn));
                mount.querySelectorAll('.bd-cs-panel-section').forEach((s) => s.classList.toggle('active', s.dataset.sec === btn.dataset.tab));
            });
        });

        if (!isKb && window.BdGamepadLive) {
            BdGamepadLive.init(el('bd-gp-mount'), {
                color: 'black',
                onConnect: (g) => log('Controller connected: ' + g.id, 'ok'),
                onDisconnect: () => log('Controller disconnected', 'warn')
            });
        }

        const master = el('bd-cs-master-switch');
        async function setMaster(on) {
            masterOn = on; master.classList.toggle('on', on);
            el('bd-cs-status').textContent = on ? 'Macros Live' : 'Ready';
            log(on ? 'Macro Toggle ON' : 'Macro Toggle OFF', 'ok');
            if (isKb) { if (on) await syncKb(); else await window.blankDelay.stopMacroEngine(); }
        }
        master.addEventListener('click', () => setMaster(!masterOn));
        window.addEventListener('keydown', (e) => { if (e.key === 'F9') setMaster(!masterOn); });

        el('bd-cs-prefire-switch').addEventListener('click', function () { PREFIRE.enabled = !PREFIRE.enabled; this.classList.toggle('on', PREFIRE.enabled); });
        el('bd-cs-prefire-trigger').addEventListener('change', (e) => { PREFIRE.bindIdx = Number(e.target.value); el('bd-cs-prefire-bind').textContent = TRIG[PREFIRE.bindIdx]; renderKeybinds(); });
        el('bd-cs-prefire-keys').addEventListener('input', (e) => { PREFIRE.keys = e.target.value.trim().toUpperCase(); renderKeybinds(); });
        el('bd-cs-drag-switch').addEventListener('click', function () { DRAG.enabled = !DRAG.enabled; this.classList.toggle('on', DRAG.enabled); });
        el('bd-cs-drag-shotgun-switch').addEventListener('click', function () { DRAG.pullShotgunAfter = !DRAG.pullShotgunAfter; this.classList.toggle('on', DRAG.pullShotgunAfter); });
        el('bd-cs-drag-delay').addEventListener('input', (e) => { DRAG.delayMs = Number(e.target.value); el('bd-cs-drag-delay-val').textContent = DRAG.delayMs + 'ms'; });
        el('bd-cs-fn-only').addEventListener('click', function () { SETTINGS.fortniteOnly = !SETTINGS.fortniteOnly; this.classList.toggle('on', SETTINGS.fortniteOnly); });
        el('bd-cs-delay-slider').addEventListener('input', (e) => { SETTINGS.delay = Number(e.target.value); el('bd-cs-delay-val').textContent = SETTINGS.delay + 'ms'; });
        el('bd-cs-jitter-slider').addEventListener('input', (e) => { SETTINGS.jitter = Number(e.target.value); el('bd-cs-jitter-val').textContent = SETTINGS.jitter + 'ms'; });

        function log(msg, type) {
            const box = el('bd-cs-log');
            const line = document.createElement('div');
            line.className = type || '';
            line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
            box.prepend(line);
        }
        function delay() { return SETTINGS.delay + (SETTINGS.jitter ? Math.floor(Math.random() * SETTINGS.jitter) : 0); }
        function canFire() { return masterOn && (!SETTINGS.fortniteOnly || fortniteOk); }
        function fireRow(r) {
            if (!canFire()) return;
            window.blankDelay.fireMacro({ keys: r.keys, speed: delay(), mode: r.mode || 'once', repeat: r.repeat || SETTINGS.loops });
            log(`${r.name} → ${r.keys}`, 'ok');
        }
        async function syncKb() {
            const binds = [];
            ROWS.forEach((r) => { if (r.enabled) binds.push({ accelerator: TRIG[r.bindIdx], keys: r.keys, delayMs: delay(), mode: r.mode, repeat: r.repeat || SETTINGS.loops }); });
            if (PREFIRE.enabled) binds.push({ accelerator: TRIG[PREFIRE.bindIdx], keys: PREFIRE.keys, delayMs: delay(), mode: 'once' });
            const res = await window.blankDelay.startMacroEngine({ type: 'keyboard', speed: SETTINGS.delay, game: 'fortnite', binds, timestamp: Date.now() });
            log((res?.registered || 0) + ' hotkeys armed', 'ok');
        }

        // Fortnite focus poll
        setInterval(async () => {
            try {
                const hud = await window.blankDelay.detectFortniteHud?.();
                fortniteOk = !!(hud && (hud.fortniteFocused || hud.fortnite));
            } catch { fortniteOk = !SETTINGS.fortniteOnly; }
            const chip = el('bd-cs-fn-chip');
            if (chip) {
                chip.classList.toggle('ok', fortniteOk);
                chip.innerHTML = fortniteOk
                    ? '<span class="pulse"></span> Fortnite Focused'
                    : '<span class="pulse"></span> Waiting Fortnite';
            }
        }, 800);

        function runDrag(pressed) {
            if (!canFire() || !DRAG.enabled) return;
            if (pressed) {
                if (!dragHoldStart) dragHoldStart = Date.now();
                const now = Date.now();
                if (now - lastDragFire >= DRAG.delayMs) {
                    window.blankDelay.fireMacro({ keys: 'LMB+SCROLLDOWN', speed: 4, mode: 'once' });
                    lastDragFire = now;
                }
                if (DRAG.pullShotgunAfter && !dragShotgunFired && now - dragHoldStart > 500) {
                    window.blankDelay.fireMacro({ keys: '5', speed: 4, mode: 'once' });
                    dragShotgunFired = true;
                    log('Shotgun pulled', 'ok');
                }
            } else { dragHoldStart = null; dragShotgunFired = false; lastDragFire = 0; }
        }

        if (!isKb) {
            setInterval(() => {
                const list = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter((g) => g?.connected) : [];
                const g = list[0];
                if (!g || !masterOn) return;
                ROWS.forEach((r) => {
                    if (!r.enabled) return;
                    const pressed = !!g.buttons[r.bindIdx]?.pressed;
                    const key = 'r_' + r.id;
                    if (pressed && !lastPressed[key]) fireRow(r);
                    lastPressed[key] = pressed;
                });
                if (PREFIRE.enabled) {
                    const pressed = !!g.buttons[PREFIRE.bindIdx]?.pressed;
                    if (pressed && !lastPressed.pf) fireRow(PREFIRE);
                    lastPressed.pf = pressed;
                }
                if (DRAG.enabled) runDrag(!!g.buttons[7]?.pressed);
            }, 16);
        } else {
            setInterval(async () => {
                if (!masterOn || !DRAG.enabled) return;
                const st = await window.blankDelay.pollInputState();
                runDrag(!!(st?.mouse && st.mouse.LMB));
            }, 50);
        }

        window.blankDelay.onMacroFired?.((d) => log(`Hotkey ${d.accelerator} → ${d.keys}`, 'ok'));
        window.blankDelay.onMacroPanic?.(() => { setMaster(false); log('F12 panic', 'warn'); });
        return { setMaster, log };
    }

    return { init };
})();
