'use strict';

/**
 * HidHide cloak control for Aphrodite.
 *
 * Uses hidhide-ctl.exe (IOCTL) so cloak works even when HidHideCLI hits 0x0057.
 * All child-process work is async — never spawnSync on the Electron main thread.
 *
 * enable(targets) hides the given physical instance paths then arms cloak.
 * Callers must connect ViGEm immediately after a successful enable.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { unpacked } = require('./unpacked');

const CLI_CANDIDATES = [
  path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Nefarius Software Solutions', 'HidHide', 'x64', 'HidHideCLI.exe'),
  path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Nefarius Software Solutions', 'HidHide', 'x64', 'HidHideCLI.exe'),
];

let cachedCli = null;
let lastStatus = null;
let chain = Promise.resolve();
/** While dual-pad is arming, never restore-games (that cleared cloak mid-plug). */
let suppressSafeRestore = false;

function setSuppressSafeRestore(on) {
  suppressSafeRestore = !!on;
}

function peekActive() {
  return !!(lastStatus && lastStatus.active);
}

/** Cached hide count — no CLI. */
function peekHiddenCount() {
  return Number(lastStatus?.hiddenCount) || 0;
}

async function readCloakActive() {
  return withQueue(async () => {
    const st = await runCtl(['status'], 2000);
    if (!st.ok) return null;
    const active = st.map.active === '1';
    if (lastStatus) lastStatus = { ...lastStatus, active };
    return active;
  });
}

async function verifyArmed(targets = []) {
  return withQueue(async () => {
    const st = await runCtl(['status'], 3000);
    if (!st.ok) return { ok: false, active: false, error: st.stderr };
    const active = st.map.active === '1';
    const hiddenCount = Number(st.map.blacklist || 0);
    if (lastStatus) {
      lastStatus = { ...lastStatus, active, hiddenCount };
    }
    const wanted = normalizeTargets(targets);
    return {
      ok: active && (hiddenCount > 0 || !wanted.length),
      active,
      hiddenCount,
    };
  });
}

function ctlPath() {
  return unpacked(path.join(__dirname, 'hidhide-ctl.exe'));
}

function findCli() {
  if (cachedCli && fs.existsSync(cachedCli)) return cachedCli;
  for (const p of CLI_CANDIDATES) {
    try {
      if (fs.existsSync(p)) {
        cachedCli = p;
        return p;
      }
    } catch {
      /* ignore */
    }
  }
  cachedCli = null;
  return null;
}

function resetCliCache() {
  cachedCli = null;
}

function driverInstalled() {
  try {
    if (fs.existsSync(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'drivers', 'HidHide.sys'))) {
      return true;
    }
  } catch {
    /* ignore */
  }
  return Boolean(findCli()) || fs.existsSync(ctlPath());
}

function virtualPadReady() {
  try {
    // eslint-disable-next-line global-require
    const vigem = require('./vigem-pad');
    const st = vigem.status?.() || {};
    return !!st.connected;
  } catch {
    return false;
  }
}

function isVirtualDevice(id) {
  const s = String(id || '').toLowerCase();
  if (!s) return true;
  if (
    s.includes('vigem')
    || s.includes('vigembus')
    || s.includes('nefarius')
    || s.includes('virtual')
    || s.includes('vhid')
    || s.includes('vgamepad')
  ) return true;
  if (/vid_045e&pid_028e/.test(s)) return true;
  if (/vid_045e&pid_02a1/.test(s)) return true;
  // ViGEm DS4 looks like Sony PID_05C4 without MI_ — never hide it.
  if (/vid_054c&pid_05c4/.test(s) && !/mi_\d+/.test(s)) return true;
  return false;
}

function withQueue(fn) {
  const job = chain.then(() => fn());
  chain = job.then(() => undefined, () => undefined);
  return job;
}

function parseKv(text) {
  const out = {};
  String(text || '').split(/\r?\n/).forEach((line) => {
    const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  });
  return out;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * HidHide Client (the config GUI) opens \\.\HidHide exclusively. While it is
 * running, hidhide-ctl gets Win32 ERROR_ACCESS_DENIED (5) and cloak cannot
 * arm. Closing only that GUI unlocks the control device — never touch the
 * HidHide driver service or Watchdog.
 */
function releaseHidHideClientLock() {
  try {
    // eslint-disable-next-line global-require
    const { execFileSync } = require('child_process');
    execFileSync(
      'taskkill',
      ['/IM', 'HidHideClient.exe', '/F'],
      { windowsHide: true, stdio: 'ignore', timeout: 3000 },
    );
    return true;
  } catch {
    return false;
  }
}

function isHidHideOpenDenied(result) {
  const err = String(result?.stderr || '');
  return /ERROR open\s+5\b/i.test(err)
    || /access is denied/i.test(err)
    || result?.code === 10;
}

function runCtlOnce(args, timeoutMs) {
  const exe = ctlPath();
  if (!fs.existsSync(exe)) {
    return Promise.resolve({
      ok: false,
      code: -1,
      stdout: '',
      stderr: 'hidhide-ctl.exe missing — rebuild the app tools.',
      map: {},
    });
  }

  return new Promise((resolve) => {
    let settled = false;
    let stdout = '';
    let stderr = '';
    let child;
    try {
      child = spawn(exe, args, {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      resolve({
        ok: false,
        code: -1,
        stdout: '',
        stderr: err?.message || String(err),
        map: {},
      });
      return;
    }

    const finish = (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const out = String(stdout || '');
      const err = String(stderr || '');
      const exit = Number.isInteger(code) ? code : -1;
      resolve({
        ok: exit === 0 && /ok=1/.test(out),
        code: exit,
        stdout: out,
        stderr: err,
        map: parseKv(out),
      });
    };

    const timer = setTimeout(() => {
      try { child.kill(); } catch { /* ignore */ }
      finish(-1);
    }, timeoutMs);

    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (c) => { stdout += c; });
    child.stderr?.on('data', (c) => { stderr += c; });
    child.on('error', (err) => {
      stderr += `\n${err?.message || String(err)}`;
      finish(-1);
    });
    child.on('exit', (code) => finish(code));
  });
}

async function runCtl(args, timeoutMs = 6000) {
  let last = await runCtlOnce(args, timeoutMs);
  let releasedClient = false;
  for (let i = 0; i < 5 && !last.ok; i += 1) {
    if (!isHidHideOpenDenied(last)) break;
    // First denial: close HidHide Client (exclusive lock), then retry.
    if (!releasedClient) {
      releasedClient = true;
      releaseHidHideClientLock();
      await sleep(200);
    } else {
      await sleep(120 * (i + 1));
    }
    last = await runCtlOnce(args, timeoutMs);
  }
  if (!last.ok && isHidHideOpenDenied(last)) {
    last = {
      ...last,
      stderr: 'HidHide is locked by HidHide Client. Close HidHide Client, then turn cloak on again.',
    };
  }
  return last;
}

function runPs(command, timeoutMs = 5000) {
  return new Promise((resolve) => {
    let settled = false;
    let stdout = '';
    let stderr = '';
    let child;
    try {
      child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command], {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      resolve({ ok: false, stdout: '', stderr: err?.message || String(err) });
      return;
    }
    const finish = (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        ok: code === 0,
        stdout: String(stdout || ''),
        stderr: String(stderr || ''),
      });
    };
    const timer = setTimeout(() => {
      try { child.kill(); } catch { /* ignore */ }
      finish(-1);
    }, timeoutMs);
    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (c) => { stdout += c; });
    child.stderr?.on('data', (c) => { stderr += c; });
    child.on('error', () => finish(-1));
    child.on('exit', (code) => finish(code));
  });
}

function appWhitelistPaths() {
  const paths = new Set();
  const add = (p) => {
    try {
      if (!p) return;
      const n = path.normalize(String(p));
      if (n && /\.exe$/i.test(n) && fs.existsSync(n)) paths.add(n);
    } catch {
      /* ignore */
    }
  };
  try { add(process.execPath); } catch { /* ignore */ }
  try { add(app.getPath('exe')); } catch { /* ignore */ }
  try { add(process.env.PORTABLE_EXECUTABLE_FILE); } catch { /* ignore */ }
  try {
    if (process.env.PORTABLE_EXECUTABLE_DIR) {
      add(path.join(process.env.PORTABLE_EXECUTABLE_DIR, path.basename(process.execPath || 'Aphrodite.exe')));
    }
  } catch {
    /* ignore */
  }
  return [...paths];
}

function normalizeTargets(targets) {
  return [...new Set(
    (Array.isArray(targets) ? targets : [])
      .map((t) => String(t || '').trim().replace(/\\+/g, '\\'))
      .filter((t) => t && !isVirtualDevice(t))
  )];
}

async function repairIfNeeded() {
  const st = await runCtl(['status']);
  if (st.ok) return { ok: true, repaired: false };
  const rep = await runCtl(['repair']);
  return { ok: rep.ok, repaired: true, detail: rep };
}

async function clearHideList() {
  return runCtl(['clear-blacklist'], 5000);
}

async function restorePadsForGames() {
  await repairIfNeeded();
  const r = await runCtl(['restore-games'], 5000);
  lastStatus = {
    ok: r.ok,
    installed: driverInstalled(),
    active: false,
    whitelisted: Number(lastStatus?.whitelisted ? 1 : 0) > 0,
    hiddenCount: 0,
    devices: [],
    note: 'Cloak off — your controller is visible to games again.',
    error: r.ok ? undefined : (r.stderr || 'Could not restore controller visibility.'),
  };
  return { ...lastStatus };
}

function statusPayload({
  active,
  hiddenCount,
  whitelisted,
  error,
  note,
  vigem,
}) {
  const vigemReady = virtualPadReady();
  const hiding = !!active && (Number(hiddenCount) || 0) > 0;
  let resolvedNote = note;
  if (!resolvedNote && !error) {
    if (active && hiding && vigemReady) {
      resolvedNote = 'Cloak on — games only see the virtual pad.';
    } else if (active && hiding) {
      resolvedNote = 'Cloak on — waiting for virtual pad…';
    } else if (active) {
      resolvedNote = 'Cloak armed. Connect a controller, then toggle again if games still see the physical pad.';
    } else {
      resolvedNote = 'Turn cloak on to hide your pad and start the matching virtual controller.';
    }
  }
  lastStatus = {
    ok: !error,
    installed: true,
    active: !!active,
    whitelisted: !!whitelisted,
    hiddenCount: Number(hiddenCount) || 0,
    devices: [],
    cli: findCli(),
    error,
    note: resolvedNote,
    vigem: vigem || undefined,
    target: vigem?.target || undefined,
  };
  return { ...lastStatus };
}

async function getStatus() {
  return withQueue(async () => {
    const installed = driverInstalled();
    if (!installed) {
      lastStatus = {
        ok: false,
        installed: false,
        active: false,
        whitelisted: false,
        devices: [],
        error: 'HidHide is not installed. Use Install on this card first.',
      };
      return { ...lastStatus };
    }

    await repairIfNeeded();
    const st = await runCtl(['status']);
    if (!st.ok) {
      lastStatus = {
        ok: false,
        installed: true,
        active: false,
        whitelisted: false,
        devices: [],
        error: st.stderr || 'Could not talk to HidHide. Try Install again, then reboot if needed.',
      };
      return { ...lastStatus };
    }

    const active = st.map.active === '1';
    const hiddenCount = Number(st.map.blacklist || 0);

    // Do not auto-restore here — activateDualPad hides first then plugs ViGEm.
    // A status poll mid-arm would otherwise tear cloak down. Boot heal is in
    // ensureSafeForGames().
    return statusPayload({
      active,
      hiddenCount,
      whitelisted: Number(st.map.whitelist || 0) > 0,
    });
  });
}

/**
 * Hide physical targets and turn cloak on.
 * @param {string[]} [targets]
 * @param {{ merge?: boolean }} [opts] merge=true adds targets without clearing the hide list
 */
async function enable(targets = [], opts = {}) {
  const merge = !!opts.merge;
  return withQueue(async () => {
    if (!driverInstalled()) {
      return {
        ok: false,
        installed: false,
        active: false,
        error: 'HidHide is not installed. Use Install on this card first.',
      };
    }

    const wanted = normalizeTargets(targets);
    if (!wanted.length) {
      return {
        ok: false,
        installed: true,
        active: false,
        error: 'Connect your controller first, then turn cloak on.',
      };
    }

    await repairIfNeeded();

    const paths = appWhitelistPaths();
    if (paths.length) {
      const wl = await runCtl(['ensure-whitelist', ...paths]);
      if (!wl.ok) {
        return statusPayload({
          active: false,
          hiddenCount: 0,
          whitelisted: false,
          error: wl.stderr || 'Could not whitelist this app in HidHide.',
        });
      }
    }

    await runCtl(['set-inverse', '0'], 3000);
    // Fresh hide list on first arm only — merge path must not flash pads back.
    if (!merge) await clearHideList();
    for (const id of wanted) {
      // eslint-disable-next-line no-await-in-loop
      const hid = await runCtl(['hide-device', id], 4000);
      if (!hid.ok) {
        if (!merge) await runCtl(['restore-games'], 5000);
        return statusPayload({
          active: false,
          hiddenCount: 0,
          whitelisted: true,
          error: hid.stderr || `Could not hide controller (${id}).`,
        });
      }
    }

    const on = await runCtl(['set-active', '1'], 4000);
    const active = on.ok && on.map.active === '1';
    if (!active) {
      if (!merge) await runCtl(['restore-games'], 5000);
      return statusPayload({
        active: false,
        hiddenCount: 0,
        whitelisted: true,
        error: on.stderr || 'Could not turn cloak on.',
      });
    }

    const st = await runCtl(['status']);
    return statusPayload({
      active: true,
      hiddenCount: Number(st.map?.blacklist || wanted.length),
      whitelisted: true,
      note: 'Physical pad hidden — starting virtual controller…',
    });
  });
}

async function disable() {
  return withQueue(async () => {
    if (!driverInstalled()) {
      return {
        ok: false,
        installed: false,
        active: false,
        error: 'HidHide is not installed.',
      };
    }
    return restorePadsForGames();
  });
}

async function setEnabled(on, targets = []) {
  return on ? enable(targets) : disable();
}

async function expandTargets(instancePaths) {
  const out = new Map();
  const add = (raw) => {
    const id = String(raw || '').trim().replace(/\\+/g, '\\');
    if (!id || isVirtualDevice(id)) return;
    const key = id.toLowerCase();
    if (!out.has(key)) out.set(key, id);
  };

  for (const raw of instancePaths || []) {
    const id = String(raw || '').trim().replace(/\\+/g, '\\');
    if (!id || isVirtualDevice(id)) continue;
    add(id);
    const vidPid = id.match(/vid_[0-9a-f]{4}&pid_[0-9a-f]{4}/i)?.[0];
    if (!vidPid) continue;
    try {
      const ps = `
$ErrorActionPreference='SilentlyContinue'
$id = '${id.replace(/'/g, "''")}'
$vidPid = '${vidPid.replace(/'/g, "''")}'
$parent = (Get-PnpDeviceProperty -InstanceId $id -KeyName 'DEVPKEY_Device_Parent' -ErrorAction SilentlyContinue).Data
Get-PnpDevice -PresentOnly -ErrorAction SilentlyContinue |
  Where-Object { $_.InstanceId -and ($_.InstanceId -match [regex]::Escape($vidPid)) } |
  ForEach-Object { $_.InstanceId }
if ($parent) { $parent }
if ($parent) {
  $gp = (Get-PnpDeviceProperty -InstanceId $parent -KeyName 'DEVPKEY_Device_Parent' -ErrorAction SilentlyContinue).Data
  if ($gp) { $gp }
}
`;
      const res = await runPs(ps, 5000);
      for (const line of String(res.stdout || '').split(/\r?\n/)) {
        add(line.trim());
      }
    } catch {
      /* keep original */
    }
  }
  return [...out.values()];
}

async function postInstallHeal() {
  return withQueue(async () => {
    resetCliCache();
    await runCtl(['repair']);
    const restored = await runCtl(['restore-games'], 5000);
    const st = await runCtl(['status']);
    return {
      ok: restored.ok || st.ok,
      repaired: true,
      active: false,
      error: (restored.ok || st.ok) ? undefined : (st.stderr || 'HidHide device not ready — a reboot may be required.'),
    };
  });
}

async function ensureSafeForGames() {
  return withQueue(async () => {
    if (!driverInstalled()) {
      return { ok: true, skipped: true };
    }
    await repairIfNeeded();
    const st = await runCtl(['status']);
    if (!st.ok) {
      return { ok: false, error: st.stderr };
    }
    const hiddenCount = Number(st.map.blacklist || 0);
    const active = st.map.active === '1';
    // Dual-pad arm: enable() finishes before ViGEm plugs. Restoring here
    // un-hides the physical pad while macros still write to ViGEm — dead macros.
    if (suppressSafeRestore) {
      return statusPayload({
        active,
        hiddenCount,
        whitelisted: Number(st.map.whitelist || 0) > 0,
        note: 'Cloak arm in progress — skipping restore.',
      });
    }
    if (!virtualPadReady() && (hiddenCount > 0 || active)) {
      await runCtl(['restore-games'], 5000);
      return statusPayload({
        active: false,
        hiddenCount: 0,
        whitelisted: Number(st.map.whitelist || 0) > 0,
        note: 'Cloak cleared on startup so games can see your controller.',
      });
    }
    return statusPayload({
      active,
      hiddenCount,
      whitelisted: Number(st.map.whitelist || 0) > 0,
    });
  });
}

function controlDevicePresent() {
  return driverInstalled();
}

module.exports = {
  findCli,
  resetCliCache,
  controlDevicePresent,
  driverInstalled,
  virtualPadReady,
  isVirtualDevice,
  expandTargets,
  getStatus,
  enable,
  disable,
  setEnabled,
  setSuppressSafeRestore,
  peekActive,
  peekHiddenCount,
  readCloakActive,
  verifyArmed,
  postInstallHeal,
  restorePadsForGames,
  ensureSafeForGames,
  appWhitelistPaths,
};
