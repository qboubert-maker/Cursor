/**
 * Cross-build singleton.
 *
 * Electron's requestSingleInstanceLock is per userData folder. Portable builds
 * unpack to a new temp path every launch, so file + mutex locks in a fixed
 * machine path are required. Two copies = two ViGEm pads = choppy / ruined sticks.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const LOCK_DIR = path.join(process.env.ProgramData || 'C:\\ProgramData', 'Aphrodite');
const LOCK_FILE = path.join(LOCK_DIR, 'controller-macro.singleton');
const LOCK_FILE_FALLBACK = path.join(
  process.env.LOCALAPPDATA || process.env.TEMP || LOCK_DIR,
  'Aphrodite',
  'controller-macro.singleton',
);
const MUTEX_NAME = 'Local\\AphroditeControllerMacroSingleton';

let mutexHandle = null;

function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err && err.code === 'EPERM';
  }
}

function lockPaths() {
  return [LOCK_FILE, LOCK_FILE_FALLBACK];
}

function readLockAt(file) {
  try {
    const raw = fs.readFileSync(file, 'utf8').trim();
    const pid = Number(String(raw).split(/\r?\n/)[0]);
    return Number.isInteger(pid) ? pid : null;
  } catch {
    return null;
  }
}

function findLiveOwner() {
  for (const file of lockPaths()) {
    const pid = readLockAt(file);
    if (pid && pid !== process.pid && pidAlive(pid)) return { pid, file };
  }
  return null;
}

function clearStaleLocks() {
  for (const file of lockPaths()) {
    const existing = readLockAt(file);
    if (existing == null) continue;
    if (existing === process.pid || !pidAlive(existing)) {
      try { fs.unlinkSync(file); } catch (_) { /* ignore */ }
    }
  }
}

function tryClaimAt(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const fd = fs.openSync(file, 'wx');
  try {
    fs.writeFileSync(fd, `${process.pid}\n`, 'utf8');
  } finally {
    try { fs.closeSync(fd); } catch (_) { /* ignore */ }
  }
}

function writePidMirror(file) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    // Exclusive replace: remove then wx so we never silently share ownership.
    try { fs.unlinkSync(file); } catch (_) { /* ignore */ }
    tryClaimAt(file);
  } catch (_) { /* ignore */ }
}

/** OS mutex — survives portable temp dirs and blocks same-machine doubles. */
function tryAcquireMutex() {
  if (process.platform !== 'win32') return { ok: true };
  try {
    // eslint-disable-next-line global-require
    const koffi = require('koffi');
    const kernel32 = koffi.load('kernel32.dll');
    const CreateMutexA = kernel32.func(
      'uintptr __stdcall CreateMutexA(uintptr lpMutexAttributes, int bInitialOwner, str lpName)',
    );
    const CloseHandle = kernel32.func('int __stdcall CloseHandle(uintptr hObject)');
    const GetLastError = kernel32.func('uint32 __stdcall GetLastError()');
    const ERROR_ALREADY_EXISTS = 183;

    const handle = CreateMutexA(0, 1, MUTEX_NAME);
    if (!handle) return { ok: false, reason: 'mutex-create-failed' };
    const err = GetLastError();
    if (err === ERROR_ALREADY_EXISTS) {
      try { CloseHandle(handle); } catch (_) { /* ignore */ }
      return { ok: false, reason: 'mutex-held' };
    }
    mutexHandle = { handle, CloseHandle };
    return { ok: true };
  } catch (err) {
    console.warn('[singleton] mutex unavailable:', err?.message || err);
    return { ok: true, soft: true };
  }
}

function releaseMutex() {
  if (!mutexHandle) return;
  try { mutexHandle.CloseHandle(mutexHandle.handle); } catch (_) { /* ignore */ }
  mutexHandle = null;
}

/**
 * @returns {{ ok: boolean, otherPid?: number, reason?: string }}
 */
function acquire() {
  const mutex = tryAcquireMutex();
  if (!mutex.ok) {
    const live = findLiveOwner();
    return { ok: false, otherPid: live?.pid, reason: mutex.reason || 'mutex' };
  }

  const live = findLiveOwner();
  if (live) {
    releaseMutex();
    return { ok: false, otherPid: live.pid, reason: 'pid-file' };
  }

  clearStaleLocks();

  const targets = lockPaths();
  for (const file of targets) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const blocked = findLiveOwner();
      if (blocked) {
        releaseMutex();
        return { ok: false, otherPid: blocked.pid, reason: 'pid-file' };
      }
      try {
        tryClaimAt(file);
        const owner = readLockAt(file);
        if (owner === process.pid) {
          for (const other of targets) {
            if (other !== file) writePidMirror(other);
          }
          return { ok: true };
        }
        if (owner && pidAlive(owner)) {
          releaseMutex();
          return { ok: false, otherPid: owner, reason: 'pid-file' };
        }
      } catch (err) {
        if (err && err.code === 'EEXIST') {
          const again = readLockAt(file);
          if (again && again !== process.pid && pidAlive(again)) {
            releaseMutex();
            return { ok: false, otherPid: again, reason: 'pid-file' };
          }
          try { fs.unlinkSync(file); } catch (_) { /* ignore */ }
          continue;
        }
        break;
      }
    }
  }

  // Mutex alone is enough to block doubles. Keep running if file paths are locked down.
  if (mutex.ok && !mutex.soft) {
    console.warn('[singleton] pid file unavailable — relying on OS mutex');
    return { ok: true, reason: 'mutex-only' };
  }

  releaseMutex();
  console.error('[singleton] could not create lock — refusing launch');
  return { ok: false, reason: 'no-lock' };
}

function release() {
  for (const file of lockPaths()) {
    try {
      const owner = readLockAt(file);
      if (owner === process.pid) fs.unlinkSync(file);
    } catch { /* ignore */ }
  }
  releaseMutex();
}

module.exports = { acquire, release, LOCK_FILE, LOCK_FILE_FALLBACK };
