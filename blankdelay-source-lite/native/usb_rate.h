// Reads a USB device's link speed and the interrupt interval the hub is actually
// running (after any hidusbf override), and maps poll rates to bInterval values
// for that speed. Low/full speed bInterval is in milliseconds; high speed and up
// is an exponent of 125 µs microframes.

#pragma once

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#include <cfgmgr32.h>

#include <algorithm>
#include <cmath>
#include <cstring>
#include <string>
#include <vector>

namespace usbrate {

constexpr DWORD kGetConnectionInfoEx = 0x220448;
constexpr DWORD kGetDescriptor = 0x220410;
constexpr GUID kHubInterface = {0xf18a0e88, 0xc30c, 0x11d0, {0x88, 0x15, 0x00, 0xa0, 0xc9, 0x06, 0xbe, 0xd8}};
constexpr int kLadder[] = {8000, 4000, 2000, 1000, 500, 250, 125, 63, 31, 16, 8};

struct Link {
  int speed = -1;
  int interval = 0;
  int native = 0;
};

inline const char* SpeedName(int speed) {
  if (speed == 0) return "low-speed USB";
  if (speed == 1) return "full-speed USB";
  if (speed == 2) return "high-speed USB";
  if (speed >= 3) return "SuperSpeed USB";
  return "USB";
}

inline int MaxHz(int speed) { return speed >= 2 ? 8000 : 1000; }

inline int IntervalFor(int speed, int hz) {
  if (speed >= 2) {
    for (int index = 0; index < static_cast<int>(sizeof(kLadder) / sizeof(kLadder[0])); ++index) {
      if (hz >= kLadder[index]) return index + 1;
    }
    return 11;
  }
  if (hz >= 1000) return 1;
  if (hz >= 500) return 2;
  if (hz >= 250) return 4;
  if (hz >= 125) return 8;
  if (hz >= 63) return 16;
  if (hz >= 31) return 32;
  if (hz >= 16) return 64;
  return 128;
}

inline int HzFor(int speed, int interval) {
  if (interval <= 0) return 0;
  if (speed >= 2) {
    const double period = 125.0 * std::pow(2.0, std::clamp(interval, 1, 16) - 1);
    return static_cast<int>(std::lround(1000000.0 / period));
  }
  int ms = 1;
  while (ms * 2 <= interval && ms < 128) ms *= 2;
  return 1000 / ms;
}

inline bool SameRate(int speed, int interval, int want) {
  return interval == want || (interval > 0 && HzFor(speed, interval) == HzFor(speed, want));
}

inline std::wstring HubPath(DEVINST hub) {
  wchar_t id[MAX_DEVICE_ID_LEN]{};
  if (CM_Get_Device_IDW(hub, id, MAX_DEVICE_ID_LEN, 0) != CR_SUCCESS) return L"";
  GUID guid = kHubInterface;
  ULONG size = 0;
  if (CM_Get_Device_Interface_List_SizeW(&size, &guid, id, CM_GET_DEVICE_INTERFACE_LIST_PRESENT) != CR_SUCCESS || size < 2) return L"";
  std::vector<wchar_t> list(size);
  if (CM_Get_Device_Interface_ListW(&guid, id, list.data(), size, CM_GET_DEVICE_INTERFACE_LIST_PRESENT) != CR_SUCCESS) return L"";
  return list.data();
}

inline int FirstInterruptIn(const BYTE* data, DWORD length) {
  for (DWORD at = 0; at + 7 <= length;) {
    const BYTE size = data[at];
    if (size < 2) break;
    if (data[at + 1] == 5 && (data[at + 3] & 3) == 3 && (data[at + 2] & 0x80)) return data[at + 6];
    at += size;
  }
  return 0;
}

inline Link Read(const std::wstring& instance) {
  Link link;
  std::vector<wchar_t> id(instance.begin(), instance.end());
  id.push_back(L'\0');
  DEVINST node = 0;
  if (CM_Locate_DevNodeW(&node, id.data(), CM_LOCATE_DEVNODE_NORMAL) != CR_SUCCESS) return link;
  ULONG port = 0;
  ULONG size = sizeof(port);
  ULONG type = 0;
  if (CM_Get_DevNode_Registry_PropertyW(node, CM_DRP_ADDRESS, &type, &port, &size, 0) != CR_SUCCESS || !port) return link;
  DEVINST hub = 0;
  if (CM_Get_Parent(&hub, node, 0) != CR_SUCCESS) return link;
  const std::wstring path = HubPath(hub);
  if (path.empty()) return link;
  HANDLE handle = CreateFileW(path.c_str(), GENERIC_WRITE, FILE_SHARE_WRITE, nullptr, OPEN_EXISTING, 0, nullptr);
  if (handle == INVALID_HANDLE_VALUE) return link;

  BYTE info[35 + 11 * 32]{};
  std::memcpy(info, &port, sizeof(port));
  DWORD returned = 0;
  if (DeviceIoControl(handle, kGetConnectionInfoEx, info, sizeof(info), info, sizeof(info), &returned, nullptr) && returned >= 35) {
    link.speed = info[23];
    ULONG pipes = 0;
    std::memcpy(&pipes, info + 27, sizeof(pipes));
    for (ULONG index = 0; index < pipes && 35 + (index + 1) * 11 <= returned; ++index) {
      const BYTE* pipe = info + 35 + index * 11;
      if ((pipe[3] & 3) == 3 && (pipe[2] & 0x80)) {
        link.interval = pipe[6];
        break;
      }
    }
  }

  BYTE request[12 + 1024]{};
  std::memcpy(request, &port, sizeof(port));
  request[4] = 0x80;
  request[5] = 6;
  request[7] = 2;
  const USHORT wanted = 1024;
  std::memcpy(request + 10, &wanted, sizeof(wanted));
  if (DeviceIoControl(handle, kGetDescriptor, request, sizeof(request), request, sizeof(request), &returned, nullptr) && returned > 12) {
    link.native = FirstInterruptIn(request + 12, returned - 12);
  }
  CloseHandle(handle);
  return link;
}

inline bool WriteInterval(const std::wstring& instance, DWORD interval) {
  const std::wstring path = L"SYSTEM\\CurrentControlSet\\Enum\\" + instance + L"\\Device Parameters";
  HKEY key = nullptr;
  if (RegCreateKeyExW(HKEY_LOCAL_MACHINE, path.c_str(), 0, nullptr, 0, KEY_QUERY_VALUE | KEY_SET_VALUE, nullptr, &key, nullptr) != ERROR_SUCCESS) return false;
  DWORD current = 0;
  DWORD size = sizeof(current);
  DWORD type = 0;
  const bool same = RegQueryValueExW(key, L"bInterval", nullptr, &type, reinterpret_cast<BYTE*>(&current), &size) == ERROR_SUCCESS && type == REG_DWORD && current == interval;
  const bool stored = same || RegSetValueExW(key, L"bInterval", 0, REG_DWORD, reinterpret_cast<const BYTE*>(&interval), sizeof(interval)) == ERROR_SUCCESS;
  RegCloseKey(key);
  return stored;
}

inline bool Restart(const std::wstring& instance) {
  std::vector<wchar_t> id(instance.begin(), instance.end());
  id.push_back(L'\0');
  DEVINST node = 0;
  if (CM_Locate_DevNodeW(&node, id.data(), CM_LOCATE_DEVNODE_NORMAL) != CR_SUCCESS) return false;
  if (CM_Disable_DevNode(node, CM_DISABLE_UI_NOT_OK) != CR_SUCCESS) return false;
  return CM_Enable_DevNode(node, 0) == CR_SUCCESS;
}

inline Link WaitForLink(const std::wstring& instance, DWORD timeoutMs) {
  const ULONGLONG until = GetTickCount64() + timeoutMs;
  Link link;
  do {
    Sleep(100);
    link = Read(instance);
    if (link.speed >= 0 && link.interval > 0) return link;
  } while (GetTickCount64() < until);
  return link;
}

}  // namespace usbrate
