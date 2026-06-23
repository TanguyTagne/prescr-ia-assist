<#
  ============================================================================
  lgo-capture.ps1   —  Capture des changements pendant un appel robot
  ============================================================================
  Utilisé par Asclion (robot:calibrate-start) pour détecter en temps réel
  ce que le LGO écrit APRÈS avoir envoyé une commande au robot automate.

  Protocole stdout (lu ligne par ligne par le main process Electron) :
    READY                  → watcher actif, Asclion peut dire à l'utilisateur
                             de déclencher un appel robot maintenant
    {"event":"change",...} → un fichier a changé
    {"event":"done",...}   → capture terminée (timeout), résumé complet

  Paramètres :
    -WatchDir   <string>   Répertoire racine à surveiller (ex: C:\...\santesocial)
    -Duration   <int>      Durée max en secondes (défaut 35)
  ============================================================================
#>
[CmdletBinding()]
param(
    [string]$WatchDir  = "",
    [int]   $Duration  = 35
)

$ErrorActionPreference = "SilentlyContinue"

# Fallback : si pas de répertoire fourni, utiliser le répertoire du premier
# processus LGO trouvé
if (-not $WatchDir -or -not (Test-Path $WatchDir)) {
    $LGO_NAMES = @('srvsvcnam','leo','lgpi','winpharma','pharmagest')
    foreach ($name in $LGO_NAMES) {
        $p = Get-Process -Name $name -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($p) {
            try {
                $WatchDir = Split-Path $p.MainModule.FileName -Parent
                break
            } catch {}
        }
    }
}

if (-not $WatchDir -or -not (Test-Path $WatchDir)) {
    Write-Output '{"event":"error","message":"Répertoire LGO introuvable"}'
    exit 1
}

# Collecter les changements dans une liste thread-safe
$changes = [System.Collections.Concurrent.ConcurrentBag[object]]::new()

$watcher = New-Object System.IO.FileSystemWatcher($WatchDir)
$watcher.IncludeSubdirectories = $true
$watcher.NotifyFilter = (
    [System.IO.NotifyFilters]::LastWrite -bor
    [System.IO.NotifyFilters]::FileName  -bor
    [System.IO.NotifyFilters]::Size
)
$watcher.EnableRaisingEvents = $false

# Handler partagé Changed + Created
$handler = {
    $path = $Event.SourceEventArgs.FullPath
    $type = $Event.SourceEventArgs.ChangeType.ToString()
    $ext  = [System.IO.Path]::GetExtension($path).ToLower()
    # Ignorer les fichiers temporaires OS, locks, thumbnails
    $leafName = [System.IO.Path]::GetFileName($path)
    if ($leafName -match '^\.|\.tmp$|\.lck$|~\$') { return }
    $obj = [pscustomobject]@{
        event      = "change"
        changeType = $type
        path       = $path
        ext        = $ext
        time       = (Get-Date -Format "HH:mm:ss.fff")
    }
    $script:changes.Add($obj)
    # Émettre immédiatement sur stdout pour que Electron puisse streamer
    Write-Output ($obj | ConvertTo-Json -Compress)
    [Console]::Out.Flush()
}

$evChanged = Register-ObjectEvent -InputObject $watcher -EventName Changed -Action $handler
$evCreated = Register-ObjectEvent -InputObject $watcher -EventName Created -Action $handler

$watcher.EnableRaisingEvents = $true

# Signal Electron : prêt à capturer
Write-Output "READY"
[Console]::Out.Flush()

# Boucle d'attente
Start-Sleep -Seconds $Duration

# Nettoyage
$watcher.EnableRaisingEvents = $false
Unregister-Event -SourceIdentifier $evChanged.Name -ErrorAction SilentlyContinue
Unregister-Event -SourceIdentifier $evCreated.Name -ErrorAction SilentlyContinue
$watcher.Dispose()

# Résumé final — dédoublonnage par path
$seen  = @{}
$dedup = @()
foreach ($c in $changes) {
    if (-not $seen.ContainsKey($c.path)) {
        $seen[$c.path] = $true
        $dedup += $c
    }
}

$summary = [pscustomobject]@{
    event      = "done"
    watchDir   = $WatchDir
    totalEvents= $changes.Count
    uniqueFiles= $dedup.Count
    files      = $dedup
}
Write-Output ($summary | ConvertTo-Json -Depth 4 -Compress)
[Console]::Out.Flush()
