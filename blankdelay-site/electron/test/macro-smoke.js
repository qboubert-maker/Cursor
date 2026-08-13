/* Headless check for the BlankDelay macro apps: splash flow, live pad display,
   controller/color switching, and Fortnite-bind macro resolution. */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.join(__dirname, '..');
let failures = 0;

function ok(name) { console.log('  PASS  ' + name); }
function bad(name, detail) { failures++; console.log('  FAIL  ' + name + (detail ? ' — ' + detail : '')); }
function check(name, cond, detail) { cond ? ok(name) : bad(name, detail); }

function fakePad(overrides) {
    const buttons = Array.from({ length: 18 }, () => ({ pressed: false, value: 0 }));
    return Object.assign({
        id: 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)',
        connected: true,
        buttons,
        axes: [0, 0, 0, 0]
    }, overrides || {});
}

function makeCtxStub() {
    const grad = { addColorStop() {} };
    return new Proxy({}, {
        get(_t, prop) {
            if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => grad;
            if (prop === 'canvas') return { width: 1280, height: 800 };
            if (prop === 'measureText') return () => ({ width: 10 });
            if (prop === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
            return () => {};
        },
        set() { return true; }
    });
}

async function loadProduct(file, padState) {
    const raw = fs.readFileSync(path.join(ROOT, 'products', file), 'utf8');
    const errors = [];

    // Collect the scripts in document order, then strip them from the markup.
    // jsdom cannot fetch file:// script deps, so the harness evaluates them itself
    // after the fake `window.blankDelay` bridge is installed.
    const scripts = [];
    const html = raw.replace(/<script([^>]*)>([\s\S]*?)<\/script>/gi, (_m, attrs, body) => {
        const srcMatch = /src\s*=\s*["']([^"']+)["']/i.exec(attrs);
        scripts.push(srcMatch ? { src: srcMatch[1] } : { code: body });
        return '';
    });

    const vc = new VirtualConsole();
    vc.on('jsdomError', (e) => errors.push(e.message));

    const dom = new JSDOM(html, {
        runScripts: 'dangerously',
        pretendToBeVisual: true,
        url: 'file://' + path.join(ROOT, 'products', file),
        virtualConsole: vc
    });
    const { window } = dom;

    window.HTMLCanvasElement.prototype.getContext = () => makeCtxStub();
    window.navigator.getGamepads = () => (padState.pad ? [padState.pad] : []);
    // Mirrors electron/preload.js so every product app sees the same bridge it would in the app.
    window.blankDelay = {
        fired: [],
        getProductInfo: async () => ({ productKey: 'controller', name: 'Controller Macro' }),
        validateKey: async (k) => ({ valid: /^BD-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(k.trim()), msg: 'ok' }),
        runTweaks: async (list) => (list || []).map((t) => ({ id: t.id, name: t.name, success: true })),
        runSingleTweak: async () => ({ success: true, output: '' }),
        checkAdmin: async () => ({ isAdmin: true }),
        restartAsAdmin: async () => ({ success: true }),
        getSystemMetrics: async () => ({ latency: 1, fps: 240, ping: 12 }),
        detectDevices: async () => ({ controllers: [], mice: [], keyboards: [] }),
        startMacroEngine: async (cfg) => ({ registered: (cfg.binds || []).length }),
        stopMacroEngine: async () => ({ success: true }),
        fireMacro: async (p) => { window.blankDelay.fired.push(p); return { success: true }; },
        pollInputState: async () => ({ keys: {}, mouse: {} }),
        listMacroProfiles: async () => [],
        saveMacroProfile: async () => ({ success: true }),
        loadMacroProfile: async () => ({}),
        deleteMacroProfile: async () => ({ success: true }),
        exportFortniteSettings: async () => ({ success: true, file: 'x.txt' }),
        launchProduct: async () => ({ success: true }),
        onMacroFired: () => {},
        onMacroPanic: () => {},
        detectFortniteHud: async () => ({ fortnite: true, fortniteFocused: true, fortniteRunning: true, weaponClass: 'shotgun' }),
        startAimAssist: async () => ({ success: true, armed: true }),
        stopAimAssist: async () => ({ success: true }),
        setAimForce: async () => ({ success: true }),
        onAimStatus: () => {},
        toggleAimArmed: async () => ({ success: true, armed: true }),
        reportAimInput: async () => ({ success: true })
    };

    // Inject as real <script> elements so top-level `const` declarations land in the
    // shared global scope, exactly like separate script tags do in Electron.
    const run = (code, label) => {
        const tag = window.document.createElement('script');
        tag.textContent = code;
        try { window.document.body.appendChild(tag); }
        catch (e) { errors.push(label + ': ' + e.message); }
    };

    for (const s of scripts) {
        if (s.src) {
            const abs = path.resolve(path.join(ROOT, 'products'), s.src);
            if (!fs.existsSync(abs)) { bad(file + ' missing script ' + s.src); continue; }
            run(fs.readFileSync(abs, 'utf8'), s.src);
        } else {
            run(s.code, 'inline');
        }
    }

    await new Promise((r) => setTimeout(r, 80));
    return { dom, window, errors };
}

async function unlock(window) {
    window.document.getElementById('bd-splash-tap').click();
    await new Promise((r) => setTimeout(r, 550));
    const input = window.document.getElementById('bd-splash-key-input');
    input.value = 'BD-TEST-1234-ABCD';
    window.document.getElementById('bd-splash-activate-btn').click();
    await new Promise((r) => setTimeout(r, 1400));
}

async function testController() {
    console.log('\nController Macro');
    const padState = { pad: null };
    const { window, errors } = await loadProduct('controller.html', padState);

    check('splash renders BLANKDELAY + product name',
        /BLANK/.test(window.document.body.textContent) && /CONTROLLER MACRO/i.test(window.document.body.textContent));
    check('tap-to-continue button present', !!window.document.getElementById('bd-splash-tap'));

    await unlock(window);
    check('app unlocked after key', !window.document.getElementById('bd-app-main').hidden);

    const viewer = window.document.querySelector('.bd-gp-viewer');
    check('live gamepad viewer mounted', !!viewer);
    const svg = window.document.querySelector('.bd-gp-svg');
    check('controller is drawn even with NO pad connected', !!svg);
    check('overlay tells user to connect', !window.document.getElementById('bd-gp-overlay').hidden);

    const skinSel = window.document.getElementById('bd-gp-skin');
    const colorSel = window.document.getElementById('bd-gp-color');
    check('controller type selector present', !!skinSel);
    check('color selector present', !!colorSel);

    skinSel.value = 'xbox';
    skinSel.dispatchEvent(new window.Event('change'));
    check('switching to Xbox redraws pad while disconnected',
        /XBOX/i.test(window.document.querySelector('.bd-gp-svg').textContent));

    colorSel.value = 'blue';
    colorSel.dispatchEvent(new window.Event('change'));
    check('color switch applies', window.document.querySelector('.bd-gp-viewer').dataset.color === 'blue');

    skinSel.value = 'dualsense';
    skinSel.dispatchEvent(new window.Event('change'));
    check('switching back to DualSense works',
        /DUALSENSE/i.test(window.document.querySelector('.bd-gp-svg').textContent));

    // connect a pad and press buttons
    padState.pad = fakePad();
    await new Promise((r) => setTimeout(r, 120));
    check('status flips to live when pad connects',
        window.document.getElementById('bd-gp-status').classList.contains('ok'),
        window.document.getElementById('bd-gp-status').textContent);
    check('overlay hides once connected', window.document.getElementById('bd-gp-overlay').hidden);

    padState.pad.buttons[0] = { pressed: true, value: 1 };
    await new Promise((r) => setTimeout(r, 120));
    check('pressing a button lights it on the display',
        !!window.document.querySelector('.bd-gp-svg [data-btn="0"].lit'));

    padState.pad.buttons[7] = { pressed: true, value: 1 };
    await new Promise((r) => setTimeout(r, 120));
    const trig = window.document.querySelector('[data-trigger="7"]');
    check('trigger meter fills with analog value', trig && Number(trig.getAttribute('width')) > 0);

    // macros
    const macroRows = window.document.querySelectorAll('.bd-cs-macro');
    check('macro list rendered with options', macroRows.length >= 6, 'rows=' + macroRows.length);
    check('Fortnite keybinds tab rendered', window.document.querySelectorAll('[data-bind]').length >= 10);

    const outEl = window.document.querySelector('[data-out="instant-build"]');
    check('instant build shows resolved Fortnite keys', outEl && /Q/.test(outEl.textContent), outEl && outEl.textContent);

    // change a bind and confirm macro output follows it
    const wallSel = window.document.querySelector('[data-bind="WALL"]');
    wallSel.value = 'Z';
    wallSel.dispatchEvent(new window.Event('change'));
    check('changing the Fortnite bind updates macro output',
        /Z/.test(window.document.querySelector('[data-out="instant-build"]').textContent),
        window.document.querySelector('[data-out="instant-build"]').textContent);

    // arm + fire via pad
    window.document.getElementById('bd-cs-master').click();
    window.document.querySelector('[data-toggle="instant-build"]').click();
    await new Promise((r) => setTimeout(r, 250));
    check('Fortnite focus detected', window.document.getElementById('bd-cs-fn-chip').classList.contains('ok'));
    padState.pad.buttons[3] = { pressed: true, value: 1 };
    await new Promise((r) => setTimeout(r, 200));
    const fired = window.blankDelay.fired.filter((f) => /Z/.test(f.keys));
    check('pressing pad trigger fires the macro with bound keys', fired.length > 0,
        JSON.stringify(window.blankDelay.fired.slice(0, 3)));

    check('no black/white invert handler present',
        !/invert/.test(window.document.documentElement.innerHTML));
    check('no runtime script errors', errors.length === 0, errors.join(' | '));
}

async function testKeyboard() {
    console.log('\nKeyboard Macro');
    const padState = { pad: null };
    const { window, errors } = await loadProduct('keyboard.html', padState);
    await unlock(window);

    check('app unlocked', !window.document.getElementById('bd-app-main').hidden);
    check('keyboard display shown', !!window.document.querySelector('.bd-cs-kb-img'));
    check('macro rows rendered', window.document.querySelectorAll('.bd-cs-macro').length >= 6);
    check('Fortnite keybinds present', window.document.querySelectorAll('[data-bind]').length >= 10);

    check('optimizer-style macros present',
        !!window.document.querySelector('[data-toggle="pickup"]')
        && !!window.document.querySelector('[data-toggle="double-edit"]')
        && !!window.document.querySelector('[data-toggle="pickaxe"]'));
    window.document.querySelector('[data-toggle="pickup"]').click();
    window.document.getElementById('bd-cs-master').click();
    await new Promise((r) => setTimeout(r, 150));
    check('macro toggle reports live',
        /live/i.test(window.document.getElementById('bd-cs-status').textContent),
        window.document.getElementById('bd-cs-status').textContent);
    check('no runtime script errors', errors.length === 0, errors.join(' | '));
}

async function testAllProducts() {
    console.log('\nAll product apps load + unlock');
    const files = ['premium.html', 'zero.html', 'zero-plus.html', 'fps.html', 'ping.html', 'aim.html', 'shotgun.html'];
    for (const f of files) {
        const padState = { pad: null };
        try {
            const { window, errors } = await loadProduct(f, padState);
            await unlock(window);
            const unlocked = !window.document.getElementById('bd-app-main').hidden;
            check(f + ' unlocks with key', unlocked);
            check(f + ' has no script errors', errors.length === 0, errors.join(' | '));
        } catch (e) {
            bad(f + ' threw', e.message);
        }
    }
}

(async () => {
    await testController();
    await testKeyboard();
    await testAllProducts();
    console.log('\n' + (failures === 0 ? 'All macro checks passed.' : failures + ' check(s) failed.'));
    process.exit(failures === 0 ? 0 : 1);
})();
