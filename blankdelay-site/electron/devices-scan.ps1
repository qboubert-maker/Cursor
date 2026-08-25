$result = @{ controllers = @(); mice = @(); keyboards = @() }
$ctrlPat = 'dualsense|dualshock|wireless controller|game controller|gamepad|xbox|joystick|8bitdo|thrustmaster|nacon|hori|054c|045e'
$excludePat = 'audio controller|storage|serial io|interrupt controller|sata|host controller|lpc controller|gpio|realtek|spaces controller|port policy'
$mousePat = 'hid-compliant mouse|^mouse'
$kbPat = 'keyboard|hid keyboard'

function Test-GameController($name) {
    if ($name -match $excludePat) { return $false }
    return ($name -match $ctrlPat)
}

function Sort-ControllerNames($names) {
    return @($names | Sort-Object @{
        Expression = {
            if ($_ -match 'dualsense|dualshock|game controller|gamepad|xbox') { 0 }
            elseif ($_ -match 'wireless controller') { 1 }
            else { 2 }
        }
    })
}

try {
    $all = Get-PnpDevice -PresentOnly -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq 'OK' }
    $result.controllers = Sort-ControllerNames @($all | Where-Object { Test-GameController $_.FriendlyName } | ForEach-Object { $_.FriendlyName } | Select-Object -Unique)
    $result.mice = @($all | Where-Object { $_.FriendlyName -match $mousePat } | Select-Object -First 3 | ForEach-Object { $_.FriendlyName })
    $result.keyboards = @($all | Where-Object { $_.FriendlyName -match $kbPat } | Select-Object -First 3 | ForEach-Object { $_.FriendlyName })
} catch {}

if (-not $result.controllers.Count) {
    try {
        Get-CimInstance Win32_PnPEntity -ErrorAction SilentlyContinue |
            Where-Object { Test-GameController $_.Name } |
            ForEach-Object { $result.controllers += $_.Name }
        $result.controllers = Sort-ControllerNames @($result.controllers | Select-Object -Unique)
    } catch {}
}

$result.type = 'devices'
$result.timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$result | ConvertTo-Json -Compress