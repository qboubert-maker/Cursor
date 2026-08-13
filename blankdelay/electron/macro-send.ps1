param([string]$Keys, [int]$DelayMs = 20, [string]$Mode = 'once', [int]$Repeat = 8)

# BlankDelay macro sender — scancode SendInput so DirectX games (Fortnite) receive the input.
# SendKeys/WM_ messages are ignored by most games; scancodes behave like a real keyboard.

Add-Type @"
using System;
using System.Runtime.InteropServices;

public class BdSend {
    [StructLayout(LayoutKind.Sequential)]
    public struct MOUSEINPUT { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
    [StructLayout(LayoutKind.Sequential)]
    public struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
    [StructLayout(LayoutKind.Explicit)]
    public struct INPUTUNION {
        [FieldOffset(0)] public MOUSEINPUT mi;
        [FieldOffset(0)] public KEYBDINPUT ki;
    }
    [StructLayout(LayoutKind.Sequential)]
    public struct INPUT { public uint type; public INPUTUNION u; }

    [DllImport("user32.dll", SetLastError = true)]
    public static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

    const uint INPUT_MOUSE = 0;
    const uint INPUT_KEYBOARD = 1;
    const uint KEYEVENTF_KEYUP = 0x0002;
    const uint KEYEVENTF_SCANCODE = 0x0008;
    const uint KEYEVENTF_EXTENDEDKEY = 0x0001;

    const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    const uint MOUSEEVENTF_LEFTUP = 0x0004;
    const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
    const uint MOUSEEVENTF_RIGHTUP = 0x0010;
    const uint MOUSEEVENTF_MIDDLEDOWN = 0x0020;
    const uint MOUSEEVENTF_MIDDLEUP = 0x0040;
    const uint MOUSEEVENTF_XDOWN = 0x0080;
    const uint MOUSEEVENTF_XUP = 0x0100;
    const uint MOUSEEVENTF_WHEEL = 0x0800;

    static INPUT KeyInput(ushort scan, bool up, bool extended) {
        INPUT i = new INPUT();
        i.type = INPUT_KEYBOARD;
        i.u.ki.wVk = 0;
        i.u.ki.wScan = scan;
        i.u.ki.dwFlags = KEYEVENTF_SCANCODE | (up ? KEYEVENTF_KEYUP : 0) | (extended ? KEYEVENTF_EXTENDEDKEY : 0);
        i.u.ki.time = 0;
        i.u.ki.dwExtraInfo = IntPtr.Zero;
        return i;
    }

    static INPUT MouseInput(uint flags, uint data) {
        INPUT i = new INPUT();
        i.type = INPUT_MOUSE;
        i.u.mi.dwFlags = flags;
        i.u.mi.mouseData = data;
        return i;
    }

    public static void KeyDown(ushort scan, bool extended) { SendInput(1, new INPUT[] { KeyInput(scan, false, extended) }, Marshal.SizeOf(typeof(INPUT))); }
    public static void KeyUp(ushort scan, bool extended) { SendInput(1, new INPUT[] { KeyInput(scan, true, extended) }, Marshal.SizeOf(typeof(INPUT))); }

    public static void MouseDown(int button) {
        if (button == 0) SendInput(1, new INPUT[] { MouseInput(MOUSEEVENTF_LEFTDOWN, 0) }, Marshal.SizeOf(typeof(INPUT)));
        else if (button == 1) SendInput(1, new INPUT[] { MouseInput(MOUSEEVENTF_RIGHTDOWN, 0) }, Marshal.SizeOf(typeof(INPUT)));
        else if (button == 2) SendInput(1, new INPUT[] { MouseInput(MOUSEEVENTF_MIDDLEDOWN, 0) }, Marshal.SizeOf(typeof(INPUT)));
        else if (button == 3) SendInput(1, new INPUT[] { MouseInput(MOUSEEVENTF_XDOWN, 1) }, Marshal.SizeOf(typeof(INPUT)));
        else if (button == 4) SendInput(1, new INPUT[] { MouseInput(MOUSEEVENTF_XDOWN, 2) }, Marshal.SizeOf(typeof(INPUT)));
    }
    public static void MouseUp(int button) {
        if (button == 0) SendInput(1, new INPUT[] { MouseInput(MOUSEEVENTF_LEFTUP, 0) }, Marshal.SizeOf(typeof(INPUT)));
        else if (button == 1) SendInput(1, new INPUT[] { MouseInput(MOUSEEVENTF_RIGHTUP, 0) }, Marshal.SizeOf(typeof(INPUT)));
        else if (button == 2) SendInput(1, new INPUT[] { MouseInput(MOUSEEVENTF_MIDDLEUP, 0) }, Marshal.SizeOf(typeof(INPUT)));
        else if (button == 3) SendInput(1, new INPUT[] { MouseInput(MOUSEEVENTF_XUP, 1) }, Marshal.SizeOf(typeof(INPUT)));
        else if (button == 4) SendInput(1, new INPUT[] { MouseInput(MOUSEEVENTF_XUP, 2) }, Marshal.SizeOf(typeof(INPUT)));
    }
    public static void Wheel(int delta) { SendInput(1, new INPUT[] { MouseInput(MOUSEEVENTF_WHEEL, (uint)delta) }, Marshal.SizeOf(typeof(INPUT))); }
}
"@ -ErrorAction SilentlyContinue

# Set-1 scancodes — what the game actually reads
$SC = @{
    'A'=0x1E; 'B'=0x30; 'C'=0x2E; 'D'=0x20; 'E'=0x12; 'F'=0x21; 'G'=0x22; 'H'=0x23; 'I'=0x17
    'J'=0x24; 'K'=0x25; 'L'=0x26; 'M'=0x32; 'N'=0x31; 'O'=0x18; 'P'=0x19; 'Q'=0x10; 'R'=0x13
    'S'=0x1F; 'T'=0x14; 'U'=0x16; 'V'=0x2F; 'W'=0x11; 'X'=0x2D; 'Y'=0x15; 'Z'=0x2C
    '1'=0x02; '2'=0x03; '3'=0x04; '4'=0x05; '5'=0x06; '6'=0x07; '7'=0x08; '8'=0x09; '9'=0x0A; '0'=0x0B
    'MINUS'=0x0C; 'EQUALS'=0x0D; 'BACKSPACE'=0x0E; 'TAB'=0x0F
    'LBRACKET'=0x1A; 'RBRACKET'=0x1B; 'ENTER'=0x1C; 'RETURN'=0x1C
    'LCTRL'=0x1D; 'CTRL'=0x1D; 'CONTROL'=0x1D
    'SEMICOLON'=0x27; 'APOSTROPHE'=0x28; 'GRAVE'=0x29
    'LSHIFT'=0x2A; 'SHIFT'=0x2A; 'BACKSLASH'=0x2B
    'COMMA'=0x33; 'PERIOD'=0x34; 'SLASH'=0x35; 'RSHIFT'=0x36
    'LALT'=0x38; 'ALT'=0x38; 'SPACE'=0x39; 'CAPSLOCK'=0x3A
    'F1'=0x3B; 'F2'=0x3C; 'F3'=0x3D; 'F4'=0x3E; 'F5'=0x3F; 'F6'=0x40
    'F7'=0x41; 'F8'=0x42; 'F9'=0x43; 'F10'=0x44; 'F11'=0x57; 'F12'=0x58
    'ESC'=0x01; 'ESCAPE'=0x01
    'UP'=0x48; 'DOWN'=0x50; 'LEFT'=0x4B; 'RIGHT'=0x4D
    'RCTRL'=0x1D; 'RALT'=0x38
}
$EXTENDED = @('UP','DOWN','LEFT','RIGHT','RCTRL','RALT')
$MOUSE = @{ 'LMB'=0; 'MOUSE1'=0; 'RMB'=1; 'MOUSE2'=1; 'MMB'=2; 'MOUSE3'=2; 'M4'=3; 'MOUSE4'=3; 'M5'=4; 'MOUSE5'=4 }

function Send-Token($token) {
    $k = $token.Trim().ToUpper()
    if ($k -eq '') { return }

    # HOLD:KEY / RELEASE:KEY for press-and-hold sequences
    if ($k -match '^(HOLD|KEYDOWN):(.+)$') {
        $name = $Matches[2]
        if ($MOUSE.ContainsKey($name)) { [BdSend]::MouseDown($MOUSE[$name]); return }
        if ($SC.ContainsKey($name)) { [BdSend]::KeyDown([uint16]$SC[$name], ($EXTENDED -contains $name)); return }
        return
    }
    if ($k -match '^(RELEASE|KEYUP):(.+)$') {
        $name = $Matches[2]
        if ($MOUSE.ContainsKey($name)) { [BdSend]::MouseUp($MOUSE[$name]); return }
        if ($SC.ContainsKey($name)) { [BdSend]::KeyUp([uint16]$SC[$name], ($EXTENDED -contains $name)); return }
        return
    }

    if ($k -eq 'SCROLLUP') { [BdSend]::Wheel(120); return }
    if ($k -eq 'SCROLLDOWN') { [BdSend]::Wheel(-120); return }

    if ($MOUSE.ContainsKey($k)) {
        $b = $MOUSE[$k]
        [BdSend]::MouseDown($b)
        Start-Sleep -Milliseconds 8
        [BdSend]::MouseUp($b)
        return
    }

    if ($SC.ContainsKey($k)) {
        $ext = $EXTENDED -contains $k
        [BdSend]::KeyDown([uint16]$SC[$k], $ext)
        Start-Sleep -Milliseconds 8
        [BdSend]::KeyUp([uint16]$SC[$k], $ext)
        return
    }
}

$tokens = $Keys -split '\+'
$iter = if ($Mode -eq 'repeat') { [Math]::Max(1, $Repeat) } else { 1 }
for ($r = 0; $r -lt $iter; $r++) {
    foreach ($t in $tokens) {
        Send-Token $t
        if ($DelayMs -gt 0) { Start-Sleep -Milliseconds $DelayMs }
    }
}
