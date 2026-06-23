<#
  ============================================================================
  lgo-process-diagnostic.ps1   —  Snapshot des ressources ouvertes par le LGO
  ============================================================================
  Retourne un objet JSON consommé par Asclion (robot:calibrate-snapshot).
  Ne lance AUCUNE fenêtre visible, ne demande PAS l'élévation admin.

  Détecte :
    - Le processus LGO (SRVSVCNAM, leo, winpharma, lgpi, pharmagest, …)
    - Son répertoire d'installation
    - Les ports COM occupés (candidats : robot via RS232)
    - Les connexions TCP actives du LGO
    - Les Named Pipes qui ressemblent à un robot
    - Les fichiers récemment modifiés dans le répertoire d'install
  ============================================================================
#>
[CmdletBinding()]
param()

$ErrorActionPreference = "SilentlyContinue"

# ── Processus LGO connus ────────────────────────────────────────────────────
$LGO_NAMES = @('srvsvcnam','leo','lgpi','winpharma','pharmagest','smartrx',
               'caduciel','alliadis','crystal','isipharm','officine','visiopharm',
               'pharmavitale','lgnet','pharmafact')

function Find-LgoProcesses {
    $found = @()
    foreach ($name in $LGO_NAMES) {
        $procs = Get-Process -Name $name -ErrorAction SilentlyContinue
        foreach ($p in $procs) {
            $exePath = ""
            try { $exePath = $p.MainModule.FileName } catch {}
            $installDir = ""
            if ($exePath) { try { $installDir = Split-Path $exePath -Parent } catch {} }
            $found += [pscustomobject]@{
                name       = $p.ProcessName
                pid        = $p.Id
                exePath    = $exePath
                installDir = $installDir
            }
        }
    }
    return $found
}

# ── Ports COM occupés ───────────────────────────────────────────────────────
function Get-BusyComPorts {
    $busy = @()
    $comPorts = (Get-WmiObject Win32_SerialPort -ErrorAction SilentlyContinue).DeviceID
    if (-not $comPorts) { return $busy }
    foreach ($port in $comPorts) {
        try {
            $sp = New-Object System.IO.Ports.SerialPort($port)
            $sp.Open()
            $sp.Close()
            # Libre — on l'ignore
        } catch {
            $msg = $_.Exception.Message
            if ($msg -match 'Access|denied|utilisé|busy|open') {
                $busy += $port
            }
        }
    }
    return $busy
}

# ── Connexions TCP du LGO ───────────────────────────────────────────────────
function Get-LgoTcpConnections([int[]]$pids) {
    if (-not $pids -or $pids.Count -eq 0) { return @() }
    $conns = @()
    foreach ($pid in $pids) {
        $tcpConns = Get-NetTCPConnection -OwningProcess $pid -ErrorAction SilentlyContinue
        foreach ($c in $tcpConns) {
            $conns += [pscustomobject]@{
                localPort   = $c.LocalPort
                remoteAddr  = $c.RemoteAddress
                remotePort  = $c.RemotePort
                state       = $c.State.ToString()
            }
        }
    }
    return $conns
}

# ── Named Pipes robots ──────────────────────────────────────────────────────
function Get-RobotPipes {
    $robotKw = 'rowa|wwks|willach|robot|automat|dispens|pharma|omnicell|becton|mach4|knapp|swisslog|tosho'
    try {
        $pipes = [System.IO.Directory]::GetFiles('\\.\pipe\') |
            ForEach-Object { Split-Path $_ -Leaf } |
            Where-Object { $_ -match $robotKw }
        return @($pipes)
    } catch { return @() }
}

# ── Fichiers récemment modifiés dans le répertoire d'install ─────────────────
function Get-RecentFiles([string]$dir, [int]$sinceSeconds = 300) {
    if (-not $dir -or -not (Test-Path $dir)) { return @() }
    $cutoff = (Get-Date).AddSeconds(-$sinceSeconds)
    $files = Get-ChildItem -Path $dir -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object { $_.LastWriteTime -gt $cutoff } |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 20 |
        ForEach-Object {
            [pscustomobject]@{
                path        = $_.FullName
                ext         = $_.Extension.ToLower()
                sizeBytes   = $_.Length
                modifiedAgo = [int]((Get-Date) - $_.LastWriteTime).TotalSeconds
            }
        }
    return @($files)
}

# ── Main ────────────────────────────────────────────────────────────────────
$lgoProcs   = Find-LgoProcesses
$busyCom    = Get-BusyComPorts
$lgoTcp     = Get-LgoTcpConnections ($lgoProcs | ForEach-Object { $_.pid })
$robotPipes = Get-RobotPipes

# Fichiers récents dans le répertoire d'install du premier process trouvé
$recentFiles = @()
$installDir  = ""
if ($lgoProcs.Count -gt 0) {
    $installDir  = $lgoProcs[0].installDir
    $recentFiles = Get-RecentFiles $installDir
}

$result = [pscustomobject]@{
    ok          = $true
    lgoProcs    = $lgoProcs
    installDir  = $installDir
    busyCom     = $busyCom
    tcp         = $lgoTcp
    robotPipes  = $robotPipes
    recentFiles = $recentFiles
    scannedAt   = (Get-Date -Format "HH:mm:ss")
}

Write-Output ($result | ConvertTo-Json -Depth 5 -Compress)
