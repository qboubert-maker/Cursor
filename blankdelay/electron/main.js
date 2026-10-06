const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec, execSync, spawn } = require('child_process');

const PRODUCTS = {
    premium: 'Blank Premium Utility',
    'zero-plus': 'Zero Delay Plus',
    zero: 'Zero Delay',
    fps: 'FPS Boost',
    ping: 'Ping Optimizer',
    controller: 'Controller Macro',
    keyboard: 'Keyboard Macro',
    aim: 'Aim Bundle',
    shotgun: 'Shotgun Pack'
};

const PURCHASE_KEY_RE = /^BD-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i;

let macroState = { active: false, shortcuts: [], gamepadPoll: null, panicRegistered: false };
let aimState = { running: false, armed: false, interval: null, toggleKey: null, togglePadBtn: -1, config: null, forceClass: null, forceShotgun: false, locked: false, input: { firing: false } };
let mainWindow = null;
let deviceCache = { data: null, at: 0 };

function createWindow(productKey) {
    const name = PRODUCTS[productKey] || 'BlankDelay Hub';
    const isHub = productKey === 'hub';
    const isTrainer = productKey === 'aim' || productKey === 'shotgun';
    const isMacro = productKey === 'controller' || productKey === 'keyboard';
    const isDashboard = productKey === 'premium';
    const isGrid = productKey === 'zero' || productKey === 'zero-plus' || productKey === 'fps' || productKey === 'ping';
    const win = new BrowserWindow({
        width: isHub ? 1440 : (isTrainer ? 1400 : (isMacro ? 1280 : (isDashboard ? 1320 : (isGrid ? 1240 : 960)))),
        height: isHub ? 920 : (isTrainer ? 960 : (isMacro ? 900 : (isDashboard ? 860 : (isGrid ? 820 : 700)))),
        minWidth: isTrainer ? 1100 : (isMacro ? 1080 : (isDashboard ? 1080 : (isGrid ? 1020 : 900))),
        minHeight: isTrainer ? 720 : (isMacro ? 680 : (isDashboard ? 640 : (isGrid ? 620 : 560))),
        backgroundColor: '#000000',
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        },
        title: `BlankDelay — ${name}`
    });

    const file = isHub ? 'hub.html' : `products/${productKey}.html`;
    win.loadFile(path.join(__dirname, file));
    mainWindow = win;
    return win;
}

const productArg = process.argv.find(a => a.startsWith('--product='));
const productKey = productArg ? productArg.split('=')[1] : 'hub';

function runMetrics(type) {
    const script = path.join(__dirname, 'metrics-runner.ps1');
    try {
        const out = execSync(
            `powershell -NoProfile -ExecutionPolicy Bypass -File "${script}" -Type "${type || 'latency'}"`,
            { encoding: 'utf8', timeout: 20000 }
        );
        return JSON.parse(out.trim());
    } catch (err) {
        return { error: err.message };
    }
}

function runDeviceScan() {
    const script = path.join(__dirname, 'devices-scan.ps1');
    try {
        const out = execSync(
            `powershell -NoProfile -ExecutionPolicy Bypass -File "${script}"`,
            { encoding: 'utf8', timeout: 8000 }
        );
        return JSON.parse(out.trim());
    } catch (err) {
        return { controllers: [], mice: [], keyboards: [], error: err.message };
    }
}

let macroDaemon = null;

function ensureMacroDaemon() {
    if (macroDaemon && !macroDaemon.killed && macroDaemon.stdin.writable) return macroDaemon;
    const script = path.join(__dirname, 'macro-daemon.ps1');
    if (!fs.existsSync(script)) return null;
    try {
        macroDaemon = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script], {
            stdio: ['pipe', 'pipe', 'pipe'],
            windowsHide: true
        });
        macroDaemon.on('exit', () => { macroDaemon = null; });
        macroDaemon.on('error', () => { macroDaemon = null; });
    } catch (_) {
        macroDaemon = null;
    }
    return macroDaemon;
}

function stopMacroDaemon() {
    if (!macroDaemon) return;
    try {
        macroDaemon.stdin.write('EXIT\n');
        macroDaemon.kill();
    } catch (_) {}
    macroDaemon = null;
}

// Games read scancode input, so all macro output goes through the scancode sender.
// The daemon keeps one PowerShell alive because spawning per-fire cannot keep up
// with drag/spam macros running on 8ms loops.
function sendMacroKeys(keys, delayMs, mode, repeat) {
    const safeKeys = String(keys || '').replace(/["|\r\n]/g, '');
    if (!safeKeys) return { success: false, error: 'no keys' };
    const m = mode || 'once';
    const r = repeat || 8;
    const d = delayMs || 5;

    const daemon = ensureMacroDaemon();
    if (daemon && daemon.stdin.writable) {
        try {
            daemon.stdin.write(`${safeKeys}|${d}|${m}|${r}\n`);
            return { success: true, via: 'daemon' };
        } catch (_) { /* fall through to one-shot */ }
    }

    const script = path.join(__dirname, 'macro-send.ps1');
    try {
        execSync(
            `powershell -NoProfile -ExecutionPolicy Bypass -File "${script}" -Keys "${safeKeys}" -DelayMs ${d} -Mode "${m}" -Repeat ${r}`,
            { timeout: 15000, windowsHide: true }
        );
        return { success: true, via: 'oneshot' };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

function pollInputState() {
    const script = path.join(__dirname, 'input-poll.ps1');
    try {
        const out = execSync(
            `powershell -NoProfile -ExecutionPolicy Bypass -File "${script}"`,
            { encoding: 'utf8', timeout: 5000 }
        );
        return JSON.parse(out.trim());
    } catch (err) {
        return { keys: {}, mouse: {} };
    }
}

function normalizeAccelerator(accel) {
    if (!accel) return null;
    const a = String(accel).trim();
    if (/^f\d+$/i.test(a)) return a.toUpperCase();
    if (a.length === 1) return a.toUpperCase();
    if (a === ' ') return 'Space';
    return a;
}

function stopMacroEngine() {
    macroState.shortcuts.forEach(id => {
        try { globalShortcut.unregister(id); } catch (_) {}
    });
    macroState.shortcuts = [];
    macroState.active = false;
}

function registerMacroHotkey(accelerator, keys, delayMs, mode, repeat) {
    const accel = normalizeAccelerator(accelerator);
    if (!accel || accel === 'F12' || globalShortcut.isRegistered(accel)) return false;
    const ok = globalShortcut.register(accel, () => {
        sendMacroKeys(keys, delayMs, mode, repeat);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('macro-fired', { accelerator: accel, keys, mode, repeat });
        }
    });
    if (ok) macroState.shortcuts.push(accel);
    return ok;
}

function panicStop() {
    stopMacroEngine();
    stopAimAssist();
    BrowserWindow.getAllWindows().forEach(win => {
        if (!win.isDestroyed()) win.webContents.send('macro-panic');
    });
}

function registerPanicShortcut() {
    if (globalShortcut.isRegistered('F12')) return;
    macroState.panicRegistered = globalShortcut.register('F12', panicStop);
}

function profileDirectory(product) {
    const safeProduct = String(product || 'macro').replace(/[^a-z0-9-]/gi, '');
    return path.join(process.env.APPDATA || app.getPath('userData'), 'BlankDelay', 'profiles', safeProduct);
}

function safeProfileName(name) {
    return String(name || 'Default').replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim().slice(0, 50) || 'Default';
}

function runHudDetect() {
    const script = path.join(__dirname, 'fortnite-hud-detect.ps1');
    try {
        const out = execSync(
            `powershell -NoProfile -ExecutionPolicy Bypass -File "${script}"`,
            { encoding: 'utf8', timeout: 4000 }
        );
        return JSON.parse(out.trim());
    } catch (err) {
        return { fortnite: false, weaponClass: 'unknown', error: err.message };
    }
}

function runAimNudge(dx, dy, strength) {
    const script = path.join(__dirname, 'aim-nudge.ps1');
    try {
        execSync(
            `powershell -NoProfile -ExecutionPolicy Bypass -File "${script}" -Dx ${dx} -Dy ${dy} -Strength ${strength || 50}`,
            { timeout: 3000 }
        );
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

function aimRadiusPx(radius) {
    if (radius === 'small') return 60;
    if (radius === 'large') return 140;
    return 100;
}

function getClassSettings(config, weaponClass) {
    const defaults = { strength: 50, radius: 'medium' };
    if (!config || !config.classes) return defaults;
    return { ...defaults, ...(config.classes[weaponClass] || {}) };
}

function weaponAllowed(config, hud) {
    if (!hud || !hud.fortniteFocused) return false;
    const cls = aimState.forceClass || hud.weaponClass;
    if (config.product === 'shotgun') {
        if (aimState.forceShotgun) return true;
        if (cls !== 'shotgun') return false;
        if (!config.shotguns || !config.shotguns.length) return true;
        const type = (hud.shotgunType || 'pump').toLowerCase();
        return config.shotguns.some(s => type.includes(String(s).toLowerCase()) || String(s).toLowerCase().includes(type));
    }
    if (aimState.forceClass) return true;
    return cls && cls !== 'none' && cls !== 'unknown';
}

function stopAimAssist() {
    if (aimState.interval) {
        clearInterval(aimState.interval);
        aimState.interval = null;
    }
    if (aimState.toggleKey) {
        try { globalShortcut.unregister(aimState.toggleKey); } catch (_) {}
        const idx = macroState.shortcuts.indexOf(aimState.toggleKey);
        if (idx >= 0) macroState.shortcuts.splice(idx, 1);
        aimState.toggleKey = null;
    }
    aimState.running = false;
    aimState.armed = false;
    aimState.locked = false;
    aimState.config = null;
    aimState.forceClass = null;
    aimState.forceShotgun = false;
}

function sendAimStatus(payload) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('aim-status', payload);
    }
}

function startAimAssistLoop(config) {
    stopAimAssist();
    aimState.config = config;
    aimState.running = true;
    aimState.armed = !!config.enabled;

    const toggle = normalizeAccelerator(config.toggleKey);
    if (toggle && toggle !== 'F12' && !globalShortcut.isRegistered(toggle)) {
        const ok = globalShortcut.register(toggle, () => {
            aimState.armed = !aimState.armed;
            sendAimStatus({ event: 'toggle', armed: aimState.armed, timestamp: Date.now() });
        });
        if (ok) {
            aimState.toggleKey = toggle;
            macroState.shortcuts.push(toggle);
        }
    }

    registerPanicShortcut();
    let lastLog = 0;
    aimState.interval = setInterval(() => {
        if (!aimState.running) return;
        const hud = runHudDetect();
        const allowed = weaponAllowed(config, hud);
        let status = 'Inactive';
        if (!aimState.armed) status = 'Inactive';
        else if (!hud.fortniteFocused) status = hud.fortniteRunning ? 'Waiting Focus' : 'Inactive';
        else if (!allowed) status = 'Searching';
        else status = 'Active';

        let assistStatus = status;
        if (aimState.armed && hud.fortniteFocused && allowed) {
            const cls = aimState.forceClass || hud.weaponClass;
            const settings = getClassSettings(config, cls);
            const input = pollInputState();
            const firing = aimState.input.firing || !!(input.mouse && (input.mouse.LMB || input.mouse.RMB));
            if (firing && aimState.armed) {
                const str = settings.strength || config.globalStrength || 50;
                const rad = aimRadiusPx(settings.radius || config.radius || 'medium');
                const dx = Math.round((Math.random() - 0.5) * rad * 0.08);
                const dy = Math.round((Math.random() - 0.42) * rad * 0.06);
                if (dx || dy) {
                    runAimNudge(dx, dy, str);
                    aimState.locked = true;
                    assistStatus = config.product === 'shotgun' ? 'Locked' : `Locked [${cls.toUpperCase()}]`;
                    if (Date.now() - lastLog > 800) {
                        sendAimStatus({ event: 'assist', weapon: cls, strength: str, dx, dy, timestamp: Date.now() });
                        lastLog = Date.now();
                    }
                }
            } else {
                aimState.locked = false;
                assistStatus = config.product === 'shotgun' ? 'Active' : `Active [${cls.toUpperCase()}]`;
            }
        } else {
            aimState.locked = false;
        }

        const activeRadius = aimState.armed && allowed
            ? (getClassSettings(config, aimState.forceClass || hud.weaponClass).radius || config.radius || 'medium')
            : (config.radius || 'medium');

        sendAimStatus({
            status: assistStatus,
            armed: aimState.armed,
            fortnite: !!hud.fortniteFocused,
            fortniteRunning: !!hud.fortniteRunning,
            fortniteFocused: !!hud.fortniteFocused,
            weaponClass: hud.weaponClass,
            shotgunType: hud.shotgunType,
            confidence: hud.confidence,
            borderHue: hud.borderHue,
            radius: activeRadius,
            forceClass: aimState.forceClass,
            forceShotgun: aimState.forceShotgun,
            timestamp: Date.now()
        });
    }, 48);
}

function saveFortniteExport(config, filename) {
    const dir = path.join(process.env.APPDATA || '', 'BlankDelay');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, filename);
    fs.writeFileSync(file, config, 'utf8');
    return file;
}

app.whenReady().then(() => {
    createWindow(productKey);
    registerPanicShortcut();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow(productKey);
    });
});

app.on('window-all-closed', () => {
    stopMacroEngine();
    stopAimAssist();
    stopMacroDaemon();
    if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
    stopMacroEngine();
    stopAimAssist();
    stopMacroDaemon();
    globalShortcut.unregisterAll();
});

ipcMain.handle('launch-product', (_e, key) => {
    if (!PRODUCTS[key]) return { success: false, error: 'Unknown product' };
    createWindow(key);
    return { success: true, product: key };
});

ipcMain.handle('get-product-info', () => ({
    productKey,
    name: PRODUCTS[productKey] || 'BlankDelay'
}));

ipcMain.handle('validate-key', (_e, key) => {
    const normalized = (key || '').trim().toUpperCase();
    if (PURCHASE_KEY_RE.test(normalized)) return { valid: true, msg: 'License activated.' };
    return { valid: false, msg: 'Invalid license key.' };
});

ipcMain.handle('run-tweaks', async (_e, tweakList) => {
    const results = [];
    for (const tweak of tweakList) {
        try {
            execSync(tweak.cmd, { shell: 'powershell.exe', timeout: 20000 });
            results.push({ id: tweak.id, name: tweak.name, success: true });
        } catch (err) {
            results.push({ id: tweak.id, name: tweak.name, success: false, error: err.message });
        }
    }
    return results;
});

ipcMain.handle('run-single-tweak', async (_e, cmd) => {
    try {
        const output = execSync(cmd, { shell: 'powershell.exe', timeout: 20000, encoding: 'utf8' });
        return { success: true, output: output.trim() };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('check-admin', async () => {
    try {
        const result = execSync(
            '([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)',
            { shell: 'powershell.exe', encoding: 'utf8' }
        );
        return result.trim() === 'True';
    } catch {
        return false;
    }
});

ipcMain.handle('restart-as-admin', () => {
    const rootDir = path.resolve(__dirname, '..');
    const batFile = path.join(rootDir, `launch-${productKey}-admin.bat`);
    if (fs.existsSync(batFile)) {
        exec(`Start-Process "${batFile}" -Verb RunAs`, { shell: 'powershell.exe' });
    } else {
        const cmd = `@echo off\nnet session >nul 2>&1\nif %errorlevel% neq 0 (\n    powershell -Command "Start-Process '%~f0' -Verb RunAs"\n    exit /b\n)\ncd /d "${rootDir}"\nset PATH=${rootDir}\\.tools\\node;${rootDir}\\node_modules\\.bin;%PATH%\nnpx electron electron/main.js --product=${productKey}`;
        fs.writeFileSync(batFile, cmd);
        exec(`Start-Process "${batFile}" -Verb RunAs`, { shell: 'powershell.exe' });
    }
    setTimeout(() => app.quit(), 500);
});

ipcMain.handle('get-system-metrics', async (_e, type) => runMetrics(type || 'latency'));

ipcMain.handle('detect-devices', async () => {
    const now = Date.now();
    if (deviceCache.data && now - deviceCache.at < 20000) {
        return deviceCache.data;
    }
    const m = runDeviceScan();
    const data = {
        controllers: m.controllers || [],
        mice: m.mice || [],
        keyboards: m.keyboards || [],
        gamepadApi: true
    };
    deviceCache = { data, at: now };
    return data;
});

ipcMain.handle('start-macro-engine', async (_e, config) => {
    stopMacroEngine();
    registerPanicShortcut();
    const dir = path.join(process.env.APPDATA || '', 'BlankDelay');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${config.type || 'macro'}-active.json`);
    fs.writeFileSync(file, JSON.stringify(config, null, 2), 'utf8');

    let registered = 0;
    (config.binds || []).forEach(bind => {
        if (bind.accelerator && bind.keys) {
            if (registerMacroHotkey(bind.accelerator, bind.keys, bind.delayMs || config.speed || 20, bind.mode, bind.repeat)) registered++;
        }
    });

    macroState.active = true;
    return { success: true, registered, file };
});

ipcMain.handle('stop-macro-engine', async () => {
    stopMacroEngine();
    registerPanicShortcut();
    return { success: true };
});

ipcMain.handle('list-macro-profiles', async (_e, product) => {
    const dir = profileDirectory(product);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
        .filter(name => name.endsWith('.json'))
        .map(name => path.basename(name, '.json'))
        .sort();
});

ipcMain.handle('save-macro-profile', async (_e, product, name, profile) => {
    const dir = profileDirectory(product);
    fs.mkdirSync(dir, { recursive: true });
    const safeName = safeProfileName(name);
    const file = path.join(dir, `${safeName}.json`);
    fs.writeFileSync(file, JSON.stringify({ ...profile, name: safeName, product, version: 1 }, null, 2), 'utf8');
    return { success: true, name: safeName, file };
});

ipcMain.handle('load-macro-profile', async (_e, product, name) => {
    const file = path.join(profileDirectory(product), `${safeProfileName(name)}.json`);
    if (!fs.existsSync(file)) return { success: false, error: 'Profile not found.' };
    return { success: true, profile: JSON.parse(fs.readFileSync(file, 'utf8')) };
});

ipcMain.handle('delete-macro-profile', async (_e, product, name) => {
    const file = path.join(profileDirectory(product), `${safeProfileName(name)}.json`);
    if (fs.existsSync(file)) fs.unlinkSync(file);
    return { success: true };
});

ipcMain.handle('fire-macro', async (_e, payload, delayMs) => {
    if (payload && typeof payload === 'object') {
        return sendMacroKeys(payload.keys, payload.speed || delayMs || 20, payload.mode, payload.repeat);
    }
    return sendMacroKeys(payload, delayMs || 20);
});

ipcMain.handle('poll-input-state', async () => pollInputState());

ipcMain.handle('detect-fortnite-hud', async () => runHudDetect());

ipcMain.handle('start-aim-assist', async (_e, config) => {
    startAimAssistLoop(config || {});
    return { success: true, armed: aimState.armed };
});

ipcMain.handle('stop-aim-assist', async () => {
    stopAimAssist();
    registerPanicShortcut();
    return { success: true };
});

ipcMain.handle('set-aim-force', async (_e, data) => {
    if (data && data.shotgun) aimState.forceShotgun = !!data.shotgun;
    if (data && data.weaponClass) aimState.forceClass = data.weaponClass || null;
    return { success: true, forceClass: aimState.forceClass, forceShotgun: aimState.forceShotgun };
});

ipcMain.handle('toggle-aim-armed', async () => {
    if (!aimState.running) return { success: false };
    aimState.armed = !aimState.armed;
    sendAimStatus({ event: 'toggle', armed: aimState.armed, timestamp: Date.now() });
    return { success: true, armed: aimState.armed };
});

ipcMain.handle('report-aim-input', async (_e, data) => {
    aimState.input = { firing: !!(data && data.firing) };
    return { success: true };
});

ipcMain.handle('export-fortnite-settings', async (_e, data) => {
    const lines = [
        'BlankDelay — Fortnite Settings Export',
        '=====================================',
        `Product: ${data.product || productKey}`,
        `Generated: ${new Date().toISOString()}`,
        '',
        '--- Recommended In-Game Settings ---',
        ...(data.settings || []).map(s => `${s.label}: ${s.value}`),
        '',
        '--- Macro Binds (map these in Fortnite) ---',
        ...(data.macros || []).map(m => `${m.name}: ${m.bind} → sends ${m.keys}`),
        '',
        '--- How to apply ---',
        '1. Open Fortnite → Settings → Keyboard Controls',
        '2. Match your build/edit keys to the macro output keys below',
        '3. Keep BlankDelay macro app running in background while playing',
        '4. Press your assigned hotkey OR controller bind to fire the macro',
        '',
        'Note: Macros send keyboard inputs. Set Fortnite binds to match.'
    ];
    const file = saveFortniteExport(lines.join('\r\n'), `fortnite-${productKey}-settings.txt`);
    return { success: true, file };
});
