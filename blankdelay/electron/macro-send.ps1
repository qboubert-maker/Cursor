param([string]$Keys, [int]$DelayMs = 20, [string]$Mode = 'once', [int]$Repeat = 8)

Add-Type -AssemblyName System.Windows.Forms

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class BdInput {
    [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);
    [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
    public const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    public const uint MOUSEEVENTF_LEFTUP = 0x0004;
    public const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
    public const uint MOUSEEVENTF_RIGHTUP = 0x0010;
    public const uint MOUSEEVENTF_MIDDLEDOWN = 0x0020;
    public const uint MOUSEEVENTF_MIDDLEUP = 0x0040;
    public const uint MOUSEEVENTF_XDOWN = 0x0080;
    public const uint MOUSEEVENTF_XUP = 0x0100;
    public const uint MOUSEEVENTF_WHEEL = 0x0800;
    public const uint KEYEVENTF_KEYUP = 0x0002;
    public static void ClickLeft() { mouse_event(MOUSEEVENTF_LEFTDOWN|MOUSEEVENTF_LEFTUP,0,0,0,UIntPtr.Zero); }
    public static void ClickRight() { mouse_event(MOUSEEVENTF_RIGHTDOWN|MOUSEEVENTF_RIGHTUP,0,0,0,UIntPtr.Zero); }
    public static void Scroll(int delta) { mouse_event(MOUSEEVENTF_WHEEL,0,0,(uint)delta,UIntPtr.Zero); }
    public static void KeyDown(byte vk) { keybd_event(vk,0,0,UIntPtr.Zero); }
    public static void KeyUp(byte vk) { keybd_event(vk,0,KEYEVENTF_KEYUP,UIntPtr.Zero); }
}
"@

function Send-Part($part) {
    $k = $part.Trim().ToUpper()
    switch ($k) {
        'LMB' { [BdInput]::ClickLeft() }
        'RMB' { [BdInput]::ClickRight() }
        'MMB' { [BdInput]::mouse_event(0x0020 -bor 0x0040,0,0,0,[UIntPtr]::Zero) }
        'M4' { [BdInput]::mouse_event(0x0080,0,0,0x0001,[UIntPtr]::Zero); [BdInput]::mouse_event(0x0100,0,0,0x0001,[UIntPtr]::Zero) }
        'M5' { [BdInput]::mouse_event(0x0080,0,0,0x0002,[UIntPtr]::Zero); [BdInput]::mouse_event(0x0100,0,0,0x0002,[UIntPtr]::Zero) }
        'SCROLLUP' { [BdInput]::Scroll(120) }
        'SCROLLDOWN' { [BdInput]::Scroll(-120) }
        'SPACE' { [System.Windows.Forms.SendKeys]::SendWait(' ') }
        'ENTER' { [System.Windows.Forms.SendKeys]::SendWait('{ENTER}') }
        'TAB' { [System.Windows.Forms.SendKeys]::SendWait('{TAB}') }
        'SHIFT' { [System.Windows.Forms.SendKeys]::SendWait('+') }
        'CTRL' { [System.Windows.Forms.SendKeys]::SendWait('^') }
        'LCTRL' {
            [BdInput]::KeyDown(0x11)
            Start-Sleep -Milliseconds 8
            [BdInput]::KeyUp(0x11)
        }
        'RCTRL' {
            [BdInput]::KeyDown(0x11)
            Start-Sleep -Milliseconds 8
            [BdInput]::KeyUp(0x11)
        }
        'ALT' { [System.Windows.Forms.SendKeys]::SendWait('%') }
        'ESC' { [System.Windows.Forms.SendKeys]::SendWait('{ESC}') }
        default {
            if ($k -match '^KEYDOWN:(.+)$') {
                $vk = Get-Vk $Matches[1]
                if ($vk) { [BdInput]::KeyDown($vk) }
            } elseif ($k -match '^KEYUP:(.+)$') {
                $vk = Get-Vk $Matches[1]
                if ($vk) { [BdInput]::KeyUp($vk) }
            } elseif ($k -eq 'KEYDOWN:LMB') {
                [BdInput]::mouse_event(0x0002,0,0,0,[UIntPtr]::Zero)
            } elseif ($k -eq 'KEYUP:LMB') {
                [BdInput]::mouse_event(0x0004,0,0,0,[UIntPtr]::Zero)
            } elseif ($k -eq 'KEYDOWN:RMB') {
                [BdInput]::mouse_event(0x0008,0,0,0,[UIntPtr]::Zero)
            } elseif ($k -eq 'KEYUP:RMB') {
                [BdInput]::mouse_event(0x0010,0,0,0,[UIntPtr]::Zero)
            } elseif ($k.Length -eq 1) {
                [System.Windows.Forms.SendKeys]::SendWait($k.ToLower())
            } else {
                [System.Windows.Forms.SendKeys]::SendWait('{' + $k + '}')
            }
        }
    }
}

function Get-Vk($name) {
    switch ($name.ToUpper()) {
        'SHIFT' { return 0x10 }
        'CTRL' { return 0x11 }
        'ALT' { return 0x12 }
        'SPACE' { return 0x20 }
        default {
            if ($name.Length -eq 1) { return [byte][char]$name.ToUpper() }
        }
    }
    return $null
}

$parts = $Keys -split '\+'
$iter = if ($Mode -eq 'repeat') { [Math]::Max(1, $Repeat) } else { 1 }
for ($r = 0; $r -lt $iter; $r++) {
    foreach ($part in $parts) {
        Send-Part $part
        Start-Sleep -Milliseconds $DelayMs
    }
}
