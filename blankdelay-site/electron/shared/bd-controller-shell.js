/* BlankDelay — Controller / Keyboard Macro shell
   Macro outputs are written as Fortnite ACTIONS ({WALL}, {EDIT}, ...) and resolved to the
   player's real in-game binds before sending, so a macro always matches their keybinds. */
const BdControllerShell = (function () {
    const MARK_SVG = '<svg viewBox="0 0 32 32"><circle cx="8" cy="16" r="3.5" fill="currentColor"/><path fill="currentColor" d="M11 16h4l14-6-3 6 3 6-14-6z"/></svg>';

    const PAD_BUTTONS = [
        { i: 0, ps: '✕ Cross', xb: 'A' }, { i: 1, ps: '○ Circle', xb: 'B' },
        { i: 2, ps: '□ Square', xb: 'X' }, { i: 3, ps: '△ Triangle', xb: 'Y' },
        { i: 4, ps: 'L1', xb: 'LB' }, { i: 5, ps: 'R1', xb: 'RB' },
        { i: 6, ps: 'L2', xb: 'LT' }, { i: 7, ps: 'R2', xb: 'RT' },
        { i: 8, ps: 'Share', xb: 'View' }, { i: 9, ps: 'Options', xb: 'Menu' },
        { i: 10, ps: 'L3 Click', xb: 'LS Click' }, { i: 11, ps: 'R3 Click', xb: 'RS Click' },
        { i: 12, ps: 'D-Pad Up', xb: 'D-Pad Up' }, { i: 13, ps: 'D-Pad Down', xb: 'D-Pad Down' },
        { i: 14, ps: 'D-Pad Left', xb: 'D-Pad Left' }, { i: 15, ps: 'D-Pad Right', xb: 'D-Pad Right' }
    ];
    const KB_TRIGGERS = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'];

    /* The player's Fortnite keybinds. Defaults match Fortnite's own defaults. */
    const FN_ACTIONS = [
        { id: 'WALL', name: 'Build Wall', def: 'Q' },
        { id: 'FLOOR', name: 'Build Floor', def: 'C' },
        { id: 'STAIRS', name: 'Build Stairs', def: 'E' },
        { id: 'ROOF', name: 'Build Roof (Cone)', def: 'R' },
        { id: 'EDIT', name: 'Edit Build', def: 'G' },
        { id: 'CONFIRM', name: 'Confirm Edit', def: 'LMB' },
        { id: 'RESET', name: 'Reset / Repair', def: 'F' },
        { id: 'CROUCH', name: 'Crouch', def: 'LCTRL' },
        { id: 'JUMP', name: 'Jump', def: 'SPACE' },
        { id: 'HARVEST', name: 'Harvesting Tool', def: '1' },
        { id: 'INTERACT', name: 'Interact / Pick Up', def: 'E' },
        { id: 'SLOT1', name: 'Weapon Slot 1', def: '2' },
        { id: 'SLOT2', name: 'Weapon Slot 2', def: '3' },
        { id: 'SLOT3', name: 'Weapon Slot 3', def: '4' },
        { id: 'SHOTGUN', name: 'Shotgun Slot', def: '2' },
        { id: 'FIRE', name: 'Fire Weapon', def: 'LMB' },
        { id: 'AIM', name: 'Aim Down Sights', def: 'RMB' }
    ];

    const KEY_CHOICES = [
        'Q', 'W', 'E', 'R', 'T', 'Y', 'A', 'S', 'D', 'F', 'G', 'H', 'Z', 'X', 'C', 'V', 'B', 'N', 'M',
        '1', '2', '3', '4', '5', '6', '7', '8', '9', '0',
        'SPACE', 'LSHIFT', 'LCTRL', 'LALT', 'TAB', 'ENTER',
        'LMB', 'RMB', 'MMB', 'M4', 'M5', 'SCROLLUP', 'SCROLLDOWN',
        'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8'
    ];

    function el(id) { return document.getElementById(id); }
    function esc(s) { return String(s).replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m])); }

    function init(opts) {
        const mount = el(opts.mountId);
        if (!mount) return null;

        const productLabel = opts.productLabel || 'Controller Macro';
        const isKb = opts.mode === 'keyboard';
        let padStyle = 'ps';

        const binds = {};
        FN_ACTIONS.forEach((a) => { binds[a.id] = a.def; });

        /* Keyboard product mirrors Blank Optimizer macro set (keyboard-only triggers).
           Controller hub UI keeps the same Fortnite action rows for in-hub fallback. */
        const ROWS = isKb ? [
            { id: 'pickup', name: 'Pick-up Spam', bindIdx: 0, seq: '{INTERACT}', mode: 'repeat', repeat: 18, enabled: false },
            { id: 'shooting', name: 'Rapid Fire', bindIdx: 1, seq: '{FIRE}', mode: 'repeat', repeat: 16, enabled: false },
            { id: 'double-edit', name: 'Double Edit', bindIdx: 2, seq: '{EDIT}+{CONFIRM}+{EDIT}+{CONFIRM}', mode: 'once', repeat: 1, enabled: false },
            { id: 'drag-edit', name: 'Drag Edit', bindIdx: 3, seq: '{EDIT}+{CONFIRM}', mode: 'hold', repeat: 1, enabled: false },
            { id: 'reset', name: 'Reset / Repair', bindIdx: 4, seq: '{RESET}', mode: 'once', repeat: 1, enabled: false },
            { id: 'pickaxe', name: 'Pickaxe Pullout', bindIdx: 5, seq: '{HARVEST}', mode: 'once', repeat: 1, enabled: false },
            { id: 'build', name: 'Build Piece', bindIdx: 6, seq: '{WALL}', mode: 'once', repeat: 1, enabled: false },
            { id: 'instant-build', name: 'Instant Build', bindIdx: 7, seq: '{WALL}+{STAIRS}+{FLOOR}', mode: 'once', repeat: 1, enabled: false }
        ] : [
            { id: 'instant-build', name: 'Instant Build', bindIdx: 3, seq: '{WALL}+{STAIRS}+{FLOOR}', mode: 'once', repeat: 1, enabled: false },
            { id: 'crouch-spam', name: 'Crouch Spam', bindIdx: 11, seq: '{CROUCH}', mode: 'repeat', repeat: 14, enabled: false },
            { id: 'weapon-switcher', name: 'Weapon Switcher', bindIdx: 2, seq: '{SLOT1}+{SLOT2}', mode: 'once', repeat: 1, enabled: false },
            { id: 'double-edit', name: 'Double Edit', bindIdx: 4, seq: '{EDIT}+{CONFIRM}+{EDIT}+{CONFIRM}', mode: 'once', repeat: 1, enabled: false },
            { id: 'edit-reset', name: 'Edit Reset', bindIdx: 14, seq: '{EDIT}+{RESET}+{CONFIRM}', mode: 'once', repeat: 1, enabled: false },
            { id: 'ramp-wall', name: 'Wall + Ramp', bindIdx: 15, seq: '{WALL}+{STAIRS}', mode: 'once', repeat: 1, enabled: false },
            { id: 'prefire', name: 'Prefire Macro', bindIdx: 5, seq: '{EDIT}+{CONFIRM}+{FIRE}', mode: 'once', repeat: 1, enabled: false }
        ];
        const DRAG = { enabled: isKb, pullShotgunAfter: true, delayMs: 8, scroll: 'down' };
        const SETTINGS = { delay: isKb ? 4 : 6, jitter: 0, fortniteOnly: true };

        let masterOn = false;
        let fortniteFocused = false;
        const lastPressed = {};
        let dragStart = null, dragShotgunFired = false, lastDragFire = 0;

        function triggerLabel(idx) {
            if (isKb) return KB_TRIGGERS[idx] || KB_TRIGGERS[0];
            const b = PAD_BUTTONS[idx] || PAD_BUTTONS[0];
            return padStyle === 'xb' ? b.xb : b.ps;
        }
        function triggerOptions(selected) {
            if (isKb) {
                return KB_TRIGGERS.map((n, i) => `<option value="${i}" ${i === selected ? 'selected' : ''}>${n}</option>`).join('');
            }
            return PAD_BUTTONS.map((b) => `<option value="${b.i}" ${b.i === selected ? 'selected' : ''}>${padStyle === 'xb' ? b.xb : b.ps}</option>`).join('');
        }

        /* {ACTION} -> the key the player actually uses in Fortnite */
        function resolveSeq(seq) {
            return String(seq || '')
                .replace(/\{([A-Z0-9_]+)\}/g, (m, id) => binds[id] || '')
                .split('+')
                .map((s) => s.trim())
                .filter(Boolean)
                .join('+');
        }

        mount.innerHTML = `
        <div class="bd-cs-wrap">
            <header class="bd-cs-brandbar">
                <div class="bd-cs-brand">
                    <span class="bd-cs-mark">${MARK_SVG}</span>
                    <div class="bd-cs-brand-text">
                        <span class="bd-cs-brand-name">BLANKDELAY</span>
                        <span class="bd-cs-brand-product">${esc(productLabel)}</span>
                    </div>
                </div>
                <div class="bd-cs-brand-right">
                    <span class="bd-cs-chip" id="bd-cs-fn-chip"><span class="dot"></span> Waiting for Fortnite</span>
                    <span class="bd-cs-chip" id="bd-cs-status"><span class="dot"></span> Macros Off</span>
                </div>
            </header>

            <div class="bd-cs-body">
                <section class="bd-cs-left">
                    ${isKb
                        ? `<div class="bd-gp-viewer">
                                <div class="bd-gp-head">
                                    <div class="bd-gp-head-left">
                                        <span class="bd-gp-title">Live Keyboard Display</span>
                                        <span class="bd-gp-status ok" id="bd-cs-kb-status"><span class="dot"></span> Hotkeys Ready</span>
                                    </div>
                                </div>
                                <div class="bd-gp-stage"><img class="bd-cs-kb-img" src="../shared/assets/keyboard.svg" alt="Keyboard"></div>
                                <div class="bd-gp-footer"><span class="mono">Scancode SendInput · works inside Fortnite</span></div>
                           </div>`
                        : `<div id="bd-gp-mount"></div>`}
                    <div class="bd-cs-log" id="bd-cs-log"><div>${esc(productLabel)} ready.</div></div>
                </section>

                <section class="bd-cs-right">
                    <div class="bd-cs-panel">
                        <nav class="bd-cs-tabs">
                            <button type="button" class="active" data-tab="macros">Macros</button>
                            <button type="button" data-tab="drag">Drag Macro</button>
                            <button type="button" data-tab="keybinds">Fortnite Keybinds</button>
                            <button type="button" data-tab="settings">Settings</button>
                        </nav>
                        <div class="bd-cs-panel-body">
                            <div class="bd-cs-section active" data-sec="macros">
                                <div class="bd-cs-master">
                                    <div class="bd-cs-master-left">
                                        <div class="bd-cs-switch" id="bd-cs-master"></div>
                                        <div class="bd-cs-master-text">
                                            <span class="t1">Macro Toggle</span>
                                            <span class="t2">Arms every enabled macro · F9 toggle · F12 panic stop</span>
                                        </div>
                                    </div>
                                    <span class="bd-cs-pill">F9</span>
                                </div>
                                <p class="bd-cs-label">Customize Macros</p>
                                <div id="bd-cs-rows"></div>
                            </div>

                            <div class="bd-cs-section" data-sec="drag">
                                <div class="bd-cs-master">
                                    <div class="bd-cs-master-left">
                                        <div class="bd-cs-switch" id="bd-cs-drag"></div>
                                        <div class="bd-cs-master-text">
                                            <span class="t1">Drag Macro</span>
                                            <span class="t2">${isKb ? 'Hold left mouse' : 'Hold R2 / RT'} to edit-drag continuously</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="bd-cs-row-line">
                                    <span class="cl">Pull shotgun after drag</span>
                                    <div class="bd-cs-switch on" id="bd-cs-drag-shotgun"></div>
                                </div>
                                <div class="bd-cs-row-line">
                                    <span class="cl">Scroll direction</span>
                                    <select id="bd-cs-drag-scroll"><option value="down">Scroll Down</option><option value="up">Scroll Up</option></select>
                                </div>
                                <div class="bd-cs-slider">
                                    <span class="cl">Drag Delay</span>
                                    <input type="range" id="bd-cs-drag-delay" min="1" max="40" value="8">
                                    <span class="sv" id="bd-cs-drag-delay-val">8ms</span>
                                </div>
                                <p class="bd-cs-note">Drag sends your Edit bind + Confirm + scroll, so it follows your Fortnite keybinds below.</p>
                            </div>

                            <div class="bd-cs-section" data-sec="keybinds">
                                <p class="bd-cs-note">Set these to match <strong>Fortnite → Settings → Keyboard Controls</strong>. Every macro uses these keys, so your binds and the macro always agree.</p>
                                <div class="bd-cs-binds" id="bd-cs-binds"></div>
                            </div>

                            <div class="bd-cs-section" data-sec="settings">
                                <div class="bd-cs-row-line">
                                    <span class="cl">Only fire while Fortnite is focused</span>
                                    <div class="bd-cs-switch on" id="bd-cs-fn-only"></div>
                                </div>
                                ${isKb ? '' : `<div class="bd-cs-row-line">
                                    <span class="cl">Button labels</span>
                                    <select id="bd-cs-pad-style"><option value="ps">PlayStation (✕ ○ □ △)</option><option value="xb">Xbox (A B X Y)</option></select>
                                </div>`}
                                <div class="bd-cs-slider">
                                    <span class="cl">Macro Delay</span>
                                    <input type="range" id="bd-cs-delay" min="1" max="40" value="6">
                                    <span class="sv" id="bd-cs-delay-val">6ms</span>
                                </div>
                                <div class="bd-cs-slider">
                                    <span class="cl">Random Jitter</span>
                                    <input type="range" id="bd-cs-jitter" min="0" max="20" value="0">
                                    <span class="sv" id="bd-cs-jitter-val">0ms</span>
                                </div>
                                <p class="bd-cs-note">Input is sent as keyboard scancodes (the same method AutoHotkey uses) so Fortnite receives it like a real key press.</p>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>`;

        const rowsEl = el('bd-cs-rows');

        function renderRows() {
            rowsEl.innerHTML = ROWS.map((r) => `
                <div class="bd-cs-macro" data-row="${r.id}">
                    <div class="bd-cs-macro-head">
                        <div class="bd-cs-switch${r.enabled ? ' on' : ''}" data-toggle="${r.id}"></div>
                        <span class="bd-cs-macro-name">${esc(r.name)}</span>
                        <span class="bd-cs-pill">${esc(triggerLabel(r.bindIdx))}</span>
                    </div>
                    <div class="bd-cs-macro-body">
                        <div class="bd-cs-field">
                            <label>Trigger</label>
                            <select data-trigger="${r.id}">${triggerOptions(r.bindIdx)}</select>
                        </div>
                        <div class="bd-cs-field">
                            <label>Mode</label>
                            <select data-mode="${r.id}">
                                <option value="once" ${r.mode === 'once' ? 'selected' : ''}>Tap once</option>
                                <option value="repeat" ${r.mode === 'repeat' ? 'selected' : ''}>Repeat / spam</option>
                                <option value="hold" ${r.mode === 'hold' ? 'selected' : ''}>Hold (drag)</option>
                            </select>
                        </div>
                        <div class="bd-cs-field">
                            <label>Repeats</label>
                            <input type="number" min="1" max="60" value="${r.repeat}" data-repeat="${r.id}" ${r.mode === 'repeat' ? '' : 'disabled'}>
                        </div>
                        <div class="bd-cs-field bd-cs-field-wide">
                            <label>Sends</label>
                            <span class="bd-cs-out mono" data-out="${r.id}">${esc(resolveSeq(r.seq) || '—')}</span>
                        </div>
                    </div>
                </div>`).join('');

            rowsEl.querySelectorAll('[data-toggle]').forEach((sw) => {
                sw.addEventListener('click', () => {
                    const r = ROWS.find((x) => x.id === sw.dataset.toggle);
                    r.enabled = !r.enabled;
                    sw.classList.toggle('on', r.enabled);
                    log(`${r.name} ${r.enabled ? 'enabled' : 'disabled'}`, 'ok');
                    if (isKb && masterOn) syncHotkeys();
                });
            });
            rowsEl.querySelectorAll('[data-trigger]').forEach((sel) => {
                sel.addEventListener('change', () => {
                    ROWS.find((x) => x.id === sel.dataset.trigger).bindIdx = Number(sel.value);
                    renderRows();
                    if (isKb && masterOn) syncHotkeys();
                });
            });
            rowsEl.querySelectorAll('[data-mode]').forEach((sel) => {
                sel.addEventListener('change', () => {
                    ROWS.find((x) => x.id === sel.dataset.mode).mode = sel.value;
                    renderRows();
                    if (isKb && masterOn) syncHotkeys();
                });
            });
            rowsEl.querySelectorAll('[data-repeat]').forEach((inp) => {
                inp.addEventListener('change', () => {
                    ROWS.find((x) => x.id === inp.dataset.repeat).repeat = Math.max(1, parseInt(inp.value, 10) || 1);
                    if (isKb && masterOn) syncHotkeys();
                });
            });
        }

        function refreshOutputs() {
            ROWS.forEach((r) => {
                const out = rowsEl.querySelector(`[data-out="${r.id}"]`);
                if (out) out.textContent = resolveSeq(r.seq) || '—';
            });
        }

        function renderBinds() {
            el('bd-cs-binds').innerHTML = FN_ACTIONS.map((a) => `
                <div class="bd-cs-bind">
                    <span class="bd-cs-bind-name">${esc(a.name)}</span>
                    <select data-bind="${a.id}">
                        ${KEY_CHOICES.map((k) => `<option value="${k}" ${k === binds[a.id] ? 'selected' : ''}>${k}</option>`).join('')}
                    </select>
                </div>`).join('');

            el('bd-cs-binds').querySelectorAll('[data-bind]').forEach((sel) => {
                sel.addEventListener('change', () => {
                    binds[sel.dataset.bind] = sel.value;
                    refreshOutputs();
                    log(`Bind updated: ${sel.dataset.bind} → ${sel.value}`, 'ok');
                    if (isKb && masterOn) syncHotkeys();
                });
            });
        }

        renderRows();
        renderBinds();

        mount.querySelectorAll('.bd-cs-tabs button').forEach((btn) => {
            btn.addEventListener('click', () => {
                mount.querySelectorAll('.bd-cs-tabs button').forEach((b) => b.classList.toggle('active', b === btn));
                mount.querySelectorAll('.bd-cs-section').forEach((s) => s.classList.toggle('active', s.dataset.sec === btn.dataset.tab));
            });
        });

        let padViewer = null;
        if (!isKb && window.BdGamepadLive) {
            padViewer = BdGamepadLive.init(el('bd-gp-mount'), {
                color: 'black',
                onConnect: (g) => {
                    log('Controller connected: ' + g.id, 'ok');
                    const detected = BdGamepadLive.detectSkin(g.id);
                    padStyle = detected === 'xbox' ? 'xb' : 'ps';
                    const styleSel = el('bd-cs-pad-style');
                    if (styleSel) styleSel.value = padStyle;
                    renderRows();
                },
                onDisconnect: () => log('Controller disconnected', 'warn')
            });
        }

        const master = el('bd-cs-master');
        function setStatus(text, ok) {
            const s = el('bd-cs-status');
            s.innerHTML = `<span class="dot"></span> ${text}`;
            s.classList.toggle('ok', !!ok);
        }
        async function setMaster(on) {
            masterOn = on;
            master.classList.toggle('on', on);
            setStatus(on ? 'Macros Live' : 'Macros Off', on);
            log(on ? 'Macro Toggle ON' : 'Macro Toggle OFF', 'ok');
            if (isKb) {
                if (on) await syncHotkeys();
                else await window.blankDelay?.stopMacroEngine?.();
            }
        }
        master.addEventListener('click', () => setMaster(!masterOn));
        window.addEventListener('keydown', (e) => { if (e.key === 'F9') { e.preventDefault(); setMaster(!masterOn); } });

        el('bd-cs-drag').addEventListener('click', function () {
            DRAG.enabled = !DRAG.enabled;
            this.classList.toggle('on', DRAG.enabled);
            log(`Drag Macro ${DRAG.enabled ? 'enabled' : 'disabled'}`, 'ok');
        });
        el('bd-cs-drag-shotgun').addEventListener('click', function () {
            DRAG.pullShotgunAfter = !DRAG.pullShotgunAfter;
            this.classList.toggle('on', DRAG.pullShotgunAfter);
        });
        el('bd-cs-drag-scroll').addEventListener('change', (e) => { DRAG.scroll = e.target.value; });
        el('bd-cs-drag-delay').addEventListener('input', (e) => {
            DRAG.delayMs = Number(e.target.value);
            el('bd-cs-drag-delay-val').textContent = DRAG.delayMs + 'ms';
        });
        el('bd-cs-fn-only').addEventListener('click', function () {
            SETTINGS.fortniteOnly = !SETTINGS.fortniteOnly;
            this.classList.toggle('on', SETTINGS.fortniteOnly);
        });
        el('bd-cs-delay').addEventListener('input', (e) => {
            SETTINGS.delay = Number(e.target.value);
            el('bd-cs-delay-val').textContent = SETTINGS.delay + 'ms';
        });
        el('bd-cs-jitter').addEventListener('input', (e) => {
            SETTINGS.jitter = Number(e.target.value);
            el('bd-cs-jitter-val').textContent = SETTINGS.jitter + 'ms';
        });
        el('bd-cs-pad-style')?.addEventListener('change', (e) => {
            padStyle = e.target.value;
            padViewer?.setSkin(padStyle === 'xb' ? 'xbox' : 'dualsense');
            renderRows();
        });

        function log(msg, type) {
            const box = el('bd-cs-log');
            if (!box) return;
            const line = document.createElement('div');
            if (type) line.className = type;
            line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
            box.prepend(line);
            while (box.children.length > 40) box.removeChild(box.lastChild);
        }

        function delayMs() {
            return SETTINGS.delay + (SETTINGS.jitter ? Math.floor(Math.random() * SETTINGS.jitter) : 0);
        }
        function canFire() {
            return masterOn && (!SETTINGS.fortniteOnly || fortniteFocused);
        }
        function fireRow(r) {
            if (!canFire()) return;
            const keys = resolveSeq(r.seq);
            if (!keys) return;
            window.blankDelay?.fireMacro?.({ keys, speed: delayMs(), mode: r.mode, repeat: r.repeat });
            log(`${r.name} → ${keys}`, 'ok');
        }

        async function syncHotkeys() {
            const bindsOut = ROWS.filter((r) => r.enabled).map((r) => ({
                accelerator: KB_TRIGGERS[r.bindIdx] || KB_TRIGGERS[0],
                keys: resolveSeq(r.seq),
                delayMs: delayMs(),
                mode: r.mode,
                repeat: r.repeat
            })).filter((b) => b.keys);
            const res = await window.blankDelay?.startMacroEngine?.({
                type: 'keyboard', speed: SETTINGS.delay, game: 'fortnite', binds: bindsOut, timestamp: Date.now()
            });
            log(`${res?.registered || 0} hotkey(s) armed`, 'ok');
        }

        /* Fortnite focus watcher — drives the chip and the "only when focused" guard.
           Runs once up front so the state is correct before the first poll interval. */
        async function pollFortnite() {
            let hud = null;
            try { hud = await window.blankDelay?.detectFortniteHud?.(); } catch (_) { hud = null; }
            fortniteFocused = !!(hud && (hud.fortniteFocused || hud.fortnite));
            const chip = el('bd-cs-fn-chip');
            if (chip) {
                chip.classList.toggle('ok', fortniteFocused);
                chip.innerHTML = `<span class="dot"></span> ${fortniteFocused ? 'Fortnite Focused' : 'Waiting for Fortnite'}`;
            }
        }
        pollFortnite();
        setInterval(pollFortnite, 900);

        function runDrag(pressed) {
            if (!canFire() || !DRAG.enabled) { dragStart = null; dragShotgunFired = false; return; }
            if (pressed) {
                const now = Date.now();
                if (!dragStart) dragStart = now;
                if (now - lastDragFire >= DRAG.delayMs) {
                    const scroll = DRAG.scroll === 'up' ? 'SCROLLUP' : 'SCROLLDOWN';
                    window.blankDelay?.fireMacro?.({
                        keys: `${binds.EDIT}+${binds.CONFIRM}+${scroll}`,
                        speed: 4,
                        mode: 'once'
                    });
                    lastDragFire = now;
                }
                if (DRAG.pullShotgunAfter && !dragShotgunFired && now - dragStart > 500) {
                    window.blankDelay?.fireMacro?.({ keys: binds.SHOTGUN, speed: 4, mode: 'once' });
                    dragShotgunFired = true;
                    log('Shotgun pulled after drag', 'ok');
                }
            } else {
                dragStart = null;
                dragShotgunFired = false;
                lastDragFire = 0;
            }
        }

        if (!isKb) {
            setInterval(() => {
                const list = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter((g) => g && g.connected) : [];
                const g = list[0];
                if (!g) return;
                if (masterOn) {
                    ROWS.forEach((r) => {
                        if (!r.enabled) return;
                        const b = g.buttons[r.bindIdx];
                        const pressed = !!(b && (b.pressed || b.value > 0.4));
                        const key = 'row_' + r.id;
                        if (pressed && !lastPressed[key]) fireRow(r);
                        lastPressed[key] = pressed;
                    });
                }
                const rt = g.buttons[7];
                runDrag(!!(rt && (rt.pressed || rt.value > 0.4)));
            }, 16);
        } else {
            setInterval(async () => {
                if (!masterOn || !DRAG.enabled) return;
                const st = await window.blankDelay?.pollInputState?.();
                runDrag(!!(st && st.mouse && st.mouse.LMB));
            }, 50);
        }

        window.blankDelay?.onMacroFired?.((d) => log(`Hotkey ${d.accelerator} → ${d.keys}`, 'ok'));
        window.blankDelay?.onMacroPanic?.(() => { setMaster(false); log('F12 panic stop', 'warn'); });

        return { setMaster, log, getBinds: () => ({ ...binds }), resolveSeq };
    }

    return { init, FN_ACTIONS, PAD_BUTTONS };
})();

window.BdControllerShell = BdControllerShell;
