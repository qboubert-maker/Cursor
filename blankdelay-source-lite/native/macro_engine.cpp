#include "macro_engine.h"

#include "ViGEm/Client.h"
#include "ViGEm/Common.h"
#include "ViGEm/Util.h"

#include <Xinput.h>

#ifndef XINPUT_GAMEPAD_GUIDE
#define XINPUT_GAMEPAD_GUIDE 0x0400
#endif
#ifndef CREATE_WAITABLE_TIMER_HIGH_RESOLUTION
#define CREATE_WAITABLE_TIMER_HIGH_RESOLUTION 0x00000002
#endif
#include <hidsdi.h>
#include <hidpi.h>
#include <SetupAPI.h>
#include <cfgmgr32.h>
#include <avrt.h>

#include "usb_rate.h"

#include <algorithm>
#include <cctype>
#include <cmath>
#include <cstring>
#include <vector>

#pragma comment(lib, "winmm.lib")
#pragma comment(lib, "xinput.lib")
#pragma comment(lib, "user32.lib")
#pragma comment(lib, "hid.lib")
#pragma comment(lib, "setupapi.lib")
#pragma comment(lib, "avrt.lib")
#pragma comment(lib, "cfgmgr32.lib")

namespace {

constexpr double kMaxDelayMs = 10.0;
constexpr int kTriggerThreshold = 30;
constexpr ULONG_PTR kEngineStamp = 0xB1A4DE1A;
constexpr LONGLONG kChatterUs = 1;
constexpr int kPollHz[] = {8000, 4000, 2000, 1000, 500, 250, 125, 63, 31, 16, 8};

int PollHzForDelay(double delayMs) {
  const int step = delayMs < 1.0 ? 0 : std::clamp(static_cast<int>(std::llround(delayMs)), 0, 10);
  return kPollHz[step];
}

bool IsGamepadHandle(HANDLE handle) {
  PHIDP_PREPARSED_DATA preparsed = nullptr;
  if (!HidD_GetPreparsedData(handle, &preparsed)) return false;
  HIDP_CAPS caps{};
  const NTSTATUS status = HidP_GetCaps(preparsed, &caps);
  HidD_FreePreparsedData(preparsed);
  return status == HIDP_STATUS_SUCCESS && caps.UsagePage == 0x01 && (caps.Usage == 0x04 || caps.Usage == 0x05);
}

int SonyRank(USHORT product) {
  if (product == 0x0DF2) return 4;
  if (product == 0x0CE6) return 3;
  if (product == 0x09CC) return 2;
  if (product == 0x05C4) return 1;
  return 2;
}

int XboxRank(USHORT product) {
  if (product == 0x0B12 || product == 0x0B13 || product == 0x0B00 || product == 0x0B20 || product == 0x0B22) return 4;
  if (product == 0x02EA || product == 0x02FD || product == 0x02FF || product == 0x02E3 || product == 0x02DD) return 3;
  if (product == 0x028E || product == 0x028F || product == 0x02D1 || product == 0x0719) return 2;
  return 1;
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

struct BindSlot {
  const char* name;
  WORD xinput;
  bool trigger;
  bool leftTrigger;
};

constexpr BindSlot kSlots[] = {
    {"L3", XINPUT_GAMEPAD_LEFT_THUMB, false, false},
    {"R3", XINPUT_GAMEPAD_RIGHT_THUMB, false, false},
    {"L1", XINPUT_GAMEPAD_LEFT_SHOULDER, false, false},
    {"R1", XINPUT_GAMEPAD_RIGHT_SHOULDER, false, false},
    {"L2", 0, true, true},
    {"R2", 0, true, false},
    {"A", XINPUT_GAMEPAD_A, false, false},
    {"B", XINPUT_GAMEPAD_B, false, false},
    {"X", XINPUT_GAMEPAD_X, false, false},
    {"Y", XINPUT_GAMEPAD_Y, false, false},
    {"UP", XINPUT_GAMEPAD_DPAD_UP, false, false},
    {"DOWN", XINPUT_GAMEPAD_DPAD_DOWN, false, false},
    {"LEFT", XINPUT_GAMEPAD_DPAD_LEFT, false, false},
    {"RIGHT", XINPUT_GAMEPAD_DPAD_RIGHT, false, false},
    {"SHARE", XINPUT_GAMEPAD_BACK, false, false},
    {"OPTIONS", XINPUT_GAMEPAD_START, false, false},
    {"TOUCH", 0, false, false},
    {"PS", XINPUT_GAMEPAD_GUIDE, false, false},
};

std::string Upper(std::string value) {
  for (char& ch : value) ch = static_cast<char>(std::toupper(static_cast<unsigned char>(ch)));
  std::string compact;
  compact.reserve(value.size());
  for (char ch : value) {
    if (ch != ' ' && ch != '_' && ch != '-') compact.push_back(ch);
  }
  return compact;
}

int SlotIndex(const std::string& name) {
  for (int index = 0; index < static_cast<int>(sizeof(kSlots) / sizeof(kSlots[0])); ++index) {
    if (name == kSlots[index].name) return index;
  }
  return -1;
}

uint32_t ReadMask(const XINPUT_STATE& state) {
  uint32_t mask = 0;
  const WORD buttons = state.Gamepad.wButtons;
  for (int index = 0; index < static_cast<int>(sizeof(kSlots) / sizeof(kSlots[0])); ++index) {
    const BindSlot& slot = kSlots[index];
    const bool down = slot.trigger
                          ? (slot.leftTrigger ? state.Gamepad.bLeftTrigger : state.Gamepad.bRightTrigger) >= kTriggerThreshold
                          : slot.xinput != 0 && (buttons & slot.xinput) != 0;
    if (down) mask |= 1u << index;
  }
  return mask;
}

void DrainRawPacket(LPARAM lparam) {
  UINT size = 0;
  GetRawInputData(reinterpret_cast<HRAWINPUT>(lparam), RID_INPUT, nullptr, &size, sizeof(RAWINPUTHEADER));
  if (size == 0) return;
  std::vector<BYTE> buffer(size);
  GetRawInputData(reinterpret_cast<HRAWINPUT>(lparam), RID_INPUT, buffer.data(), &size, sizeof(RAWINPUTHEADER));
}

LRESULT CALLBACK EngineWindowProc(HWND hwnd, UINT message, WPARAM wparam, LPARAM lparam) {
  if (message == WM_INPUT) {
    DrainRawPacket(lparam);
    return 0;
  }
  if (message == WM_APP) return 0;
  return DefWindowProcW(hwnd, message, wparam, lparam);
}

HWND CreateEngineWindow() {
  HINSTANCE instance = GetModuleHandleW(nullptr);
  WNDCLASSW windowClass{};
  windowClass.lpfnWndProc = EngineWindowProc;
  windowClass.hInstance = instance;
  windowClass.lpszClassName = L"BlankDelayControllerOptimizer";
  RegisterClassW(&windowClass);

  HWND hwnd = CreateWindowExW(0, windowClass.lpszClassName, L"", 0, 0, 0, 0, 0, HWND_MESSAGE, nullptr, instance, nullptr);
  if (!hwnd) return nullptr;

  RAWINPUTDEVICE devices[2]{};
  devices[0].usUsagePage = 0x01;
  devices[0].usUsage = 0x04;
  devices[0].dwFlags = RIDEV_INPUTSINK;
  devices[0].hwndTarget = hwnd;
  devices[1].usUsagePage = 0x01;
  devices[1].usUsage = 0x05;
  devices[1].dwFlags = RIDEV_INPUTSINK;
  devices[1].hwndTarget = hwnd;
  RegisterRawInputDevices(devices, 2, sizeof(RAWINPUTDEVICE));
  return hwnd;
}

void DestroyEngineWindow(HWND hwnd) {
  if (!hwnd) return;
  RAWINPUTDEVICE devices[2]{};
  devices[0].usUsagePage = 0x01;
  devices[0].usUsage = 0x04;
  devices[0].dwFlags = RIDEV_REMOVE;
  devices[0].hwndTarget = nullptr;
  devices[1].usUsagePage = 0x01;
  devices[1].usUsage = 0x05;
  devices[1].dwFlags = RIDEV_REMOVE;
  devices[1].hwndTarget = nullptr;
  RegisterRawInputDevices(devices, 2, sizeof(RAWINPUTDEVICE));
  DestroyWindow(hwnd);
}

void DrainMessages(HWND hwnd) {
  MSG message;
  while (PeekMessageW(&message, hwnd, 0, 0, PM_REMOVE)) {
    TranslateMessage(&message);
    DispatchMessageW(&message);
  }
}

std::vector<std::wstring> GamingInstancePaths();

}  // namespace

std::string CanonicalButton(std::string name) {
  name = Upper(std::move(name));
  if (name == "L3" || name == "LS" || name == "LEFTSTICK") return "L3";
  if (name == "R3" || name == "RS" || name == "RIGHTSTICK") return "R3";
  if (name == "L1" || name == "LB" || name == "LEFTBUMPER") return "L1";
  if (name == "R1" || name == "RB" || name == "RIGHTBUMPER") return "R1";
  if (name == "L2" || name == "LT" || name == "LEFTTRIGGER") return "L2";
  if (name == "R2" || name == "RT" || name == "RIGHTTRIGGER") return "R2";
  if (name == "A" || name == "SOUTH" || name == "CROSS") return "A";
  if (name == "B" || name == "EAST" || name == "CIRCLE") return "B";
  if (name == "X" || name == "WEST" || name == "SQUARE") return "X";
  if (name == "Y" || name == "NORTH" || name == "TRIANGLE") return "Y";
  if (name == "UP" || name == "DPADUP") return "UP";
  if (name == "DOWN" || name == "DPADDOWN") return "DOWN";
  if (name == "LEFT" || name == "DPADLEFT") return "LEFT";
  if (name == "RIGHT" || name == "DPADRIGHT") return "RIGHT";
  if (name == "SHARE" || name == "CREATE" || name == "VIEW" || name == "BACK") return "SHARE";
  if (name == "OPTIONS" || name == "MENU" || name == "START") return "OPTIONS";
  if (name == "TOUCH" || name == "TOUCHPAD" || name == "PAD") return "TOUCH";
  if (name == "PS" || name == "GUIDE" || name == "XBOX") return "PS";
  return "";
}

bool KnownButton(const std::string& name) { return !CanonicalButton(name).empty(); }

MacroEngine& Engine() {
  static MacroEngine instance;
  return instance;
}

MacroEngine::MacroEngine() {
  static_assert(sizeof(kSlots) / sizeof(kSlots[0]) == kEngineSlotCount, "button slot count");
  QueryPerformanceFrequency(&qpcFrequency);
  if (qpcFrequency.QuadPart <= 0) qpcFrequency.QuadPart = 1;
  for (const BindSlot& slot : kSlots) buttonDelayMap[slot.name] = 0;
}

MacroEngine::~MacroEngine() { Stop(); }

bool MacroEngine::Start() {
  if (isRunning.load()) return true;
  isRunning = true;
  if (timeBeginPeriod(1) == TIMERR_NOERROR) timerRaised_ = true;
  workerThread = std::thread([this] { RunInputLoop(); });
  SetThreadPriority(reinterpret_cast<HANDLE>(workerThread.native_handle()), THREAD_PRIORITY_HIGHEST);
  return true;
}

void MacroEngine::Stop() {
  isRunning = false;
  HWND hwnd = messageWindow_.load();
  if (hwnd) PostMessageW(hwnd, WM_APP, 0, 0);
  if (workerThread.joinable()) workerThread.join();
  if (timerRaised_) {
    timeEndPeriod(1);
    timerRaised_ = false;
  }
}

void MacroEngine::SetButtonDelay(const std::string& button, double delayMs) {
  const std::string key = CanonicalButton(button);
  const int index = SlotIndex(key);
  if (key.empty() || index < 0 || index >= kEngineSlotCount) return;
  const bool immediate = delayMs < 1.0;
  delayMs = immediate ? 0 : std::clamp(std::round(delayMs), 1.0, kMaxDelayMs);
  const int64_t ticks = immediate ? 0 : std::max<int64_t>(1, std::llround((static_cast<double>(qpcFrequency.QuadPart) * delayMs) / 1000.0));
  delayTicks_[index].store(ticks, std::memory_order_release);
  {
    std::lock_guard<std::mutex> lock(queueMutex_);
    QueryPerformanceCounter(&qpcCounter);
    const LONGLONG now = qpcCounter.QuadPart;
    for (TimedEdge& edge : queue_) {
      if (edge.button != key) continue;
      if (immediate) edge.due = now;
      else {
        const LONGLONG due = edge.issued + ticks;
        edge.due = due < now ? now : due;
      }
    }
  }
  if (immediate) {
    const uint32_t flag = 1u << index;
    uint32_t mask = delayedMask_.load(std::memory_order_relaxed);
    if ((physical_.mask & flag) != 0) mask |= flag;
    else mask &= ~flag;
    delayedMask_.store(mask, std::memory_order_release);
  }
  scheduleRevision_.fetch_add(1, std::memory_order_release);
  std::lock_guard<std::mutex> lock(configMutex);
  buttonDelayMap[key] = delayMs;
}

void MacroEngine::SetPollMs(double delayMs) {
  requestedHz_.store(PollHzForDelay(delayMs), std::memory_order_release);
}

void MacroEngine::ServicePollRequest() {
  const int hz = requestedHz_.load(std::memory_order_acquire);
  if (usbInstance_.empty()) return;
  if (armedHz_ == hz && armedInstance_ == usbInstance_) return;
  armedHz_ = hz;
  armedInstance_ = usbInstance_;
  if (usbTargets_.empty()) usbTargets_.push_back(usbInstance_);

  std::vector<std::pair<std::wstring, int>> changes;
  for (const std::wstring& target : usbTargets_) {
    const usbrate::Link link = usbrate::Read(target);
    if (link.speed < 0) continue;
    const int want = usbrate::IntervalFor(link.speed, hz);
    const bool refused = std::find(refusedRates_.begin(), refusedRates_.end(), std::make_pair(target, want)) != refusedRates_.end();
    if (refused || usbrate::SameRate(link.speed, link.interval, want)) {
      usbrate::WriteInterval(target, static_cast<DWORD>(link.interval));
      continue;
    }
    EnsureHidusbf(target);
    if (usbrate::WriteInterval(target, static_cast<DWORD>(want))) changes.emplace_back(target, want);
  }

  if (!changes.empty()) {
    const std::wstring instance = usbInstance_;
    const std::vector<std::wstring> targets = usbTargets_;
    switchUntil_.store(GetTickCount64() + 8000, std::memory_order_release);
    ClosePhysicalPad();
    usbInstance_ = instance;
    usbTargets_ = targets;
    for (const auto& change : changes) usbrate::Restart(change.first);
    for (const auto& change : changes) {
      const usbrate::Link after = usbrate::WaitForLink(change.first, 3000);
      if (after.interval > 0 && !usbrate::SameRate(after.speed, after.interval, change.second)) {
        usbrate::WriteInterval(change.first, static_cast<DWORD>(after.interval));
        refusedRates_.emplace_back(change.first, change.second);
      }
    }
    rateWindowStart_ = 0;
    rateWindowCount_ = 0;
    measuredHz_.store(0, std::memory_order_release);
    OpenPhysicalPad();
  }

  const usbrate::Link link = usbrate::Read(armedInstance_);
  linkSpeed_.store(link.speed, std::memory_order_release);
  linkHz_.store(usbrate::HzFor(link.speed, link.interval), std::memory_order_release);
  appliedHz_.store(hz, std::memory_order_release);
}

void MacroEngine::NoteReport() {
  QueryPerformanceCounter(&qpcCounter);
  const LONGLONG now = qpcCounter.QuadPart;
  if (rateWindowStart_ == 0) {
    rateWindowStart_ = now;
    rateWindowCount_ = 0;
    return;
  }
  rateWindowCount_ += 1;
  const LONGLONG elapsed = now - rateWindowStart_;
  if (elapsed < qpcFrequency.QuadPart / 2) return;
  const int hz = static_cast<int>(std::llround(static_cast<double>(rateWindowCount_) * static_cast<double>(qpcFrequency.QuadPart) / static_cast<double>(elapsed)));
  measuredHz_.store(std::max(0, hz), std::memory_order_release);
  rateWindowStart_ = now;
  rateWindowCount_ = 0;
}

double MacroEngine::GetButtonDelay(const std::string& button) {
  const std::string key = CanonicalButton(button);
  if (key.empty()) return 0;
  std::lock_guard<std::mutex> lock(configMutex);
  const auto found = buttonDelayMap.find(key);
  return found == buttonDelayMap.end() ? 0 : found->second;
}

void MacroEngine::SetConsole(const std::string& console) {
  wantPlayStation_ = console != "xbox";
}

void MacroEngine::RunInputLoop() {
  SetThreadPriority(GetCurrentThread(), THREAD_PRIORITY_HIGHEST);
  DWORD mmTask = 0;
  HANDLE mmCss = AvSetMmThreadCharacteristicsW(L"Pro Audio", &mmTask);
  HWND hwnd = CreateEngineWindow();
  messageWindow_ = hwnd;
  routeMessage_ = "Starting the controller driver";
  OpenPhysicalPad();
  const std::vector<std::wstring> physicalDevices = GamingInstancePaths();
  activePlayStation_ = wantPlayStation_.load();
  const bool virtualPad = StartVirtualPad();
  if (virtualPad) CloakPhysicalPads(physicalDevices);
  else if (routeMessage_.find("PlayStation 5") == std::string::npos) routeMessage_ = "The virtual controller did not start, so the delay cannot reach games";

  HANDLE timer = CreateWaitableTimerExW(nullptr, nullptr, CREATE_WAITABLE_TIMER_HIGH_RESOLUTION, TIMER_ALL_ACCESS);
  if (!timer) timer = CreateWaitableTimerW(nullptr, FALSE, nullptr);
  uint32_t sentMask = 0xFFFFFFFF;
  uint32_t sentDelayed = 0xFFFFFFFF;
  int16_t sentLX = 1;
  int16_t sentLY = 1;
  int16_t sentRX = 1;
  int16_t sentRY = 1;
  uint8_t sentL2 = 1;
  uint8_t sentR2 = 1;
  while (isRunning.load()) {
    const bool wantPlayStation = wantPlayStation_.load();
    const bool haveOutput = dualSenseOutput_ || vigemClient_ != nullptr;
    if (haveOutput && wantPlayStation != activePlayStation_) {
      StopVirtualPad();
      activePlayStation_ = wantPlayStation;
      StartVirtualPad();
      sentMask = 0xFFFFFFFF;
    }
    DrainMessages(hwnd);
    if (padHandle_ == INVALID_HANDLE_VALUE) {
      QueryPerformanceCounter(&qpcCounter);
      if (openAttempt_ == 0 || qpcCounter.QuadPart - openAttempt_ >= qpcFrequency.QuadPart) {
        openAttempt_ = qpcCounter.QuadPart;
        OpenPhysicalPad();
      }
    }
    ServicePollRequest();
    ReadPhysicalPad();
    PollPads();
    FireDue();
    const uint32_t delayed = delayedMask_.load(std::memory_order_acquire);
    const bool changed = physical_.mask != sentMask || delayed != sentDelayed || physical_.leftX != sentLX || physical_.leftY != sentLY || physical_.rightX != sentRX || physical_.rightY != sentRY || physical_.leftTrigger != sentL2 || physical_.rightTrigger != sentR2;
    if (changed) {
      PublishPad();
      sentMask = physical_.mask;
      sentDelayed = delayed;
      sentLX = physical_.leftX;
      sentLY = physical_.leftY;
      sentRX = physical_.rightX;
      sentRY = physical_.rightY;
      sentL2 = physical_.leftTrigger;
      sentR2 = physical_.rightTrigger;
    }

    const LONGLONG due = NextDue();
    QueryPerformanceCounter(&qpcCounter);
    const LONGLONG now = qpcCounter.QuadPart;
    const LONGLONG tight = std::max<LONGLONG>(1, qpcFrequency.QuadPart / 10000);
    if (due > now && due - now <= tight) {
      const uint32_t seen = scheduleRevision_.load(std::memory_order_acquire);
      while (isRunning.load(std::memory_order_relaxed)) {
        if (scheduleRevision_.load(std::memory_order_acquire) != seen) break;
        QueryPerformanceCounter(&qpcCounter);
        if (qpcCounter.QuadPart >= due) break;
        YieldProcessor();
      }
      continue;
    }

    if (!(due > now) && !padReadPending_ && padHandle_ != INVALID_HANDLE_VALUE) continue;
    HANDLE handles[2]{};
    DWORD count = 0;
    if (padEvent_ && padReadPending_) handles[count++] = padEvent_;
    if (due > now && timer) {
      const LONGLONG remain = -std::max<LONGLONG>(100, static_cast<LONGLONG>(static_cast<double>(due - now) * 1e7 / static_cast<double>(qpcFrequency.QuadPart)));
      LARGE_INTEGER rel{};
      rel.QuadPart = remain;
      SetWaitableTimer(timer, &rel, 0, nullptr, nullptr, FALSE);
      handles[count++] = timer;
    }
    MsgWaitForMultipleObjects(count, count ? handles : nullptr, FALSE, 50, QS_ALLINPUT);
  }
  if (mmCss) AvRevertMmThreadCharacteristics(mmCss);
  if (timer) CloseHandle(timer);

  RestorePhysicalPads();
  StopVirtualPad();
  ClosePhysicalPad();
  messageWindow_ = nullptr;
  DestroyEngineWindow(hwnd);
}

void MacroEngine::PollPads() {
  const uint32_t mask = physical_.connected ? physical_.mask : 0;

  const uint32_t previous = physicalMask_;
  physicalMask_ = mask;
  const uint32_t changed = previous ^ mask;
  if (!changed) return;

  for (int index = 0; index < static_cast<int>(sizeof(kSlots) / sizeof(kSlots[0])); ++index) {
    const uint32_t flag = 1u << index;
    if ((changed & flag) == 0) continue;
    if ((mask & flag) != 0) buttonPresses_.fetch_add(1, std::memory_order_release);
    const int64_t ticks = index < kEngineSlotCount ? delayTicks_[index].load(std::memory_order_acquire) : 0;
    Enqueue(kSlots[index].name, (mask & flag) != 0, ticks);
  }
}

void MacroEngine::Enqueue(const std::string& button, bool down, int64_t ticks) {
  QueryPerformanceCounter(&qpcCounter);
  const LONGLONG now = qpcCounter.QuadPart;
  if (ticks < 0) ticks = 0;
  const LONGLONG chatter = (qpcFrequency.QuadPart * kChatterUs) / 1000000;

  std::lock_guard<std::mutex> lock(queueMutex_);
  if (!queue_.empty()) {
    const TimedEdge& tail = queue_.back();
    if (tail.button == button && tail.down != down && now >= tail.issued && (now - tail.issued) < chatter) {
      queue_.pop_back();
      return;
    }
  }

  TimedEdge edge;
  edge.button = button;
  edge.down = down;
  edge.issued = now;
  if (ticks <= 0) edge.due = now;
  else edge.due = now + ticks;
  queue_.push_back(edge);
}

void MacroEngine::FireDue() {
  QueryPerformanceCounter(&qpcCounter);
  const LONGLONG now = qpcCounter.QuadPart;
  std::deque<TimedEdge> due;
  {
    std::lock_guard<std::mutex> lock(queueMutex_);
    auto it = queue_.begin();
    while (it != queue_.end()) {
      if (it->due <= now) {
        due.push_back(*it);
        it = queue_.erase(it);
      } else {
        ++it;
      }
    }
  }
  for (const TimedEdge& edge : due) {
    QueryPerformanceCounter(&qpcCounter);
    const LONGLONG jitter = ((qpcCounter.QuadPart - edge.due) * 1000000) / qpcFrequency.QuadPart;
    {
      std::lock_guard<std::mutex> lock(queueMutex_);
      lastJitterUs_ = jitter;
    }
    Dispatch(edge);
  }
}

void MacroEngine::Dispatch(const TimedEdge& edge) {
  const int index = SlotIndex(edge.button);
  if (index >= 0) {
    const uint32_t flag = 1u << index;
    uint32_t mask = delayedMask_.load(std::memory_order_relaxed);
    if (edge.down) mask |= flag;
    else mask &= ~flag;
    delayedMask_.store(mask, std::memory_order_release);
  }

  uint16_t scan = 0;
  {
    std::lock_guard<std::mutex> lock(configMutex);
    const auto found = scanCodes_.find(edge.button);
    if (found != scanCodes_.end()) scan = found->second;
  }
  if (scan == 0) return;

  INPUT input{};
  input.type = INPUT_KEYBOARD;
  input.ki.wScan = scan;
  input.ki.dwFlags = KEYEVENTF_SCANCODE | (edge.down ? 0 : KEYEVENTF_KEYUP);
  input.ki.dwExtraInfo = kEngineStamp;
  SendInput(1, &input, sizeof(INPUT));
}

LONGLONG MacroEngine::NextDue() {
  std::lock_guard<std::mutex> lock(queueMutex_);
  LONGLONG due = 0;
  for (const TimedEdge& edge : queue_) {
    if (due == 0 || edge.due < due) due = edge.due;
  }
  return due;
}

namespace {

constexpr USHORT kVirtualButtons[] = {
    XUSB_GAMEPAD_LEFT_THUMB,
    XUSB_GAMEPAD_RIGHT_THUMB,
    XUSB_GAMEPAD_LEFT_SHOULDER,
    XUSB_GAMEPAD_RIGHT_SHOULDER,
    0,
    0,
    XUSB_GAMEPAD_A,
    XUSB_GAMEPAD_B,
    XUSB_GAMEPAD_X,
    XUSB_GAMEPAD_Y,
    XUSB_GAMEPAD_DPAD_UP,
    XUSB_GAMEPAD_DPAD_DOWN,
    XUSB_GAMEPAD_DPAD_LEFT,
    XUSB_GAMEPAD_DPAD_RIGHT,
    XUSB_GAMEPAD_BACK,
    XUSB_GAMEPAD_START,
    0,
    XUSB_GAMEPAD_GUIDE,
};

std::string RunHidHide(const std::wstring& args) {
  SECURITY_ATTRIBUTES security{sizeof(security), nullptr, TRUE};
  HANDLE readPipe = nullptr;
  HANDLE writePipe = nullptr;
  if (!CreatePipe(&readPipe, &writePipe, &security, 0)) return {};
  SetHandleInformation(readPipe, HANDLE_FLAG_INHERIT, 0);
  STARTUPINFOW startup{sizeof(startup)};
  startup.dwFlags = STARTF_USESTDHANDLES | STARTF_USESHOWWINDOW;
  startup.wShowWindow = SW_HIDE;
  startup.hStdOutput = writePipe;
  startup.hStdError = writePipe;
  std::wstring command = L"\"C:\\Program Files\\Nefarius Software Solutions\\HidHide\\x64\\HidHideCLI.exe\" " + args;
  std::vector<wchar_t> mutableCommand(command.begin(), command.end());
  mutableCommand.push_back(L'\0');
  PROCESS_INFORMATION process{};
  if (!CreateProcessW(nullptr, mutableCommand.data(), nullptr, nullptr, TRUE, CREATE_NO_WINDOW, nullptr, nullptr, &startup, &process)) {
    CloseHandle(readPipe);
    CloseHandle(writePipe);
    return {};
  }
  CloseHandle(writePipe);
  std::string output;
  char buffer[1024];
  DWORD read = 0;
  while (ReadFile(readPipe, buffer, sizeof(buffer), &read, nullptr) && read) output.append(buffer, read);
  WaitForSingleObject(process.hProcess, 8000);
  CloseHandle(process.hProcess);
  CloseHandle(process.hThread);
  CloseHandle(readPipe);
  return output;
}

std::wstring JsonUnescape(const std::string& value) {
  std::wstring out;
  for (size_t i = 0; i < value.size(); ++i) {
    if (value[i] == '\\' && i + 1 < value.size() && value[i + 1] == '\\') {
      out.push_back(L'\\');
      ++i;
    } else {
      out.push_back(static_cast<unsigned char>(value[i]));
    }
  }
  return out;
}

std::vector<std::wstring> GamingInstancePaths() {
  const std::string output = RunHidHide(L"--dev-gaming");
  std::vector<std::wstring> paths;
  const std::string key = "\"deviceInstancePath\"";
  size_t cursor = 0;
  while ((cursor = output.find(key, cursor)) != std::string::npos) {
    const size_t quote = output.find('"', output.find(':', cursor) + 1);
    const size_t end = quote == std::string::npos ? std::string::npos : output.find('"', quote + 1);
    if (quote == std::string::npos || end == std::string::npos) break;
    paths.push_back(JsonUnescape(output.substr(quote + 1, end - quote - 1)));
    cursor = end + 1;
  }
  return paths;
}

int16_t StickAxis(uint8_t value) {
  const int scaled = (static_cast<int>(value) - 128) * 257;
  return static_cast<int16_t>(std::clamp(scaled, -32767, 32767));
}

int16_t InvertStick(int16_t value) {
  return static_cast<int16_t>(std::clamp(-static_cast<int>(value), -32767, 32767));
}

int16_t SettleStick(int16_t value) {
  return (value > -2400 && value < 2400) ? static_cast<int16_t>(0) : value;
}

BYTE Ds4Stick(int value) {
  if (value > -2400 && value < 2400) return 128;
  const int shifted = std::clamp(value, -32767, 32767) + 32767;
  return static_cast<BYTE>((shifted * 255) / 65534);
}

void ApplySonyReport(const uint8_t* data, DWORD size, PhysicalPad& pad) {
  if (size < 10) return;
  size_t base = 0;
  if (data[0] == 0x01) base = 1;
  else if (data[0] == 0x31 && size >= 12) base = 2;
  else return;
  if (base + 8 >= size) return;
  pad.connected = true;
  pad.leftX = StickAxis(data[base + 0]);
  pad.leftY = InvertStick(StickAxis(data[base + 1]));
  pad.rightX = StickAxis(data[base + 2]);
  pad.rightY = InvertStick(StickAxis(data[base + 3]));
  pad.leftTrigger = data[base + 4];
  pad.rightTrigger = data[base + 5];
  const uint8_t face = data[base + 7];
  const uint8_t shoulders = data[base + 8];
  const int hat = face & 0x0f;
  uint32_t mask = 0;
  if (shoulders & 0x40) mask |= 1u << 0;
  if (shoulders & 0x80) mask |= 1u << 1;
  if (shoulders & 0x01) mask |= 1u << 2;
  if (shoulders & 0x02) mask |= 1u << 3;
  if ((shoulders & 0x04) || pad.leftTrigger >= kTriggerThreshold) mask |= 1u << 4;
  if ((shoulders & 0x08) || pad.rightTrigger >= kTriggerThreshold) mask |= 1u << 5;
  if (face & 0x20) mask |= 1u << 6;
  if (face & 0x40) mask |= 1u << 7;
  if (face & 0x10) mask |= 1u << 8;
  if (face & 0x80) mask |= 1u << 9;
  if (hat == 0 || hat == 1 || hat == 7) mask |= 1u << 10;
  if (hat == 3 || hat == 4 || hat == 5) mask |= 1u << 11;
  if (hat == 5 || hat == 6 || hat == 7) mask |= 1u << 12;
  if (hat == 1 || hat == 2 || hat == 3) mask |= 1u << 13;
  if (shoulders & 0x10) mask |= 1u << 14;
  if (shoulders & 0x20) mask |= 1u << 15;
  if (base + 9 < size) {
    const uint8_t special = data[base + 9];
    if (special & 0x02) mask |= 1u << 16;
    if (special & 0x01) mask |= 1u << 17;
  }
  pad.mask = mask;
}

}  // namespace

bool MacroEngine::OpenPhysicalPad() {
  usbTargets_.clear();
  GUID guid{};
  HidD_GetHidGuid(&guid);
  HDEVINFO devices = SetupDiGetClassDevsW(&guid, nullptr, nullptr, DIGCF_PRESENT | DIGCF_DEVICEINTERFACE);
  if (devices == INVALID_HANDLE_VALUE) return false;
  HANDLE best = INVALID_HANDLE_VALUE;
  std::wstring bestPath;
  DEVINST bestNode = 0;
  int bestRank = 0;
  SP_DEVICE_INTERFACE_DATA iface{sizeof(iface)};
  for (DWORD index = 0; SetupDiEnumDeviceInterfaces(devices, nullptr, &guid, index, &iface); ++index) {
    DWORD size = 0;
    SetupDiGetDeviceInterfaceDetailW(devices, &iface, nullptr, 0, &size, nullptr);
    std::vector<uint8_t> buffer(size);
    auto detail = reinterpret_cast<SP_DEVICE_INTERFACE_DETAIL_DATA_W*>(buffer.data());
    detail->cbSize = sizeof(SP_DEVICE_INTERFACE_DETAIL_DATA_W);
    SP_DEVINFO_DATA devInfo{sizeof(devInfo)};
    if (!SetupDiGetDeviceInterfaceDetailW(devices, &iface, detail, size, nullptr, &devInfo)) continue;
    HANDLE handle = CreateFileW(detail->DevicePath, GENERIC_READ | GENERIC_WRITE, FILE_SHARE_READ | FILE_SHARE_WRITE, nullptr, OPEN_EXISTING, FILE_FLAG_OVERLAPPED, nullptr);
    if (handle == INVALID_HANDLE_VALUE) continue;
    HIDD_ATTRIBUTES attributes{sizeof(attributes)};
    int rank = 0;
    if (HidD_GetAttributes(handle, &attributes) && IsGamepadHandle(handle)) {
      if (attributes.VendorID == 0x054C) rank = SonyRank(attributes.ProductID);
      else if (attributes.VendorID == 0x045E) rank = XboxRank(attributes.ProductID);
      if (rank > 0 && attributes.VendorID == 0x054C && wantPlayStation_.load()) rank += 20;
      if (rank > 0 && attributes.VendorID == 0x045E && !wantPlayStation_.load()) rank += 20;
    }
    if (rank > 0 && devInfo.DevInst) {
      DEVINST node = devInfo.DevInst;
      bool virtualBus = false;
      std::wstring usbId;
      for (int hop = 0; hop < 8; ++hop) {
        wchar_t id[MAX_DEVICE_ID_LEN]{};
        if (CM_Get_Device_IDW(node, id, MAX_DEVICE_ID_LEN, 0) == CR_SUCCESS) {
          if (wcsstr(id, L"ViGEm") || wcsstr(id, L"VIGEM") || wcsstr(id, L"Nefarius") || wcsstr(id, L"VIRTUAL")) virtualBus = true;
          const bool usbPad = wcsstr(id, L"USB\\VID_054C") || wcsstr(id, L"USB\\VID_045E");
          if (usbId.empty() && usbPad && !wcsstr(id, L"&MI_")) usbId = id;
        }
        DEVINST parent = 0;
        if (CM_Get_Parent(&parent, node, 0) != CR_SUCCESS) break;
        node = parent;
      }
      if (virtualBus) rank = 0;
      else if (!usbId.empty() && std::find(usbTargets_.begin(), usbTargets_.end(), usbId) == usbTargets_.end()) usbTargets_.push_back(usbId);
    }
    if (rank > bestRank) {
      if (best != INVALID_HANDLE_VALUE) CloseHandle(best);
      best = handle;
      bestPath = detail->DevicePath;
      bestNode = devInfo.DevInst;
      bestRank = rank;
    } else {
      CloseHandle(handle);
    }
  }
  SetupDiDestroyDeviceInfoList(devices);
  if (best == INVALID_HANDLE_VALUE) return false;
  padHandle_ = best;
  padPath_ = bestPath;
  HIDD_ATTRIBUTES opened{sizeof(opened)};
  padVendor_ = HidD_GetAttributes(padHandle_, &opened) ? opened.VendorID : 0;
  HidD_SetNumInputBuffers(padHandle_, 512);
  if (bestNode) {
    DEVINST node = bestNode;
    for (int hop = 0; hop < 8; ++hop) {
      wchar_t id[MAX_DEVICE_ID_LEN]{};
      if (CM_Get_Device_IDW(node, id, MAX_DEVICE_ID_LEN, 0) == CR_SUCCESS) {
        const bool usbPad = wcsstr(id, L"USB\\VID_054C") || wcsstr(id, L"USB\\VID_045E");
        if (usbPad && !wcsstr(id, L"&MI_")) {
          usbInstance_ = id;
          if (std::find(usbTargets_.begin(), usbTargets_.end(), usbInstance_) == usbTargets_.end()) usbTargets_.push_back(usbInstance_);
          if (DeviceHasHidusbf(id)) break;
        }
      }
      DEVINST parent = 0;
      if (CM_Get_Parent(&parent, node, 0) != CR_SUCCESS) break;
      node = parent;
    }
  }
  pollReady_.store(!usbInstance_.empty(), std::memory_order_release);
  padEvent_ = CreateEventW(nullptr, TRUE, FALSE, nullptr);
  padRead_ = {};
  padRead_.hEvent = padEvent_;
  padReadPending_ = false;
  return true;
}

void MacroEngine::ClosePhysicalPad() {
  if (padReadPending_ && padHandle_ != INVALID_HANDLE_VALUE) CancelIo(padHandle_);
  if (padHandle_ != INVALID_HANDLE_VALUE) CloseHandle(padHandle_);
  if (padEvent_) CloseHandle(padEvent_);
  padHandle_ = INVALID_HANDLE_VALUE;
  padPath_.clear();
  pollReady_.store(false, std::memory_order_release);
  padEvent_ = nullptr;
  padReadPending_ = false;
}

void MacroEngine::ReadPhysicalPad() {
  if (padHandle_ != INVALID_HANDLE_VALUE) {
    for (int burst = 0; burst < 64; ++burst) {
      if (!padReadPending_) {
        ResetEvent(padEvent_);
        padRead_.hEvent = padEvent_;
        DWORD read = 0;
        if (!ReadFile(padHandle_, padBuffer_, sizeof(padBuffer_), &read, &padRead_)) {
          if (GetLastError() == ERROR_IO_PENDING) padReadPending_ = true;
          else ClosePhysicalPad();
          break;
        }
        if (!read) break;
        padReportSize_ = read;
        if (padVendor_ == 0x054C) ApplySonyReport(padBuffer_, read, physical_);
        NoteReport();
        PollPads();
        continue;
      }
      if (WaitForSingleObject(padEvent_, 0) != WAIT_OBJECT_0) break;
      DWORD read = 0;
      if (GetOverlappedResult(padHandle_, &padRead_, &read, FALSE) && read) {
        padReportSize_ = read;
        if (padVendor_ == 0x054C) ApplySonyReport(padBuffer_, read, physical_);
        NoteReport();
        PollPads();
      }
      padReadPending_ = false;
      ResetEvent(padEvent_);
    }
    if (physical_.connected && (wantPlayStation_.load() || padVendor_ != 0x054C)) return;
  }

  PhysicalPad pad;
  for (DWORD index = 0; index < 4; ++index) {
    if (index == virtualIndex_) continue;
    XINPUT_STATE state{};
    if (XInputGetState(index, &state) != ERROR_SUCCESS) continue;
    pad.connected = true;
    pad.mask = ReadMask(state);
    pad.leftTrigger = state.Gamepad.bLeftTrigger;
    pad.rightTrigger = state.Gamepad.bRightTrigger;
    pad.leftX = state.Gamepad.sThumbLX;
    pad.leftY = state.Gamepad.sThumbLY;
    pad.rightX = state.Gamepad.sThumbRX;
    pad.rightY = state.Gamepad.sThumbRY;
    break;
  }
  if (!pad.connected && padHandle_ == INVALID_HANDLE_VALUE) physical_ = {};
  else if (pad.connected) physical_ = pad;
}

bool MacroEngine::StartDualSense() {
  StopDualSense();
  ps5NeedsAdmin_ = false;
  const wchar_t* library = L"C:\\Program Files\\Nefarius Software Solutions\\Nefarius VirtualPad Driver Runtime\\runtime\\x64\\NefariusVirtualPadRuntime.dll";
  HMODULE lib = LoadLibraryW(library);
  if (!lib) return false;
  using CreateFn = int(__stdcall*)(uint32_t, void**);
  using DestroyFn = int(__stdcall*)(void*);
  using SubmitFn = int(__stdcall*)(void*, const uint8_t*, uint32_t);
  auto create = reinterpret_cast<CreateFn>(GetProcAddress(lib, "VPadRuntimeDualSenseDeviceCreate"));
  auto destroy = reinterpret_cast<DestroyFn>(GetProcAddress(lib, "VPadRuntimeDualSenseDeviceDestroy"));
  auto submit = reinterpret_cast<SubmitFn>(GetProcAddress(lib, "VPadRuntimeDualSenseDeviceReportSubmit"));
  void* device = nullptr;
  SetLastError(0);
  const int created = create && destroy && submit ? create(0, &device) : 0;
  if (!create || !destroy || !submit || !device || created != 0x20000000) {
    FreeLibrary(lib);
    return false;
  }
  dualSenseLib_ = lib;
  dualSenseDevice_ = device;
  dualSenseDestroy_ = reinterpret_cast<void*>(destroy);
  dualSenseSubmit_ = reinterpret_cast<void*>(submit);
  dualSenseOutput_ = true;
  routeActive_ = true;
  routeMessage_ = "PlayStation 5 output is live. Games see a DualSense while this app is open";
  return true;
}

void MacroEngine::StopDualSense() {
  if (dualSenseDevice_ && dualSenseDestroy_) {
    reinterpret_cast<int(__stdcall*)(void*)>(dualSenseDestroy_)(dualSenseDevice_);
  }
  dualSenseDevice_ = nullptr;
  dualSenseDestroy_ = nullptr;
  dualSenseSubmit_ = nullptr;
  dualSenseOutput_ = false;
  if (dualSenseLib_) {
    FreeLibrary(static_cast<HMODULE>(dualSenseLib_));
    dualSenseLib_ = nullptr;
  }
}

void MacroEngine::PublishDualSense(uint32_t buttons) {
  if (!dualSenseDevice_ || !dualSenseSubmit_) return;
  uint8_t report[64]{};
  report[0] = 0x01;
  report[1] = report[2] = report[3] = report[4] = 0x80;
  report[8] = 0x08;
  const bool rawUsb = padBuffer_[0] == 0x01 && padReportSize_ >= 10;
  if (rawUsb) {
    const uint32_t count = padReportSize_ < sizeof(report) ? padReportSize_ : static_cast<uint32_t>(sizeof(report));
    memcpy(report, padBuffer_, count);
  }
  const auto axis = [](int value) {
    const int shifted = std::clamp(value, -32767, 32767) + 32767;
    return static_cast<uint8_t>((shifted * 255) / 65534);
  };
  report[0] = 0x01;
  if (!rawUsb) {
    report[1] = axis(physical_.leftX);
    report[2] = axis(-static_cast<int>(physical_.leftY));
    report[3] = axis(physical_.rightX);
    report[4] = axis(-static_cast<int>(physical_.rightY));
  }
  const bool up = (buttons & (1u << 10)) != 0;
  const bool down = (buttons & (1u << 11)) != 0;
  const bool left = (buttons & (1u << 12)) != 0;
  const bool right = (buttons & (1u << 13)) != 0;
  uint8_t hat = 8;
  if (up && right) hat = 1;
  else if (right && down) hat = 3;
  else if (down && left) hat = 5;
  else if (left && up) hat = 7;
  else if (up) hat = 0;
  else if (right) hat = 2;
  else if (down) hat = 4;
  else if (left) hat = 6;
  uint8_t face = hat;
  if (buttons & (1u << 8)) face |= 0x10;
  if (buttons & (1u << 6)) face |= 0x20;
  if (buttons & (1u << 7)) face |= 0x40;
  if (buttons & (1u << 9)) face |= 0x80;
  uint8_t shoulders = 0;
  if (buttons & (1u << 2)) shoulders |= 0x01;
  if (buttons & (1u << 3)) shoulders |= 0x02;
  if (buttons & (1u << 4)) shoulders |= 0x04;
  if (buttons & (1u << 5)) shoulders |= 0x08;
  if (buttons & (1u << 14)) shoulders |= 0x10;
  if (buttons & (1u << 15)) shoulders |= 0x20;
  if (buttons & (1u << 0)) shoulders |= 0x40;
  if (buttons & (1u << 1)) shoulders |= 0x80;
  uint8_t special = report[10] & static_cast<uint8_t>(~0x03);
  if (buttons & (1u << 17)) special |= 0x01;
  if (buttons & (1u << 16)) special |= 0x02;
  report[5] = (buttons & (1u << 4)) ? (physical_.leftTrigger ? physical_.leftTrigger : 255) : 0;
  report[6] = (buttons & (1u << 5)) ? (physical_.rightTrigger ? physical_.rightTrigger : 255) : 0;
  report[8] = face;
  report[9] = shoulders;
  report[10] = special;
  reinterpret_cast<int(__stdcall*)(void*, const uint8_t*, uint32_t)>(dualSenseSubmit_)(dualSenseDevice_, report, sizeof(report));
}

bool MacroEngine::StartVirtualPad() {
  auto client = vigem_alloc();
  if (!client || !VIGEM_SUCCESS(vigem_connect(client))) {
    if (client) vigem_free(client);
    routeActive_ = false;
    routeMessage_ = "ViGEm is not available, so games still see the original controller";
    return false;
  }
  auto target = activePlayStation_ ? vigem_target_ds4_alloc() : vigem_target_x360_alloc();
  if (!target || !VIGEM_SUCCESS(vigem_target_add(client, target))) {
    if (target) vigem_target_free(target);
    vigem_disconnect(client);
    vigem_free(client);
    routeActive_ = false;
    routeMessage_ = activePlayStation_ ? "DualShock 4 output did not start" : "The virtual controller could not be created";
    return false;
  }
  virtualIndex_ = 0xFFFFFFFF;
  if (!activePlayStation_) {
    ULONG index = 0;
    if (VIGEM_SUCCESS(vigem_target_x360_get_user_index(client, target, &index))) virtualIndex_ = index;
  }
  vigemClient_ = client;
  vigemTarget_ = target;
  routeActive_ = true;
  routeMessage_ = activePlayStation_
                     ? "DualShock 4 output is live. The delay reaches games while this app is open"
                     : "Xbox output is live. Games see an Xbox controller while this app is open";
  return true;
}

void MacroEngine::StopVirtualPad() {
  StopDualSense();
  auto client = static_cast<PVIGEM_CLIENT>(vigemClient_);
  auto target = static_cast<PVIGEM_TARGET>(vigemTarget_);
  if (client && target) {
    if (activePlayStation_) {
      DS4_REPORT report;
      DS4_REPORT_INIT(&report);
      vigem_target_ds4_update(client, target, report);
    } else {
      XUSB_REPORT report{};
      XUSB_REPORT_INIT(&report);
      vigem_target_x360_update(client, target, report);
    }
    vigem_target_remove(client, target);
    vigem_target_free(target);
  }
  if (client) {
    vigem_disconnect(client);
    vigem_free(client);
  }
  vigemClient_ = nullptr;
  vigemTarget_ = nullptr;
  virtualIndex_ = 0xFFFFFFFF;
  routeActive_ = false;
}

bool MacroEngine::CloakPhysicalPads(const std::vector<std::wstring>& devices) {
  wchar_t executable[MAX_PATH]{};
  GetModuleFileNameW(nullptr, executable, MAX_PATH);
  RunHidHide(L"--app-reg \"" + std::wstring(executable) + L"\"");
  const std::string state = RunHidHide(L"--cloak-state");
  const bool alreadyOn = state.find("--cloak-on") != std::string::npos;
  for (const std::wstring& path : devices) {
    if (path.find(L"VID_054C") == std::wstring::npos && path.find(L"VID_045E") == std::wstring::npos) continue;
    RunHidHide(L"--dev-hide \"" + path + L"\"");
    hiddenDevices_.push_back(path);
  }
  if (hiddenDevices_.empty()) {
    routeMessage_ = "The controller is mirrored, but it could not be hidden from games";
    return false;
  }
  if (!alreadyOn) {
    RunHidHide(L"--cloak-on");
    cloakEnabledByUs_ = true;
  }
  if (activePlayStation_) routeMessage_ = "DualShock 4 output is live. The delay reaches games while this app is open";
  else routeMessage_ = "Xbox output is live. Games see an Xbox controller while this app is open";
  return true;
}

void MacroEngine::RestorePhysicalPads() {
  for (const std::wstring& path : hiddenDevices_) RunHidHide(L"--dev-unhide \"" + path + L"\"");
  hiddenDevices_.clear();
  if (cloakEnabledByUs_) {
    RunHidHide(L"--cloak-off");
    cloakEnabledByUs_ = false;
  }
  routeMessage_ = "Original controller restored";
}

void MacroEngine::PublishPad() {
  auto client = static_cast<PVIGEM_CLIENT>(vigemClient_);
  auto target = static_cast<PVIGEM_TARGET>(vigemTarget_);
  if (!dualSenseOutput_ && (!client || !target)) return;
  XUSB_REPORT report{};
  XUSB_REPORT_INIT(&report);
  uint32_t resolved = 0;
  if (physical_.connected) {
    report.sThumbLX = SettleStick(physical_.leftX);
    report.sThumbLY = SettleStick(physical_.leftY);
    report.sThumbRX = SettleStick(physical_.rightX);
    report.sThumbRY = SettleStick(physical_.rightY);
    const uint32_t delayed = delayedMask_.load(std::memory_order_acquire);
    for (int index = 0; index < static_cast<int>(sizeof(kSlots) / sizeof(kSlots[0])); ++index) {
      const uint32_t flag = 1u << index;
      const int64_t ticks = index < kEngineSlotCount ? delayTicks_[index].load(std::memory_order_acquire) : 0;
      const bool on = ticks > 0 ? (delayed & flag) != 0 : (physical_.mask & flag) != 0;
      if (on) resolved |= flag;
      if (!on) continue;
      if (index == 4) report.bLeftTrigger = physical_.leftTrigger ? physical_.leftTrigger : 255;
      else if (index == 5) report.bRightTrigger = physical_.rightTrigger ? physical_.rightTrigger : 255;
      else report.wButtons |= kVirtualButtons[index];
    }
  }
  if (dualSenseOutput_) {
    PublishDualSense(resolved);
    return;
  }
  if (activePlayStation_) {
    DS4_REPORT ds4;
    DS4_REPORT_INIT(&ds4);
    XUSB_TO_DS4_REPORT(&report, &ds4);
    ds4.bThumbLX = Ds4Stick(report.sThumbLX);
    ds4.bThumbLY = Ds4Stick(-static_cast<int>(report.sThumbLY));
    ds4.bThumbRX = Ds4Stick(report.sThumbRX);
    ds4.bThumbRY = Ds4Stick(-static_cast<int>(report.sThumbRY));
    if (resolved & (1u << 16)) ds4.bSpecial |= DS4_SPECIAL_BUTTON_TOUCHPAD;
    vigem_target_ds4_update(client, target, ds4);
    return;
  }
  vigem_target_x360_update(client, target, report);
}

Napi::Object MacroEngine::GetStatus(Napi::Env env) {
  std::unordered_map<std::string, double> delays;
  {
    std::lock_guard<std::mutex> lock(configMutex);
    delays = buttonDelayMap;
  }
  uint32_t mask = 0;
  size_t depth = 0;
  LONGLONG jitter = 0;
  {
    std::lock_guard<std::mutex> lock(queueMutex_);
    mask = delayedMask_.load(std::memory_order_acquire);
    depth = queue_.size();
    jitter = lastJitterUs_;
  }

  Napi::Object status = Napi::Object::New(env);
  status.Set("running", Napi::Boolean::New(env, isRunning.load()));
  status.Set("timerResolutionMs", Napi::Number::New(env, timerRaised_ ? 1 : 0));
  status.Set("qpcFrequency", Napi::Number::New(env, static_cast<double>(qpcFrequency.QuadPart)));
  status.Set("lastJitterUs", Napi::Number::New(env, static_cast<double>(jitter)));
  status.Set("queueDepth", Napi::Number::New(env, static_cast<double>(depth)));

  Napi::Object delayObject = Napi::Object::New(env);
  Napi::Array buttons = Napi::Array::New(env);
  Napi::Array live = Napi::Array::New(env);
  uint32_t liveCount = 0;
  for (int index = 0; index < static_cast<int>(sizeof(kSlots) / sizeof(kSlots[0])); ++index) {
    const std::string name = kSlots[index].name;
    const double delay = delays.count(name) ? delays[name] : 0;
    delayObject.Set(name, Napi::Number::New(env, delay));
    Napi::Object config = Napi::Object::New(env);
    config.Set("buttonName", Napi::String::New(env, name));
    config.Set("targetDelayMs", Napi::Number::New(env, delay));
    config.Set("enabled", Napi::Boolean::New(env, true));
    buttons.Set(static_cast<uint32_t>(index), config);
    if ((mask & (1u << index)) == 0) continue;
    live.Set(liveCount++, Napi::String::New(env, name));
  }
  status.Set("delays", delayObject);
  status.Set("buttons", buttons);
  status.Set("liveButtons", live);
  status.Set("buttonPresses", Napi::Number::New(env, buttonPresses_.load(std::memory_order_acquire)));
  status.Set("output", Napi::String::New(env, wantPlayStation_.load() ? "ps5" : "xbox"));
  const int requested = requestedHz_.load(std::memory_order_acquire);
  const int measured = measuredHz_.load(std::memory_order_acquire);
  const bool ready = pollReady_.load(std::memory_order_acquire);
  const int linkHz = linkHz_.load(std::memory_order_acquire);
  const int linkSpeed = linkSpeed_.load(std::memory_order_acquire);
  std::string pollMessage;
  if (ready && linkHz > 0 && appliedHz_.load(std::memory_order_acquire) == requested) {
    const bool reached = usbrate::HzFor(linkSpeed, usbrate::IntervalFor(linkSpeed, requested)) == linkHz;
    pollMessage = std::string(reached ? "Controller polling at " : "Controller stays at ") + std::to_string(linkHz) + " Hz";
    if (requested > usbrate::MaxHz(linkSpeed)) pollMessage += std::string(" (") + usbrate::SpeedName(linkSpeed) + " max)";
    if (measured > 0) pollMessage += " · " + std::to_string(measured) + " reports/s";
  } else if (ready || GetTickCount64() < switchUntil_.load(std::memory_order_acquire)) {
    pollMessage = "Setting the controller to " + std::to_string(requested) + " Hz";
  } else {
    pollMessage = "Connect the controller over USB";
  }
  status.Set("linkHz", Napi::Number::New(env, linkHz));
  status.Set("pollHz", Napi::Number::New(env, requested));
  status.Set("measuredHz", Napi::Number::New(env, measured));
  status.Set("pollIntervalMs", Napi::Number::New(env, acceptedPollMs_.load(std::memory_order_acquire)));
  status.Set("pollMessage", Napi::String::New(env, pollMessage));
  status.Set("route", Napi::String::New(env, routeMessage_));
  status.Set("controllerLive", Napi::Boolean::New(env, routeActive_));
  return status;
}

static Napi::Boolean InitEngine(const Napi::CallbackInfo& info) {
  return Napi::Boolean::New(info.Env(), Engine().Start());
}

static Napi::Boolean StopEngine(const Napi::CallbackInfo& info) {
  Engine().Stop();
  return Napi::Boolean::New(info.Env(), true);
}

static Napi::Value SetDelay(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 2 || !info[0].IsString() || !info[1].IsNumber()) {
    Napi::TypeError::New(env, "SetDelay expects a button name and a delay in milliseconds").ThrowAsJavaScriptException();
    return env.Null();
  }
  const std::string button = info[0].As<Napi::String>().Utf8Value();
  const double delayMs = info[1].As<Napi::Number>().DoubleValue();
  const double rounded = std::round(delayMs * 100.0) / 100.0;
  if (!KnownButton(button) || rounded < -0.001 || rounded > kMaxDelayMs + 0.001) return Napi::Boolean::New(env, false);
  Engine().SetButtonDelay(button, delayMs);
  return Napi::Boolean::New(env, true);
}

static Napi::Boolean SetPoll(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 1 || !info[0].IsNumber()) return Napi::Boolean::New(env, false);
  Engine().SetPollMs(info[0].As<Napi::Number>().DoubleValue());
  return Napi::Boolean::New(env, true);
}

static Napi::Boolean SetConsole(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 1 || !info[0].IsString()) return Napi::Boolean::New(env, false);
  Engine().SetConsole(info[0].As<Napi::String>().Utf8Value());
  return Napi::Boolean::New(env, true);
}

static Napi::Value GetStatus(const Napi::CallbackInfo& info) { return Engine().GetStatus(info.Env()); }

Napi::Object InitAll(Napi::Env env, Napi::Object exports) {
  exports.Set("InitEngine", Napi::Function::New(env, InitEngine));
  exports.Set("StopEngine", Napi::Function::New(env, StopEngine));
  exports.Set("SetDelay", Napi::Function::New(env, SetDelay));
  exports.Set("SetPoll", Napi::Function::New(env, SetPoll));
  exports.Set("SetConsole", Napi::Function::New(env, SetConsole));
  exports.Set("GetStatus", Napi::Function::New(env, GetStatus));
  return exports;
}

NODE_API_MODULE(blank_delay_engine, InitAll)
