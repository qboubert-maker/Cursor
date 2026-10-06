'use strict';

/**
 * Detect when a game (Fortnite) owns the foreground so we can tear down the
 * Chromium settings window and free GPU/CPU for the match.
 */

const koffi = require('koffi');

const GAME_EXE_RE = /fortniteclient-win64-shipping(?:_eac_eos)?\.exe$/i;

let ready = false;
let GetForegroundWindow;
let GetWindowThreadProcessId;
let OpenProcess;
let QueryFullProcessImageNameA;
let CloseHandle;

function init() {
  if (ready || process.platform !== 'win32') return ready;
  try {
    const user32 = koffi.load('user32.dll');
    const kernel32 = koffi.load('kernel32.dll');
    GetForegroundWindow = user32.func('uintptr __stdcall GetForegroundWindow()');
    GetWindowThreadProcessId = user32.func(
      'uint32 __stdcall GetWindowThreadProcessId(uintptr hWnd, _Out_ uint32 *lpdwProcessId)',
    );
    OpenProcess = kernel32.func(
      'uintptr __stdcall OpenProcess(uint32 dwDesiredAccess, int bInheritHandle, uint32 dwProcessId)',
    );
    QueryFullProcessImageNameA = kernel32.func(
      'int __stdcall QueryFullProcessImageNameA(uintptr hProcess, uint32 dwFlags, char *lpExeName, _Inout_ uint32 *lpdwSize)',
    );
    CloseHandle = kernel32.func('int __stdcall CloseHandle(uintptr hObject)');
    ready = true;
  } catch (err) {
    console.warn('[game-focus] unavailable:', err?.message || err);
    ready = false;
  }
  return ready;
}

function foregroundExePath() {
  if (!init()) return '';
  try {
    const hwnd = GetForegroundWindow();
    if (!hwnd) return '';
    const pidOut = [0];
    GetWindowThreadProcessId(hwnd, pidOut);
    const pid = pidOut[0] >>> 0;
    if (!pid) return '';
    const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;
    const handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
    if (!handle) return '';
    try {
      const size = [520];
      const buf = Buffer.alloc(520);
      const ok = QueryFullProcessImageNameA(handle, 0, buf, size);
      if (!ok) return '';
      return buf.toString('utf8', 0, Math.max(0, (size[0] || 0))).replace(/\0/g, '');
    } finally {
      try { CloseHandle(handle); } catch (_) { /* ignore */ }
    }
  } catch (_) {
    return '';
  }
}

function isGameForeground() {
  const path = foregroundExePath();
  if (!path) return false;
  const base = path.split(/[/\\]/).pop() || path;
  return GAME_EXE_RE.test(base);
}

module.exports = {
  isGameForeground,
  foregroundExePath,
  GAME_EXE_RE,
};
