#pragma once

#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>
#include <mmsystem.h>

#include <atomic>
#include <cstdint>
#include <deque>
#include <mutex>
#include <string>
#include <thread>
#include <unordered_map>
#include <vector>

#include <napi.h>

struct ButtonConfig {
  std::string buttonName;
  double targetDelayMs = 0;
  bool enabled = true;
};

struct TimedEdge {
  std::string button;
  bool down = false;
  LONGLONG due = 0;
  LONGLONG issued = 0;
};

struct PhysicalPad {
  bool connected = false;
  uint32_t mask = 0;
  uint8_t leftTrigger = 0;
  uint8_t rightTrigger = 0;
  int16_t leftX = 0;
  int16_t leftY = 0;
  int16_t rightX = 0;
  int16_t rightY = 0;
};

class MacroEngine {
 public:
  MacroEngine();
  ~MacroEngine();

  MacroEngine(const MacroEngine&) = delete;
  MacroEngine& operator=(const MacroEngine&) = delete;

  bool Start();
  void Stop();
  void SetButtonDelay(const std::string& button, double delayMs);
  void SetPollMs(double delayMs);
  double GetButtonDelay(const std::string& button);
  void SetConsole(const std::string& console);
  void RunInputLoop();
  Napi::Object GetStatus(Napi::Env env);

  std::atomic<bool> isRunning{false};
  std::thread workerThread;
  std::mutex configMutex;
  std::unordered_map<std::string, double> buttonDelayMap;
  LARGE_INTEGER qpcFrequency{};
  LARGE_INTEGER qpcCounter{};

 private:
  void PollPads();
  void Enqueue(const std::string& button, bool down, int64_t ticks);
  void FireDue();
  void Dispatch(const TimedEdge& edge);
  bool OpenPhysicalPad();
  void ClosePhysicalPad();
  void ServicePollRequest();
  void NoteReport();
  void ReadPhysicalPad();
  bool StartVirtualPad();
  bool StartDualSense();
  void StopDualSense();
  void PublishDualSense(uint32_t buttons);
  void StopVirtualPad();
  bool CloakPhysicalPads(const std::vector<std::wstring>& devices);
  void RestorePhysicalPads();
  void PublishPad();
  LONGLONG NextDue();

  mutable std::mutex queueMutex_;
  std::deque<TimedEdge> queue_;
  std::unordered_map<std::string, uint16_t> scanCodes_;
  static constexpr int kEngineSlotCount = 18;
  std::atomic<int64_t> delayTicks_[kEngineSlotCount]{};
  std::atomic<uint32_t> scheduleRevision_{0};
  std::atomic<uint32_t> delayedMask_{0};
  std::atomic<uint32_t> buttonPresses_{0};
  uint32_t physicalMask_ = 0;
  LONGLONG lastJitterUs_ = 0;
  bool timerRaised_ = false;
  std::atomic<HWND> messageWindow_{nullptr};
  PhysicalPad physical_{};
  void* vigemClient_ = nullptr;
  void* vigemTarget_ = nullptr;
  unsigned long virtualIndex_ = 0xFFFFFFFF;
  HANDLE padHandle_ = INVALID_HANDLE_VALUE;
  std::wstring padPath_;
  std::wstring usbInstance_;
  std::vector<std::wstring> usbTargets_;
  uint16_t padVendor_ = 0;
  std::atomic<int> requestedHz_{8000};
  std::atomic<int> appliedHz_{-1};
  std::atomic<int> measuredHz_{0};
  std::atomic<int> acceptedPollMs_{0};
  std::atomic<bool> pollReady_{false};
  LONGLONG rateWindowStart_ = 0;
  uint32_t rateWindowCount_ = 0;
  int armedHz_ = -1;
  LONGLONG openAttempt_ = 0;
  std::wstring armedInstance_;
  std::atomic<int> linkHz_{0};
  std::atomic<int> linkSpeed_{-1};
  std::atomic<ULONGLONG> switchUntil_{0};
  std::vector<std::pair<std::wstring, int>> refusedRates_;
  HANDLE padEvent_ = nullptr;
  OVERLAPPED padRead_{};
  bool padReadPending_ = false;
  uint8_t padBuffer_[128]{};
  uint32_t padReportSize_ = 0;
  void* dualSenseLib_ = nullptr;
  void* dualSenseDevice_ = nullptr;
  void* dualSenseSubmit_ = nullptr;
  void* dualSenseDestroy_ = nullptr;
  bool dualSenseOutput_ = false;
  bool ps5NeedsAdmin_ = false;
  std::vector<std::wstring> hiddenDevices_;
  bool cloakEnabledByUs_ = false;
  bool routeActive_ = false;
  bool activePlayStation_ = true;
  std::atomic<bool> wantPlayStation_{true};
  std::string routeMessage_ = "Controller delay is not active";
};

MacroEngine& Engine();
std::string CanonicalButton(std::string name);
bool KnownButton(const std::string& name);
