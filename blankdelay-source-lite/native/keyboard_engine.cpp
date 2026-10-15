// User-mode keyboard delay. The low-level hooks live on their own message thread
// and are installed only while some key (or mouse button) has a 1–10 ms delay,
// so a busy Electron main thread never holds up anyone's input. Held input is
// replayed on a QPC deadline; 0 ms stays a passthrough. Poll steps use the same
// 0→8000 Hz … 10→8 Hz map as the controller, converted per device for its USB
// link speed, written through hidusbf, and read back from the hub.

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#include <setupapi.h>
#include <cfgmgr32.h>
#include <mmsystem.h>
#include <avrt.h>

#include <napi.h>

#include "usb_rate.h"

#ifndef CREATE_WAITABLE_TIMER_HIGH_RESOLUTION
#define CREATE_WAITABLE_TIMER_HIGH_RESOLUTION 0x00000002
#endif

#include <algorithm>
#include <atomic>
#include <cctype>
#include <cmath>
#include <condition_variable>
#include <cwctype>
#include <mutex>
#include <string>
#include <thread>
#include <utility>
#include <vector>

namespace {

constexpr ULONG_PTR kSignature = 0xB1A4C0E1;
constexpr int kPollHz[] = {8000, 4000, 2000, 1000, 500, 250, 125, 63, 31, 16, 8};

constexpr int kCodeCount = 264;
constexpr int kMouseLeft = 257;
constexpr int kMouseRight = 258;
constexpr int kMouseMiddle = 259;
constexpr int kMouseX1 = 260;
constexpr int kMouseX2 = 261;
constexpr int kWheelUp = 262;
constexpr int kWheelDown = 263;

constexpr UINT kSyncHooks = WM_APP + 0x31;
constexpr ULONGLONG kScanTtlMs = 4000;

enum class InputKind { Key, Button, Wheel };

struct Pending {
  InputKind kind;
  DWORD vk;
  DWORD scan;
  DWORD flags;
  int code;
  bool down;
  bool wheelUp;
  LONGLONG due;
};

struct DeviceEntry {
  std::string kind;
  std::string name;
};

struct Target {
  std::wstring instance;
  std::string kind;
  std::string name;
  int iface = 99;
  usbrate::Link link;
};

std::atomic<int> gDelay[kCodeCount];
std::atomic<bool> gRunning{false};
std::atomic<int> gRequestedHz{8000};

std::mutex gQueueMutex;
std::vector<Pending> gQueue;
HANDLE gWake = nullptr;
HANDLE gTimer = nullptr;
HHOOK gHook = nullptr;
HHOOK gMouseHook = nullptr;
std::thread gWorker;
std::thread gHookThread;
std::atomic<DWORD> gHookThreadId{0};
HANDLE gHookSynced = nullptr;
std::atomic<bool> gHooksOk{true};
std::atomic<bool> gKeyHooked{false};
std::atomic<bool> gMouseHooked{false};
LARGE_INTEGER gFreq{};
std::wstring gRoute = L"Keyboard driver is off";
std::mutex gTextMutex;
HANDLE gAvrt = nullptr;

std::mutex gDeviceMutex;
std::vector<Target> gTargets;
std::vector<DeviceEntry> gDevices;
ULONGLONG gScannedAt = 0;

std::mutex gPollMutex;
std::condition_variable gPollWake;
std::thread gPollThread;
bool gPollQuit = false;
int gPollWant[2] = {0, 0};
std::string gPollText[2];
std::atomic<bool> gPollBusy{false};
std::vector<std::pair<std::wstring, int>> gRefused;

struct KeyWatch {
  std::thread thread;
  std::atomic<bool> running{false};
  int vk = 0;
  int mods = 0;
  Napi::ThreadSafeFunction callback;
};

KeyWatch gWatch;

int PollHzForDelay(double delayMs) {
  const int step = delayMs < 1.0 ? 0 : std::clamp(static_cast<int>(std::llround(delayMs)), 0, 10);
  return kPollHz[step];
}

bool KnownCode(int code) { return code >= 1 && code < kCodeCount; }

int KindIndex(const std::string& kind) { return kind == "mouse" ? 1 : 0; }

LONGLONG Now() {
  LARGE_INTEGER now{};
  QueryPerformanceCounter(&now);
  return now.QuadPart;
}

void SetRoute(const wchar_t* text) {
  std::lock_guard<std::mutex> lock(gTextMutex);
  gRoute = text;
}

void SetPollText(int index, const std::string& text) {
  std::lock_guard<std::mutex> lock(gTextMutex);
  gPollText[index] = text;
}

void SendItem(const Pending& item) {
  INPUT input{};
  if (item.kind == InputKind::Key) {
    input.type = INPUT_KEYBOARD;
    if (item.scan) {
      input.ki.wScan = static_cast<WORD>(item.scan);
      input.ki.dwFlags = KEYEVENTF_SCANCODE;
    } else {
      input.ki.wVk = static_cast<WORD>(item.vk);
    }
    if (!item.down) input.ki.dwFlags |= KEYEVENTF_KEYUP;
    if (item.flags & LLKHF_EXTENDED) input.ki.dwFlags |= KEYEVENTF_EXTENDEDKEY;
    input.ki.dwExtraInfo = kSignature;
  } else if (item.kind == InputKind::Wheel) {
    input.type = INPUT_MOUSE;
    input.mi.dwFlags = MOUSEEVENTF_WHEEL;
    input.mi.mouseData = item.wheelUp ? WHEEL_DELTA : static_cast<DWORD>(-WHEEL_DELTA);
    input.mi.dwExtraInfo = kSignature;
  } else {
    input.type = INPUT_MOUSE;
    input.mi.dwExtraInfo = kSignature;
    if (item.code == kMouseLeft) input.mi.dwFlags = item.down ? MOUSEEVENTF_LEFTDOWN : MOUSEEVENTF_LEFTUP;
    else if (item.code == kMouseRight) input.mi.dwFlags = item.down ? MOUSEEVENTF_RIGHTDOWN : MOUSEEVENTF_RIGHTUP;
    else if (item.code == kMouseMiddle) input.mi.dwFlags = item.down ? MOUSEEVENTF_MIDDLEDOWN : MOUSEEVENTF_MIDDLEUP;
    else {
      input.mi.dwFlags = item.down ? MOUSEEVENTF_XDOWN : MOUSEEVENTF_XUP;
      input.mi.mouseData = item.code == kMouseX2 ? XBUTTON2 : XBUTTON1;
    }
  }
  SendInput(1, &input, sizeof(INPUT));
}

void QueueItem(Pending item, int delayMs) {
  item.due = Now() + (gFreq.QuadPart * delayMs) / 1000;
  {
    std::lock_guard<std::mutex> lock(gQueueMutex);
    gQueue.push_back(item);
  }
  if (gWake) SetEvent(gWake);
}

void Worker() {
  DWORD task = 0;
  gAvrt = AvSetMmThreadCharacteristicsW(L"Pro Audio", &task);
  SetThreadPriority(GetCurrentThread(), THREAD_PRIORITY_HIGHEST);
  timeBeginPeriod(1);
  const LONGLONG spin = std::max<LONGLONG>(1, gFreq.QuadPart / 1000);
  while (gRunning.load(std::memory_order_acquire)) {
    Pending ready{};
    bool fire = false;
    LONGLONG waitTicks = 0;
    {
      std::lock_guard<std::mutex> lock(gQueueMutex);
      if (!gQueue.empty()) {
        auto soonest = std::min_element(gQueue.begin(), gQueue.end(), [](const Pending& a, const Pending& b) { return a.due < b.due; });
        const LONGLONG now = Now();
        if (soonest->due <= now) {
          ready = *soonest;
          gQueue.erase(soonest);
          fire = true;
        } else {
          waitTicks = soonest->due - now;
        }
      }
    }
    if (fire) {
      SendItem(ready);
      continue;
    }
    if (waitTicks > 0 && waitTicks <= spin) {
      const LONGLONG until = Now() + waitTicks;
      while (gRunning.load(std::memory_order_relaxed) && Now() < until) YieldProcessor();
      continue;
    }
    if (waitTicks > 0 && gTimer) {
      LARGE_INTEGER due{};
      due.QuadPart = -(((waitTicks - spin) * 10000000) / std::max<LONGLONG>(gFreq.QuadPart, 1));
      if (due.QuadPart == 0) due.QuadPart = -1;
      SetWaitableTimer(gTimer, &due, 0, nullptr, nullptr, FALSE);
      HANDLE handles[2] = {gWake, gTimer};
      WaitForMultipleObjects(2, handles, FALSE, INFINITE);
      continue;
    }
    WaitForSingleObject(gWake, 50);
  }
  timeEndPeriod(1);
  if (gAvrt) {
    AvRevertMmThreadCharacteristics(gAvrt);
    gAvrt = nullptr;
  }
}

LRESULT CALLBACK KeyboardProc(int code, WPARAM wParam, LPARAM lParam) {
  if (code != HC_ACTION || !gRunning.load(std::memory_order_relaxed)) return CallNextHookEx(gHook, code, wParam, lParam);
  const auto* info = reinterpret_cast<KBDLLHOOKSTRUCT*>(lParam);
  if (info->dwExtraInfo == kSignature) return CallNextHookEx(gHook, code, wParam, lParam);
  const bool down = wParam == WM_KEYDOWN || wParam == WM_SYSKEYDOWN;
  const bool up = wParam == WM_KEYUP || wParam == WM_SYSKEYUP;
  if (!down && !up) return CallNextHookEx(gHook, code, wParam, lParam);
  const int slot = static_cast<int>(info->vkCode);
  if (!KnownCode(slot)) return CallNextHookEx(gHook, code, wParam, lParam);
  const int delay = gDelay[slot].load(std::memory_order_relaxed);
  if (delay < 1) return CallNextHookEx(gHook, code, wParam, lParam);
  Pending item{};
  item.kind = InputKind::Key;
  item.vk = info->vkCode;
  item.scan = info->scanCode;
  item.flags = info->flags;
  item.code = slot;
  item.down = down;
  QueueItem(item, delay);
  return 1;
}

LRESULT CALLBACK MouseProc(int code, WPARAM wParam, LPARAM lParam) {
  if (code != HC_ACTION || !gRunning.load(std::memory_order_relaxed)) return CallNextHookEx(gMouseHook, code, wParam, lParam);
  const auto* info = reinterpret_cast<MSLLHOOKSTRUCT*>(lParam);
  if (info->dwExtraInfo == kSignature) return CallNextHookEx(gMouseHook, code, wParam, lParam);
  int slot = 0;
  bool down = false;
  bool wheel = false;
  bool wheelUp = false;
  switch (wParam) {
    case WM_LBUTTONDOWN: slot = kMouseLeft; down = true; break;
    case WM_LBUTTONUP: slot = kMouseLeft; break;
    case WM_RBUTTONDOWN: slot = kMouseRight; down = true; break;
    case WM_RBUTTONUP: slot = kMouseRight; break;
    case WM_MBUTTONDOWN: slot = kMouseMiddle; down = true; break;
    case WM_MBUTTONUP: slot = kMouseMiddle; break;
    case WM_XBUTTONDOWN:
      slot = HIWORD(info->mouseData) == XBUTTON2 ? kMouseX2 : kMouseX1;
      down = true;
      break;
    case WM_XBUTTONUP: slot = HIWORD(info->mouseData) == XBUTTON2 ? kMouseX2 : kMouseX1; break;
    case WM_MOUSEWHEEL: {
      const short delta = static_cast<short>(HIWORD(info->mouseData));
      slot = delta >= 0 ? kWheelUp : kWheelDown;
      wheel = true;
      wheelUp = delta >= 0;
      break;
    }
    default: return CallNextHookEx(gMouseHook, code, wParam, lParam);
  }
  const int delay = gDelay[slot].load(std::memory_order_relaxed);
  if (delay < 1) return CallNextHookEx(gMouseHook, code, wParam, lParam);
  Pending item{};
  item.kind = wheel ? InputKind::Wheel : InputKind::Button;
  item.code = slot;
  item.down = down;
  item.wheelUp = wheelUp;
  QueueItem(item, delay);
  return 1;
}

bool AnyDelay(int from, int to) {
  for (int code = from; code < to; ++code) {
    if (gDelay[code].load(std::memory_order_relaxed) > 0) return true;
  }
  return false;
}

void SyncHooksHere() {
  const bool running = gRunning.load(std::memory_order_acquire);
  const bool wantKeys = running && AnyDelay(1, kMouseLeft);
  const bool wantMouse = running && AnyDelay(kMouseLeft, kCodeCount);
  HMODULE module = GetModuleHandleW(nullptr);
  if (wantKeys && !gHook) gHook = SetWindowsHookExW(WH_KEYBOARD_LL, KeyboardProc, module, 0);
  if (!wantKeys && gHook) {
    UnhookWindowsHookEx(gHook);
    gHook = nullptr;
  }
  if (wantMouse && !gMouseHook) gMouseHook = SetWindowsHookExW(WH_MOUSE_LL, MouseProc, module, 0);
  if (!wantMouse && gMouseHook) {
    UnhookWindowsHookEx(gMouseHook);
    gMouseHook = nullptr;
  }
  gKeyHooked.store(gHook != nullptr, std::memory_order_release);
  gMouseHooked.store(gMouseHook != nullptr, std::memory_order_release);
  gHooksOk.store((!wantKeys || gHook) && (!wantMouse || gMouseHook), std::memory_order_release);
}

void HookThread() {
  SetThreadPriority(GetCurrentThread(), THREAD_PRIORITY_TIME_CRITICAL);
  MSG msg{};
  PeekMessageW(&msg, nullptr, WM_USER, WM_USER, PM_NOREMOVE);
  gHookThreadId.store(GetCurrentThreadId(), std::memory_order_release);
  SyncHooksHere();
  SetEvent(gHookSynced);
  while (GetMessageW(&msg, nullptr, 0, 0) > 0) {
    if (msg.message == kSyncHooks && msg.hwnd == nullptr) {
      SyncHooksHere();
      SetEvent(gHookSynced);
      continue;
    }
    DispatchMessageW(&msg);
  }
  if (gHook) UnhookWindowsHookEx(gHook);
  if (gMouseHook) UnhookWindowsHookEx(gMouseHook);
  gHook = nullptr;
  gMouseHook = nullptr;
  gKeyHooked.store(false, std::memory_order_release);
  gMouseHooked.store(false, std::memory_order_release);
  gHookThreadId.store(0, std::memory_order_release);
}

bool SyncHooks() {
  const DWORD id = gHookThreadId.load(std::memory_order_acquire);
  if (!id || !gHookSynced) return gHooksOk.load(std::memory_order_acquire);
  ResetEvent(gHookSynced);
  if (!PostThreadMessageW(id, kSyncHooks, 0, 0)) return false;
  if (WaitForSingleObject(gHookSynced, 2000) != WAIT_OBJECT_0) return false;
  return gHooksOk.load(std::memory_order_acquire);
}

bool DeviceHasHidusbf(const std::wstring& instance) {
  const std::wstring path = L"SYSTEM\\CurrentControlSet\\Enum\\" + instance;
  HKEY key = nullptr;
  if (RegOpenKeyExW(HKEY_LOCAL_MACHINE, path.c_str(), 0, KEY_QUERY_VALUE, &key) != ERROR_SUCCESS) return false;
  DWORD type = 0;
  DWORD size = 0;
  const LSTATUS query = RegQueryValueExW(key, L"LowerFilters", nullptr, &type, nullptr, &size);
  if (query != ERROR_SUCCESS || type != REG_MULTI_SZ || size < sizeof(wchar_t)) {
    RegCloseKey(key);
    return false;
  }
  std::vector<wchar_t> names(size / sizeof(wchar_t) + 1);
  DWORD read = size;
  const bool ok = RegQueryValueExW(key, L"LowerFilters", nullptr, &type, reinterpret_cast<BYTE*>(names.data()), &read) == ERROR_SUCCESS;
  RegCloseKey(key);
  if (!ok) return false;
  for (const wchar_t* name = names.data(); *name; name += wcslen(name) + 1) {
    if (_wcsicmp(name, L"hidusbf") == 0) return true;
  }
  return false;
}

bool EnsureHidusbf(const std::wstring& instance) {
  if (instance.empty() || DeviceHasHidusbf(instance)) return false;
  const std::wstring path = L"SYSTEM\\CurrentControlSet\\Enum\\" + instance;
  HKEY key = nullptr;
  if (RegOpenKeyExW(HKEY_LOCAL_MACHINE, path.c_str(), 0, KEY_QUERY_VALUE | KEY_SET_VALUE, &key) != ERROR_SUCCESS) return false;
  DWORD type = 0;
  DWORD size = 0;
  std::vector<wchar_t> names;
  if (RegQueryValueExW(key, L"LowerFilters", nullptr, &type, nullptr, &size) == ERROR_SUCCESS && type == REG_MULTI_SZ && size >= sizeof(wchar_t)) {
    names.resize(size / sizeof(wchar_t) + 1);
    DWORD read = size;
    if (RegQueryValueExW(key, L"LowerFilters", nullptr, &type, reinterpret_cast<BYTE*>(names.data()), &read) != ERROR_SUCCESS) names.clear();
  }
  std::wstring packed;
  for (const wchar_t* name = names.empty() ? L"" : names.data(); name && *name; name += wcslen(name) + 1) {
    packed.append(name);
    packed.push_back(L'\0');
  }
  packed.append(L"hidusbf");
  packed.push_back(L'\0');
  packed.push_back(L'\0');
  const bool wrote = RegSetValueExW(key, L"LowerFilters", 0, REG_MULTI_SZ, reinterpret_cast<const BYTE*>(packed.data()), static_cast<DWORD>(packed.size() * sizeof(wchar_t))) == ERROR_SUCCESS;
  RegCloseKey(key);
  return wrote;
}

std::string WideToUtf8(const std::wstring& text) {
  if (text.empty()) return {};
  const int length = WideCharToMultiByte(CP_UTF8, 0, text.c_str(), -1, nullptr, 0, nullptr, nullptr);
  if (length <= 1) return {};
  std::string out(length - 1, '\0');
  WideCharToMultiByte(CP_UTF8, 0, text.c_str(), -1, out.data(), length, nullptr, nullptr);
  return out;
}

std::wstring DevNodeName(DEVINST node) {
  wchar_t buffer[512]{};
  ULONG size = sizeof(buffer);
  ULONG type = 0;
  if (CM_Get_DevNode_Registry_PropertyW(node, CM_DRP_FRIENDLYNAME, &type, buffer, &size, 0) == CR_SUCCESS && buffer[0]) return buffer;
  size = sizeof(buffer);
  buffer[0] = L'\0';
  if (CM_Get_DevNode_Registry_PropertyW(node, CM_DRP_DEVICEDESC, &type, buffer, &size, 0) == CR_SUCCESS && buffer[0]) return buffer;
  return L"";
}

bool GenericDeviceName(const std::wstring& name) {
  std::wstring lower = name;
  for (wchar_t& letter : lower) letter = static_cast<wchar_t>(towlower(letter));
  return lower.empty() || lower.find(L"hid keyboard") != std::wstring::npos || lower.find(L"hid-compliant") != std::wstring::npos || lower == L"keyboard" || lower == L"mouse" || lower == L"usb input device" || lower == L"usb composite device";
}

const DEVPROPKEY kBusReportedDeviceDesc = {{0x540b947e, 0x8b40, 0x45bc, {0xa8, 0xa2, 0x6a, 0x0b, 0x89, 0x4c, 0xbd, 0xa2}}, 4};

std::wstring BusReportedName(HDEVINFO devices, const wchar_t* instance) {
  if (!devices || devices == INVALID_HANDLE_VALUE || !instance || !instance[0]) return L"";
  SP_DEVINFO_DATA info{sizeof(info)};
  if (!SetupDiOpenDeviceInfoW(devices, instance, nullptr, 0, &info)) return L"";
  wchar_t buffer[512]{};
  DEVPROPTYPE type = 0;
  if (!SetupDiGetDevicePropertyW(devices, &info, &kBusReportedDeviceDesc, &type, reinterpret_cast<BYTE*>(buffer), sizeof(buffer), nullptr, 0) || !buffer[0]) return L"";
  return buffer;
}

std::wstring DeviceLabel(HDEVINFO allDevices, DEVINST node) {
  std::wstring fallback = DevNodeName(node);
  DEVINST current = node;
  for (int hop = 0; hop < 8 && current; ++hop) {
    wchar_t id[MAX_DEVICE_ID_LEN]{};
    if (CM_Get_Device_IDW(current, id, MAX_DEVICE_ID_LEN, 0) == CR_SUCCESS) {
      const std::wstring reported = BusReportedName(allDevices, id);
      if (!GenericDeviceName(reported)) return reported;
    }
    const std::wstring named = DevNodeName(current);
    if (fallback.empty()) fallback = named;
    DEVINST parent = 0;
    if (CM_Get_Parent(&parent, current, 0) != CR_SUCCESS) break;
    current = parent;
  }
  return fallback;
}

bool VirtualId(const wchar_t* id) {
  return wcsstr(id, L"ViGEm") || wcsstr(id, L"VIGEM") || wcsstr(id, L"Nefarius") || wcsstr(id, L"VIRTUAL");
}

void CollectClass(HDEVINFO allDevices, const GUID& deviceClass, const char* kind, bool includeCollections, std::vector<Target>& targets, std::vector<DeviceEntry>& devices) {
  HDEVINFO list = SetupDiGetClassDevsW(&deviceClass, nullptr, nullptr, DIGCF_PRESENT);
  if (list == INVALID_HANDLE_VALUE) return;
  SP_DEVINFO_DATA devInfo{sizeof(devInfo)};
  for (DWORD index = 0; SetupDiEnumDeviceInfo(list, index, &devInfo); ++index) {
    wchar_t selfId[MAX_DEVICE_ID_LEN]{};
    if (CM_Get_Device_IDW(devInfo.DevInst, selfId, MAX_DEVICE_ID_LEN, 0) == CR_SUCCESS) {
      if (VirtualId(selfId)) continue;
      if (!includeCollections && wcsstr(selfId, L"&COL")) continue;
    }
    const std::string name = WideToUtf8(DeviceLabel(allDevices, devInfo.DevInst));
    if (!name.empty()) {
      const bool seen = std::any_of(devices.begin(), devices.end(), [&](const DeviceEntry& entry) { return entry.kind == kind && entry.name == name; });
      if (!seen) devices.push_back({kind, name});
    }
    DEVINST node = devInfo.DevInst;
    bool skip = false;
    int iface = 99;
    std::wstring usbId;
    for (int hop = 0; hop < 8 && node; ++hop) {
      wchar_t id[MAX_DEVICE_ID_LEN]{};
      if (CM_Get_Device_IDW(node, id, MAX_DEVICE_ID_LEN, 0) == CR_SUCCESS) {
        if (VirtualId(id) || wcsstr(id, L"VID_054C") || wcsstr(id, L"VID_045E")) skip = true;
        const wchar_t* mi = wcsstr(id, L"&MI_");
        if (mi && iface == 99) iface = static_cast<int>(wcstol(mi + 4, nullptr, 16));
        if (usbId.empty() && wcsncmp(id, L"USB\\", 4) == 0 && !mi) usbId = id;
      }
      DEVINST parent = 0;
      if (CM_Get_Parent(&parent, node, 0) != CR_SUCCESS) break;
      node = parent;
    }
    if (skip || usbId.empty()) continue;
    auto existing = std::find_if(targets.begin(), targets.end(), [&](const Target& target) { return target.instance == usbId; });
    if (existing == targets.end()) {
      targets.push_back({usbId, kind, name, iface, {}});
    } else if (iface < existing->iface) {
      existing->kind = kind;
      existing->iface = iface;
      if (!name.empty()) existing->name = name;
    }
  }
  SetupDiDestroyDeviceInfoList(list);
}

void ScanDevices() {
  std::vector<Target> targets;
  std::vector<DeviceEntry> devices;
  HDEVINFO allDevices = SetupDiGetClassDevsW(nullptr, nullptr, nullptr, DIGCF_PRESENT | DIGCF_ALLCLASSES);
  const GUID keyboardClass = {0x4d36e96b, 0xe325, 0x11ce, {0xbf, 0xc1, 0x08, 0x00, 0x2b, 0xe1, 0x03, 0x18}};
  const GUID mouseClass = {0x4d36e96f, 0xe325, 0x11ce, {0xbf, 0xc1, 0x08, 0x00, 0x2b, 0xe1, 0x03, 0x18}};
  CollectClass(allDevices, keyboardClass, "keyboard", false, targets, devices);
  CollectClass(allDevices, mouseClass, "mouse", false, targets, devices);
  if (std::none_of(devices.begin(), devices.end(), [](const DeviceEntry& entry) { return entry.kind == "keyboard"; })) CollectClass(allDevices, keyboardClass, "keyboard", true, targets, devices);
  if (std::none_of(devices.begin(), devices.end(), [](const DeviceEntry& entry) { return entry.kind == "mouse"; })) CollectClass(allDevices, mouseClass, "mouse", true, targets, devices);
  if (allDevices != INVALID_HANDLE_VALUE) SetupDiDestroyDeviceInfoList(allDevices);
  for (Target& target : targets) target.link = usbrate::Read(target.instance);
  std::lock_guard<std::mutex> lock(gDeviceMutex);
  gTargets.swap(targets);
  gDevices.swap(devices);
  gScannedAt = GetTickCount64();
}

void EnsureScanned() {
  bool stale = false;
  {
    std::lock_guard<std::mutex> lock(gDeviceMutex);
    stale = !gScannedAt || GetTickCount64() - gScannedAt > kScanTtlMs;
  }
  if (stale && !gPollBusy.load(std::memory_order_acquire)) ScanDevices();
}

std::vector<Target> TargetsOf(const char* kind) {
  std::vector<Target> out;
  std::lock_guard<std::mutex> lock(gDeviceMutex);
  for (const Target& target : gTargets) {
    if (target.kind == kind) out.push_back(target);
  }
  return out;
}

std::string RateLine(const Target& target, int requestedHz) {
  const int hz = usbrate::HzFor(target.link.speed, target.link.interval);
  if (hz <= 0) return target.name + " rate unknown";
  std::string line = target.name + " " + std::to_string(hz) + " Hz";
  if (requestedHz > usbrate::MaxHz(target.link.speed) && target.link.speed >= 0) line += std::string(" (") + usbrate::SpeedName(target.link.speed) + " max)";
  return line;
}

void ApplyKind(int index, int hz) {
  const char* kind = index == 1 ? "mouse" : "keyboard";
  ScanDevices();
  std::vector<Target> targets = TargetsOf(kind);
  if (targets.empty()) {
    SetPollText(index, index == 1 ? "Connect a USB mouse" : "Connect a USB keyboard");
    return;
  }
  std::vector<std::string> lines;
  for (Target& target : targets) {
    const usbrate::Link link = target.link.speed >= 0 ? target.link : usbrate::Read(target.instance);
    if (link.speed < 0) {
      lines.push_back(target.name + " rate unknown");
      continue;
    }
    const int want = usbrate::IntervalFor(link.speed, hz);
    target.link = link;
    if (usbrate::SameRate(link.speed, link.interval, want)) {
      usbrate::WriteInterval(target.instance, static_cast<DWORD>(link.interval));
      lines.push_back(RateLine(target, hz));
      continue;
    }
    const auto refused = std::find(gRefused.begin(), gRefused.end(), std::make_pair(target.instance, want));
    if (refused != gRefused.end()) {
      lines.push_back(target.name + " stays at " + std::to_string(usbrate::HzFor(link.speed, link.interval)) + " Hz (" + usbrate::SpeedName(link.speed) + ")");
      continue;
    }
    EnsureHidusbf(target.instance);
    if (!usbrate::WriteInterval(target.instance, static_cast<DWORD>(want))) {
      lines.push_back(target.name + " could not be set");
      continue;
    }
    SetPollText(index, "Setting " + target.name + " to " + std::to_string(usbrate::HzFor(link.speed, want)) + " Hz");
    const bool restarted = usbrate::Restart(target.instance);
    const usbrate::Link after = restarted ? usbrate::WaitForLink(target.instance, 3000) : usbrate::Read(target.instance);
    target.link = after.speed >= 0 ? after : link;
    if (after.interval == want) {
      lines.push_back(RateLine(target, hz));
      continue;
    }
    if (after.interval > 0) usbrate::WriteInterval(target.instance, static_cast<DWORD>(after.interval));
    gRefused.emplace_back(target.instance, want);
    const int stays = usbrate::HzFor(target.link.speed, target.link.interval);
    lines.push_back(target.name + " stays at " + std::to_string(stays) + " Hz (" + usbrate::SpeedName(link.speed) + ")");
  }
  ScanDevices();
  std::string text;
  for (const std::string& line : lines) {
    if (!text.empty()) text += " · ";
    text += line;
  }
  SetPollText(index, text);
}

void PollLoop() {
  std::unique_lock<std::mutex> lock(gPollMutex);
  while (!gPollQuit) {
    const int index = gPollWant[0] ? 0 : gPollWant[1] ? 1 : -1;
    if (index < 0) {
      gPollWake.wait(lock);
      continue;
    }
    const int hz = gPollWant[index];
    gPollWant[index] = 0;
    gPollBusy.store(true, std::memory_order_release);
    lock.unlock();
    ApplyKind(index, hz);
    lock.lock();
    gPollBusy.store(false, std::memory_order_release);
  }
}

void StopPollThread() {
  {
    std::lock_guard<std::mutex> lock(gPollMutex);
    gPollQuit = true;
    gPollWant[0] = 0;
    gPollWant[1] = 0;
  }
  gPollWake.notify_all();
  if (gPollThread.joinable()) gPollThread.join();
}

void ReleaseHeld() {
  std::vector<Pending> leftover;
  {
    std::lock_guard<std::mutex> lock(gQueueMutex);
    leftover.swap(gQueue);
  }
  for (const Pending& item : leftover) {
    if (item.down || item.kind == InputKind::Wheel) continue;
    SendItem(item);
  }
}

void StopEngine() {
  gRunning.store(false, std::memory_order_release);
  const DWORD hookThread = gHookThreadId.load(std::memory_order_acquire);
  if (hookThread) PostThreadMessageW(hookThread, WM_QUIT, 0, 0);
  if (gHookThread.joinable()) gHookThread.join();
  if (gWake) SetEvent(gWake);
  if (gWorker.joinable()) gWorker.join();
  StopPollThread();
  ReleaseHeld();
  SetRoute(L"Keyboard driver is off");
}

std::string KindMessage(int index, int requestedHz) {
  std::string text;
  {
    std::lock_guard<std::mutex> lock(gTextMutex);
    text = gPollText[index];
  }
  if (!text.empty()) return text;
  std::string out;
  for (const Target& target : TargetsOf(index == 1 ? "mouse" : "keyboard")) {
    if (!out.empty()) out += " · ";
    out += RateLine(target, requestedHz);
  }
  return out;
}

Napi::Object Status(Napi::Env env) {
  Napi::Object status = Napi::Object::New(env);
  const bool running = gRunning.load(std::memory_order_acquire);
  status.Set("running", Napi::Boolean::New(env, running));
  EnsureScanned();
  Napi::Object delays = Napi::Object::New(env);
  for (int code = 1; code < kCodeCount; ++code) {
    const int delay = gDelay[code].load(std::memory_order_acquire);
    if (delay > 0) delays.Set(std::to_string(code), Napi::Number::New(env, delay));
  }
  status.Set("delays", delays);
  Napi::Array keyboards = Napi::Array::New(env);
  Napi::Array mice = Napi::Array::New(env);
  Napi::Array rates = Napi::Array::New(env);
  int firstHz = 0;
  {
    std::lock_guard<std::mutex> lock(gDeviceMutex);
    uint32_t keyboardCount = 0;
    uint32_t mouseCount = 0;
    for (const DeviceEntry& entry : gDevices) {
      if (entry.kind == "mouse") mice.Set(mouseCount++, Napi::String::New(env, entry.name));
      else keyboards.Set(keyboardCount++, Napi::String::New(env, entry.name));
    }
    uint32_t rateCount = 0;
    for (const Target& target : gTargets) {
      const int hz = usbrate::HzFor(target.link.speed, target.link.interval);
      Napi::Object rate = Napi::Object::New(env);
      rate.Set("kind", Napi::String::New(env, target.kind));
      rate.Set("name", Napi::String::New(env, target.name));
      rate.Set("hz", Napi::Number::New(env, hz));
      rate.Set("nativeHz", Napi::Number::New(env, usbrate::HzFor(target.link.speed, target.link.native)));
      rate.Set("speed", Napi::String::New(env, usbrate::SpeedName(target.link.speed)));
      rates.Set(rateCount++, rate);
      if (!firstHz && target.kind == "keyboard") firstHz = hz;
    }
  }
  status.Set("keyboards", keyboards);
  status.Set("mice", mice);
  status.Set("rates", rates);
  const int requested = gRequestedHz.load(std::memory_order_acquire);
  status.Set("measuredHz", Napi::Number::New(env, firstHz));
  status.Set("pollHz", Napi::Number::New(env, requested));
  status.Set("pollBusy", Napi::Boolean::New(env, gPollBusy.load(std::memory_order_acquire)));
  Napi::Object hooks = Napi::Object::New(env);
  hooks.Set("keyboard", Napi::Boolean::New(env, gKeyHooked.load(std::memory_order_acquire)));
  hooks.Set("mouse", Napi::Boolean::New(env, gMouseHooked.load(std::memory_order_acquire)));
  status.Set("hooks", hooks);
  std::string poll = "Turn on the keyboard driver";
  if (running) {
    const std::string keys = KindMessage(0, requested);
    const std::string mouse = KindMessage(1, requested);
    poll = keys;
    if (!mouse.empty()) poll += (poll.empty() ? "" : " · ") + mouse;
    if (poll.empty()) poll = "Keyboard driver is on";
  }
  status.Set("pollMessage", Napi::String::New(env, poll));
  std::wstring route;
  {
    std::lock_guard<std::mutex> lock(gTextMutex);
    route = gRoute;
  }
  status.Set("route", Napi::String::New(env, WideToUtf8(route)));
  return status;
}

Napi::Value Start(const Napi::CallbackInfo& info) {
  if (gRunning.load(std::memory_order_acquire)) return Napi::Boolean::New(info.Env(), true);
  QueryPerformanceFrequency(&gFreq);
  if (!gWake) gWake = CreateEventW(nullptr, FALSE, FALSE, nullptr);
  if (!gTimer) gTimer = CreateWaitableTimerExW(nullptr, nullptr, CREATE_WAITABLE_TIMER_HIGH_RESOLUTION, TIMER_ALL_ACCESS);
  if (!gTimer) gTimer = CreateWaitableTimerW(nullptr, FALSE, nullptr);
  if (!gHookSynced) gHookSynced = CreateEventW(nullptr, TRUE, FALSE, nullptr);
  ScanDevices();
  {
    std::lock_guard<std::mutex> lock(gTextMutex);
    gPollText[0].clear();
    gPollText[1].clear();
  }
  {
    std::lock_guard<std::mutex> lock(gPollMutex);
    gPollQuit = false;
  }
  gRunning.store(true, std::memory_order_release);
  gWorker = std::thread(Worker);
  ResetEvent(gHookSynced);
  gHookThread = std::thread(HookThread);
  WaitForSingleObject(gHookSynced, 2000);
  if (!gHookThreadId.load(std::memory_order_acquire) || !gHooksOk.load(std::memory_order_acquire)) {
    StopEngine();
    SetRoute(L"Could not start the keyboard driver");
    return Napi::Boolean::New(info.Env(), false);
  }
  gPollThread = std::thread(PollLoop);
  SetRoute(TargetsOf("keyboard").empty() && TargetsOf("mouse").empty() ? L"Keyboard driver is on" : L"USB keyboard and mouse");
  return Napi::Boolean::New(info.Env(), true);
}

Napi::Value Stop(const Napi::CallbackInfo& info) {
  StopEngine();
  return Napi::Boolean::New(info.Env(), true);
}

Napi::Value SetDelay(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 2 || !info[0].IsNumber() || !info[1].IsNumber()) return Napi::Boolean::New(env, false);
  const int code = info[0].As<Napi::Number>().Int32Value();
  const int delay = std::clamp(static_cast<int>(std::llround(info[1].As<Napi::Number>().DoubleValue())), 0, 10);
  if (!KnownCode(code)) return Napi::Boolean::New(env, false);
  gDelay[code].store(delay, std::memory_order_release);
  if (!gRunning.load(std::memory_order_acquire)) return Napi::Boolean::New(env, true);
  return Napi::Boolean::New(env, SyncHooks());
}

Napi::Value SetPoll(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 1 || !info[0].IsNumber()) return Napi::Boolean::New(env, false);
  if (!gRunning.load(std::memory_order_acquire)) return Napi::Boolean::New(env, false);
  const int hz = PollHzForDelay(info[0].As<Napi::Number>().DoubleValue());
  const std::string kind = info.Length() > 1 && info[1].IsString() ? info[1].As<Napi::String>().Utf8Value() : "all";
  gRequestedHz.store(hz, std::memory_order_release);
  {
    std::lock_guard<std::mutex> lock(gPollMutex);
    if (kind != "mouse") gPollWant[0] = hz;
    if (kind != "keyboard") gPollWant[1] = hz;
  }
  if (kind != "mouse") SetPollText(0, "Setting the keyboard to " + std::to_string(hz) + " Hz");
  if (kind != "keyboard") SetPollText(1, "Setting the mouse to " + std::to_string(hz) + " Hz");
  gPollWake.notify_all();
  return Napi::Boolean::New(env, true);
}

Napi::Value GetStatus(const Napi::CallbackInfo& info) { return Status(info.Env()); }

bool ModsHeld(int mods) {
  const auto down = [](int key) { return (GetAsyncKeyState(key) & 0x8000) != 0; };
  if ((mods & 1) && !down(VK_CONTROL)) return false;
  if ((mods & 2) && !down(VK_MENU)) return false;
  if ((mods & 4) && !down(VK_SHIFT)) return false;
  if ((mods & 8) && !down(VK_LWIN) && !down(VK_RWIN)) return false;
  return true;
}

void WatchLoop(int vk, int mods) {
  SetThreadPriority(GetCurrentThread(), THREAD_PRIORITY_ABOVE_NORMAL);
  HANDLE timer = CreateWaitableTimerExW(nullptr, nullptr, CREATE_WAITABLE_TIMER_HIGH_RESOLUTION, TIMER_ALL_ACCESS);
  bool held = (GetAsyncKeyState(vk) & 0x8000) != 0;
  while (gWatch.running.load(std::memory_order_acquire)) {
    const bool down = (GetAsyncKeyState(vk) & 0x8000) != 0;
    if (down && !held && ModsHeld(mods)) gWatch.callback.NonBlockingCall();
    held = down;
    if (timer) {
      LARGE_INTEGER due{};
      due.QuadPart = -80000;
      SetWaitableTimer(timer, &due, 0, nullptr, nullptr, FALSE);
      WaitForSingleObject(timer, 50);
    } else {
      Sleep(8);
    }
  }
  if (timer) CloseHandle(timer);
}

void StopWatch() {
  gWatch.running.store(false, std::memory_order_release);
  if (gWatch.thread.joinable()) gWatch.thread.join();
  if (gWatch.callback) {
    gWatch.callback.Release();
    gWatch.callback = Napi::ThreadSafeFunction();
  }
}

Napi::Value WatchKey(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 3 || !info[0].IsNumber() || !info[1].IsNumber() || !info[2].IsFunction()) return Napi::Boolean::New(env, false);
  const int vk = info[0].As<Napi::Number>().Int32Value();
  const int mods = info[1].As<Napi::Number>().Int32Value() & 0x0f;
  if (vk < 1 || vk > 254) return Napi::Boolean::New(env, false);
  StopWatch();
  gWatch.callback = Napi::ThreadSafeFunction::New(env, info[2].As<Napi::Function>(), "blank-clip-key", 0, 1);
  gWatch.callback.Unref(env);
  gWatch.vk = vk;
  gWatch.mods = mods;
  gWatch.running.store(true, std::memory_order_release);
  gWatch.thread = std::thread(WatchLoop, vk, mods);
  return Napi::Boolean::New(env, true);
}

Napi::Value UnwatchKey(const Napi::CallbackInfo& info) {
  StopWatch();
  return Napi::Boolean::New(info.Env(), true);
}

void Cleanup(void*) {
  gWatch.running.store(false, std::memory_order_release);
  if (gWatch.thread.joinable()) gWatch.thread.join();
  StopEngine();
}

}  // namespace

Napi::Object InitAll(Napi::Env env, Napi::Object exports) {
  napi_add_env_cleanup_hook(env, Cleanup, nullptr);
  exports.Set("Start", Napi::Function::New(env, Start));
  exports.Set("Stop", Napi::Function::New(env, Stop));
  exports.Set("SetDelay", Napi::Function::New(env, SetDelay));
  exports.Set("SetPoll", Napi::Function::New(env, SetPoll));
  exports.Set("GetStatus", Napi::Function::New(env, GetStatus));
  exports.Set("ListDevices", Napi::Function::New(env, GetStatus));
  exports.Set("WatchKey", Napi::Function::New(env, WatchKey));
  exports.Set("UnwatchKey", Napi::Function::New(env, UnwatchKey));
  return exports;
}

NODE_API_MODULE(blank_keyboard_engine, InitAll)
