import { execFileSync, spawn } from 'node:child_process'

const TYPE = 'Add-Type -Namespace BlankOpt -Name Taskbar -MemberDefinition \'[DllImport("user32.dll")] public static extern System.IntPtr FindWindowEx(System.IntPtr p, System.IntPtr a, string c, string t); [DllImport("user32.dll")] public static extern bool ShowWindow(System.IntPtr h, int s); public static void Set(int show) { foreach (var cls in new[] { "Shell_TrayWnd", "Shell_SecondaryTrayWnd" }) { var h = System.IntPtr.Zero; while ((h = FindWindowEx(System.IntPtr.Zero, h, cls, null)) != System.IntPtr.Zero) ShowWindow(h, show == 1 ? 5 : 0); } }\''

const LOOP = `${TYPE}; try { while ($null -ne ($line = [Console]::In.ReadLine())) { [BlankOpt.Taskbar]::Set([int]$line) } } finally { [BlankOpt.Taskbar]::Set(1) }`

const PS_ARGS = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command']

let helper = null
let hidden = false
let watchdogStarted = false

function encode(script) {
  return Buffer.from(script, 'utf16le').toString('base64')
}

// Runs outside the app's process job, so it outlives a crash or force-kill and brings the taskbar back.
function startWatchdog() {
  if (watchdogStarted) return
  watchdogStarted = true
  const watch = encode(`${TYPE}; Wait-Process -Id ${process.pid} -ErrorAction SilentlyContinue; [BlankOpt.Taskbar]::Set(1)`)
  spawn('powershell.exe', [
    ...PS_ARGS,
    `Start-Process powershell.exe -WindowStyle Hidden -ArgumentList '-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-EncodedCommand','${watch}'`,
  ], { windowsHide: true, stdio: 'ignore' })
}

function ensureHelper() {
  if (helper || process.platform !== 'win32') return helper
  startWatchdog()
  helper = spawn('powershell.exe', [...PS_ARGS, LOOP], {
    windowsHide: true,
    stdio: ['pipe', 'ignore', 'ignore'],
  })
  helper.on('exit', () => {
    helper = null
    hidden = false
  })
  return helper
}

export function setTaskbarHidden(hide) {
  if (hide === hidden) return
  const ps = ensureHelper()
  if (!ps) return
  hidden = hide
  ps.stdin.write(`${hide ? 0 : 1}\n`)
}

export function restoreTaskbarNow() {
  if (process.platform !== 'win32') return
  hidden = false
  try {
    helper?.stdin.end()
  } catch {
    // already gone
  }
  helper = null
  try {
    execFileSync('powershell.exe', [...PS_ARGS, `${TYPE}; [BlankOpt.Taskbar]::Set(1)`], {
      windowsHide: true,
      timeout: 8000,
    })
  } catch {
    // best effort
  }
}

export function warmTaskbarGuard() {
  ensureHelper()
}
