'use strict';

/**
 * Detect / download / install drivers this app needs:
 *   ViGEmBus   — virtual pad games read (required for macros)
 *   HidHide    — cloaks the physical pad so games only see the virtual one
 *   DS4Windows — PlayStation DualShock 4 / DualSense support on PC
 *
 * Bundled installers under ./drivers (or resources/drivers when packaged)
 * are preferred. Nefarius setups install silently with /qn when elevated.
 * GitHub download is the fallback. winget is last resort only.
 * DS4Windows is downloaded as a zip and extracted into userData.
 */

const { app } = require('electron');
const { spawn, execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const fsp = require('fs').promises;
const https = require('https');
const http = require('http');
const os = require('os');
const path = require('path');
const { EventEmitter } = require('events');

const execFileAsync = promisify(execFile);

const CATALOG = {
  vigem: {
    id: 'vigem',
    name: 'ViGEmBus',
    type: 'kernel',
    required: true,
    service: 'ViGEmBus',
    sysFiles: ['ViGEmBus.sys'],
    prefix: 'ViGEmBus',
    fileName: 'ViGEmBus_1.22.0_x64_x86_arm64.exe',
    url: 'https://github.com/nefarius/ViGEmBus/releases/download/v1.22.0/ViGEmBus_1.22.0_x64_x86_arm64.exe',
    wingetId: 'Nefarius.ViGEmBus',
    title: 'Virtual controller',
    blurb: 'Creates the virtual pad games read — works for PlayStation and Xbox layouts. Required for every macro.',
    platforms: ['PlayStation', 'Xbox'],
  },
  hidhide: {
    id: 'hidhide',
    name: 'HidHide',
    type: 'kernel',
    required: true,
    service: 'HidHide',
    sysFiles: ['HidHide.sys'],
    prefix: 'HidHide',
    fileName: 'HidHide_1.5.230_x64.exe',
    url: 'https://github.com/nefarius/HidHide/releases/download/v1.5.230.0/HidHide_1.5.230_x64.exe',
    wingetId: 'Nefarius.HidHide',
    title: 'Double-input cloak',
    blurb: 'Hides your physical DualSense, DualShock, or Xbox pad so games only see the virtual controller.',
    platforms: ['PlayStation', 'Xbox'],
  },
  ds4: {
    id: 'ds4',
    name: 'DS4Windows',
    type: 'app',
    required: false,
    fileName: 'DS4Windows_3.3.3_x64.zip',
    url: 'https://github.com/Ryochan7/DS4Windows/releases/download/v3.3.3/DS4Windows_3.3.3_x64.zip',
    title: 'PlayStation pad support',
    blurb: 'DS4Windows for DualShock 4 and DualSense on PC — installs into the app and launches when ready.',
    platforms: ['PlayStation'],
  },
};

const KERNEL_IDS = ['vigem', 'hidhide'];
const DS4_PINNED_URL = CATALOG.ds4.url;

/** Nefarius setups document /qn; keep a few fallbacks for older packages. */
const SILENT_ARG_SETS = [
  ['/qn'],
  ['/quiet', '/norestart'],
  ['/qn', '/norestart'],
  ['/passive', '/norestart'],
  ['/install', '/quiet', '/norestart'],
  ['/S'],
];

const emitter = new EventEmitter();
let busy = false;

function driversDir() {
  const candidates = [];
  try {
    if (app?.isPackaged && process.resourcesPath) {
      candidates.push(path.join(process.resourcesPath, 'drivers'));
    }
  } catch {
    /* app not ready */
  }
  try {
    candidates.push(path.join(path.dirname(process.execPath), 'resources', 'drivers'));
    candidates.push(path.join(path.dirname(process.execPath), 'drivers'));
  } catch {
    /* ignore */
  }
  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    candidates.push(path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'drivers'));
  }
  candidates.push(path.join(__dirname, 'drivers'));

  for (const dir of candidates) {
    try {
      if (dir && fs.existsSync(dir)) return dir;
    } catch {
      /* ignore */
    }
  }
  return path.join(__dirname, 'drivers');
}

function cacheDir() {
  try {
    if (app?.getPath) return path.join(app.getPath('userData'), 'driver-cache');
  } catch {
    /* app not ready */
  }
  return path.join(__dirname, 'driver-cache');
}

function psQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function serviceInstalled(serviceName) {
  try {
    await execFileAsync(
      'reg.exe',
      ['query', `HKLM\\SYSTEM\\CurrentControlSet\\Services\\${serviceName}`],
      { windowsHide: true, timeout: 10000 },
    );
    return true;
  } catch {
    return false;
  }
}

async function serviceState(serviceName) {
  try {
    const { stdout } = await execFileAsync(
      'sc.exe',
      ['query', serviceName],
      { windowsHide: true, timeout: 10000 },
    );
    const text = String(stdout || '');
    if (/RUNNING/i.test(text)) return 'running';
    if (/START_PENDING/i.test(text)) return 'starting';
    if (/STOPPED|STOP_PENDING/i.test(text)) return 'stopped';
    if (/does not exist|FAILED|1060/i.test(text)) return 'missing';
    return 'unknown';
  } catch (e) {
    const msg = String(e?.stderr || e?.message || '');
    if (/1060|does not exist/i.test(msg)) return 'missing';
    return 'unknown';
  }
}

async function startService(serviceName) {
  try {
    await execFileAsync('sc.exe', ['start', serviceName], {
      windowsHide: true,
      timeout: 15000,
    });
    return true;
  } catch (e) {
    // 1056 = already running, 1058 = disabled
    const msg = String(e?.stderr || e?.message || e || '');
    if (/1056|already running/i.test(msg)) return true;
    return false;
  }
}

/**
 * Start ViGEmBus + HidHide when present so controllers work without a reboot
 * on machines where services were installed but left stopped / manual.
 */
async function ensureServicesRunning() {
  const results = {};
  for (const name of ['ViGEmBus', 'HidHide']) {
    // eslint-disable-next-line no-await-in-loop
    let state = await serviceState(name);
    if (state === 'missing') {
      results[name] = { ok: false, state, started: false };
      continue;
    }
    if (state !== 'running' && state !== 'starting') {
      // eslint-disable-next-line no-await-in-loop
      await startService(name);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 600));
      // eslint-disable-next-line no-await-in-loop
      state = await serviceState(name);
    }
    results[name] = {
      ok: state === 'running' || state === 'starting',
      state,
      started: true,
    };
  }
  return {
    ok: Object.values(results).every((r) => r.ok || r.state === 'missing'),
    services: results,
  };
}

/**
 * After HidHide MSI install: recreate ROOT device + class filters when missing,
 * then heal bloated whitelist so cloak/CLI work for every PC.
 */
async function ensureHidHideDeviceReady() {
  const script = [
    `$ErrorActionPreference = 'Continue'`,
    `$base = ${psQuote('C:\\Program Files\\Nefarius Software Solutions\\HidHide\\x64')}`,
    `$nef = Join-Path $base 'nefconw.exe'`,
    `$inf = Join-Path $base 'HidHide\\HidHide.inf'`,
    `if (-not (Test-Path $nef) -or -not (Test-Path $inf)) { Write-Output 'SKIP no-nefcon'; exit 0 }`,
    `$sysGuid = '{4D36E97D-E325-11CE-BFC1-08002BE10318}'`,
    `$hidGuid = '{745a17a0-74d3-11d0-b6fe-00a0c90f57da}'`,
    `$xnaGuid = '{d61ca365-5af4-4486-998b-9db4734c6ca3}'`,
    `$xboxGuid = '{05f5cfe2-4733-4950-a6bb-07aad01a3a84}'`,
    `$short = Join-Path $env:TEMP 'AphroditeHidHideInf'`,
    `New-Item -ItemType Directory -Force -Path $short | Out-Null`,
    `Copy-Item (Join-Path $base 'HidHide\\*') $short -Force`,
    `$infShort = Join-Path $short 'HidHide.inf'`,
    `& $nef --install-driver --inf-path $infShort | Out-Null`,
    `& $nef --create-device-node --hardware-id 'root\\HidHide' --class-name System --class-guid $sysGuid | Out-Null`,
    `& $nef --add-class-filter --position upper --service-name HidHide --class-guid $hidGuid | Out-Null`,
    `& $nef --add-class-filter --position upper --service-name HidHide --class-guid $xnaGuid | Out-Null`,
    `& $nef --add-class-filter --position upper --service-name HidHide --class-guid $xboxGuid | Out-Null`,
    `try { Start-Service HidHide -ErrorAction SilentlyContinue } catch {}`,
    `try { & sc.exe start HidHide | Out-Null } catch {}`,
    `Start-Sleep -Seconds 1`,
    `Write-Output 'OK hidhide-device'`,
    `exit 0`,
  ].join('\r\n');

  const elevated = await isElevated();
  const result = await runPowerShell(script, { elevated: !elevated });
  try {
    // eslint-disable-next-line global-require
    const hidhide = require('./hidhide');
    hidhide.resetCliCache?.();
    await hidhide.postInstallHeal?.();
  } catch {
    /* ignore */
  }
  return result;
}

function ds4InstallDir() {
  try {
    if (app?.getPath) return path.join(app.getPath('userData'), 'DS4Windows');
  } catch {
    /* app not ready */
  }
  return path.join(__dirname, 'DS4Windows');
}

function findDs4Exe() {
  const candidates = [
    path.join(ds4InstallDir(), 'DS4Windows.exe'),
    path.join(ds4InstallDir(), 'DS4Windows', 'DS4Windows.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'DS4Windows', 'DS4Windows.exe'),
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'DS4Windows', 'DS4Windows.exe'),
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'DS4Windows', 'DS4Windows.exe'),
  ];
  for (const file of candidates) {
    try {
      if (file && fs.existsSync(file)) return file;
    } catch {
      /* ignore */
    }
  }
  return null;
}

function sysFileInstalled(sysFiles = []) {
  const roots = [
    process.env.SystemRoot || 'C:\\Windows',
    'C:\\Windows',
  ];
  for (const root of roots) {
    for (const name of sysFiles) {
      try {
        if (fs.existsSync(path.join(root, 'System32', 'drivers', name))) return true;
      } catch {
        /* ignore */
      }
    }
  }
  return false;
}

/**
 * True only when the driver is actually usable — not leftover registry keys,
 * orphaned .sys files, or a CLI without a running service. False positives here
 * used to disable Install for customers who still needed setup.
 */
async function driverPresent(drv) {
  if (drv.type === 'app') {
    if (drv.id === 'ds4') return Boolean(findDs4Exe());
    return false;
  }
  const hasService = await serviceInstalled(drv.service);
  const hasSys = sysFileInstalled(drv.sysFiles);
  return Boolean(hasService && hasSys);
}

/** Present + kernel service running (starts it when stopped). Apps only need the exe. */
async function driverReady(drv) {
  if (!(await driverPresent(drv))) return false;
  if (drv.type === 'app') return true;
  const state = await serviceState(drv.service);
  if (state === 'running' || state === 'starting') return true;
  if (state === 'stopped' || state === 'unknown') {
    await startService(drv.service);
    await new Promise((r) => setTimeout(r, 500));
    const next = await serviceState(drv.service);
    return next === 'running' || next === 'starting';
  }
  return false;
}

async function isElevated() {
  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      [
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-Command',
        '([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)',
      ],
      { windowsHide: true, timeout: 10000 },
    );
    return String(stdout || '').trim().toLowerCase() === 'true';
  } catch {
    return false;
  }
}

async function hasWorkingWinget() {
  try {
    const { stdout } = await execFileAsync('winget.exe', ['--version'], {
      windowsHide: true,
      timeout: 8000,
    });
    const ver = String(stdout || '').trim();
    return /^v?\d+/i.test(ver);
  } catch {
    return false;
  }
}

function findBundled(prefix) {
  try {
    const dir = driversDir();
    if (!fs.existsSync(dir)) return null;
    const file = fs
      .readdirSync(dir)
      .find((f) => f.toLowerCase().startsWith(prefix.toLowerCase()) && /\.(msi|exe)$/i.test(f));
    return file ? path.join(dir, file) : null;
  } catch {
    return null;
  }
}

function findCached(fileName) {
  const file = path.join(cacheDir(), fileName);
  try {
    if (fs.existsSync(file) && fs.statSync(file).size > 100000) return file;
  } catch {
    /* ignore */
  }
  return null;
}

function emitProgress(payload) {
  emitter.emit('progress', payload);
}

async function getStatus() {
  const elevated = await isElevated();
  const entries = await Promise.all(
    Object.values(CATALOG).map(async (drv) => {
      const present = await driverPresent(drv);
      const ready = present ? await driverReady(drv) : false;
      const isApp = drv.type === 'app';
      const state = !isApp && present ? await serviceState(drv.service) : (present ? 'ready' : 'missing');
      const bundled = drv.prefix ? findBundled(drv.prefix) : null;
      const cached = findCached(drv.fileName);
      const openPath = drv.id === 'ds4' ? findDs4Exe() : null;
      return {
        id: drv.id,
        name: drv.name,
        type: drv.type || 'kernel',
        required: !!drv.required,
        title: drv.title,
        blurb: drv.blurb,
        platforms: drv.platforms,
        // UI "Installed" only when the service is actually running (or app present).
        installed: ready,
        present,
        running: isApp ? ready : (state === 'running' || state === 'starting'),
        serviceState: state,
        canInstall: !ready,
        canOpen: Boolean(openPath),
        openPath: openPath || null,
        hasInstaller: isApp ? true : Boolean(bundled || cached),
        source: bundled ? 'bundled' : cached ? 'cached' : 'download',
      };
    }),
  );

  // Only ViGEmBus + HidHide matter for "ready".
  const kernel = entries.filter((e) => e.id === 'vigem' || e.id === 'hidhide');
  const byId = Object.fromEntries(kernel.map((e) => [e.id, e]));
  const missingRequired = kernel.filter((e) => !e.installed).map((e) => e.id);
  return {
    busy,
    elevated,
    allReady: kernel.every((e) => e.installed),
    missing: missingRequired.slice(),
    missingRequired,
    needsSetup: missingRequired.length > 0,
    platforms: {
      playstation: {
        label: 'PlayStation',
        detail: 'DualSense / DualShock 4 — ViGEm + HidHide required; DS4Windows recommended.',
      },
      xbox: {
        label: 'Xbox',
        detail: 'Xbox One / Series — ViGEm + HidHide. Built-in Windows pad support reads the pad.',
      },
    },
    drivers: byId,
  };
}

function downloadTo(url, dest, onProgress) {
  return new Promise((resolve, reject) => {
    const get = (target, redirects = 0) => {
      if (redirects > 8) {
        reject(new Error('Too many redirects while downloading driver'));
        return;
      }
      const lib = target.startsWith('https:') ? https : http;
      const req = lib.get(target, { headers: { 'User-Agent': 'Aphrodite-Controller-Macro' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          get(res.headers.location, redirects + 1);
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`Download failed (HTTP ${res.statusCode})`));
          return;
        }

        const total = Number(res.headers['content-length']) || 0;
        let received = 0;
        const tmp = `${dest}.partial`;
        const out = fs.createWriteStream(tmp);

        res.on('data', (chunk) => {
          received += chunk.length;
          if (onProgress) {
            onProgress({
              received,
              total,
              percent: total ? Math.min(100, Math.round((received / total) * 100)) : null,
            });
          }
        });

        res.pipe(out);
        out.on('finish', () => {
          out.close(() => {
            try {
              fs.renameSync(tmp, dest);
              resolve(dest);
            } catch (err) {
              reject(err);
            }
          });
        });
        out.on('error', (err) => {
          try { fs.unlinkSync(tmp); } catch { /* ignore */ }
          reject(err);
        });
      });
      req.on('error', reject);
      req.setTimeout(180000, () => {
        req.destroy(new Error('Download timed out'));
      });
    };
    get(url);
  });
}

/** Copy installer to a short temp path so elevated setup never fails on spaces / asar paths. */
async function stageInstaller(file) {
  const dir = path.join(os.tmpdir(), 'aphrodite-driver-setup');
  await fsp.mkdir(dir, { recursive: true });
  const dest = path.join(dir, path.basename(file));
  if (path.resolve(file) !== path.resolve(dest)) {
    await fsp.copyFile(file, dest);
  }
  return dest;
}

function httpsJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Aphrodite-Controller-Macro',
        Accept: 'application/vnd.github+json',
      },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        httpsJson(res.headers.location).then(resolve, reject);
        return;
      }
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`GitHub API failed (HTTP ${res.statusCode})`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => req.destroy(new Error('GitHub API timed out')));
  });
}

async function resolveDs4Download() {
  try {
    const release = await httpsJson('https://api.github.com/repos/Ryochan7/DS4Windows/releases/latest');
    const assets = Array.isArray(release?.assets) ? release.assets : [];
    const asset = assets.find((a) => /x64\.zip$/i.test(a?.name || ''))
      || assets.find((a) => /\.zip$/i.test(a?.name || ''));
    if (asset?.browser_download_url) {
      return {
        url: asset.browser_download_url,
        fileName: asset.name || CATALOG.ds4.fileName,
      };
    }
  } catch {
    /* fall through to pinned release */
  }
  return { url: DS4_PINNED_URL, fileName: CATALOG.ds4.fileName };
}

async function extractZip(zipPath, destDir) {
  await fsp.mkdir(destDir, { recursive: true });
  const script = [
    `$ErrorActionPreference = 'Stop'`,
    `if (Test-Path -LiteralPath ${psQuote(destDir)}) { Remove-Item -LiteralPath ${psQuote(destDir)} -Recurse -Force -ErrorAction SilentlyContinue }`,
    `New-Item -ItemType Directory -Force -Path ${psQuote(destDir)} | Out-Null`,
    `Expand-Archive -LiteralPath ${psQuote(zipPath)} -DestinationPath ${psQuote(destDir)} -Force`,
  ].join('\r\n');
  const result = await runPowerShell(script, { elevated: false });
  if (!result.ok) {
    throw new Error(result.error || 'Could not extract DS4Windows.');
  }
}

async function installDs4App() {
  emitProgress({
    id: 'ds4',
    phase: 'prepare',
    message: 'Preparing DS4Windows…',
  });

  const existing = findDs4Exe();
  if (existing) {
    emitProgress({ id: 'ds4', phase: 'done', message: 'DS4Windows is ready.' });
    return { ok: true, id: 'ds4', installed: true, skipped: true, openPath: existing };
  }

  const { url, fileName } = await resolveDs4Download();
  await fsp.mkdir(cacheDir(), { recursive: true });
  const zipPath = path.join(cacheDir(), fileName);

  if (!findCached(fileName)) {
    emitProgress({
      id: 'ds4',
      phase: 'download',
      message: 'Downloading DS4Windows…',
      percent: 0,
    });
    await downloadTo(url, zipPath, (p) => {
      emitProgress({
        id: 'ds4',
        phase: 'download',
        message: p.percent != null
          ? `Downloading DS4Windows… ${p.percent}%`
          : 'Downloading DS4Windows…',
        percent: p.percent,
      });
    });
  }

  const dest = ds4InstallDir();
  emitProgress({
    id: 'ds4',
    phase: 'install',
    message: 'Installing DS4Windows into the app…',
  });

  const extractRoot = path.join(os.tmpdir(), `aphrodite-ds4-${Date.now()}`);
  try {
    await extractZip(zipPath, extractRoot);

    // Zip may contain a nested DS4Windows folder or files at the root.
    let sourceDir = extractRoot;
    const nested = path.join(extractRoot, 'DS4Windows');
    if (fs.existsSync(path.join(nested, 'DS4Windows.exe'))) {
      sourceDir = nested;
    } else if (!fs.existsSync(path.join(extractRoot, 'DS4Windows.exe'))) {
      const kids = fs.readdirSync(extractRoot);
      const hit = kids.find((name) => {
        try {
          return fs.existsSync(path.join(extractRoot, name, 'DS4Windows.exe'));
        } catch {
          return false;
        }
      });
      if (hit) sourceDir = path.join(extractRoot, hit);
    }

    await fsp.mkdir(dest, { recursive: true });
    // Clear previous install contents, then copy.
    for (const name of fs.readdirSync(dest)) {
      // eslint-disable-next-line no-await-in-loop
      await fsp.rm(path.join(dest, name), { recursive: true, force: true });
    }
    for (const name of fs.readdirSync(sourceDir)) {
      // eslint-disable-next-line no-await-in-loop
      await fsp.cp(path.join(sourceDir, name), path.join(dest, name), { recursive: true });
    }
  } finally {
    try { await fsp.rm(extractRoot, { recursive: true, force: true }); } catch { /* ignore */ }
  }

  const exe = findDs4Exe();
  if (!exe) {
    const error = 'DS4Windows downloaded but DS4Windows.exe was not found.';
    emitProgress({ id: 'ds4', phase: 'error', message: error });
    return { ok: false, id: 'ds4', installed: false, error };
  }

  emitProgress({ id: 'ds4', phase: 'done', message: 'DS4Windows installed.' });
  return { ok: true, id: 'ds4', installed: true, openPath: exe };
}

async function openDs4() {
  const exe = findDs4Exe();
  if (!exe) return { ok: false, error: 'DS4Windows is not installed yet.' };
  try {
    const { shell } = require('electron');
    const err = await shell.openPath(exe);
    if (err) return { ok: false, error: err };
    return { ok: true, openPath: exe };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

async function ensureInstaller(drv) {
  let source = 'download';
  let file = null;

  const bundled = findBundled(drv.prefix);
  if (bundled) {
    file = bundled;
    source = 'bundled';
  } else {
    const cached = findCached(drv.fileName);
    if (cached) {
      file = cached;
      source = 'cached';
    } else {
      await fsp.mkdir(cacheDir(), { recursive: true });
      const dest = path.join(cacheDir(), drv.fileName);

      emitProgress({
        id: drv.id,
        phase: 'download',
        message: `Downloading ${drv.name}…`,
        percent: 0,
      });

      await downloadTo(drv.url, dest, (p) => {
        emitProgress({
          id: drv.id,
          phase: 'download',
          message: p.percent != null
            ? `Downloading ${drv.name}… ${p.percent}%`
            : `Downloading ${drv.name}…`,
          percent: p.percent,
        });
      });
      file = dest;
      source = 'download';
    }
  }

  const staged = await stageInstaller(file);
  return { file: staged, source };
}

function runPowerShell(script, { elevated }) {
  // Write the script from Node (avoids PowerShell command-length limits), then
  // run it — elevating only when the app itself is not already admin.
  const tmp = path.join(
    os.tmpdir(),
    `aphrodite-drivers-${Date.now()}-${Math.random().toString(16).slice(2)}.ps1`,
  );
  fs.writeFileSync(tmp, script, 'utf8');

  const args = elevated
    ? [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-Command',
      [
        `$p = Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File', ${psQuote(tmp)}) -Verb RunAs -Wait -PassThru`,
        `if ($null -eq $p) { exit 1223 }`,
        `exit $p.ExitCode`,
      ].join('; '),
    ]
    : ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', tmp];

  return new Promise((resolve) => {
    const child = spawn('powershell.exe', args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c) => { stdout += c.toString('utf8'); });
    child.stderr.on('data', (c) => { stderr += c.toString('utf8'); });
    const finish = (payload) => {
      try { fs.unlinkSync(tmp); } catch { /* ignore */ }
      resolve(payload);
    };
    child.on('error', (err) => finish({ ok: false, code: -1, error: err.message, stdout, stderr }));
    child.on('close', (code) => {
      const exit = code ?? -1;
      // 1223 = ERROR_CANCELLED (UAC denied). 3010 = success, reboot required.
      if (exit === 1223) {
        finish({
          ok: false,
          code: exit,
          cancelled: true,
          error: 'Windows approval was cancelled. Approve once to install both drivers.',
          stdout,
          stderr,
        });
        return;
      }
      const reboot = exit === 3010;
      const ok = exit === 0 || reboot;
      finish({
        ok,
        code: exit,
        reboot,
        cancelled: false,
        error: ok ? null : (stderr.trim() || stdout.trim() || `Installer exited with code ${exit}`),
        stdout,
        stderr,
      });
    });
  });
}

function buildInstallerScript(jobs) {
  const lines = [
    `$ErrorActionPreference = 'Continue'`,
    `$failed = 0`,
    `$reboot = 0`,
  ];

  jobs.forEach((job) => {
    const argSets = /\.msi$/i.test(job.file)
      ? [['/i', job.file, '/qn', '/norestart']]
      : SILENT_ARG_SETS.map((args) => [...args]);

    lines.push(`Write-Output ${psQuote(`Installing ${job.name}…`)}`);
    lines.push(`$installedOk = 0`);

    argSets.forEach((args, idx) => {
      const file = /\.msi$/i.test(job.file) ? 'msiexec.exe' : job.file;
      const finalArgs = /\.msi$/i.test(job.file) ? args : args;
      const argList = finalArgs.map((a) => psQuote(a)).join(',');
      lines.push(
        `if ($installedOk -eq 0) {`,
        `  Write-Output ${psQuote(`TRY ${job.name} set=${idx}`)}`,
        `  $p = Start-Process -FilePath ${psQuote(file)} -ArgumentList @(${argList}) -Wait -PassThru`,
        // 0 ok, 3010 reboot required, 1638 already installed
        `  if ($null -ne $p -and ($p.ExitCode -eq 0 -or $p.ExitCode -eq 3010 -or $p.ExitCode -eq 1638)) {`,
        `    $installedOk = 1`,
        `    if ($p.ExitCode -eq 3010) { $reboot = 1 }`,
        `    Write-Output ${psQuote(`OK ${job.name}`)}`,
        `  } elseif ($null -ne $p) {`,
        `    Write-Output ('TRYFAIL ' + ${psQuote(job.name)} + ' code=' + $p.ExitCode + ' set=${idx}')`,
        `  }`,
        `}`,
      );
    });

    lines.push(
      `if ($installedOk -eq 0) { $failed = 1; Write-Output ('FAIL ' + ${psQuote(job.name)}) }`,
    );
  });

  // Start kernel services so controllers work immediately when Windows allows it.
  lines.push(
    `foreach ($svc in @('ViGEmBus','HidHide')) {`,
    `  try { Start-Service -Name $svc -ErrorAction SilentlyContinue } catch {}`,
    `  try { & sc.exe start $svc | Out-Null } catch {}`,
    `}`,
    `Start-Sleep -Seconds 2`,
    `if ($failed -ne 0) { exit 1 }`,
    `if ($reboot -ne 0) { exit 3010 }`,
    `exit 0`,
  );
  return lines.join('\r\n');
}

function buildWingetScript(ids) {
  const lines = [
    `$ErrorActionPreference = 'Continue'`,
    `$failed = 0`,
    `$reboot = 0`,
  ];
  ids.forEach((id) => {
    const drv = CATALOG[id];
    if (!drv?.wingetId) return;
    lines.push(
      `Write-Output ${psQuote(`Installing ${drv.name} via winget…`)}`,
      `$p = Start-Process -FilePath 'winget.exe' -ArgumentList @('install','--id',${psQuote(drv.wingetId)},'-e','--accept-package-agreements','--accept-source-agreements','--disable-interactivity','--silent') -Wait -PassThru`,
      `if ($null -eq $p) { $failed = 1; Write-Output ('FAIL ' + ${psQuote(drv.name)}) }`,
      `elseif ($p.ExitCode -eq 0 -or $p.ExitCode -eq -1978335189 -or $p.ExitCode -eq -1978335212) { Write-Output ${psQuote(`OK ${drv.name}`)} }`,
      `elseif ($p.ExitCode -eq 3010) { $reboot = 1; Write-Output ${psQuote(`OK ${drv.name}`)} }`,
      `else { $failed = 1; Write-Output ('FAIL ' + ${psQuote(drv.name)} + ' code=' + $p.ExitCode) }`,
    );
  });
  lines.push(
    `if ($failed -ne 0) { exit 1 }`,
    `if ($reboot -ne 0) { exit 3010 }`,
    `exit 0`,
  );
  return lines.join('\r\n');
}

function parseFailNames(stdout = '') {
  const failed = new Set();
  String(stdout).split(/\r?\n/).forEach((line) => {
    const m = line.match(/^FAIL\s+(.+?)(?:\s+code=|$)/i);
    if (m) failed.add(m[1].trim());
  });
  return failed;
}

async function settleAndCheck(id) {
  const drv = CATALOG[id];
  for (let i = 0; i < 8; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    if (await driverPresent(drv)) return true;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 750));
  }
  return driverPresent(drv);
}

async function installBatch(ids, { force = false } = {}) {
  const want = [];
  for (const id of ids) {
    const drv = CATALOG[id];
    if (!drv || drv.type === 'app') continue;
    // Install when not ready — never skip just because a leftover key exists.
    // eslint-disable-next-line no-await-in-loop
    const ready = await driverReady(drv);
    if (force || !ready) want.push(id);
  }
  if (!want.length) {
    return {
      ok: true,
      results: ids.filter((id) => CATALOG[id]?.type !== 'app').map((id) => ({
        ok: true, id, installed: true, skipped: true,
      })),
      reboot: false,
      cancelled: false,
    };
  }

  const elevated = await isElevated();

  emitProgress({
    id: null,
    phase: 'prepare',
    message: 'Preparing PlayStation & Xbox drivers…',
  });

  const jobs = [];
  let script;
  let usedWinget = false;

  try {
    for (const id of want) {
      const drv = CATALOG[id];
      // eslint-disable-next-line no-await-in-loop
      const { file, source } = await ensureInstaller(drv);
      jobs.push({ id, name: drv.name, file, source });
      emitProgress({
        id,
        phase: 'install',
        message: source === 'bundled'
          ? `Installing ${drv.name}…`
          : `Installing ${drv.name} (${source})…`,
      });
    }
    script = buildInstallerScript(jobs);
  } catch (err) {
    // Bundled/download path failed — last resort winget if it actually works.
    const wingetOk = await hasWorkingWinget();
    if (!wingetOk) {
      return {
        ok: false,
        reboot: false,
        cancelled: false,
        results: want.map((id) => ({
          ok: false,
          id,
          installed: false,
          error: err?.message || `Could not get the ${CATALOG[id].name} installer.`,
        })),
        error: err?.message || 'Could not get driver installers.',
      };
    }
    usedWinget = true;
    want.forEach((id) => {
      emitProgress({ id, phase: 'install', message: `Installing ${CATALOG[id].name}…` });
    });
    script = buildWingetScript(want);
  }

  emitProgress({
    id: null,
    phase: 'install',
    message: elevated
      ? 'Installing drivers…'
      : 'Installing drivers… approve the one Windows prompt if shown.',
  });

  const result = await runPowerShell(script, { elevated: !elevated });
  const failedNames = parseFailNames(result.stdout);

  // Always try to bring services up after setup.
  await ensureServicesRunning();

  const results = [];
  let reboot = Boolean(result.reboot);
  for (const id of want) {
    const drv = CATALOG[id];
    // eslint-disable-next-line no-await-in-loop
    const installed = await settleAndCheck(id);
    if (installed) {
      // eslint-disable-next-line no-await-in-loop
      await driverReady(drv);
      emitProgress({
        id,
        phase: reboot ? 'reboot' : 'done',
        message: reboot
          ? `${drv.name} installed — restart Windows to finish.`
          : `${drv.name} installed.`,
      });
      results.push({ ok: true, id, installed: true, reboot });
    } else {
      let error;
      if (result.cancelled) {
        error = result.error;
      } else if (failedNames.has(drv.name)) {
        error = `Could not install ${drv.name}. Approve the Windows prompt and try again.`;
      } else if (usedWinget) {
        error = `Could not install ${drv.name} via winget.`;
      } else {
        error = `Could not install ${drv.name}. Approve the Windows prompt and try again.`;
      }
      emitProgress({ id, phase: 'error', message: error });
      results.push({ ok: false, id, installed: false, error, cancelled: result.cancelled });
    }
  }

  ids.forEach((id) => {
    if (!want.includes(id) && CATALOG[id]?.type !== 'app') {
      results.push({ ok: true, id, installed: true, skipped: true });
    }
  });

  return {
    ok: results.every((r) => r.ok),
    reboot,
    cancelled: Boolean(result.cancelled),
    results,
    error: results.filter((r) => !r.ok).map((r) => r.error).filter(Boolean).join(' · ') || null,
  };
}

async function installOne(id) {
  const batch = await installBatch([id]);
  const mine = batch.results.find((r) => r.id === id) || { ok: false, id, error: 'Unknown driver' };
  return { ...mine, reboot: batch.reboot, cancelled: batch.cancelled };
}

async function installMissing(ids, opts = {}) {
  if (busy) return { ok: false, error: 'An install is already running', status: await getStatus() };
  busy = true;
  emitProgress({ id: null, phase: 'start', message: 'Starting driver install…' });

  try {
    const prior = await getStatus();
    let force = !!opts.force;
    let want;
    if (Array.isArray(ids) && ids.length) {
      // Explicit Install click — always run the installer for these.
      want = ids.filter((id) => CATALOG[id]);
      force = true;
    } else {
      want = prior.missing.slice();
    }
    if (!want.length) {
      emitProgress({
        id: null,
        phase: 'done',
        message: 'Drivers are ready.',
      });
      return {
        ok: true,
        reboot: false,
        cancelled: false,
        results: [],
        status: prior,
        error: null,
      };
    }

    const kernelWant = want.filter((id) => CATALOG[id]?.type !== 'app');
    const appWant = want.filter((id) => CATALOG[id]?.type === 'app');

    let batch = {
      ok: true,
      reboot: false,
      cancelled: false,
      results: [],
      error: null,
    };

    if (kernelWant.length) {
      batch = await installBatch(kernelWant, { force });
      await ensureServicesRunning();
      if (kernelWant.includes('hidhide') || batch.results.some((r) => r.id === 'hidhide' && r.ok)) {
        emitProgress({
          id: 'hidhide',
          phase: 'install',
          message: 'Finishing HidHide setup…',
        });
        try {
          await ensureHidHideDeviceReady();
        } catch (err) {
          console.warn('[drivers] hidhide device ensure', err?.message || err);
        }
      }
    }

    const appResults = [];
    for (const id of appWant) {
      if (id !== 'ds4') continue;
      try {
        // eslint-disable-next-line no-await-in-loop
        appResults.push(await installDs4App());
      } catch (err) {
        const error = err?.message || 'Could not install DS4Windows.';
        emitProgress({ id: 'ds4', phase: 'error', message: error });
        appResults.push({ ok: false, id: 'ds4', installed: false, error });
      }
    }

    const results = [...batch.results, ...appResults];
    const status = await getStatus();
    const failed = results.filter((r) => !r.ok);

    emitProgress({
      id: null,
      phase: failed.length ? 'error' : batch.reboot ? 'reboot' : 'done',
      message: failed.length
        ? (batch.cancelled
          ? 'Windows approval was cancelled — approve once to finish setup.'
          : failed.map((f) => f.error).filter(Boolean).join(' · '))
        : batch.reboot
          ? 'Drivers installed. Restart Windows, then reopen the app.'
          : status.allReady
            ? 'PlayStation & Xbox drivers are ready.'
            : 'Install finished.',
    });

    return {
      ok: failed.length === 0,
      reboot: batch.reboot,
      cancelled: batch.cancelled,
      results,
      status,
      error: failed.map((r) => r.error).filter(Boolean).join(' · ') || null,
    };
  } finally {
    busy = false;
  }
}

function onProgress(fn) {
  emitter.on('progress', fn);
  return () => emitter.off('progress', fn);
}

module.exports = {
  CATALOG,
  KERNEL_IDS,
  getStatus,
  installMissing,
  installOne,
  openDs4,
  findDs4Exe,
  driverPresent,
  driverReady,
  ensureServicesRunning,
  ensureHidHideDeviceReady,
  startService,
  serviceState,
  onProgress,
};
