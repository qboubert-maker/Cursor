import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { loadTweakState, readTweakState, recordTweakState } from './tweakState.js'
import useSmoothWheel from './useSmoothWheel.js'

const LANES = [
  { id: 'gpu', title: 'GPU Optimization', short: 'GPU', detail: 'Graphics scheduling and overlay options in this lane.', character: 'Itachi', src: '/itachi-headband.jpg?v=8', body: '/tweaks/body/itachi.png?v=2', rgb: '200, 16, 46', icon: 'gpu' },
  { id: 'cpu', title: 'CPU Optimization', short: 'CPU', detail: 'Processor scheduling options in this lane.', character: 'Sasuke', src: '/team/sasuke.jpg?v=4', body: '/tweaks/body/sasuke.png?v=3', rgb: '124, 63, 214', icon: 'cpu' },
  { id: 'zero', title: 'Zero Delay Optimization', short: 'Zero Delay', detail: 'Input timing options in this lane.', character: 'Kakashi', src: '/team/kakashi.jpg', body: '/tweaks/body/kakashi.png?v=3', rgb: '108, 132, 158', icon: 'zap' },
  { id: 'fps', title: 'FPS Optimization', short: 'FPS', detail: 'Frame pacing options in this lane.', character: 'Madara', src: '/tweaks/thumb/madara.png?v=2', body: '/tweaks/body/madara.png?v=3', rgb: '46, 140, 230', icon: 'fps' },
  { id: 'bios', title: 'BIOS Optimization', short: 'BIOS', detail: 'Startup options in this lane.', character: 'Obito', src: '/team/obito.jpg', body: '/tweaks/body/obito.png?v=3', rgb: '224, 112, 28', icon: 'bios' },
  { id: 'controller', title: 'Controller Optimization', short: 'Controller', detail: 'Controller profile options in this lane.', character: 'Shisui', src: '/tweaks/thumb/shisui.png?v=2', body: '/tweaks/body/shisui.png?v=3', rgb: '36, 148, 92', icon: 'pad' },
  { id: 'keyboard', title: 'Keyboard Optimization', short: 'Keyboard', detail: 'Keyboard profile options in this lane.', character: 'Fugaku', src: '/tweaks/body/fugaku.png?v=5', body: '/tweaks/body/fugaku.png?v=5', rgb: '92, 104, 74', icon: 'key' },
]

const BLANK = ['B', 'L', 'A', 'N', 'K']
const NOUZEN = ['N', 'O', 'U', 'Z', 'E', 'N']
const TOAST_MS = 3200

const OPTIONS = {
  gpu: [
    { id: 'gpu-ulps', title: 'Disable ULPS', detail: 'ULPS option in this lane.', impact: 'high' },
    { id: 'gpu-tdr', title: 'Relax GPU Watchdog', detail: 'GPU watchdog option in this lane.', impact: 'medium' },
    { id: 'gpu-nv-telemetry', title: 'Driver Telemetry Off', detail: 'Driver telemetry option in this lane.', impact: 'low' },
    { id: 'gpu-als', title: 'Auto Brightness Off', detail: 'Auto brightness option in this lane.', impact: 'low' },
    { id: 'gpu-cursor-shadow', title: 'Cursor Shadow Off', detail: 'Cursor shadow option in this lane.', impact: 'low' },
    { id: 'gpu-saver', title: 'Screensaver Off', detail: 'Screensaver option in this lane.', impact: 'low' },
    { id: 'gpu-shake', title: 'Aero Shake Off', detail: 'Aero Shake option in this lane.', impact: 'low' },
    { id: 'gpu-snap', title: 'Snap Assist Off', detail: 'Snap Assist option in this lane.', impact: 'low' },
    { id: 'gpu-thumbs', title: 'Live Thumbnails Off', detail: 'Thumbnail option in this lane.', impact: 'low' },
    { id: 'gpu-peek', title: 'Peek Preview Off', detail: 'Peek preview option in this lane.', impact: 'low' },
    { id: 'gpu-tdr-ddi', title: 'Relax DDI Watchdog', detail: 'DDI watchdog option in this lane.', impact: 'medium' },
    { id: 'gpu-amd-aspm-l0s', title: 'GPU ASPM L0s Off', detail: 'GPU link power option in this lane.', impact: 'high' },
    { id: 'gpu-amd-aspm-l1', title: 'GPU ASPM L1 Off', detail: 'GPU link power option in this lane.', impact: 'high' },
    { id: 'gpu-amd-sclk-sleep', title: 'GPU Deep Sleep Off', detail: 'Shader clock sleep option in this lane.', impact: 'high' },
    { id: 'gpu-amd-powerdown', title: 'GPU Power Down Off', detail: 'GPU power-down option in this lane.', impact: 'high' },
    { id: 'gpu-amd-light-sleep', title: 'GPU Light Sleep Off', detail: 'GPU light sleep option in this lane.', impact: 'high' },
    { id: 'gpu-amd-deep-sleep', title: 'GPU Memory Sleep Off', detail: 'GPU memory sleep option in this lane.', impact: 'high' },
    { id: 'gpu-amd-chill', title: 'Radeon Chill Off', detail: 'Chill option in this lane.', impact: 'high' },
    { id: 'gpu-amd-frtc', title: 'Frame Rate Target Off', detail: 'Frame rate cap option in this lane.', impact: 'high' },
    { id: 'gpu-amd-boost', title: 'Radeon Boost Off', detail: 'Resolution boost option in this lane.', impact: 'medium' },
    { id: 'gpu-amd-cf', title: 'CrossFire Auto-Link Off', detail: 'CrossFire option in this lane.', impact: 'low' },
    { id: 'gpu-amd-cbpm', title: 'Context Power Saving Off', detail: 'Context power option in this lane.', impact: 'medium' },
    { id: 'gpu-amd-shader', title: 'Shader Cache On', detail: 'Shader cache option in this lane.', impact: 'high' },
    { id: 'gpu-amd-async', title: 'Async Flip On', detail: 'Async flip option in this lane.', impact: 'medium' },
    { id: 'gpu-amd-fast-time', title: 'Fast GPU Timing', detail: 'GPU timing option in this lane.', impact: 'medium' },
    { id: 'gpu-amd-antilag', title: 'Anti-Lag On', detail: 'Anti-Lag option in this lane.', impact: 'high' },
    { id: 'gpu-cursor-trails', title: 'Cursor Trails Off', detail: 'Cursor trail option in this lane.', impact: 'low' },
    { id: 'gpu-hot-track', title: 'List Fade Select Off', detail: 'List selection fade option in this lane.', impact: 'low' },
    { id: 'gpu-menu-fade', title: 'Menu Fade Off', detail: 'Menu fade option in this lane.', impact: 'low' },
    { id: 'gpu-listbox', title: 'Listbox Animation Off', detail: 'Listbox animation option in this lane.', impact: 'low' },
    { id: 'gpu-video-idle', title: 'Display Sleep Off', detail: 'Display idle option in this lane.', impact: 'medium' },
    { id: 'gpu-video-dim', title: 'Display Dim Off', detail: 'Display dim option in this lane.', impact: 'low' },
    { id: 'gpu-blur', title: 'DWM Blur Off', detail: 'Desktop blur option in this lane.', impact: 'low' },
    { id: 'gpu-perf-svc', title: 'Graphics Perf Service Off', detail: 'Graphics perf service option in this lane.', impact: 'low' },
    { id: 'gpu-nv-overlay', title: 'ShadowPlay Audio Off', detail: 'ShadowPlay option in this lane.', impact: 'low' },
    { id: 'gpu-amd-ulps-na', title: 'ULPS Control Available', detail: 'ULPS control option in this lane.', impact: 'high' },
    { id: 'gpu-amd-disable-l0s', title: 'Block GPU ASPM L0s', detail: 'GPU ASPM L0s option in this lane.', impact: 'high' },
    { id: 'gpu-amd-disable-l1', title: 'Block GPU ASPM L1', detail: 'GPU ASPM L1 option in this lane.', impact: 'high' },
    { id: 'gpu-amd-l1ss', title: 'GPU ASPM L1SS Off', detail: 'GPU L1SS option in this lane.', impact: 'high' },
    { id: 'gpu-amd-powerdown-en', title: 'GPU Power-Down Enable Off', detail: 'GPU power-down enable option in this lane.', impact: 'high' },
    { id: 'gpu-amd-varibright', title: 'Vari-Bright Off', detail: 'Vari-Bright option in this lane.', impact: 'low' },
    { id: 'gpu-amd-power-saver', title: 'GPU Power Saver Off', detail: 'GPU power saver option in this lane.', impact: 'high' },
    { id: 'gpu-amd-power-saver-def', title: 'GPU Power Saver Auto Off', detail: 'GPU auto power saver option in this lane.', impact: 'medium' },
    { id: 'gpu-amd-spread', title: 'Spread Spectrum Off', detail: 'Spread spectrum option in this lane.', impact: 'low' },
    { id: 'gpu-amd-delag', title: 'Anti-Lag+ Off', detail: 'Anti-Lag+ option in this lane.', impact: 'high' },
    { id: 'gpu-amd-fps-cap', title: 'Driver FPS Cap Off', detail: 'Driver frame cap option in this lane.', impact: 'high' },
    { id: 'gpu-amd-vrr-hz', title: 'Keep VRR Refresh Rate', detail: 'VRR refresh option in this lane.', impact: 'medium' },
    { id: 'gpu-amd-dma', title: 'GPU DMA Copy On', detail: 'GPU DMA copy option in this lane.', impact: 'medium' },
    { id: 'gpu-amd-block-write', title: 'GPU Block Write Off', detail: 'GPU block write option in this lane.', impact: 'medium' },
    { id: 'gpu-amd-3d-perf', title: '3D Performance Mode', detail: '3D performance option in this lane.', impact: 'medium' },
    { id: 'gpu-amd-vsr-auto', title: 'Auto VSR Off', detail: 'Virtual super resolution option in this lane.', impact: 'low' },
    { id: 'gpu-amd-ris', title: 'Image Sharpening Off', detail: 'Radeon image sharpening option in this lane.', impact: 'medium' },
    { id: 'gpu-amd-rsr', title: 'Super Resolution Off', detail: 'Radeon super resolution option in this lane.', impact: 'medium' },
    { id: 'gpu-nv-powermizer', title: 'NVIDIA PowerMizer Max', detail: 'PowerMizer option in this lane.', impact: 'high' },
    { id: 'gpu-nv-ulps', title: 'NVIDIA ULPS Off', detail: 'NVIDIA ULPS option in this lane.', impact: 'high' },
    { id: 'gpu-visualfx', title: 'Best Performance Visuals', detail: 'Visual effects option in this lane.', impact: 'medium' },
    { id: 'gpu-drag', title: 'Full Window Drag Off', detail: 'Window drag option in this lane.', impact: 'low' },
    { id: 'gpu-icons', title: 'Icons Instead of Thumbnails', detail: 'Explorer thumbnail option in this lane.', impact: 'low' },
    { id: 'gpu-list-shadow', title: 'List Shadow Off', detail: 'List shadow option in this lane.', impact: 'low' },
    { id: 'gpu-balloon', title: 'Balloon Tips Off', detail: 'Balloon tip option in this lane.', impact: 'low' },
    { id: 'gpu-preview', title: 'Desktop Preview Off', detail: 'Desktop preview option in this lane.', impact: 'low' },
    { id: 'gpu-live-hover', title: 'Peek Hover Delay Off', detail: 'Peek hover option in this lane.', impact: 'low' },
    { id: 'gpu-thumb-hover', title: 'Thumbnail Hover Delay Off', detail: 'Thumbnail hover option in this lane.', impact: 'low' },
    { id: 'gpu-extended-hover', title: 'Extended Hover Delay Off', detail: 'Extended hover option in this lane.', impact: 'low' },
    { id: 'gpu-thumbs-hibernate', title: 'Thumbnail Hibernate Off', detail: 'Thumbnail hibernate option in this lane.', impact: 'low' },
  ],
  cpu: [
    { id: 'cpu-blank-ultimate', title: 'Blank Ultimate Plan', detail: 'Blank ultimate plan option in this lane.', impact: 'high' },
    { id: 'cpu-turbo-max', title: 'Turbo Boost Max', detail: 'Turbo boost option in this lane.', impact: 'high' },
    { id: 'cpu-epp', title: 'Max Performance Energy', detail: 'Energy preference option in this lane.', impact: 'high' },
    { id: 'cpu-min-state', title: 'Minimum Processor State', detail: 'Minimum processor option in this lane.', impact: 'high' },
    { id: 'cpu-max-freq', title: 'Uncap Processor Frequency', detail: 'Maximum frequency option in this lane.', impact: 'medium' },
    { id: 'cpu-parking', title: 'Core Parking Off', detail: 'Core parking option in this lane.', impact: 'high' },
    { id: 'cpu-prio', title: 'Foreground Priority Boost', detail: 'Foreground scheduler option in this lane.', impact: 'medium' },
    { id: 'cpu-throttle', title: 'Power Throttling Off', detail: 'Power throttling option in this lane.', impact: 'high' },
    { id: 'cpu-timer-system', title: 'Global Timer Resolution', detail: 'Timer resolution option in this lane.', impact: 'high' },
    { id: 'cpu-game-mode', title: 'Windows Game Mode', detail: 'Game Mode option in this lane.', impact: 'low' },
    { id: 'cpu-sysmain', title: 'Disable SysMain', detail: 'SysMain option in this lane.', impact: 'medium' },
    { id: 'cpu-kernel-pin', title: 'Kernel Pinned in RAM', detail: 'Kernel paging option in this lane.', impact: 'medium' },
    { id: 'cpu-pcie', title: 'PCIe Link Power Off', detail: 'PCIe power option in this lane.', impact: 'medium' },
    { id: 'cpu-nvme', title: 'NVMe Power State Hold', detail: 'NVMe power option in this lane.', impact: 'medium' },
    { id: 'cpu-hdd', title: 'Disable HDD Sleep Timeout', detail: 'Disk sleep option in this lane.', impact: 'low' },
    { id: 'cpu-8dot3', title: 'Disable 8.3 Names', detail: 'Short name option in this lane.', impact: 'low' },
    { id: 'cpu-boost-pol', title: 'Boost Policy Max', detail: 'Boost policy option in this lane.', impact: 'high' },
    { id: 'cpu-inc-pol', title: 'Fast Frequency Ramp', detail: 'Increase policy option in this lane.', impact: 'high' },
    { id: 'cpu-inc-pol1', title: 'Class 1 Fast Ramp', detail: 'Class 1 increase policy option in this lane.', impact: 'medium' },
    { id: 'cpu-inc-time', title: 'Short Increase Time', detail: 'Increase time option in this lane.', impact: 'medium' },
    { id: 'cpu-inc-time1', title: 'Class 1 Increase Time', detail: 'Class 1 increase time option in this lane.', impact: 'medium' },
    { id: 'cpu-dec-time', title: 'Hold Boost Longer', detail: 'Decrease time option in this lane.', impact: 'high' },
    { id: 'cpu-dec-time1', title: 'Class 1 Hold Boost', detail: 'Class 1 decrease time option in this lane.', impact: 'medium' },
    { id: 'cpu-dec-th', title: 'Later Downclock', detail: 'Decrease threshold option in this lane.', impact: 'high' },
    { id: 'cpu-dec-th1', title: 'Class 1 Later Downclock', detail: 'Class 1 decrease threshold option in this lane.', impact: 'medium' },
    { id: 'cpu-dec-pol', title: 'Gentle Downclock Policy', detail: 'Decrease policy option in this lane.', impact: 'medium' },
    { id: 'cpu-dec-pol1', title: 'Class 1 Downclock Policy', detail: 'Class 1 decrease policy option in this lane.', impact: 'medium' },
    { id: 'cpu-epp1', title: 'Efficiency-Class EPP', detail: 'Class 1 EPP option in this lane.', impact: 'high' },
    { id: 'cpu-min-state1', title: 'Class 1 Minimum State', detail: 'Class 1 minimum state option in this lane.', impact: 'high' },
    { id: 'cpu-max-state1', title: 'Class 1 Maximum State', detail: 'Class 1 maximum state option in this lane.', impact: 'medium' },
    { id: 'cpu-park-max', title: 'Max Unparked Cores', detail: 'Unparked core option in this lane.', impact: 'high' },
    { id: 'cpu-park-max1', title: 'Class 1 Max Unparked', detail: 'Class 1 unparked option in this lane.', impact: 'high' },
    { id: 'cpu-park-min1', title: 'Class 1 Parking Off', detail: 'Class 1 parking option in this lane.', impact: 'high' },
    { id: 'cpu-latency-perf', title: 'Latency Hint Performance', detail: 'Latency performance option in this lane.', impact: 'high' },
    { id: 'cpu-latency-perf1', title: 'Class 1 Latency Performance', detail: 'Class 1 latency performance option in this lane.', impact: 'medium' },
    { id: 'cpu-latency-unpark', title: 'Latency Hint Unpark', detail: 'Latency unpark option in this lane.', impact: 'high' },
    { id: 'cpu-latency-unpark1', title: 'Class 1 Latency Unpark', detail: 'Class 1 latency unpark option in this lane.', impact: 'medium' },
    { id: 'cpu-latency-epp', title: 'Latency Hint EPP', detail: 'Latency EPP option in this lane.', impact: 'medium' },
    { id: 'cpu-latency-epp1', title: 'Class 1 Latency EPP', detail: 'Class 1 latency EPP option in this lane.', impact: 'medium' },
    { id: 'cpu-class1-init', title: 'Class 1 Initial Performance', detail: 'Class 1 initial performance option in this lane.', impact: 'medium' },
    { id: 'cpu-freq-max1', title: 'Class 1 Frequency Uncap', detail: 'Class 1 frequency option in this lane.', impact: 'medium' },
    { id: 'cpu-unpark-fast', title: 'Fast Core Unpark', detail: 'Unpark time option in this lane.', impact: 'medium' },
    { id: 'cpu-park-slow', title: 'Slow Core Park', detail: 'Park time option in this lane.', impact: 'medium' },
    { id: 'cpu-overutil', title: 'Earlier Core Unpark', detail: 'Overutilization option in this lane.', impact: 'medium' },
    { id: 'cpu-headroom', title: 'Parking Headroom', detail: 'Parking headroom option in this lane.', impact: 'medium' },
    { id: 'cpu-soft-park', title: 'Soft Park Latency Off', detail: 'Soft park option in this lane.', impact: 'medium' },
    { id: 'cpu-hybrid', title: 'Hybrid Sleep Off', detail: 'Hybrid sleep option in this lane.', impact: 'medium' },
    { id: 'cpu-standby', title: 'Sleep Timeout Off', detail: 'Sleep timeout option in this lane.', impact: 'medium' },
    { id: 'cpu-hibernate-idle', title: 'Hibernate Timeout Off', detail: 'Hibernate timeout option in this lane.', impact: 'low' },
    { id: 'cpu-away', title: 'Away Mode Off', detail: 'Away mode option in this lane.', impact: 'low' },
    { id: 'cpu-es', title: 'Energy Saver Off', detail: 'Energy saver option in this lane.', impact: 'high' },
    { id: 'cpu-nvme-ppm', title: 'NVMe Idle Power Off', detail: 'NVMe idle power option in this lane.', impact: 'medium' },
    { id: 'cpu-large-cache', title: 'Server Cache Off', detail: 'Large system cache option in this lane.', impact: 'medium' },
    { id: 'cpu-search', title: 'Windows Search Off', detail: 'Search indexer option in this lane.', impact: 'medium' },
    { id: 'cpu-maps', title: 'Downloaded Maps Off', detail: 'Maps broker option in this lane.', impact: 'low' },
    { id: 'cpu-retail', title: 'Retail Demo Off', detail: 'Retail demo option in this lane.', impact: 'low' },
    { id: 'cpu-diaghub', title: 'Diag Hub Off', detail: 'Diagnostic hub option in this lane.', impact: 'low' },
    { id: 'cpu-push', title: 'WAP Push Off', detail: 'WAP push option in this lane.', impact: 'low' },
    { id: 'cpu-dps', title: 'Diagnostic Policy Off', detail: 'Diagnostic policy option in this lane.', impact: 'low' },
    { id: 'cpu-wdi', title: 'WDI User Off', detail: 'WDI user option in this lane.', impact: 'low' },
    { id: 'cpu-wdi2', title: 'WDI System Off', detail: 'WDI system option in this lane.', impact: 'low' },
    { id: 'cpu-trk', title: 'Distributed Link Tracking Off', detail: 'Link tracking option in this lane.', impact: 'low' },
    { id: 'cpu-dusm', title: 'Data Usage Service Off', detail: 'Data usage option in this lane.', impact: 'low' },
    { id: 'cpu-do', title: 'Delivery Optimization Off', detail: 'Delivery optimization service option in this lane.', impact: 'medium' },
    { id: 'cpu-pca', title: 'Program Compat Off', detail: 'Compat assistant option in this lane.', impact: 'low' },
    { id: 'cpu-wer-svc', title: 'Error Reporting Off', detail: 'Error reporting service option in this lane.', impact: 'low' },
    { id: 'cpu-wisvc', title: 'Insider Service Off', detail: 'Insider service option in this lane.', impact: 'low' },
    { id: 'cpu-icssvc', title: 'Mobile Hotspot Off', detail: 'Hotspot service option in this lane.', impact: 'low' },
    { id: 'cpu-lfsvc', title: 'Geolocation Off', detail: 'Geolocation service option in this lane.', impact: 'low' },
    { id: 'cpu-remotereg', title: 'Remote Registry Off', detail: 'Remote registry option in this lane.', impact: 'low' },
    { id: 'cpu-shared', title: 'Internet Connection Sharing Off', detail: 'ICS option in this lane.', impact: 'low' },
    { id: 'cpu-aj', title: 'AllJoyn Off', detail: 'AllJoyn option in this lane.', impact: 'low' },
    { id: 'cpu-wallet', title: 'Wallet Service Off', detail: 'Wallet service option in this lane.', impact: 'low' },
    { id: 'cpu-wpc', title: 'Parental Controls Off', detail: 'Parental controls option in this lane.', impact: 'low' },
    { id: 'cpu-frame', title: 'Frame Server Off', detail: 'Camera frame server option in this lane.', impact: 'low' },
    { id: 'cpu-phone', title: 'Phone Service Off', detail: 'Phone service option in this lane.', impact: 'low' },
    { id: 'cpu-se', title: 'Payments Off', detail: 'Payments service option in this lane.', impact: 'low' },
    { id: 'cpu-csc', title: 'Offline Files Off', detail: 'Offline files option in this lane.', impact: 'low' },
    { id: 'cpu-pla', title: 'Performance Logs Off', detail: 'Performance logs option in this lane.', impact: 'low' },
    { id: 'cpu-shpam', title: 'Shared PC Account Off', detail: 'Shared PC option in this lane.', impact: 'low' },
    { id: 'cpu-uev', title: 'UE-V Off', detail: 'UE-V option in this lane.', impact: 'low' },
    { id: 'cpu-spectrum', title: 'Spectrum Off', detail: 'Spectrum option in this lane.', impact: 'low' },
    { id: 'cpu-fhsvc', title: 'File History Off', detail: 'File history option in this lane.', impact: 'low' },
    { id: 'cpu-scard', title: 'Smart Card Off', detail: 'Smart card option in this lane.', impact: 'low' },
    { id: 'cpu-sensor', title: 'Sensor Service Off', detail: 'Sensor service option in this lane.', impact: 'low' },
    { id: 'cpu-sensr', title: 'Sensor Monitoring Off', detail: 'Sensor monitoring option in this lane.', impact: 'low' },
    { id: 'cpu-sensor-data', title: 'Sensor Data Off', detail: 'Sensor data option in this lane.', impact: 'low' },
    { id: 'cpu-diagsvc', title: 'Diagnostic Service Off', detail: 'Diagnostic service option in this lane.', impact: 'low' },
    { id: 'cpu-dssvc', title: 'Data Sharing Off', detail: 'Data sharing option in this lane.', impact: 'low' },
    { id: 'cpu-stisvc', title: 'Still Image Off', detail: 'Still image option in this lane.', impact: 'low' },
    { id: 'cpu-print-notify', title: 'Print Notify Off', detail: 'Print notify option in this lane.', impact: 'low' },
    { id: 'cpu-wia', title: 'WIA RPC Off', detail: 'WIA option in this lane.', impact: 'low' },
    { id: 'cpu-wbio', title: 'Biometric Service Off', detail: 'Biometric option in this lane.', impact: 'low' },
    { id: 'cpu-wpn', title: 'Push Notifications Off', detail: 'Push notification option in this lane.', impact: 'low' },
    { id: 'cpu-cdp', title: 'Connected Devices Off', detail: 'Connected devices option in this lane.', impact: 'low' },
    { id: 'cpu-onesync', title: 'Sync Host Off', detail: 'Sync host option in this lane.', impact: 'low' },
    { id: 'cpu-msg', title: 'Messaging Service Off', detail: 'Messaging option in this lane.', impact: 'low' },
    { id: 'cpu-pim', title: 'Contact Data Off', detail: 'Contact data option in this lane.', impact: 'low' },
    { id: 'cpu-unistore', title: 'User Data Storage Off', detail: 'User data storage option in this lane.', impact: 'low' },
    { id: 'cpu-userdata', title: 'User Data Access Off', detail: 'User data access option in this lane.', impact: 'low' },
    { id: 'cpu-inc-th', title: 'Earlier Frequency Ramp', detail: 'Increase threshold option in this lane.', impact: 'high' },
    { id: 'cpu-inc-th1', title: 'Class 1 Frequency Ramp', detail: 'Class 1 increase threshold option in this lane.', impact: 'medium' },
    { id: 'cpu-iphlp', title: 'IPv6 Helper Off', detail: 'IP helper option in this lane.', impact: 'medium' },
    { id: 'cpu-wmpnet', title: 'WMP Network Sharing Off', detail: 'WMP network option in this lane.', impact: 'low' },
    { id: 'cpu-rasauto', title: 'Remote Access Auto Off', detail: 'RAS auto option in this lane.', impact: 'low' },
    { id: 'cpu-remoteaccess', title: 'Routing and RAS Off', detail: 'Remote access option in this lane.', impact: 'low' },
    { id: 'cpu-alg', title: 'Application Layer Gateway Off', detail: 'ALG option in this lane.', impact: 'low' },
    { id: 'cpu-peerdist', title: 'BranchCache Off', detail: 'BranchCache option in this lane.', impact: 'low' },
    { id: 'cpu-p2p', title: 'Peer Networking Off', detail: 'Peer networking option in this lane.', impact: 'low' },
    { id: 'cpu-p2pim', title: 'Peer Identity Manager Off', detail: 'Peer identity option in this lane.', impact: 'low' },
    { id: 'cpu-pnrp', title: 'PNRP Off', detail: 'PNRP option in this lane.', impact: 'low' },
    { id: 'cpu-pnrp-auto', title: 'PNRP Auto-Reg Off', detail: 'PNRP auto-reg option in this lane.', impact: 'low' },
    { id: 'cpu-wcs', title: 'WCS Plugin Off', detail: 'Color system plugin option in this lane.', impact: 'low' },
    { id: 'cpu-workfolders', title: 'Work Folders Off', detail: 'Work Folders option in this lane.', impact: 'low' },
    { id: 'cpu-wfd', title: 'Wi-Fi Direct Off', detail: 'Wi-Fi Direct option in this lane.', impact: 'low' },
    { id: 'cpu-snmptrap', title: 'SNMP Trap Off', detail: 'SNMP trap option in this lane.', impact: 'low' },
    { id: 'cpu-sdr', title: 'Windows Backup Off', detail: 'Windows backup option in this lane.', impact: 'low' },
    { id: 'cpu-wbengine', title: 'Block Level Backup Off', detail: 'Block backup option in this lane.', impact: 'low' },
    { id: 'cpu-swprv', title: 'Software Shadow Copy Off', detail: 'Shadow copy option in this lane.', impact: 'low' },
    { id: 'cpu-seclogon', title: 'Secondary Logon Off', detail: 'Secondary logon option in this lane.', impact: 'low' },
    { id: 'cpu-shellhw', title: 'Shell Hardware Detect Off', detail: 'Shell hardware option in this lane.', impact: 'low' },
    { id: 'cpu-dmenroll', title: 'Device Enrollment Off', detail: 'Device enrollment option in this lane.', impact: 'low' },
    { id: 'cpu-cdpuser', title: 'CDP User Service Off', detail: 'CDP user option in this lane.', impact: 'low' },
    { id: 'cpu-wpnuser', title: 'User Push Notifications Off', detail: 'User push option in this lane.', impact: 'low' },
    { id: 'cpu-wait-kill', title: 'Faster App Close', detail: 'App close timeout option in this lane.', impact: 'medium' },
    { id: 'cpu-hung', title: 'Faster Hung App Detect', detail: 'Hung app option in this lane.', impact: 'medium' },
    { id: 'cpu-svc-timeout', title: 'Faster Service Stop', detail: 'Service stop timeout option in this lane.', impact: 'low' },
  ],
  zero: [
    { id: 'zero-ptr-accel', title: 'Mouse Acceleration Off', detail: 'Pointer acceleration option in this lane.', impact: 'high' },
    { id: 'zero-mmcss', title: 'Games Task Priority', detail: 'MMCSS option in this lane.', impact: 'medium' },
    { id: 'zero-net-throttle', title: 'Network Throttling Off', detail: 'Network throttling option in this lane.', impact: 'high' },
    { id: 'zero-nagle', title: 'Disable Nagle', detail: 'Nagle option in this lane.', impact: 'high' },
    { id: 'zero-int-mod', title: 'NIC Interrupt Moderation Off', detail: 'NIC interrupt option in this lane.', impact: 'high' },
    { id: 'zero-eee', title: 'Energy-Efficient Ethernet Off', detail: 'Ethernet power option in this lane.', impact: 'medium' },
    { id: 'zero-eco', title: 'Vendor Eco Modes Off', detail: 'Adapter eco option in this lane.', impact: 'low' },
    { id: 'zero-flow', title: 'Flow Control Off', detail: 'Flow control option in this lane.', impact: 'medium' },
    { id: 'zero-lso', title: 'Large Send Offload Off', detail: 'Large send offload option in this lane.', impact: 'medium' },
    { id: 'zero-wol', title: 'Wake-on-LAN Off', detail: 'Wake-on-LAN option in this lane.', impact: 'low' },
    { id: 'zero-wifi-save', title: 'Radio Power Save Off', detail: 'Radio power option in this lane.', impact: 'medium' },
    { id: 'zero-uapsd', title: 'U-APSD Off', detail: 'U-APSD option in this lane.', impact: 'low' },
    { id: 'zero-llmnr', title: 'Legacy Name Protocols Off', detail: 'Name protocol option in this lane.', impact: 'low' },
    { id: 'zero-netbios', title: 'NetBIOS Off', detail: 'NetBIOS option in this lane.', impact: 'low' },
    { id: 'zero-neg-ttl', title: 'Negative Cache TTL', detail: 'Negative cache option in this lane.', impact: 'low' },
    { id: 'zero-bg-cap', title: 'Background Bandwidth Cap', detail: 'Background bandwidth option in this lane.', impact: 'medium' },
    { id: 'zero-p2p', title: 'P2P Update Sharing Off', detail: 'Update sharing option in this lane.', impact: 'low' },
    { id: 'zero-ndu', title: 'Network Data Usage Off', detail: 'Network data usage option in this lane.', impact: 'low' },
    { id: 'zero-smb1', title: 'SMBv1 Off', detail: 'SMBv1 option in this lane.', impact: 'low' },
    { id: 'zero-menu', title: 'Menu Delay Off', detail: 'Menu delay option in this lane.', impact: 'medium' },
    { id: 'zero-dwm', title: 'Window Animations Off', detail: 'Window animation option in this lane.', impact: 'medium' },
    { id: 'zero-ui-anim', title: 'Disable UI Animations', detail: 'UI animation option in this lane.', impact: 'low' },
    { id: 'zero-smooth-scroll', title: 'Smooth Scrolling Off', detail: 'Smooth scrolling option in this lane.', impact: 'low' },
    { id: 'zero-transparency', title: 'Disable Transparency', detail: 'Transparency option in this lane.', impact: 'low' },
    { id: 'zero-bg-apps', title: 'Background Apps Off', detail: 'Background app option in this lane.', impact: 'medium' },
    { id: 'zero-diagtrack', title: 'DiagTrack Off', detail: 'DiagTrack option in this lane.', impact: 'medium' },
    { id: 'zero-telemetry', title: 'Telemetry to Minimum', detail: 'Telemetry option in this lane.', impact: 'medium' },
    { id: 'zero-tasks', title: 'Telemetry Tasks Off', detail: 'Scheduled task option in this lane.', impact: 'low' },
    { id: 'zero-feedback', title: 'Feedback Prompts Off', detail: 'Feedback prompt option in this lane.', impact: 'low' },
    { id: 'zero-adid', title: 'Advertising ID Off', detail: 'Advertising ID option in this lane.', impact: 'low' },
    { id: 'zero-activity', title: 'Activity History Off', detail: 'Activity history option in this lane.', impact: 'low' },
    { id: 'zero-clipboard', title: 'Cloud Clipboard Off', detail: 'Cloud clipboard option in this lane.', impact: 'low' },
    { id: 'zero-handwrite', title: 'Handwriting Data Off', detail: 'Handwriting option in this lane.', impact: 'low' },
    { id: 'zero-sync', title: 'Settings Sync Off', detail: 'Settings sync option in this lane.', impact: 'low' },
    { id: 'zero-fax', title: 'Fax Service Off', detail: 'Fax service option in this lane.', impact: 'low' },
    { id: 'zero-edge', title: 'Edge Background Off', detail: 'Edge background option in this lane.', impact: 'low' },
    { id: 'zero-cortana', title: 'Cortana Off', detail: 'Cortana option in this lane.', impact: 'low' },
    { id: 'zero-web-search', title: 'Web Search Off', detail: 'Web search option in this lane.', impact: 'low' },
    { id: 'zero-tips', title: 'Tips and Suggestions Off', detail: 'Tips option in this lane.', impact: 'low' },
    { id: 'zero-start-ads', title: 'Start Menu Ads Off', detail: 'Start menu ad option in this lane.', impact: 'low' },
    { id: 'zero-lock-ads', title: 'Lock Screen Ads Off', detail: 'Lock screen ad option in this lane.', impact: 'low' },
    { id: 'zero-bloat', title: 'Auto-Installed Apps Off', detail: 'Auto-installed app option in this lane.', impact: 'low' },
    { id: 'zero-widgets', title: 'Widgets Host Off', detail: 'Widgets option in this lane.', impact: 'low' },
    { id: 'zero-teams', title: 'Consumer Teams Off', detail: 'Teams option in this lane.', impact: 'low' },
    { id: 'zero-copilot', title: 'Copilot Off', detail: 'Copilot option in this lane.', impact: 'low' },
    { id: 'zero-updates', title: 'Update Auto-Restart Off', detail: 'Update restart option in this lane.', impact: 'low' },
    { id: 'zero-startup-sound', title: 'Startup Sound Off', detail: 'Startup sound option in this lane.', impact: 'low' },
    { id: 'zero-autoplay', title: 'AutoPlay Off', detail: 'AutoPlay option in this lane.', impact: 'low' },
    { id: 'zero-snap-layout', title: 'Snap Layouts Off', detail: 'Snap layout option in this lane.', impact: 'low' },
    { id: 'zero-context', title: 'Classic Context Menu', detail: 'Context menu option in this lane.', impact: 'low' },
    { id: 'zero-duck', title: 'Audio Ducking Off', detail: 'Audio ducking option in this lane.', impact: 'low' },
    { id: 'zero-notify-sound', title: 'Notification Sounds Off', detail: 'Notification sound option in this lane.', impact: 'low' },
    { id: 'zero-delack', title: 'Delayed ACK Off', detail: 'Delayed ACK option in this lane.', impact: 'high' },
    { id: 'zero-timed-wait', title: 'Shorter TIME-WAIT', detail: 'TIME-WAIT option in this lane.', impact: 'medium' },
    { id: 'zero-rss', title: 'Receive Side Scaling On', detail: 'RSS option in this lane.', impact: 'high' },
    { id: 'zero-offload', title: 'Keep Task Offload', detail: 'Task offload option in this lane.', impact: 'high' },
    { id: 'zero-wsd', title: 'Weak Host Send Off', detail: 'Weak host option in this lane.', impact: 'low' },
    { id: 'zero-max-port', title: 'Expand Ephemeral Ports', detail: 'Ephemeral port option in this lane.', impact: 'medium' },
    { id: 'zero-dead-gw', title: 'Dead Gateway Detect Off', detail: 'Dead gateway option in this lane.', impact: 'medium' },
    { id: 'zero-tcp-nodelay', title: 'TCP No Delay', detail: 'TCP no-delay option in this lane.', impact: 'high' },
    { id: 'zero-sack', title: 'Selective ACK On', detail: 'Selective ACK option in this lane.', impact: 'medium' },
    { id: 'zero-qos-limit', title: 'QoS Bandwidth Reserve Off', detail: 'QoS reserve option in this lane.', impact: 'high' },
    { id: 'zero-smb-throttle', title: 'SMB Bandwidth Throttle Off', detail: 'SMB throttle option in this lane.', impact: 'medium' },
    { id: 'zero-smb-dir', title: 'SMB Directory Cache Off', detail: 'SMB directory cache option in this lane.', impact: 'low' },
    { id: 'zero-smb-info', title: 'SMB File Info Cache Off', detail: 'SMB file info cache option in this lane.', impact: 'low' },
    { id: 'zero-smb-nf', title: 'SMB Not-Found Cache Off', detail: 'SMB not-found cache option in this lane.', impact: 'low' },
    { id: 'zero-autoshare', title: 'Admin Shares Off', detail: 'Admin share option in this lane.', impact: 'low' },
    { id: 'zero-rsc', title: 'Receive Segment Coalescing Off', detail: 'RSC option in this lane.', impact: 'medium' },
    { id: 'zero-nic-rss', title: 'NIC RSS On', detail: 'NIC RSS option in this lane.', impact: 'high' },
    { id: 'zero-pmarp', title: 'ARP Offload', detail: 'ARP Offload option in this lane.', impact: 'low' },
    { id: 'zero-pmns', title: 'NS Offload', detail: 'NS Offload option in this lane.', impact: 'low' },
    { id: 'zero-pme', title: 'NIC Wake PME Off', detail: 'PME option in this lane.', impact: 'low' },
    { id: 'zero-priority-vlan', title: 'Priority VLAN Off', detail: 'Priority VLAN option in this lane.', impact: 'medium' },
    { id: 'zero-itr', title: 'Interrupt Throttle Rate Off', detail: 'ITR option in this lane.', impact: 'medium' },
    { id: 'zero-mod-rate', title: 'Moderation Rate Off', detail: 'Interrupt moderation rate option in this lane.', impact: 'medium' },
    { id: 'zero-auto-giga', title: 'Auto Disable Gigabit Off', detail: 'Auto Gigabit option in this lane.', impact: 'medium' },
    { id: 'zero-location', title: 'Location Services Off', detail: 'Location option in this lane.', impact: 'low' },
    { id: 'zero-sensors', title: 'Sensors Policy Off', detail: 'Sensors option in this lane.', impact: 'low' },
    { id: 'zero-wer', title: 'Error Reporting Off', detail: 'Error reporting option in this lane.', impact: 'low' },
    { id: 'zero-wer-ui', title: 'Error Reporting UI Off', detail: 'Error reporting UI option in this lane.', impact: 'low' },
    { id: 'zero-tailored', title: 'Tailored Experiences Off', detail: 'Tailored experiences option in this lane.', impact: 'low' },
    { id: 'zero-spotlight', title: 'Lock Screen Spotlight Off', detail: 'Spotlight option in this lane.', impact: 'low' },
    { id: 'zero-content', title: 'Content Delivery Off', detail: 'Content delivery option in this lane.', impact: 'low' },
    { id: 'zero-subscribed', title: 'Subscribed Content Off', detail: 'Subscribed content option in this lane.', impact: 'low' },
    { id: 'zero-338393', title: 'Suggested Content Off', detail: 'Suggested content option in this lane.', impact: 'low' },
    { id: 'zero-353694', title: 'Timeline Suggestions Off', detail: 'Timeline suggestion option in this lane.', impact: 'low' },
    { id: 'zero-353696', title: 'Setting Suggestions Off', detail: 'Setting suggestion option in this lane.', impact: 'low' },
    { id: 'zero-338381', title: 'Ink Suggestions Off', detail: 'Ink suggestion option in this lane.', impact: 'low' },
    { id: 'zero-314563', title: 'My People Suggestions Off', detail: 'My People suggestion option in this lane.', impact: 'low' },
    { id: 'zero-track-docs', title: 'Start Recent Files Off', detail: 'Recent files option in this lane.', impact: 'low' },
    { id: 'zero-track-progs', title: 'Start App Tracking Off', detail: 'App tracking option in this lane.', impact: 'low' },
    { id: 'zero-taskview', title: 'Task View Button Off', detail: 'Task View option in this lane.', impact: 'low' },
    { id: 'zero-people', title: 'People Bar Off', detail: 'People bar option in this lane.', impact: 'low' },
    { id: 'zero-meet', title: 'Meet Now Off', detail: 'Meet Now option in this lane.', impact: 'low' },
    { id: 'zero-clipboard-hist', title: 'Clipboard History Off', detail: 'Clipboard history option in this lane.', impact: 'low' },
    { id: 'zero-speech', title: 'Online Speech Off', detail: 'Online speech option in this lane.', impact: 'low' },
    { id: 'zero-find', title: 'Find My Device Off', detail: 'Find My Device option in this lane.', impact: 'low' },
    { id: 'zero-ceip', title: 'Customer Experience Off', detail: 'CEIP option in this lane.', impact: 'low' },
    { id: 'zero-inventory', title: 'App Inventory Off', detail: 'App inventory option in this lane.', impact: 'low' },
    { id: 'zero-remote-assist', title: 'Remote Assistance Off', detail: 'Remote Assistance option in this lane.', impact: 'low' },
    { id: 'zero-hotspot', title: 'OEM Hotspot Auto Off', detail: 'Hotspot option in this lane.', impact: 'low' },
    { id: 'zero-onedrive', title: 'OneDrive Sync Off', detail: 'OneDrive option in this lane.', impact: 'low' },
    { id: 'zero-metadata', title: 'Windows Update Driver Search Off', detail: 'Driver search option in this lane.', impact: 'low' },
    { id: 'zero-device-meta', title: 'Device Metadata Off', detail: 'Device metadata option in this lane.', impact: 'low' },
    { id: 'zero-siuf', title: 'Inking Feedback Off', detail: 'Inking feedback option in this lane.', impact: 'low' },
    { id: 'zero-toast-lock', title: 'Lock Screen Toasts Off', detail: 'Lock toast option in this lane.', impact: 'low' },
    { id: 'zero-notify-lock', title: 'Critical Lock Toasts Off', detail: 'Critical lock toast option in this lane.', impact: 'low' },
    { id: 'zero-edge-prelaunch', title: 'Legacy Edge Prelaunch Off', detail: 'Edge prelaunch option in this lane.', impact: 'low' },
    { id: 'zero-edge-tab', title: 'Legacy Edge Tab Preload Off', detail: 'Edge tab preload option in this lane.', impact: 'low' },
    { id: 'zero-cloud-search', title: 'Cloud Search Off', detail: 'Cloud search option in this lane.', impact: 'low' },
    { id: 'zero-location-search', title: 'Search Location Off', detail: 'Search location option in this lane.', impact: 'low' },
    { id: 'zero-thumb-cache', title: 'Thumbnail Cache Off', detail: 'Thumbnail cache option in this lane.', impact: 'low' },
    { id: 'zero-auto-complete', title: 'Explorer AutoSuggest Off', detail: 'AutoSuggest option in this lane.', impact: 'low' },
    { id: 'zero-hide-recent', title: 'Quick Access Recent Off', detail: 'Recent files option in this lane.', impact: 'low' },
    { id: 'zero-show-frequent', title: 'Quick Access Frequent Off', detail: 'Frequent folders option in this lane.', impact: 'low' },
    { id: 'zero-task-sqm', title: 'SQM Task Off', detail: 'SQM task option in this lane.', impact: 'low' },
    { id: 'zero-task-winsat', title: 'WinSAT Task Off', detail: 'WinSAT task option in this lane.', impact: 'low' },
    { id: 'zero-task-maps', title: 'Maps Update Task Off', detail: 'Maps task option in this lane.', impact: 'low' },
    { id: 'zero-task-wer', title: 'Error Queue Task Off', detail: 'Error queue task option in this lane.', impact: 'low' },
    { id: 'zero-task-ceip2', title: 'Kernel CEIP Task Off', detail: 'Kernel CEIP task option in this lane.', impact: 'low' },
    { id: 'zero-task-disk', title: 'Disk Footprint Task Off', detail: 'Disk footprint task option in this lane.', impact: 'low' },
    { id: 'zero-task-net', title: 'Network Trace Task Off', detail: 'Network trace task option in this lane.', impact: 'low' },
    { id: 'zero-task-cloud', title: 'Cloud Experience Task Off', detail: 'Cloud experience task option in this lane.', impact: 'low' },
    { id: 'zero-cache-ttl', title: 'DNS Cache Lifetime', detail: 'DNS cache option in this lane.', impact: 'low' },
    { id: 'zero-do-qos', title: 'Delivery QoS Floor', detail: 'Delivery QoS option in this lane.', impact: 'low' },
    { id: 'zero-do-fg', title: 'Foreground Download Cap Off', detail: 'Foreground download option in this lane.', impact: 'low' },
    { id: 'zero-prefer-ipv4', title: 'Prefer IPv4', detail: 'IPv4 preference option in this lane.', impact: 'medium' },
    { id: 'zero-arp-life', title: 'ARP Cache Lifetime', detail: 'ARP cache option in this lane.', impact: 'low' },
    { id: 'zero-icmp-redirect', title: 'ICMP Redirects Off', detail: 'ICMP redirect option in this lane.', impact: 'medium' },
    { id: 'zero-keepalive', title: 'Faster TCP Keep-Alive', detail: 'Keep-alive option in this lane.', impact: 'medium' },
    { id: 'zero-connect-retry', title: 'Fewer Connect Retries', detail: 'Connect retry option in this lane.', impact: 'low' },
    { id: 'zero-afd-fast', title: 'Fast Datagram Send', detail: 'Fast datagram option in this lane.', impact: 'high' },
    { id: 'zero-afd-copy', title: 'Fast Datagram Copy', detail: 'Fast copy option in this lane.', impact: 'medium' },
    { id: 'zero-afd-push', title: 'Ignore TCP Push Bit', detail: 'TCP push bit option in this lane.', impact: 'medium' },
    { id: 'zero-afd-boost', title: 'Socket Completion Boost', detail: 'Socket boost option in this lane.', impact: 'medium' },
    { id: 'zero-autoshare-srv', title: 'Server Admin Shares Off', detail: 'Server share option in this lane.', impact: 'low' },
    { id: 'zero-hover', title: 'Faster Mouse Hover', detail: 'Mouse hover option in this lane.', impact: 'medium' },
    { id: 'zero-snap-mouse', title: 'Snap Mouse to Default Off', detail: 'Snap-to-default option in this lane.', impact: 'low' },
    { id: 'zero-track-mouse', title: 'Activation Follows Mouse Off', detail: 'Mouse activation option in this lane.', impact: 'medium' },
    { id: 'zero-toasts', title: 'Windows Toasts Off', detail: 'Windows toast option in this lane.', impact: 'low' },
    { id: 'zero-net-crawl', title: 'Network Crawling Off', detail: 'Network crawling option in this lane.', impact: 'low' },
    { id: 'zero-recent-hist', title: 'Recent Docs History Off', detail: 'Recent docs option in this lane.', impact: 'low' },
    { id: 'zero-link-info', title: 'Shortcut Extra Resolve Off', detail: 'Shortcut resolve option in this lane.', impact: 'low' },
    { id: 'zero-resolve-search', title: 'Shortcut Search Resolve Off', detail: 'Shortcut search option in this lane.', impact: 'low' },
    { id: 'zero-resolve-track', title: 'Shortcut Tracking Off', detail: 'Shortcut tracking option in this lane.', impact: 'low' },
    { id: 'zero-disk-space', title: 'Low Disk Checks Off', detail: 'Low disk check option in this lane.', impact: 'low' },
    { id: 'zero-instrument', title: 'Explorer Instrumentation Off', detail: 'Explorer instrumentation option in this lane.', impact: 'low' },
    { id: 'zero-share-wizard', title: 'Sharing Wizard Off', detail: 'Sharing wizard option in this lane.', impact: 'low' },
    { id: 'zero-auto-check', title: 'Checkbox Select Off', detail: 'Checkbox select option in this lane.', impact: 'low' },
    { id: 'zero-empty-drives', title: 'Hide Empty Drives', detail: 'Empty drive option in this lane.', impact: 'low' },
    { id: 'zero-persist-browse', title: 'Persist Explorer Windows Off', detail: 'Persist window option in this lane.', impact: 'low' },
    { id: 'zero-type-overlay', title: 'Type Overlay Off', detail: 'Type overlay option in this lane.', impact: 'low' },
    { id: 'zero-pretty-path', title: 'Pretty Path Off', detail: 'Pretty path option in this lane.', impact: 'low' },
    { id: 'zero-launch-this', title: 'Explorer Opens This PC', detail: 'Explorer launch option in this lane.', impact: 'low' },
    { id: 'zero-info-tip', title: 'Folder Info Tips Off', detail: 'Info tip option in this lane.', impact: 'low' },
    { id: 'zero-cdm-feature', title: 'Feature Management Off', detail: 'Feature management option in this lane.', impact: 'low' },
    { id: 'zero-cdm-ever', title: 'Preinstalled Apps History Off', detail: 'Preinstalled apps option in this lane.', impact: 'low' },
    { id: 'zero-cdm-remediate', title: 'Content Remediation Off', detail: 'Content remediation option in this lane.', impact: 'low' },
    { id: 'zero-202914', title: 'Spotlight Fun Facts Off', detail: 'Spotlight fun facts option in this lane.', impact: 'low' },
    { id: 'zero-280815', title: 'Consumer Features Off', detail: 'Consumer feature option in this lane.', impact: 'low' },
    { id: 'zero-280810', title: 'Sync Provider Notifications Off', detail: 'Sync provider option in this lane.', impact: 'low' },
    { id: 'zero-338380', title: 'Suggested Apps Off', detail: 'Suggested app option in this lane.', impact: 'low' },
    { id: 'zero-353698', title: 'Start Suggestions Off', detail: 'Start suggestion option in this lane.', impact: 'low' },
    { id: 'zero-314559', title: 'Windows Spotlight Facts Off', detail: 'Spotlight facts option in this lane.', impact: 'low' },
    { id: 'zero-sync-app', title: 'App Setting Sync Off', detail: 'App setting sync option in this lane.', impact: 'low' },
    { id: 'zero-sync-web', title: 'Web Setting Sync Off', detail: 'Web setting sync option in this lane.', impact: 'low' },
    { id: 'zero-sync-theme', title: 'Theme Sync Off', detail: 'Theme sync option in this lane.', impact: 'low' },
    { id: 'zero-sync-cred', title: 'Credential Sync Off', detail: 'Credential sync option in this lane.', impact: 'low' },
    { id: 'zero-sync-paid', title: 'Paid Network Sync Off', detail: 'Paid network sync option in this lane.', impact: 'low' },
    { id: 'zero-spotlight-pol', title: 'Spotlight Policy Off', detail: 'Spotlight policy option in this lane.', impact: 'low' },
    { id: 'zero-cloud-content', title: 'Cloud Optimized Content Off', detail: 'Cloud content option in this lane.', impact: 'low' },
    { id: 'zero-input-personal', title: 'Input Personalization Off', detail: 'Input personalization option in this lane.', impact: 'low' },
    { id: 'zero-app-location', title: 'App Location Access Off', detail: 'App location option in this lane.', impact: 'low' },
    { id: 'zero-app-account', title: 'App Account Access Off', detail: 'App account option in this lane.', impact: 'low' },
    { id: 'zero-app-calendar', title: 'App Calendar Access Off', detail: 'App calendar option in this lane.', impact: 'low' },
    { id: 'zero-app-contacts', title: 'App Contacts Access Off', detail: 'App contacts option in this lane.', impact: 'low' },
    { id: 'zero-app-email', title: 'App Email Access Off', detail: 'App email option in this lane.', impact: 'low' },
    { id: 'zero-app-call', title: 'App Call History Off', detail: 'App call history option in this lane.', impact: 'low' },
    { id: 'zero-app-motion', title: 'App Motion Access Off', detail: 'App motion option in this lane.', impact: 'low' },
    { id: 'zero-app-radios', title: 'App Radio Access Off', detail: 'App radio option in this lane.', impact: 'low' },
    { id: 'zero-app-tasks', title: 'App Tasks Access Off', detail: 'App tasks option in this lane.', impact: 'low' },
    { id: 'zero-app-sync', title: 'App Device Sync Off', detail: 'App device sync option in this lane.', impact: 'low' },
    { id: 'zero-ait', title: 'Application Impact Telemetry Off', detail: 'AIT option in this lane.', impact: 'low' },
    { id: 'zero-device-name', title: 'Device Name in Telemetry Off', detail: 'Device name telemetry option in this lane.', impact: 'low' },
    { id: 'zero-max-tel', title: 'Telemetry Cap Minimum', detail: 'Telemetry cap option in this lane.', impact: 'low' },
    { id: 'zero-connected-web', title: 'Connected Web Search Off', detail: 'Connected search option in this lane.', impact: 'low' },
    { id: 'zero-metered-search', title: 'Metered Web Search Off', detail: 'Metered search option in this lane.', impact: 'low' },
    { id: 'zero-cortana-lock', title: 'Cortana on Lock Off', detail: 'Cortana lock option in this lane.', impact: 'low' },
    { id: 'zero-remote-search', title: 'Remote Search Off', detail: 'Remote search option in this lane.', impact: 'low' },
    { id: 'zero-edge-sleep', title: 'Edge Sleeping Tabs Off', detail: 'Sleeping tabs option in this lane.', impact: 'low' },
    { id: 'zero-edge-first', title: 'Edge First-Run Off', detail: 'Edge first-run option in this lane.', impact: 'low' },
    { id: 'zero-edge-efficiency', title: 'Edge Efficiency Mode Off', detail: 'Edge efficiency option in this lane.', impact: 'medium' },
  ],
  fps: [
    { id: 'fps-dvr', title: 'Kill Game DVR', detail: 'Kill Game DVR option in this lane.', impact: 'high' },
    { id: 'fps-fso', title: 'Fullscreen Optimizations Off', detail: 'Fullscreen Optimizations Off option in this lane.', impact: 'high' },
    { id: 'fps-hags', title: 'Hardware GPU Scheduling', detail: 'Hardware GPU Scheduling option in this lane.', impact: 'high' },
    { id: 'fps-vrr', title: 'VRR for Windowed Mode', detail: 'VRR for Windowed Mode option in this lane.', impact: 'high' },
    { id: 'fps-tear', title: 'Windowed Game Optimizations', detail: 'Windowed Game Optimizations option in this lane.', impact: 'medium' },
    { id: 'fps-cooling', title: 'Active Cooling', detail: 'Active Cooling option in this lane.', impact: 'medium' },
    { id: 'fps-duty', title: 'CPU Duty Cycling Off', detail: 'CPU Duty Cycling Off option in this lane.', impact: 'high' },
    { id: 'fps-sched', title: 'Use All Processor Classes', detail: 'Use All Processor Classes option in this lane.', impact: 'high' },
    { id: 'fps-short-sched', title: 'Prefer Fast Cores', detail: 'Prefer Fast Cores option in this lane.', impact: 'high' },
    { id: 'fps-autonomous', title: 'Hardware Speed Shift On', detail: 'Hardware Speed Shift On option in this lane.', impact: 'high' },
    { id: 'fps-distribute', title: 'Spread Work Across Cores', detail: 'Spread Work Across Cores option in this lane.', impact: 'medium' },
    { id: 'fps-core-up', title: 'Wake Cores Together', detail: 'Wake Cores Together option in this lane.', impact: 'medium' },
    { id: 'fps-core-down', title: 'Keep Core Count Steady', detail: 'Keep Core Count Steady option in this lane.', impact: 'medium' },
    { id: 'fps-concurrency', title: 'Unpark Cores Sooner', detail: 'Unpark Cores Sooner option in this lane.', impact: 'medium' },
    { id: 'fps-distribution', title: 'Even Core Distribution', detail: 'Even Core Distribution option in this lane.', impact: 'medium' },
    { id: 'fps-hetero-dec', title: 'Hold Hybrid Boost', detail: 'Hold Hybrid Boost option in this lane.', impact: 'medium' },
    { id: 'fps-hetero-inc', title: 'Fast Hybrid Ramp', detail: 'Fast Hybrid Ramp option in this lane.', impact: 'medium' },
    { id: 'fps-idle-scale', title: 'Idle Frequency Scaling Off', detail: 'Idle Frequency Scaling Off option in this lane.', impact: 'medium' },
    { id: 'fps-park-perf', title: 'Parked Cores Stay Ready', detail: 'Parked Cores Stay Ready option in this lane.', impact: 'medium' },
    { id: 'fps-park-perf1', title: 'Efficiency Cores Stay Ready', detail: 'Efficiency Cores Stay Ready option in this lane.', impact: 'low' },
    { id: 'fps-history', title: 'Instant Frequency Reaction', detail: 'Instant Frequency Reaction option in this lane.', impact: 'medium' },
    { id: 'fps-history1', title: 'Class 1 Frequency Reaction', detail: 'Class 1 Frequency Reaction option in this lane.', impact: 'low' },
    { id: 'fps-conlock', title: 'Lock Screen Display Sleep Off', detail: 'Lock Screen Display Sleep Off option in this lane.', impact: 'low' },
    { id: 'fps-game-mode', title: 'Game Mode Switch On', detail: 'Game Mode Switch On option in this lane.', impact: 'high' },
    { id: 'fps-audio-cap', title: 'Game Audio Capture Off', detail: 'Game Audio Capture Off option in this lane.', impact: 'high' },
    { id: 'fps-cursor-cap', title: 'Game Cursor Capture Off', detail: 'Game Cursor Capture Off option in this lane.', impact: 'medium' },
    { id: 'fps-history-cap', title: 'Background Game Capture Off', detail: 'Background Game Capture Off option in this lane.', impact: 'high' },
    { id: 'fps-history-battery', title: 'Battery Game Capture Off', detail: 'Battery Game Capture Off option in this lane.', impact: 'medium' },
    { id: 'fps-history-wireless', title: 'Wireless Game Capture Off', detail: 'Wireless Game Capture Off option in this lane.', impact: 'medium' },
    { id: 'fps-mic-cap', title: 'Game Mic Capture Off', detail: 'Game Mic Capture Off option in this lane.', impact: 'medium' },
    { id: 'fps-bg-rec', title: 'Background Recording Off', detail: 'Background Recording Off option in this lane.', impact: 'high' },
    { id: 'fps-gameplay-rec', title: 'Gameplay Recording Off', detail: 'Gameplay Recording Off option in this lane.', impact: 'high' },
    { id: 'fps-mic', title: 'Game Mic Monitor Off', detail: 'Game Mic Monitor Off option in this lane.', impact: 'low' },
    { id: 'fps-tdr-level', title: 'GPU Timeout Recovery On', detail: 'GPU Timeout Recovery On option in this lane.', impact: 'high' },
    { id: 'fps-preempt', title: 'GPU Preemption On', detail: 'GPU Preemption On option in this lane.', impact: 'high' },
    { id: 'fps-overlays', title: 'Hardware Overlays On', detail: 'Hardware Overlays On option in this lane.', impact: 'high' },
    { id: 'fps-tdr-count', title: 'GPU Timeout Count Default', detail: 'GPU Timeout Count Default option in this lane.', impact: 'medium' },
    { id: 'fps-tdr-window', title: 'GPU Timeout Window Default', detail: 'GPU Timeout Window Default option in this lane.', impact: 'medium' },
    { id: 'fps-mpo', title: 'Desktop Overlays On', detail: 'Desktop Overlays On option in this lane.', impact: 'high' },
    { id: 'fps-dwm-anim', title: 'DWM Animation Policy Off', detail: 'DWM Animation Policy Off option in this lane.', impact: 'medium' },
    { id: 'fps-dwm-anim-all', title: 'DWM Animations Off For All Users', detail: 'DWM Animations Off For All Users option in this lane.', impact: 'medium' },
    { id: 'fps-accent', title: 'Accent Gradient Off', detail: 'Accent Gradient Off option in this lane.', impact: 'low' },
    { id: 'fps-spi', title: 'System Animations Off', detail: 'System Animations Off option in this lane.', impact: 'medium' },
    { id: 'fps-effect-cache', title: 'DWM Effect Cache On', detail: 'DWM Effect Cache On option in this lane.', impact: 'medium' },
    { id: 'fps-wheel', title: 'Mouse Wheel Animation Off', detail: 'Mouse Wheel Animation Off option in this lane.', impact: 'low' },
    { id: 'fps-distapps-cat', title: 'Distributed Apps Schedule Class', detail: 'Distributed Apps Schedule Class option in this lane.', impact: 'low' },
    { id: 'fps-distapps-gpu', title: 'Distributed Apps GPU Priority', detail: 'Distributed Apps GPU Priority option in this lane.', impact: 'low' },
    { id: 'fps-distapps-pri', title: 'Distributed Apps CPU Priority', detail: 'Distributed Apps CPU Priority option in this lane.', impact: 'low' },
    { id: 'fps-distapps-sfio', title: 'Distributed Apps IO Priority', detail: 'Distributed Apps IO Priority option in this lane.', impact: 'low' },
    { id: 'fps-distapps-bg', title: 'Distributed Apps Background Class', detail: 'Distributed Apps Background Class option in this lane.', impact: 'low' },
    { id: 'fps-distapps-aff', title: 'Distributed Apps CPU Affinity', detail: 'Distributed Apps CPU Affinity option in this lane.', impact: 'low' },
    { id: 'fps-distapps-lat', title: 'Distributed Apps Latency Hint', detail: 'Distributed Apps Latency Hint option in this lane.', impact: 'low' },
    { id: 'fps-dist-cat', title: 'Distribution Schedule Class', detail: 'Distribution Schedule Class option in this lane.', impact: 'low' },
    { id: 'fps-dist-gpu', title: 'Distribution GPU Priority', detail: 'Distribution GPU Priority option in this lane.', impact: 'low' },
    { id: 'fps-dist-pri', title: 'Distribution CPU Priority', detail: 'Distribution CPU Priority option in this lane.', impact: 'low' },
    { id: 'fps-dist-sfio', title: 'Distribution IO Priority', detail: 'Distribution IO Priority option in this lane.', impact: 'low' },
    { id: 'fps-dist-bg', title: 'Distribution Background Class', detail: 'Distribution Background Class option in this lane.', impact: 'low' },
    { id: 'fps-dist-aff', title: 'Distribution CPU Affinity', detail: 'Distribution CPU Affinity option in this lane.', impact: 'low' },
    { id: 'fps-dist-lat', title: 'Distribution Latency Hint', detail: 'Distribution Latency Hint option in this lane.', impact: 'low' },
    { id: 'fps-install-cat', title: 'Install Tasks Schedule Class', detail: 'Install Tasks Schedule Class option in this lane.', impact: 'low' },
    { id: 'fps-install-gpu', title: 'Install Tasks GPU Priority', detail: 'Install Tasks GPU Priority option in this lane.', impact: 'low' },
    { id: 'fps-install-pri', title: 'Install Tasks CPU Priority', detail: 'Install Tasks CPU Priority option in this lane.', impact: 'low' },
    { id: 'fps-install-sfio', title: 'Install Tasks IO Priority', detail: 'Install Tasks IO Priority option in this lane.', impact: 'low' },
    { id: 'fps-install-bg', title: 'Install Tasks Background Class', detail: 'Install Tasks Background Class option in this lane.', impact: 'low' },
    { id: 'fps-install-aff', title: 'Install Tasks CPU Affinity', detail: 'Install Tasks CPU Affinity option in this lane.', impact: 'low' },
    { id: 'fps-install-lat', title: 'Install Tasks Latency Hint', detail: 'Install Tasks Latency Hint option in this lane.', impact: 'low' },
    { id: 'fps-ie-cat', title: 'Internet Explorer Schedule Class', detail: 'Internet Explorer Schedule Class option in this lane.', impact: 'low' },
    { id: 'fps-ie-gpu', title: 'Internet Explorer GPU Priority', detail: 'Internet Explorer GPU Priority option in this lane.', impact: 'low' },
    { id: 'fps-ie-pri', title: 'Internet Explorer CPU Priority', detail: 'Internet Explorer CPU Priority option in this lane.', impact: 'low' },
    { id: 'fps-ie-sfio', title: 'Internet Explorer IO Priority', detail: 'Internet Explorer IO Priority option in this lane.', impact: 'low' },
    { id: 'fps-ie-bg', title: 'Internet Explorer Background Class', detail: 'Internet Explorer Background Class option in this lane.', impact: 'low' },
    { id: 'fps-ie-aff', title: 'Internet Explorer CPU Affinity', detail: 'Internet Explorer CPU Affinity option in this lane.', impact: 'low' },
    { id: 'fps-ie-lat', title: 'Internet Explorer Latency Hint', detail: 'Internet Explorer Latency Hint option in this lane.', impact: 'low' },
    { id: 'fps-photo-cat', title: 'Photo Import Schedule Class', detail: 'Photo Import Schedule Class option in this lane.', impact: 'low' },
    { id: 'fps-photo-gpu', title: 'Photo Import GPU Priority', detail: 'Photo Import GPU Priority option in this lane.', impact: 'low' },
    { id: 'fps-photo-pri', title: 'Photo Import CPU Priority', detail: 'Photo Import CPU Priority option in this lane.', impact: 'low' },
    { id: 'fps-photo-sfio', title: 'Photo Import IO Priority', detail: 'Photo Import IO Priority option in this lane.', impact: 'low' },
    { id: 'fps-photo-bg', title: 'Photo Import Background Class', detail: 'Photo Import Background Class option in this lane.', impact: 'low' },
    { id: 'fps-photo-aff', title: 'Photo Import CPU Affinity', detail: 'Photo Import CPU Affinity option in this lane.', impact: 'low' },
    { id: 'fps-photo-lat', title: 'Photo Import Latency Hint', detail: 'Photo Import Latency Hint option in this lane.', impact: 'low' },
    { id: 'fps-present-cat', title: 'Presentations Schedule Class', detail: 'Presentations Schedule Class option in this lane.', impact: 'low' },
    { id: 'fps-present-gpu', title: 'Presentations GPU Priority', detail: 'Presentations GPU Priority option in this lane.', impact: 'low' },
    { id: 'fps-present-pri', title: 'Presentations CPU Priority', detail: 'Presentations CPU Priority option in this lane.', impact: 'low' },
    { id: 'fps-present-sfio', title: 'Presentations IO Priority', detail: 'Presentations IO Priority option in this lane.', impact: 'low' },
    { id: 'fps-present-bg', title: 'Presentations Background Class', detail: 'Presentations Background Class option in this lane.', impact: 'low' },
    { id: 'fps-present-aff', title: 'Presentations CPU Affinity', detail: 'Presentations CPU Affinity option in this lane.', impact: 'low' },
    { id: 'fps-present-lat', title: 'Presentations Latency Hint', detail: 'Presentations Latency Hint option in this lane.', impact: 'low' },
    { id: 'fps-movies-gpu', title: 'Movies GPU Priority', detail: 'Movies GPU Priority option in this lane.', impact: 'low' },
    { id: 'fps-movies-cat', title: 'Movies Schedule Class', detail: 'Movies Schedule Class option in this lane.', impact: 'low' },
    { id: 'fps-movies-pri', title: 'Movies CPU Priority', detail: 'Movies CPU Priority option in this lane.', impact: 'low' },
    { id: 'fps-movies-sfio', title: 'Movies IO Priority', detail: 'Movies IO Priority option in this lane.', impact: 'low' },
    { id: 'fps-movies-bg', title: 'Movies Background Class', detail: 'Movies Background Class option in this lane.', impact: 'low' },
    { id: 'fps-movies-aff', title: 'Movies CPU Affinity', detail: 'Movies CPU Affinity option in this lane.', impact: 'low' },
    { id: 'fps-movies-lat', title: 'Movies Latency Hint', detail: 'Movies Latency Hint option in this lane.', impact: 'low' },
    { id: 'fps-playback-gpu', title: 'Playback GPU Priority', detail: 'Playback GPU Priority option in this lane.', impact: 'low' },
    { id: 'fps-playback-cat', title: 'Playback Schedule Class', detail: 'Playback Schedule Class option in this lane.', impact: 'low' },
    { id: 'fps-playback-pri', title: 'Playback CPU Priority', detail: 'Playback CPU Priority option in this lane.', impact: 'low' },
    { id: 'fps-playback-sfio', title: 'Playback IO Priority', detail: 'Playback IO Priority option in this lane.', impact: 'low' },
    { id: 'fps-playback-bg', title: 'Playback Background Class', detail: 'Playback Background Class option in this lane.', impact: 'low' },
    { id: 'fps-playback-aff', title: 'Playback CPU Affinity', detail: 'Playback CPU Affinity option in this lane.', impact: 'low' },
    { id: 'fps-playback-lat', title: 'Playback Latency Hint', detail: 'Playback Latency Hint option in this lane.', impact: 'low' },
    { id: 'fps-video-gpu', title: 'Video GPU Priority', detail: 'Video GPU Priority option in this lane.', impact: 'low' },
    { id: 'fps-video-cat', title: 'Video Schedule Class', detail: 'Video Schedule Class option in this lane.', impact: 'low' },
    { id: 'fps-video-pri', title: 'Video CPU Priority', detail: 'Video CPU Priority option in this lane.', impact: 'low' },
    { id: 'fps-video-sfio', title: 'Video IO Priority', detail: 'Video IO Priority option in this lane.', impact: 'low' },
    { id: 'fps-video-bg', title: 'Video Background Class', detail: 'Video Background Class option in this lane.', impact: 'low' },
    { id: 'fps-video-aff', title: 'Video CPU Affinity', detail: 'Video CPU Affinity option in this lane.', impact: 'low' },
    { id: 'fps-video-lat', title: 'Video Latency Hint', detail: 'Video Latency Hint option in this lane.', impact: 'low' },
    { id: 'fps-camera-gpu', title: 'Video Camera GPU Priority', detail: 'Video Camera GPU Priority option in this lane.', impact: 'low' },
    { id: 'fps-camera-cat', title: 'Video Camera Schedule Class', detail: 'Video Camera Schedule Class option in this lane.', impact: 'low' },
    { id: 'fps-camera-pri', title: 'Video Camera CPU Priority', detail: 'Video Camera CPU Priority option in this lane.', impact: 'low' },
    { id: 'fps-camera-sfio', title: 'Video Camera IO Priority', detail: 'Video Camera IO Priority option in this lane.', impact: 'low' },
    { id: 'fps-camera-bg', title: 'Video Camera Background Class', detail: 'Video Camera Background Class option in this lane.', impact: 'low' },
    { id: 'fps-camera-aff', title: 'Video Camera CPU Affinity', detail: 'Video Camera CPU Affinity option in this lane.', impact: 'low' },
    { id: 'fps-camera-lat', title: 'Video Camera Latency Hint', detail: 'Video Camera Latency Hint option in this lane.', impact: 'low' },
    { id: 'fps-mcu-gpu', title: 'Media Call GPU Priority', detail: 'Media Call GPU Priority option in this lane.', impact: 'low' },
    { id: 'fps-mcu-cat', title: 'Media Call Schedule Class', detail: 'Media Call Schedule Class option in this lane.', impact: 'low' },
    { id: 'fps-mcu-pri', title: 'Media Call CPU Priority', detail: 'Media Call CPU Priority option in this lane.', impact: 'low' },
    { id: 'fps-mcu-sfio', title: 'Media Call IO Priority', detail: 'Media Call IO Priority option in this lane.', impact: 'low' },
    { id: 'fps-mcu-bg', title: 'Media Call Background Class', detail: 'Media Call Background Class option in this lane.', impact: 'low' },
    { id: 'fps-mcu-aff', title: 'Media Call CPU Affinity', detail: 'Media Call CPU Affinity option in this lane.', impact: 'low' },
    { id: 'fps-mcu-lat', title: 'Media Call Latency Hint', detail: 'Media Call Latency Hint option in this lane.', impact: 'low' },
    { id: 'fps-dpp-gpu', title: 'Display Processing GPU Priority', detail: 'Display Processing GPU Priority option in this lane.', impact: 'medium' },
    { id: 'fps-dpp-pri', title: 'Display Processing CPU Priority', detail: 'Display Processing CPU Priority option in this lane.', impact: 'medium' },
    { id: 'fps-dpp-cat', title: 'Display Processing Schedule Class', detail: 'Display Processing Schedule Class option in this lane.', impact: 'medium' },
    { id: 'fps-dpp-sfio', title: 'Display Processing IO Priority', detail: 'Display Processing IO Priority option in this lane.', impact: 'medium' },
    { id: 'fps-dpp-bg', title: 'Display Processing Background Class', detail: 'Display Processing Background Class option in this lane.', impact: 'medium' },
    { id: 'fps-dpp-aff', title: 'Display Processing CPU Affinity', detail: 'Display Processing CPU Affinity option in this lane.', impact: 'medium' },
    { id: 'fps-dpp-lat', title: 'Display Processing Latency Hint', detail: 'Display Processing Latency Hint option in this lane.', impact: 'medium' },
    { id: 'fps-wm-gpu', title: 'Window Manager GPU Priority', detail: 'Window Manager GPU Priority option in this lane.', impact: 'medium' },
    { id: 'fps-wm-pri', title: 'Window Manager CPU Priority', detail: 'Window Manager CPU Priority option in this lane.', impact: 'medium' },
    { id: 'fps-wm-cat', title: 'Window Manager Schedule Class', detail: 'Window Manager Schedule Class option in this lane.', impact: 'medium' },
    { id: 'fps-wm-sfio', title: 'Window Manager IO Priority', detail: 'Window Manager IO Priority option in this lane.', impact: 'medium' },
    { id: 'fps-wm-bg', title: 'Window Manager Background Class', detail: 'Window Manager Background Class option in this lane.', impact: 'medium' },
    { id: 'fps-wm-aff', title: 'Window Manager CPU Affinity', detail: 'Window Manager CPU Affinity option in this lane.', impact: 'medium' },
    { id: 'fps-wm-lat', title: 'Window Manager Latency Hint', detail: 'Window Manager Latency Hint option in this lane.', impact: 'medium' },
    { id: 'fps-cap-gpu', title: 'Game Capture Task GPU Priority', detail: 'Game Capture Task GPU Priority option in this lane.', impact: 'high' },
    { id: 'fps-cap-pri', title: 'Game Capture Task CPU Priority', detail: 'Game Capture Task CPU Priority option in this lane.', impact: 'high' },
    { id: 'fps-cap-cat', title: 'Game Capture Task Schedule Class', detail: 'Game Capture Task Schedule Class option in this lane.', impact: 'high' },
    { id: 'fps-cap-sfio', title: 'Game Capture Task IO Priority', detail: 'Game Capture Task IO Priority option in this lane.', impact: 'high' },
    { id: 'fps-cap-bg', title: 'Game Capture Task Background Class', detail: 'Game Capture Task Background Class option in this lane.', impact: 'high' },
    { id: 'fps-cap-aff', title: 'Game Capture Task CPU Affinity', detail: 'Game Capture Task CPU Affinity option in this lane.', impact: 'high' },
    { id: 'fps-cap-lat', title: 'Game Capture Task Latency Hint', detail: 'Game Capture Task Latency Hint option in this lane.', impact: 'high' },
    { id: 'fps-games-clock', title: 'Games Timer Rate', detail: 'Games Timer Rate option in this lane.', impact: 'high' },
    { id: 'fps-games-aff', title: 'Games CPU Affinity', detail: 'Games CPU Affinity option in this lane.', impact: 'high' },
    { id: 'fps-multi-gpu', title: 'Multimedia GPU Priority', detail: 'Multimedia GPU Priority option in this lane.', impact: 'medium' },
    { id: 'fps-multi-pri', title: 'Multimedia CPU Priority', detail: 'Multimedia CPU Priority option in this lane.', impact: 'medium' },
    { id: 'fps-multi-cat', title: 'Multimedia Schedule Class', detail: 'Multimedia Schedule Class option in this lane.', impact: 'medium' },
    { id: 'fps-multi-sfio', title: 'Multimedia IO Priority', detail: 'Multimedia IO Priority option in this lane.', impact: 'medium' },
    { id: 'fps-multi-aff', title: 'Multimedia CPU Affinity', detail: 'Multimedia CPU Affinity option in this lane.', impact: 'medium' },
  ],
  bios: [
    { id: 'bios-fast-startup', title: 'Fast Startup Off', detail: 'Fast startup option in this lane.', impact: 'high' },
    { id: 'bios-dyntick', title: 'Disable Dynamic Tick', detail: 'Dynamic tick option in this lane.', impact: 'high' },
    { id: 'bios-hpet', title: 'HPET Platform Clock Off', detail: 'HPET option in this lane.', impact: 'high' },
    { id: 'bios-tsc', title: 'Enhanced TSC Sync', detail: 'TSC option in this lane.', impact: 'medium' },
    { id: 'bios-timeout', title: 'Quick Boot Timeout', detail: 'Boot timeout option in this lane.', impact: 'medium' },
    { id: 'bios-ahci', title: 'AHCI Link Power Off', detail: 'AHCI link power option in this lane.', impact: 'medium' },
    { id: 'bios-startup-delay', title: 'Startup App Delay Off', detail: 'Startup delay option in this lane.', impact: 'medium' },
    { id: 'bios-ntfs', title: 'NTFS Last Access Off', detail: 'NTFS last access option in this lane.', impact: 'low' },
  ],
  controller: [
    { id: 'pad-bandwidth', title: 'USB Bandwidth Priority', detail: 'USB bandwidth option in this lane.', impact: 'high' },
    { id: 'pad-interrupts', title: 'High-Frequency Interrupts', detail: 'USB interrupt option in this lane.', impact: 'high' },
    { id: 'pad-endpoint', title: 'Endpoint Size', detail: 'USB endpoint option in this lane.', impact: 'medium' },
    { id: 'pad-sched-boost', title: 'USB Scheduler Boost', detail: 'USB scheduler option in this lane.', impact: 'medium' },
    { id: 'pad-force-rate', title: 'Force Maximum Polling', detail: 'Polling rate option in this lane.', impact: 'high' },
    { id: 'pad-idle-time', title: 'USB Idle Time', detail: 'USB idle option in this lane.', impact: 'high' },
    { id: 'pad-usb-suspend', title: 'USB Selective Suspend Off', detail: 'USB suspend option in this lane.', impact: 'high' },
    { id: 'pad-int-mod', title: 'Interrupt Moderation Off', detail: 'Interrupt moderation option in this lane.', impact: 'medium' },
    { id: 'pad-msi', title: 'USB MSI Mode', detail: 'USB MSI option in this lane.', impact: 'medium' },
    { id: 'pad-responsiveness', title: 'System Responsiveness', detail: 'System responsiveness option in this lane.', impact: 'high' },
    { id: 'bios-hpet', title: 'HPET Optimization', detail: 'HPET option in this lane.', impact: 'high' },
    { id: 'pad-hid-power', title: 'Controller Power Saving Off', detail: 'Controller power option in this lane.', impact: 'high' },
    { id: 'bios-dyntick', title: 'Disable Dynamic Tick', detail: 'Dynamic tick option in this lane.', impact: 'high' },
    { id: 'pad-xinput', title: 'XInput Latency', detail: 'XInput option in this lane.', impact: 'medium' },
    { id: 'pad-directinput', title: 'DirectInput Buffer', detail: 'DirectInput option in this lane.', impact: 'medium' },
    { id: 'zero-ptr-accel', title: 'Raw Input Processing', detail: 'Pointer acceleration option in this lane.', impact: 'high' },
    { id: 'pad-hid-poll', title: 'HID Poll Interval', detail: 'HID poll option in this lane.', impact: 'medium' },
    { id: 'fps-fso', title: 'Fullscreen Exclusive', detail: 'Fullscreen option in this lane.', impact: 'high' },
    { id: 'cpu-game-mode', title: 'Windows Game Mode', detail: 'Game Mode option in this lane.', impact: 'low' },
    { id: 'pad-priority', title: 'Controller Thread Priority', detail: 'Controller thread option in this lane.', impact: 'medium' },
    { id: 'pad-vibration', title: 'Vibration Priority', detail: 'Vibration option in this lane.', impact: 'low' },
    { id: 'cpu-prio', title: 'Foreground Scheduler', detail: 'Foreground scheduler option in this lane.', impact: 'medium' },
    { id: 'pad-serialize', title: 'Serialized Timers', detail: 'Timer serialization option in this lane.', impact: 'medium' },
    { id: 'cpu-timer-system', title: 'Global Timer Resolution', detail: 'Timer resolution option in this lane.', impact: 'high' },
    { id: 'pad-distribute', title: 'Distributed Timers', detail: 'Timer distribution option in this lane.', impact: 'medium' },
    { id: 'bios-tsc', title: 'Enhanced TSC Sync', detail: 'TSC option in this lane.', impact: 'medium' },
    { id: 'pad-watchdog', title: 'DPC Watchdog', detail: 'DPC watchdog option in this lane.', impact: 'high' },
    { id: 'pad-high-perf', title: 'High Performance Plan', detail: 'Power plan option in this lane.', impact: 'high' },
    { id: 'cpu-min-state', title: 'Minimum Processor State', detail: 'Minimum processor option in this lane.', impact: 'high' },
    { id: 'cpu-parking', title: 'Core Parking Off', detail: 'Core parking option in this lane.', impact: 'high' },
    { id: 'cpu-epp', title: 'Max Performance Energy', detail: 'Energy preference option in this lane.', impact: 'high' },
    { id: 'pad-idle-off', title: 'CPU Idle Off', detail: 'CPU idle option in this lane.', impact: 'high' },
    { id: 'cpu-pcie', title: 'PCIe Link Power Off', detail: 'PCIe power option in this lane.', impact: 'medium' },
    { id: 'cpu-throttle', title: 'Power Throttling Off', detail: 'Power throttling option in this lane.', impact: 'high' },
    { id: 'fps-hags', title: 'Hardware GPU Scheduling', detail: 'GPU scheduling option in this lane.', impact: 'high' },
    { id: 'zero-mmcss', title: 'MMCSS Game Profile', detail: 'MMCSS option in this lane.', impact: 'medium' },
    { id: 'zero-net-throttle', title: 'Network Throttling Off', detail: 'Network throttling option in this lane.', impact: 'high' },
    { id: 'pad-sched', title: 'Latency Sensitive Scheduling', detail: 'Scheduler option in this lane.', impact: 'medium' },
    { id: 'pad-queue-trim', title: 'Input Queue Trim', detail: 'Input queue option in this lane.', impact: 'medium' },
    { id: 'pad-usb3-link', title: 'USB 3 Link Power Off', detail: 'USB link power option in this lane.', impact: 'high' },
    { id: 'pad-xhci-msi', title: 'XHCI MSI Mode', detail: 'XHCI MSI option in this lane.', impact: 'medium' },
    { id: 'pad-hub-idle', title: 'Hub Idle Off', detail: 'USB hub idle option in this lane.', impact: 'medium' },
    { id: 'pad-enhanced', title: 'Enhanced USB Power Off', detail: 'Enhanced USB power option in this lane.', impact: 'high' },
    { id: 'pad-xhci-mod', title: 'XHCI Moderation Off', detail: 'XHCI moderation option in this lane.', impact: 'medium' },
    { id: 'fps-dvr', title: 'Game DVR Off', detail: 'Game DVR option in this lane.', impact: 'high' },
    { id: 'pad-guide', title: 'Guide Button Game Bar Off', detail: 'Guide button option in this lane.', impact: 'medium' },
    { id: 'pad-hibernate', title: 'Hibernation Off', detail: 'Hibernation option in this lane.', impact: 'medium' },
    { id: 'zero-bg-apps', title: 'Background Apps Off', detail: 'Background app option in this lane.', impact: 'medium' },
  ],
  keyboard: [
    { id: 'pad-idle-time', title: 'USB Polling Optimization', detail: 'USB idle option in this lane.', impact: 'high' },
    { id: 'pad-usb-suspend', title: 'USB Selective Suspend Off', detail: 'USB suspend option in this lane.', impact: 'high' },
    { id: 'key-queue', title: 'HID Queue Size', detail: 'Input queue option in this lane.', impact: 'medium' },
    { id: 'pad-msi', title: 'MSI Mode for USB', detail: 'USB MSI option in this lane.', impact: 'medium' },
    { id: 'zero-ptr-accel', title: 'Mouse Acceleration Off', detail: 'Pointer acceleration option in this lane.', impact: 'high' },
    { id: 'key-precision', title: 'Enhanced Pointer Precision Off', detail: 'Pointer precision option in this lane.', impact: 'high' },
    { id: 'key-raw', title: 'Raw Input', detail: 'Raw input option in this lane.', impact: 'medium' },
    { id: 'key-fast', title: 'Keyboard Response Time', detail: 'Fast typing option in this lane.', impact: 'medium' },
    { id: 'key-filter', title: 'Filter Keys Off', detail: 'Filter Keys option in this lane.', impact: 'medium' },
    { id: 'key-sticky', title: 'Sticky Keys Off', detail: 'Sticky Keys option in this lane.', impact: 'medium' },
    { id: 'key-toggle', title: 'Toggle Keys Off', detail: 'Toggle Keys option in this lane.', impact: 'low' },
    { id: 'key-kbd-priority', title: 'Keyboard Thread Priority', detail: 'Keyboard thread option in this lane.', impact: 'high' },
    { id: 'key-kbd-poll', title: 'Keyboard Poll Iterations', detail: 'Keyboard poll option in this lane.', impact: 'medium' },
    { id: 'key-mou-priority', title: 'Mouse Thread Priority', detail: 'Mouse thread option in this lane.', impact: 'high' },
    { id: 'key-hooks', title: 'Input Hook Timeout', detail: 'Hook timeout option in this lane.', impact: 'medium' },
    { id: 'key-predict', title: 'Text Prediction Off', detail: 'Text prediction option in this lane.', impact: 'medium' },
    { id: 'key-game', title: 'Layout Switch Hotkeys Off', detail: 'Layout hotkey option in this lane.', impact: 'medium' },
    { id: 'key-serial', title: 'Serial Keys Off', detail: 'Serial Keys option in this lane.', impact: 'low' },
    { id: 'cpu-prio', title: 'Foreground Priority Boost', detail: 'Foreground scheduler option in this lane.', impact: 'medium' },
    { id: 'zero-mmcss', title: 'Games Task Priority', detail: 'MMCSS option in this lane.', impact: 'medium' },
    { id: 'cpu-throttle', title: 'Power Throttling Off', detail: 'Power throttling option in this lane.', impact: 'high' },
    { id: 'cpu-kernel-pin', title: 'Kernel Pinned in RAM', detail: 'Kernel paging option in this lane.', impact: 'medium' },
    { id: 'pad-high-perf', title: 'High Performance Plan', detail: 'Power plan option in this lane.', impact: 'high' },
    { id: 'key-irq', title: 'System Timer IRQ Priority', detail: 'Timer IRQ option in this lane.', impact: 'low' },
    { id: 'cpu-timer-system', title: 'Global Timer Resolution', detail: 'Timer resolution option in this lane.', impact: 'high' },
    { id: 'fps-dvr', title: 'Game DVR Off', detail: 'Game DVR option in this lane.', impact: 'high' },
    { id: 'fps-fso', title: 'Fullscreen Optimizations Off', detail: 'Fullscreen option in this lane.', impact: 'high' },
    { id: 'key-fse-flags', title: 'Exclusive Fullscreen Flags', detail: 'Fullscreen flag option in this lane.', impact: 'medium' },
    { id: 'bios-fast-startup', title: 'Fast Startup Off', detail: 'Fast startup option in this lane.', impact: 'high' },
    { id: 'zero-menu', title: 'Menu Delay Off', detail: 'Menu delay option in this lane.', impact: 'medium' },
    { id: 'key-foreground', title: 'Instant Window Focus', detail: 'Focus timeout option in this lane.', impact: 'medium' },
    { id: 'bios-startup-delay', title: 'Startup App Delay Off', detail: 'Startup delay option in this lane.', impact: 'medium' },
    { id: 'zero-dwm', title: 'Window Animations Off', detail: 'Window animation option in this lane.', impact: 'medium' },
    { id: 'pad-responsiveness', title: 'DPC Latency', detail: 'System responsiveness option in this lane.', impact: 'high' },
    { id: 'zero-net-throttle', title: 'Network Throttling Off', detail: 'Network throttling option in this lane.', impact: 'high' },
    { id: 'bios-hpet', title: 'High Precision Timer', detail: 'HPET option in this lane.', impact: 'high' },
    { id: 'bios-dyntick', title: 'Dynamic Tick Off', detail: 'Dynamic tick option in this lane.', impact: 'high' },
    { id: 'pad-int-mod', title: 'Interrupt Moderation Off', detail: 'Interrupt moderation option in this lane.', impact: 'medium' },
    { id: 'cpu-game-mode', title: 'Windows Game Mode', detail: 'Game Mode option in this lane.', impact: 'low' },
    { id: 'key-ps2', title: 'PS/2 Keyboard Poll', detail: 'PS/2 poll option in this lane.', impact: 'low' },
    { id: 'key-access', title: 'Accessibility Hotkeys Off', detail: 'Accessibility hotkey option in this lane.', impact: 'low' },
  ],
}

function impactLabel(level) {
  if (level === 'high') return 'High impact'
  if (level === 'low') return 'Low impact'
  return 'Medium impact'
}

function markMap(applied) {
  const next = {}
  if (applied) applied.forEach((id) => { next[id] = true })
  return next
}

function count(list, word) {
  return list.length === 1 ? `1 ${word}` : `${list.length} ${word}s`
}

function applyToast(ids, good, titleOf) {
  const kept = ids.length - good.length
  if (!good.length) return { title: 'Settings unchanged', body: 'Windows kept the current values', tone: 'muted', icon: 'apply' }
  if (kept) return { title: `${good.length} of ${ids.length} applied`, body: `${kept} kept ${kept === 1 ? 'its' : 'their'} current setting · takes effect after restart`, icon: 'apply' }
  const title = ids.length === 1 ? `${titleOf(ids[0])} applied` : `${count(ids, 'optimization')} applied`
  return { title, body: 'Takes effect after restart', icon: 'apply' }
}

function revertToast(ids, good, titleOf) {
  const left = ids.length - good.length
  if (!good.length) return { title: 'Settings still applied', body: 'Windows kept the optimized values', tone: 'muted', icon: 'revert' }
  if (left) return { title: `${good.length} of ${ids.length} reverted`, body: `${left} still applied · takes effect after restart`, icon: 'revert' }
  const title = ids.length === 1 ? `${titleOf(ids[0])} reverted` : `${count(ids, 'optimization')} reverted`
  return { title, body: `Original ${ids.length === 1 ? 'setting' : 'settings'} restored · takes effect after restart`, icon: 'revert' }
}

function Icon({ name }) {
  const common = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '1.7', 'aria-hidden': true }
  if (name === 'cpu') {
    return (
      <svg {...common}>
        <rect x="7" y="7" width="10" height="10" rx="1.5" />
        <path d="M9 3v3M12 3v3M15 3v3M9 18v3M12 18v3M15 18v3M3 9h3M3 12h3M3 15h3M18 9h3M18 12h3M18 15h3" />
      </svg>
    )
  }
  if (name === 'zap') {
    return (
      <svg {...common}>
        <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />
      </svg>
    )
  }
  if (name === 'fps') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v5l3 2" />
      </svg>
    )
  }
  if (name === 'bios') {
    return (
      <svg {...common}>
        <rect x="6" y="6" width="12" height="12" rx="2" />
        <path d="M9 10h6M9 14h4" />
      </svg>
    )
  }
  if (name === 'pad') {
    return (
      <svg {...common}>
        <path d="M7 9h10a4 4 0 0 1 4 4v1a3 3 0 0 1-3 3h-1l-2-2h-6l-2 2H6a3 3 0 0 1-3-3v-1a4 4 0 0 1 4-4z" />
        <path d="M8 12h3M9.5 10.5v3M16 11.5h.01M18 13.5h.01" />
      </svg>
    )
  }
  if (name === 'key') {
    return (
      <svg {...common}>
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <rect x="4" y="5" width="16" height="12" rx="2" />
      <path d="M8 19h8M12 17v2" />
    </svg>
  )
}

export default function TweaksPage() {
  const [side, setSide] = useState(null)
  const [phase, setPhase] = useState('brothers')
  const [pickId, setPickId] = useState('gpu')
  const [laneId, setLaneId] = useState(null)
  const [marks, setMarks] = useState(() => markMap(readTweakState()?.applied))
  const [hidden, setHidden] = useState(() => new Set(readTweakState()?.unavailable || []))
  const [query, setQuery] = useState('')
  const [working, setWorking] = useState(false)
  const [toast, setToast] = useState(null)
  const [toastShown, setToastShown] = useState(false)
  const scrollRef = useRef(null)
  const toastTimer = useRef(0)
  const requests = useRef({ next: 0, latest: {} })
  const picked = LANES.find((item) => item.id === pickId) || LANES[0]
  const lane = LANES.find((item) => item.id === laneId)
  const theme = phase === 'lane' ? lane : phase === 'open' ? picked : null
  const laneOptions = lane ? (OPTIONS[lane.id] || []).filter((item) => !hidden.has(item.id)) : []
  const needle = query.trim().toLowerCase()
  const visibleOptions = laneOptions.filter((item) => {
    if (!needle) return true
    return `${item.title} ${item.detail}`.toLowerCase().includes(needle)
  })
  const activeCount = laneOptions.filter((item) => marks[item.id]).length

  useSmoothWheel(scrollRef, phase === 'lane')

  useEffect(() => {
    let live = true
    loadTweakState().then((state) => {
      if (!live || !state) return
      setMarks(markMap(state.applied))
      setHidden(new Set(state.unavailable))
    })
    LANES.forEach((item) => {
      const image = new Image()
      image.decoding = 'async'
      image.src = item.body
    })
    return () => {
      live = false
      window.clearTimeout(toastTimer.current)
    }
  }, [])

  useEffect(() => {
    const root = document.documentElement
    if (phase === 'lane') root.classList.add('is-tweak-lane')
    else root.classList.remove('is-tweak-lane')
    return () => root.classList.remove('is-tweak-lane')
  }, [phase])

  const showToast = (next) => {
    window.clearTimeout(toastTimer.current)
    setToast({ ...next, rgb: lane?.rgb || picked.rgb })
    setToastShown(true)
    toastTimer.current = window.setTimeout(() => setToastShown(false), TOAST_MS)
  }

  const titleOf = (id) => Object.values(OPTIONS).flat().find((item) => item.id === id)?.title || 'Optimization'

  const commit = async (ids, on) => {
    const bridge = window.optimizerWindow
    const token = ++requests.current.next
    ids.forEach((id) => { requests.current.latest[id] = token })
    setMarks((current) => {
      const next = { ...current }
      ids.forEach((id) => { next[id] = on })
      return next
    })
    let result = null
    try {
      result = await (on ? bridge?.tweaksApply?.(ids) : bridge?.tweaksRevert?.(ids))
    } catch {
      result = null
    }
    const good = on ? [...(result?.applied || []), ...(result?.already || [])] : [...(result?.reverted || []), ...(result?.missing || [])]
    const goodSet = new Set(good)
    const missing = result?.unavailable || []
    setMarks((current) => {
      const next = { ...current }
      ids.forEach((id) => {
        if (requests.current.latest[id] === token) next[id] = goodSet.has(id) ? on : !on
      })
      return next
    })
    if (missing.length) setHidden((current) => new Set([...current, ...missing]))
    recordTweakState(on ? { applied: good, unavailable: missing } : { reverted: good })
    showToast(on ? applyToast(ids, good.filter((id) => ids.includes(id)), titleOf) : revertToast(ids, good.filter((id) => ids.includes(id)), titleOf))
  }

  const setLane = async (on) => {
    if (!lane || working) return
    const ids = laneOptions.filter((item) => Boolean(marks[item.id]) !== on).map((item) => item.id)
    if (!ids.length) {
      showToast(on
        ? { title: 'Lane already applied', body: 'Every tweak here is active', icon: 'apply' }
        : { title: 'Lane at original settings', body: 'Every tweak here is ready to apply', icon: 'revert' })
      return
    }
    setWorking(true)
    try {
      await commit(ids, on)
    } finally {
      setWorking(false)
    }
  }

  const toggle = (id) => {
    commit([id], !marks[id])
  }

  const open = (next) => {
    if (phase !== 'brothers') return
    setSide(next)
    setPickId(next === 'sasuke' ? 'cpu' : 'gpu')
    setPhase('open')
  }

  const back = () => {
    if (phase === 'lane') {
      setPhase('open')
      setLaneId(null)
      return
    }
    setPhase('brothers')
    setSide(null)
  }

  const className = [
    'blank-tweaks',
    side ? `is-${side}` : '',
    phase === 'open' ? 'is-open' : '',
    phase === 'lane' ? 'is-lane is-flow' : '',
    theme ? 'is-themed' : '',
  ].filter(Boolean).join(' ')

  return (
    <section className={className} aria-label="Tweaks" style={theme ? { '--tweak-rgb': theme.rgb } : undefined}>
      <div className="blank-tweaks__brothers">
        <img src="/tweaks/brothers.png?v=2" alt="" />
        <button type="button" className="blank-tweaks__hit is-itachi" aria-label="Itachi" onClick={() => open('itachi')} />
        <button type="button" className="blank-tweaks__hit is-sasuke" aria-label="Sasuke" onClick={() => open('sasuke')} />
      </div>
      <button type="button" className="blank-tweaks__name is-itachi" aria-label="Blank" onClick={() => open('itachi')}>
        {BLANK.map((letter) => (
          <span key={letter} aria-hidden="true">{letter}</span>
        ))}
      </button>
      <button type="button" className="blank-tweaks__name is-sasuke" aria-label="Nouzen" onClick={() => open('sasuke')}>
        {NOUZEN.map((letter) => (
          <span key={letter} aria-hidden="true">{letter}</span>
        ))}
      </button>
      <div className="blank-tweaks__veil" aria-hidden="true" />
      {phase === 'open' ? (
        <button type="button" className="blank-tweaks__back is-deck" onClick={back}>Back</button>
      ) : null}
      {phase === 'open' ? (
        <article className="blank-cast" style={{ '--card-rgb': picked.rgb }}>
          <div className="blank-cast__hero">
            <img src={picked.body} alt="" />
          </div>
          <div className="blank-cast__panel">
            <p className="blank-cast__kicker">Tweaks</p>
            <h1>{picked.character}</h1>
            <p className="blank-cast__role">{picked.title}</p>
            <div className="blank-cast__list">
              {LANES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={item.id === picked.id ? 'is-on' : ''}
                  style={{ '--card-rgb': item.rgb }}
                  onClick={() => setPickId(item.id)}
                >
                  <img src={item.src} alt="" />
                  <span>
                    <strong>{item.character}</strong>
                    <em>{item.title}</em>
                  </span>
                  {(OPTIONS[item.id] || []).some((option) => marks[option.id]) ? <b>On</b> : null}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="blank-cast__enter"
              onClick={() => {
                setQuery('')
                setLaneId(picked.id)
                setPhase('lane')
              }}
            >
              Enter lane
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </button>
          </div>
        </article>
      ) : null}
      {phase === 'lane' && lane ? (
        <section className="blank-lane" aria-label={lane.title}>
          <div className="blank-lane__ambient" aria-hidden="true" />
          <header className="blank-lane__head">
            <button type="button" className="blank-lane__back" onClick={back}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
              Back
            </button>
            <div className="blank-lane__title-wrap">
              <span className="blank-lane__eyebrow">Optimization lane</span>
              <h2>{lane.title}</h2>
            </div>
            <div className="blank-lane__stat" aria-live="polite">{activeCount} / {laneOptions.length} active</div>
          </header>
          <div className="blank-lane__toolbar">
            <input
              type="search"
              className="blank-lane__search"
              placeholder="Search tweaks in this lane..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className="blank-lane__actions">
              <button type="button" className="blank-lane__revert" disabled={working} onClick={() => setLane(false)}>Revert optimizations</button>
              <button type="button" className="blank-lane__apply" disabled={working} onClick={() => setLane(true)}>Apply all optimizations</button>
            </div>
          </div>
          <div className="blank-lane__scroll" ref={scrollRef}>
            <div className="blank-lane__bento" role="list">
              {visibleOptions.map((item, index) => (
                <article
                  key={item.id}
                  role="listitem"
                  className={`blank-tweak${index === 0 && !needle ? ' is-spotlight' : ''}${marks[item.id] ? ' is-on' : ''}`}
                  onClick={() => toggle(item.id)}
                >
                  <span className="blank-tweak__accent" aria-hidden="true" />
                  <span className="blank-tweak__glow" aria-hidden="true" />
                  <div className="blank-tweak__inner">
                    <div className="blank-tweak__top">
                      <div className="blank-tweak__identity">
                        <span className="blank-tweak__icon" aria-hidden="true"><Icon name={lane.icon} /></span>
                        <div>
                          <span className="blank-tweak__cat">{lane.title}</span>
                          <h3>{item.title}</h3>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="blank-tweak__toggle"
                        aria-checked={marks[item.id] ? 'true' : 'false'}
                        aria-label={`Toggle ${item.title}`}
                        onClick={(event) => {
                          event.stopPropagation()
                          toggle(item.id)
                        }}
                      />
                    </div>
                    <p>{item.detail}</p>
                    <div className="blank-tweak__foot">
                      <span className={`blank-tweak__impact is-${item.impact}`}>{impactLabel(item.impact)}</span>
                      <span className="blank-tweak__status">{marks[item.id] ? 'Applied' : 'Ready'}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}
      {createPortal(
        <div
          className={`blank-toast${toastShown ? ' is-shown' : ''}${toast?.tone === 'muted' ? ' is-muted' : ''}`}
          role="status"
          aria-live="polite"
          style={{ '--tweak-rgb': toast?.rgb || '200, 16, 46' }}
        >
          <span className="blank-toast__icon" aria-hidden="true">
            {toast?.icon === 'revert' ? (
              <svg viewBox="0 0 24 24"><path d="M9 7H4V2" /><path d="M4.6 7A8 8 0 1 1 4 12" /></svg>
            ) : (
              <svg viewBox="0 0 24 24"><path d="M5 12.5l4.2 4.2L19 7" /></svg>
            )}
          </span>
          <span className="blank-toast__copy">
            <strong>{toast?.title}</strong>
            <small>{toast?.body}</small>
          </span>
        </div>,
        document.body,
      )}
    </section>
  )
}
