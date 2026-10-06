/* BlankDelay Aim Assist Pro */
const BlankAimAssist = (function () {
    const GP = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start', 'LS', 'RS', 'D-Up', 'D-Down', 'D-Left', 'D-Right'];
    const CLASSES = ['ar', 'smg', 'shotgun', 'sniper', 'pistol', 'melee'];
    const SHOTGUNS = ['pump', 'tactical', 'combat', 'charge', 'drum', 'auto', 'heavy'];
    const CLASS_LABEL = { ar: 'Assault Rifle', smg: 'SMG', shotgun: 'Shotgun', sniper: 'Sniper', pistol: 'Pistol', melee: 'Melee / Pickaxe' };
    const DEFAULTS = {
        ar: { strength: 42, radius: 'medium' }, smg: { strength: 48, radius: 'medium' },
        shotgun: { strength: 72, radius: 'large' }, sniper: { strength: 22, radius: 'small' },
        pistol: { strength: 50, radius: 'medium' }, melee: { strength: 80, radius: 'small' }
    };
    const RADIUS_LABEL = { small: 'Small (tight)', medium: 'Medium', large: 'Large (wide)' };

    let product = 'aim', armed = false, running = false, globalStrength = 50, radius = 'medium';
    let toggleKey = 'F9', togglePadBtn = 4, togglePadName = 'LB';
    let classes = {}, shotguns = SHOTGUNS.slice(), forceMode = false;
    let captureKey = false, capturePad = false, lastPadToggle = false, pollId = null, hudPollId = null;

    const el = id => document.getElementById(id);

    function log(m, t) {
        const b = el('aim-pro-log');
        if (!b) return;
        const n = document.createElement('div');
        n.className = t || '';
        n.textContent = new Date().toLocaleTimeString() + ' — ' + m;
        b.prepend(n);
    }

    function stat(id, v) {
        const n = el(id);
        if (!n) return;
        n.textContent = v;
        if (id === 'stat-fortnite') {
            n.classList.toggle('fortnite-open', v === 'OPEN' || v === 'FOCUSED');
        }
    }

    function cfg() {
        return { product, enabled: armed, globalStrength, radius, toggleKey, togglePadBtn, togglePadName, forceMode, classes, shotguns };
    }

    function showSec(s) {
        document.querySelectorAll('.aim-pro-nav button').forEach(b => b.classList.toggle('active', b.dataset.sec === s));
        document.querySelectorAll('.aim-pro-section').forEach(x => x.classList.toggle('active', x.dataset.sec === s));
    }

    function initClasses() {
        classes = {};
        CLASSES.forEach(c => { classes[c] = { ...DEFAULTS[c] }; });
    }

    function updateRadarSize(r) {
        const ring = el('aim-ring');
        const lbl = el('aim-radius-label');
        const rad = r || radius;
        if (ring) {
            ring.classList.remove('radius-small', 'radius-medium', 'radius-large');
            ring.classList.add('radius-' + rad);
        }
        if (lbl) lbl.textContent = 'Target zone: ' + (RADIUS_LABEL[rad] || rad);
    }

    function setRadar(st) {
        const ring = el('aim-ring');
        const big = el('aim-state');
        const sub = el('aim-state-sub');
        if (st.radius) updateRadarSize(st.radius);
        if (big) big.textContent = st.status || 'Inactive';
        if (sub) {
            if (st.fortniteFocused) {
                sub.textContent = 'Fortnite focused' + (st.weaponClass && st.weaponClass !== 'none' ? ' · ' + st.weaponClass.toUpperCase() : '');
            } else if (st.fortniteRunning) {
                sub.textContent = 'Fortnite OPEN — alt-tab to focus';
            } else {
                sub.textContent = 'Waiting for Fortnite';
            }
        }
        if (ring) {
            ring.classList.remove('locked', 'searching', 'fortnite-open');
            if (st.fortniteRunning) ring.classList.add('fortnite-open');
            if ((st.status || '').includes('Locked')) ring.classList.add('locked');
            else if (st.status === 'Searching' || st.status === 'Waiting Focus') ring.classList.add('searching');
            else if (st.status === 'Active' || (st.status || '').startsWith('Active')) ring.classList.add('locked');
        }
        if (st.fortniteRunning !== undefined) {
            stat('stat-fortnite', st.fortniteFocused ? 'FOCUSED' : (st.fortniteRunning ? 'OPEN' : 'NO'));
        } else if (st.fortnite !== undefined) {
            stat('stat-fortnite', st.fortnite ? 'FOCUSED' : 'NO');
        }
    }

    function renderClasses() {
        const box = el('aim-class-grid');
        if (!box) return;
        box.innerHTML = '';
        CLASSES.forEach(c => {
            const s = classes[c] || DEFAULTS[c];
            const card = document.createElement('div');
            card.className = 'aim-pro-class-card';
            card.innerHTML = '<h4>' + CLASS_LABEL[c] + '</h4>' +
                '<div class="aim-pro-row"><label>Lock-On Strength</label><input type="range" min="0" max="100" value="' + s.strength + '" data-cl="' + c + '" data-f="strength"><span class="aim-val">' + s.strength + '</span></div>' +
                '<div class="aim-pro-row"><label>Target Radius</label><select data-cl="' + c + '" data-f="radius">' +
                '<option value="small"' + (s.radius === 'small' ? ' selected' : '') + '>Small</option>' +
                '<option value="medium"' + (s.radius === 'medium' ? ' selected' : '') + '>Medium</option>' +
                '<option value="large"' + (s.radius === 'large' ? ' selected' : '') + '>Large</option></select></div>';
            box.appendChild(card);
        });
        box.querySelectorAll('input[data-f=strength]').forEach(inp => inp.addEventListener('input', () => {
            classes[inp.dataset.cl].strength = +inp.value;
            inp.nextElementSibling.textContent = inp.value;
        }));
        box.querySelectorAll('select[data-f=radius]').forEach(sel => sel.addEventListener('change', () => {
            classes[sel.dataset.cl].radius = sel.value;
        }));
    }

    function renderShotguns() {
        const box = el('aim-shotgun-list');
        if (!box) return;
        box.innerHTML = '';
        SHOTGUNS.forEach(s => {
            const lb = document.createElement('label');
            lb.innerHTML = '<input type="checkbox" data-sg="' + s + '" ' + (shotguns.includes(s) ? 'checked' : '') + '> ' + s.charAt(0).toUpperCase() + s.slice(1);
            lb.querySelector('input').addEventListener('change', e => {
                if (e.target.checked) { if (!shotguns.includes(s)) shotguns.push(s); }
                else shotguns = shotguns.filter(x => x !== s);
            });
            box.appendChild(lb);
        });
    }

    function renderPadButtons() {
        const box = el('aim-pad-grid');
        if (!box) return;
        box.innerHTML = '';
        GP.forEach((name, idx) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'aim-pad-btn' + (togglePadBtn === idx ? ' active' : '');
            btn.textContent = name;
            btn.dataset.idx = idx;
            btn.addEventListener('click', () => {
                togglePadBtn = idx;
                togglePadName = name;
                box.querySelectorAll('.aim-pad-btn').forEach(b => b.classList.toggle('active', +b.dataset.idx === idx));
                const cap = el('toggle-pad');
                if (cap) cap.textContent = name;
                log('Controller toggle: ' + name, 'ok');
            });
            box.appendChild(btn);
        });
    }

    function getPads() {
        if (!navigator.getGamepads) return [];
        const raw = navigator.getGamepads();
        const pads = [];
        for (let i = 0; i < raw.length; i++) if (raw[i] && raw[i].connected) pads.push(raw[i]);
        return pads;
    }

    function pollGamepad() {
        const pad = getPads()[0];
        if (!pad) return;
        if (togglePadBtn >= 0) {
            const pressed = !!pad.buttons[togglePadBtn]?.pressed;
            if (pressed && !lastPadToggle && running) {
                window.blankDelay.toggleAimArmed().then(r => {
                    if (r && r.success) {
                        armed = r.armed;
                        el('aim-global-toggle')?.classList.toggle('active', armed);
                        stat('stat-armed', armed ? 'ON' : 'OFF');
                    }
                });
            }
            lastPadToggle = pressed;
        }
        const firing = !!(pad.buttons[7]?.pressed || pad.buttons[5]?.pressed || pad.buttons[0]?.pressed);
        if (running) window.blankDelay.reportAimInput({ firing });
    }

    function startPolls() {
        if (pollId) clearInterval(pollId);
        pollId = setInterval(pollGamepad, 16);
        if (hudPollId) clearInterval(hudPollId);
        hudPollId = setInterval(async () => {
            const hud = await window.blankDelay.detectFortniteHud();
            if (hud) {
                setRadar({ ...hud, status: el('aim-state')?.textContent || 'Inactive', radius });
                if (hud.weaponClass && hud.weaponClass !== 'none') stat('stat-weapon', hud.weaponClass.toUpperCase());
            }
        }, 500);
    }

    function stopPolls() {
        if (pollId) clearInterval(pollId);
        if (hudPollId) clearInterval(hudPollId);
        pollId = null;
        hudPollId = null;
    }

    async function activate() {
        running = true;
        armed = true;
        el('aim-global-toggle')?.classList.add('active');
        await window.blankDelay.startAimAssist(cfg());
        startPolls();
        stat('stat-armed', 'ON');
        el('status-pill') && (el('status-pill').textContent = 'Assist Live');
        log('Armed — KB: ' + toggleKey + ' · Pad: ' + togglePadName, 'ok');
    }

    async function deactivate() {
        armed = false;
        running = false;
        el('aim-global-toggle')?.classList.remove('active');
        await window.blankDelay.stopAimAssist();
        stopPolls();
        stat('stat-armed', 'OFF');
        el('status-pill') && (el('status-pill').textContent = 'Ready');
        log('Disarmed.', 'ok');
    }

    async function refreshProf() {
        const s = el('profile-select');
        if (!s) return;
        const list = await window.blankDelay.listMacroProfiles(product);
        s.innerHTML = '<option value="">— profile —</option>';
        (list || []).forEach(n => {
            const o = document.createElement('option');
            o.value = n;
            o.textContent = n;
            s.appendChild(o);
        });
    }

    async function saveProf() {
        const n = el('profile-name')?.value?.trim() || 'Default';
        await window.blankDelay.saveMacroProfile(product, n, cfg());
        await refreshProf();
        log('Saved profile ' + n, 'ok');
    }

    async function loadProf() {
        const n = el('profile-select')?.value;
        if (!n) return;
        const r = await window.blankDelay.loadMacroProfile(product, n);
        if (!r.success) return log('Profile not found', 'warn');
        const p = r.profile;
        globalStrength = p.globalStrength ?? globalStrength;
        radius = p.radius ?? radius;
        toggleKey = p.toggleKey ?? toggleKey;
        togglePadBtn = p.togglePadBtn ?? togglePadBtn;
        togglePadName = p.togglePadName ?? (GP[togglePadBtn] || 'LB');
        classes = p.classes || classes;
        shotguns = p.shotguns || shotguns;
        el('global-strength').value = globalStrength;
        el('global-strength-val').textContent = globalStrength;
        el('global-radius').value = radius;
        el('toggle-key').textContent = toggleKey;
        el('toggle-pad').textContent = togglePadName;
        updateRadarSize(radius);
        renderClasses();
        renderShotguns();
        renderPadButtons();
        log('Loaded ' + n, 'ok');
    }

    function exportCfg() {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([JSON.stringify(cfg(), null, 2)], { type: 'application/json' }));
        a.download = 'blankdelay-' + product + '.json';
        a.click();
    }

    function bindKeyCapture() {
        const cap = el('toggle-key');
        if (!cap) return;
        cap.addEventListener('click', () => {
            captureKey = true;
            capturePad = false;
            cap.classList.add('capturing');
            cap.textContent = 'Press key...';
        });
        const pcap = el('toggle-pad');
        if (pcap) {
            pcap.addEventListener('click', () => {
                capturePad = true;
                captureKey = false;
                pcap.classList.add('capturing');
                pcap.textContent = 'Press pad button...';
            });
        }
        window.addEventListener('keydown', e => {
            if (!captureKey) return;
            e.preventDefault();
            toggleKey = e.key.length === 1 ? e.key.toUpperCase() : e.key;
            captureKey = false;
            cap.classList.remove('capturing');
            cap.textContent = toggleKey;
            log('Keyboard toggle: ' + toggleKey, 'ok');
        }, { capture: true });
    }

    function bindPadCapture() {
        if (pollId) return;
        setInterval(() => {
            if (!capturePad) return;
            const pad = getPads()[0];
            if (!pad) return;
            pad.buttons.forEach((b, i) => {
                if (b.pressed) {
                    togglePadBtn = i;
                    togglePadName = GP[i] || ('Btn' + i);
                    capturePad = false;
                    const pcap = el('toggle-pad');
                    if (pcap) { pcap.classList.remove('capturing'); pcap.textContent = togglePadName; }
                    renderPadButtons();
                    log('Controller toggle bound: ' + togglePadName, 'ok');
                }
            });
        }, 16);
    }

    function bind() {
        document.querySelectorAll('.aim-pro-nav button').forEach(b => b.addEventListener('click', () => showSec(b.dataset.sec)));
        el('aim-global-toggle')?.addEventListener('click', () => armed ? deactivate() : activate());
        el('btn-start')?.addEventListener('click', activate);
        el('btn-stop')?.addEventListener('click', deactivate);
        el('btn-force')?.addEventListener('click', async () => {
            forceMode = !forceMode;
            if (product === 'shotgun') await window.blankDelay.setAimForce({ shotgun: forceMode });
            else await window.blankDelay.setAimForce({ weaponClass: forceMode ? 'shotgun' : null });
            log('Force mode ' + (forceMode ? 'ON' : 'OFF'), 'ok');
        });
        el('global-strength')?.addEventListener('input', e => {
            globalStrength = +e.target.value;
            el('global-strength-val').textContent = globalStrength;
        });
        el('global-radius')?.addEventListener('change', e => {
            radius = e.target.value;
            updateRadarSize(radius);
            log('Radar preview: ' + RADIUS_LABEL[radius], 'ok');
        });
        el('btn-save-profile')?.addEventListener('click', saveProf);
        el('btn-load-profile')?.addEventListener('click', loadProf);
        el('btn-export')?.addEventListener('click', exportCfg);
        el('import-file')?.addEventListener('change', e => {
            const f = e.target.files[0];
            if (!f) return;
            const r = new FileReader();
            r.onload = () => {
                try {
                    const p = JSON.parse(r.result);
                    Object.assign(classes, p.classes || {});
                    shotguns = p.shotguns || shotguns;
                    globalStrength = p.globalStrength ?? globalStrength;
                    toggleKey = p.toggleKey ?? toggleKey;
                    togglePadBtn = p.togglePadBtn ?? togglePadBtn;
                    togglePadName = p.togglePadName ?? togglePadName;
                    radius = p.radius ?? radius;
                    updateRadarSize(radius);
                    renderClasses();
                    renderShotguns();
                    renderPadButtons();
                    log('Imported profile', 'ok');
                } catch { log('Bad import file', 'warn'); }
            };
            r.readAsText(f);
        });
        bindKeyCapture();
        bindPadCapture();
        window.blankDelay.onAimStatus?.(d => {
            setRadar(d);
            if (d.weaponClass && d.weaponClass !== 'none') stat('stat-weapon', d.weaponClass.toUpperCase());
            if (d.armed !== undefined) {
                armed = d.armed;
                stat('stat-armed', armed ? 'ON' : 'OFF');
                el('aim-global-toggle')?.classList.toggle('active', armed);
            }
            if (d.event === 'assist') log('Assist ' + d.weapon + ' nudge', 'ok');
            if (d.event === 'toggle') log('Toggled: ' + (d.armed ? 'ON' : 'OFF'), 'ok');
        });
        window.blankDelay.onMacroPanic?.(() => {
            armed = false;
            running = false;
            stopPolls();
            stat('stat-armed', 'OFF');
            log('F12 panic — assist off', 'warn');
        });
    }

    function init(o) {
        product = o.product || 'aim';
        if (product === 'shotgun') radius = 'large';
        initClasses();
        bind();
        showSec('control');
        renderClasses();
        renderPadButtons();
        if (product === 'shotgun') renderShotguns();
        updateRadarSize(radius);
        refreshProf();
        startPolls();
        stat('stat-fortnite', 'NO');
        stat('stat-weapon', '—');
        stat('stat-armed', 'OFF');
        return {
            unlock: () => {
                log((product === 'shotgun' ? 'Shotgun Pack' : 'Aim Bundle') + ' ready — Fortnite + controller toggle.', 'ok');
            }
        };
    }

    return { init };
})();
