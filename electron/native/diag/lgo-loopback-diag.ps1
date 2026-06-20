<#
  lgo-loopback-diag.ps1 — one-click loopback diagnostic for Asclion.

  Goal: when the robot link is mediated by a local middleware (LMS for LEO,
  Pharmathek's local agent, OmnicellAgent, RowaService…) the dispense order
  flows over 127.0.0.1, which the default WinDivert NETWORK-layer filter does
  NOT see. This script:

    1. Enumerates every TCP listener on the loopback adapter
    2. Resolves each listener to its owning process
    3. Keeps the ones whose process name matches a known middleware pattern
       (LMS*, Rowa*, Omnicell*, Pharmathek*, etc.) — falls back to ALL
       loopback listeners if none match, so we never miss an unknown LGO
    4. Captures every loopback packet to each candidate port for $Seconds
       seconds via WinDivert in passive SNIFF mode
    5. Zips the per-port capture logs + a summary JSON into one .zip the
       pharmacist can email to support

  Capture is 100 % passive (SNIFF + RECV_ONLY) so the LGO↔robot link is never
  perturbed. Patient data is NOT scrubbed here — this is a diagnostic dump for
  internal analysis only; the resulting zip must be handled as personal data.

  Usage (run as Administrator):
      powershell -ExecutionPolicy Bypass -File lgo-loopback-diag.ps1 `
          -DllPath "C:\Path\To\WinDivert.dll" `
          -OutDir  "$env:TEMP\asclion-loopback-diag" `
          -Seconds 60
#>
param(
  [Parameter(Mandatory = $true)][string]$DllPath,
  [string]$OutDir = "$env:TEMP\asclion-loopback-diag",
  [int]$Seconds = 60,
  # When set, capture EVERY loopback listener (not just middleware-looking
  # processes). Useful when the middleware is unknown / unnamed.
  [switch]$All
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $DllPath)) {
  Write-Error "WinDivert.dll not found at: $DllPath"
  exit 2
}

$scriptDir = Split-Path -Parent $PSCommandPath
$captureScript = Join-Path (Split-Path -Parent $scriptDir) "windivert\windivert-capture.ps1"
if (-not (Test-Path $captureScript)) {
  Write-Error "windivert-capture.ps1 not found at: $captureScript"
  exit 2
}

# Fresh output folder
if (Test-Path $OutDir) { Remove-Item $OutDir -Recurse -Force }
New-Item -ItemType Directory -Path $OutDir | Out-Null

Write-Host "[asclion] Loopback diagnostic starting…"
Write-Host "[asclion] Output folder : $OutDir"
Write-Host "[asclion] Capture window: $Seconds s per port"
Write-Host ""

# ── Step 1+2+3: enumerate loopback listeners + owning process ─────────────
$middlewarePatterns = @(
  'LMS', 'Leo', 'Rowa', 'Omnicell', 'Pharmathek', 'Robot',
  'Winpharma', 'Pharmagest', 'Wpf', 'Dispenser', 'Stockage'
)

$listeners = @()
try {
  $listeners = Get-NetTCPConnection -State Listen -ErrorAction Stop |
    Where-Object {
      $_.LocalAddress -eq '127.0.0.1' -or
      $_.LocalAddress -eq '0.0.0.0'   -or
      $_.LocalAddress -eq '::1'       -or
      $_.LocalAddress -eq '::'
    } |
    ForEach-Object {
      $proc = $null
      try { $proc = Get-Process -Id $_.OwningProcess -ErrorAction Stop } catch {}
      [PSCustomObject]@{
        LocalPort   = [int]$_.LocalPort
        LocalAddress= $_.LocalAddress
        Pid         = [int]$_.OwningProcess
        ProcessName = if ($proc) { $proc.ProcessName } else { "pid:$($_.OwningProcess)" }
        ProcessPath = if ($proc) { try { $proc.Path } catch { $null } } else { $null }
      }
    }
} catch {
  Write-Warning "Get-NetTCPConnection failed: $($_.Exception.Message)"
}

# Always exclude Asclion itself and obvious noise (Electron, browsers, system)
$noisePatterns = @('Asclion', 'electron', 'chrome', 'msedge', 'firefox', 'svchost', 'System', 'Idle')
$listeners = $listeners | Where-Object {
  $name = $_.ProcessName
  -not ($noisePatterns | Where-Object { $name -like "*$_*" })
}

$candidates = $listeners
if (-not $All) {
  $filtered = $listeners | Where-Object {
    $name = $_.ProcessName
    ($middlewarePatterns | Where-Object { $name -like "*$_*" }).Count -gt 0
  }
  if ($filtered.Count -gt 0) { $candidates = $filtered }
}

# Dedupe by port
$candidates = $candidates | Sort-Object LocalPort -Unique

if ($candidates.Count -eq 0) {
  Write-Warning "No loopback listener candidate found. Try -All to capture every loopback port."
  $summary = @{
    timestamp = (Get-Date).ToString("o")
    candidates = @()
    note = "No middleware listener detected"
  }
  $summary | ConvertTo-Json -Depth 5 | Out-File (Join-Path $OutDir "summary.json") -Encoding UTF8
  exit 0
}

Write-Host "[asclion] Found $($candidates.Count) candidate port(s):"
$candidates | ForEach-Object {
  Write-Host ("  - port {0,-6} pid {1,-6} {2}" -f $_.LocalPort, $_.Pid, $_.ProcessName)
}
Write-Host ""

# ── Step 4: capture each candidate port in parallel ───────────────────────
$jobs = @()
foreach ($c in $candidates) {
  $logPath = Join-Path $OutDir ("port-{0}-{1}.log" -f $c.LocalPort, $c.ProcessName)
  Write-Host "[asclion] Capturing port $($c.LocalPort) → $logPath"

  $job = Start-Job -ScriptBlock {
    param($captureScript, $dll, $port, $logPath)
    & powershell.exe -NoProfile -ExecutionPolicy Bypass `
      -File $captureScript `
      -DllPath $dll `
      -Port $port `
      -Loopback `
      2>&1 | Out-File -FilePath $logPath -Encoding UTF8
  } -ArgumentList $captureScript, $DllPath, $c.LocalPort, $logPath

  $jobs += [PSCustomObject]@{ Job = $job; Port = $c.LocalPort; LogPath = $logPath; Process = $c.ProcessName }
}

Write-Host ""
Write-Host "[asclion] Trigger a real robot dispense NOW. Capturing for $Seconds seconds…"
Start-Sleep -Seconds $Seconds

Write-Host "[asclion] Stopping captures…"
foreach ($entry in $jobs) {
  try { Stop-Job -Job $entry.Job -ErrorAction SilentlyContinue } catch {}
  try { Remove-Job -Job $entry.Job -Force -ErrorAction SilentlyContinue } catch {}
}

# ── Step 5: build summary + zip ───────────────────────────────────────────
$results = foreach ($entry in $jobs) {
  $size = 0
  $lines = 0
  if (Test-Path $entry.LogPath) {
    $size = (Get-Item $entry.LogPath).Length
    $lines = (Get-Content $entry.LogPath -ErrorAction SilentlyContinue | Measure-Object -Line).Lines
  }
  [PSCustomObject]@{
    port        = $entry.Port
    processName = $entry.Process
    logFile     = Split-Path -Leaf $entry.LogPath
    bytes       = $size
    lines       = $lines
    sawTraffic  = ($lines -gt 1)
  }
}

$summary = @{
  timestamp     = (Get-Date).ToString("o")
  captureSeconds= $Seconds
  candidates    = $candidates
  results       = $results
}
$summary | ConvertTo-Json -Depth 5 | Out-File (Join-Path $OutDir "summary.json") -Encoding UTF8

$zipPath = "$OutDir.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path (Join-Path $OutDir "*") -DestinationPath $zipPath

Write-Host ""
Write-Host "[asclion] Done."
Write-Host "[asclion] Summary :"
$results | Format-Table -AutoSize
Write-Host "[asclion] Zip     : $zipPath"
Write-Host "[asclion] Send this zip to Asclion support to identify the LMS port + protocol."
