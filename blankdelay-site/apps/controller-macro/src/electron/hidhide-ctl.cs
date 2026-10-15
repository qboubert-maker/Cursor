// Aphrodite HidHide control helper — talks to \\.\HidHide via IOCTL.
// Avoids HidHideCLI constructor crash when the whitelist is bloated (0x0057).
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
using Microsoft.Win32.SafeHandles;

internal static class Program
{
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern SafeFileHandle CreateFile(string name, uint access, uint share, IntPtr sec, uint disp, uint flags, IntPtr template);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool DeviceIoControl(SafeFileHandle h, uint code, byte[] inBuf, uint inSize, byte[] outBuf, uint outSize, out uint returned, IntPtr overlapped);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern uint QueryDosDevice(string name, StringBuilder path, uint max);

    const uint GENERIC_READ = 0x80000000;
    const uint OPEN_EXISTING = 3;
    const uint FILE_ATTRIBUTE_NORMAL = 0x80;
    const uint SHARE = 7;

    static uint Ctl(uint fn) { return (32769u << 16) | (1u << 14) | (fn << 2); }
    static readonly uint GET_WL = Ctl(2048);
    static readonly uint SET_WL = Ctl(2049);
    static readonly uint GET_BL = Ctl(2050);
    static readonly uint SET_BL = Ctl(2051);
    static readonly uint GET_ACT = Ctl(2052);
    static readonly uint SET_ACT = Ctl(2053);
    static readonly uint GET_INV = Ctl(2054);
    static readonly uint SET_INV = Ctl(2055);

    static int Main(string[] args)
    {
        try
        {
            if (args.Length == 0) { PrintHelp(); return 2; }
            string cmd = args[0].ToLowerInvariant();
            using (var h = Open())
            {
                if (h.IsInvalid)
                {
                    Console.Error.WriteLine("ERROR open " + Marshal.GetLastWin32Error());
                    return 10;
                }

                if (cmd == "status")
                {
                    bool active = GetActive(h);
                    var wl = GetMulti(h, GET_WL);
                    var bl = GetMulti(h, GET_BL);
                    Console.WriteLine("active=" + (active ? "1" : "0"));
                    Console.WriteLine("whitelist=" + wl.Count);
                    Console.WriteLine("blacklist=" + bl.Count);
                    Console.WriteLine("ok=1");
                    return 0;
                }

                if (cmd == "repair")
                {
                    // Wipe bloated whitelist that breaks HidHideCLI (error 0x0057).
                    SetMulti(h, SET_WL, new List<string>());
                    Console.WriteLine("repaired=1");
                    Console.WriteLine("ok=1");
                    return 0;
                }

                if (cmd == "set-active")
                {
                    if (args.Length < 2) { Console.Error.WriteLine("ERROR missing 0|1"); return 2; }
                    bool on = args[1] == "1" || args[1].Equals("true", StringComparison.OrdinalIgnoreCase) || args[1].Equals("on", StringComparison.OrdinalIgnoreCase);
                    SetActive(h, on);
                    Console.WriteLine("active=" + (GetActive(h) ? "1" : "0"));
                    Console.WriteLine("ok=1");
                    return 0;
                }

                if (cmd == "ensure-whitelist")
                {
                    var wanted = new List<string>();
                    for (int i = 1; i < args.Length; i++)
                    {
                        string dos = ToDos(args[i]);
                        if (!string.IsNullOrEmpty(dos)) wanted.Add(dos);
                    }
                    if (wanted.Count == 0) { Console.Error.WriteLine("ERROR no paths"); return 2; }

                    List<string> wl;
                    try { wl = GetMulti(h, GET_WL); }
                    catch
                    {
                        SetMulti(h, SET_WL, new List<string>());
                        wl = new List<string>();
                    }

                    // Auto-repair absurd lists that crash official CLI.
                    if (wl.Count > 64)
                    {
                        wl = new List<string>();
                    }

                    bool changed = false;
                    foreach (string p in wanted)
                    {
                        if (!ContainsPath(wl, p))
                        {
                            wl.Add(p);
                            changed = true;
                        }
                    }
                    if (changed) SetMulti(h, SET_WL, wl);
                    Console.WriteLine("whitelisted=" + wanted.Count);
                    Console.WriteLine("whitelist=" + GetMulti(h, GET_WL).Count);
                    Console.WriteLine("ok=1");
                    return 0;
                }

                if (cmd == "hide-device")
                {
                    if (args.Length < 2) { Console.Error.WriteLine("ERROR missing instance path"); return 2; }
                    var bl = GetMulti(h, GET_BL);
                    string id = args[1].Trim();
                    if (!ContainsPath(bl, id))
                    {
                        bl.Add(id);
                        SetMulti(h, SET_BL, bl);
                    }
                    Console.WriteLine("hidden=1");
                    Console.WriteLine("ok=1");
                    return 0;
                }

                if (cmd == "clear-blacklist" || cmd == "unhide-all")
                {
                    // Restore every device to games (empty hide list).
                    SetMulti(h, SET_BL, new List<string>());
                    Console.WriteLine("blacklist=0");
                    Console.WriteLine("ok=1");
                    return 0;
                }

                if (cmd == "restore-games")
                {
                    // Emergency: cloak off + nothing hidden so physical pads work in-game.
                    SetActive(h, false);
                    SetMulti(h, SET_BL, new List<string>());
                    Console.WriteLine("active=" + (GetActive(h) ? "1" : "0"));
                    Console.WriteLine("blacklist=0");
                    Console.WriteLine("ok=1");
                    return 0;
                }

                if (cmd == "set-inverse")
                {
                    bool inv = args.Length > 1 && (args[1] == "1" || args[1].Equals("true", StringComparison.OrdinalIgnoreCase));
                    SetBool(h, SET_INV, inv);
                    Console.WriteLine("inverse=" + (GetBool(h, GET_INV) ? "1" : "0"));
                    Console.WriteLine("ok=1");
                    return 0;
                }

                PrintHelp();
                return 2;
            }
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine("ERROR " + ex.Message);
            return 1;
        }
    }

    static void PrintHelp()
    {
        Console.Error.WriteLine("hidhide-ctl status|repair|set-active 0|1|ensure-whitelist <exe...>|hide-device <id>|clear-blacklist|restore-games|set-inverse 0|1");
    }

    static SafeFileHandle Open()
    {
        return CreateFile("\\\\.\\HidHide", GENERIC_READ, SHARE, IntPtr.Zero, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, IntPtr.Zero);
    }

    static bool Ioctl(SafeFileHandle h, uint code, byte[] inBuf, uint inSize, byte[] outBuf, out uint ret)
    {
        bool ok = DeviceIoControl(h, code, inBuf, inSize, outBuf, outBuf == null ? 0u : (uint)outBuf.Length, out ret, IntPtr.Zero);
        if (!ok)
        {
            int err = Marshal.GetLastWin32Error();
            throw new InvalidOperationException("DeviceIoControl 0x" + code.ToString("X") + " failed win32=" + err);
        }
        return ok;
    }

    static bool GetActive(SafeFileHandle h)
    {
        return GetBool(h, GET_ACT);
    }

    static void SetActive(SafeFileHandle h, bool on)
    {
        SetBool(h, SET_ACT, on);
    }

    static bool GetBool(SafeFileHandle h, uint code)
    {
        byte[] buf = new byte[1];
        uint ret;
        Ioctl(h, code, null, 0, buf, out ret);
        return buf[0] != 0;
    }

    static void SetBool(SafeFileHandle h, uint code, bool value)
    {
        byte[] buf = new byte[] { (byte)(value ? 1 : 0) };
        uint ret;
        Ioctl(h, code, buf, 1, null, out ret);
    }

    static List<string> GetMulti(SafeFileHandle h, uint code)
    {
        uint need;
        // Size probe — some broken states throw; caller may repair.
        if (!DeviceIoControl(h, code, null, 0, null, 0, out need, IntPtr.Zero))
        {
            int err = Marshal.GetLastWin32Error();
            throw new InvalidOperationException("size probe failed win32=" + err);
        }
        if (need == 0) return new List<string>();
        // Cap absurd sizes and force repair path.
        if (need > 16384)
        {
            throw new InvalidOperationException("list too large need=" + need);
        }
        byte[] buf = new byte[need];
        uint got;
        Ioctl(h, code, null, 0, buf, out got);
        return ParseMultiSz(buf, (int)got);
    }

    static void SetMulti(SafeFileHandle h, uint code, List<string> items)
    {
        byte[] buf = ToMultiSz(items);
        uint ret;
        Ioctl(h, code, buf, (uint)buf.Length, null, out ret);
    }

    static List<string> ParseMultiSz(byte[] buf, int len)
    {
        var list = new List<string>();
        string s = Encoding.Unicode.GetString(buf, 0, len);
        foreach (string part in s.Split(new char[] { '\0' }, StringSplitOptions.RemoveEmptyEntries))
        {
            list.Add(part);
        }
        return list;
    }

    static byte[] ToMultiSz(List<string> items)
    {
        var sb = new StringBuilder();
        foreach (string item in items)
        {
            if (string.IsNullOrEmpty(item)) continue;
            sb.Append(item);
            sb.Append('\0');
        }
        sb.Append('\0');
        if (sb.Length == 1) sb.Append('\0'); // ensure double-null for empty
        return Encoding.Unicode.GetBytes(sb.ToString());
    }

    static string ToDos(string winPath)
    {
        if (string.IsNullOrEmpty(winPath)) return null;
        winPath = winPath.Trim().Trim('"');
        if (winPath.StartsWith(@"\Device\", StringComparison.OrdinalIgnoreCase)) return winPath;
        if (winPath.Length < 3 || winPath[1] != ':') return winPath;
        string drive = winPath.Substring(0, 2);
        var sb = new StringBuilder(512);
        if (QueryDosDevice(drive, sb, 512) == 0) return winPath;
        string dos = sb.ToString();
        int z = dos.IndexOf('\0');
        if (z >= 0) dos = dos.Substring(0, z);
        return dos + winPath.Substring(2);
    }

    static bool ContainsPath(List<string> list, string path)
    {
        foreach (string p in list)
        {
            if (string.Equals(p, path, StringComparison.OrdinalIgnoreCase)) return true;
        }
        return false;
    }
}
