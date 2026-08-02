param([string]$Type = 'latency')

if ($Type -eq 'devices') {
    $scan = Join-Path $PSScriptRoot 'devices-scan.ps1'
    if (Test-Path $scan) { & $scan; exit 0 }
}

$result = @{}

try {
    $ping = Test-Connection -ComputerName '8.8.8.8' -Count 2 -ErrorAction SilentlyContinue |
        Measure-Object -Property ResponseTime -Average
    $result.pingMs = if ($ping.Average) { [math]::Round($ping.Average, 0) } else { $null }
} catch { $result.pingMs = $null }

try {
    $iface = Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters\Interfaces\*' -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($iface) {
        $result.nagleOff = ($iface.TCPNoDelay -eq 1 -and $iface.TcpAckFrequency -eq 1)
    }
} catch { $result.nagleOff = $false }

try {
    $mq = Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Services\mouclass\Parameters' -Name MouseDataQueueSize -ErrorAction SilentlyContinue
    $result.mouseQueue = $mq.MouseDataQueueSize
} catch { $result.mouseQueue = $null }

try {
    $kq = Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Services\kbdclass\Parameters' -Name KeyboardDataQueueSize -ErrorAction SilentlyContinue
    $result.keyboardQueue = $kq.KeyboardDataQueueSize
} catch { $result.keyboardQueue = $null }

try {
    $tr = Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\kernel' -Name GlobalTimerResolutionRequests -ErrorAction SilentlyContinue
    $result.timerOptimized = ($tr.GlobalTimerResolutionRequests -eq 1)
} catch { $result.timerOptimized = $false }

try {
    $sr = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile' -Name SystemResponsiveness -ErrorAction SilentlyContinue
    $result.systemResponsiveness = $sr.SystemResponsiveness
} catch { $result.systemResponsiveness = $null }

try {
    $gm = Get-ItemProperty 'HKCU:\Software\Microsoft\GameBar' -Name AutoGameModeEnabled -ErrorAction SilentlyContinue
    $result.gameMode = ($gm.AutoGameModeEnabled -eq 1)
} catch { $result.gameMode = $false }

try {
    $gs = Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' -Name HwSchMode -ErrorAction SilentlyContinue
    $result.gpuScheduling = ($gs.HwSchMode -eq 2)
} catch { $result.gpuScheduling = $false }

try {
    $sys = Get-Service SysMain -ErrorAction SilentlyContinue
    $result.sysMainRunning = ($sys.Status -eq 'Running')
} catch { $result.sysMainRunning = $true }

try {
    $mouse = Get-ItemProperty 'HKCU:\Control Panel\Mouse' -ErrorAction SilentlyContinue
    $result.mouseAccelOff = ($mouse.MouseSpeed -eq '0')
} catch { $result.mouseAccelOff = $false }

try {
    $dns = Get-DnsClientServerAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.ServerAddresses -contains '1.1.1.1' } | Select-Object -First 1
    $result.cloudflareDns = ($null -ne $dns)
} catch { $result.cloudflareDns = $false }

try {
    $controllers = Get-PnpDevice -Class 'HIDClass','USB','Bluetooth' -ErrorAction SilentlyContinue |
        Where-Object {
            $_.Status -eq 'OK' -and $_.FriendlyName -notmatch 'audio controller|storage|serial io|interrupt|sata|host controller|lpc|gpio|realtek|spaces controller|port policy' -and
            $_.FriendlyName -match 'dualsense|dualshock|wireless controller|game controller|gamepad|xbox|joystick|8bitdo|thrustmaster|054c|045e|nacon|hori'
        }
    $result.controllers = @($controllers | ForEach-Object { $_.FriendlyName })
} catch { $result.controllers = @() }

try {
    $mice = Get-PnpDevice -Class 'Mouse','HIDClass' -ErrorAction SilentlyContinue |
        Where-Object { $_.FriendlyName -match 'mouse|hid-compliant mouse' -and $_.Status -eq 'OK' } | Select-Object -First 3
    $result.mice = @($mice | ForEach-Object { $_.FriendlyName })
} catch { $result.mice = @() }

try {
    $kbs = Get-PnpDevice -Class 'Keyboard','HIDClass' -ErrorAction SilentlyContinue |
        Where-Object { $_.FriendlyName -match 'keyboard|hid keyboard' -and $_.Status -eq 'OK' } | Select-Object -First 3
    $result.keyboards = @($kbs | ForEach-Object { $_.FriendlyName })
} catch { $result.keyboards = @() }

$result.type = $Type
$result.timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$result | ConvertTo-Json -Compress
