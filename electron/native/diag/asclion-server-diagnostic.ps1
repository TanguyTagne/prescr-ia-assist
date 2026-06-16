<#
  ============================================================================
  asclion-server-diagnostic.ps1   —  Diagnostic reseau LGO <-> robot Rowa
  ============================================================================

  Lance depuis Asclion : Parametres -> Robot -> "Diagnostic robot (PC serveur)".
  Peut aussi se lancer a la main : clic droit -> "Executer avec PowerShell".

  OBJECTIF
  --------
  Trouver, sans rien deviner, COMMENT la caisse (LGO) parle au robot Rowa :
    * sur QUEL PORT TCP le robot ecoute,
    * QUELLES IP (caisses / serveur LGO) sont connectees,
    * dans quel SENS circule le message vu depuis CE PC (entrant / sortant),
    * si la communication passe par le loopback (127.0.0.1) -> cas piege,
    * (option) lire la CHARGE UTILE XML pour confirmer le code CIP/EAN.

  Le protocole Rowa (WWKS2) = des messages XML sur une simple socket TCP.
  Le port n'est PAS public : il est fixe a l'installation. D'ou ce scan.

  N'installe RIEN : utilise uniquement Get-NetTCPConnection + pktmon (integres
  a Windows). Fonctionne meme si la capture WinDivert/Npcap d'Asclion echoue,
  et voit aussi le loopback.

  Options :
    -Seconds 90              duree de l'ecoute temps reel (defaut 45)
    -Capture -Port 6050      capture la charge utile XML sur ce port (pktmon)
                             -> produit un .pcapng a ouvrir dans Wireshark
  ============================================================================
#>

[CmdletBinding()]
param(
  [int]$Seconds = 45,
  [switch]$Capture,
  [int]$Port = 0,
  [string]$LogDir = "$env:USERPROFILE\Desktop"
)

# ---- Auto-elevation administrateur ----------------------------------------
$id        = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($id)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Host "Elevation en administrateur..." -ForegroundColor Yellow
  $a = @("-NoExit","-ExecutionPolicy","Bypass","-File","`"$PSCommandPath`"","-Seconds",$Seconds,"-LogDir","`"$LogDir`"")
  if ($Capture)    { $a += "-Capture" }
  if ($Port -gt 0) { $a += @("-Port",$Port) }
  Start-Process powershell.exe -Verb RunAs -ArgumentList $a
  exit
}

$ErrorActionPreference = "Continue"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
if (-not (Test-Path $LogDir)) { $LogDir = $env:USERPROFILE }
$log = Join-Path $LogDir "asclion-diag-$($env:COMPUTERNAME)-$stamp.txt"
try { Start-Transcript -Path $log -Append | Out-Null } catch {}

function Section($t){ Write-Host "`n========================== $t ==========================" -ForegroundColor Cyan }

# Mots-cles pour reperer automatiquement le robot et le LGO dans les process
$robotKw = @('rowa','wwks','vmax','vmotion','prowa','becton','dispens')
$lgoKw   = @('winpharma','lgpi','pharmagest','smartrx','smart rx','pharma','caduciel','periph',
             'visiopharm','officine','isipharm','alliadis','crystal','pharmaland','santestat')
$noiseKw = @('chrome','msedge','firefox','iexplore','svchost','System','Idle','OneDrive','Teams',
             'outlook','SearchApp','RuntimeBroker','explorer','Spotify','steam','Discord')

function Get-ProcInfo([int]$procId){
  try {
    $p = Get-Process -Id $procId -ErrorAction Stop
    $path = ""; try { $path = $p.Path } catch {}
    return [pscustomobject]@{ Name=$p.ProcessName; Path=$path }
  } catch { return [pscustomobject]@{ Name="(pid $procId)"; Path="" } }
}
function Is-Private($ip){
  if ($ip -match '^127\.' -or $ip -eq '::1') { return $true }
  if ($ip -match '^10\.')                    { return $true }
  if ($ip -match '^192\.168\.')              { return $true }
  if ($ip -match '^172\.(1[6-9]|2[0-9]|3[0-1])\.') { return $true }
  return $false
}
function Is-Loopback($ip){ return ($ip -match '^127\.' -or $ip -eq '::1') }
function Match-Kw($txt,$kw){ foreach($k in $kw){ if($txt -match [regex]::Escape($k)){ return $true } }; return $false }

# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "  ASCLION - Diagnostic robot Rowa (WWKS2)" -ForegroundColor White
Write-Host "  Journal complet enregistre dans : $log" -ForegroundColor DarkGray

Section "PC ANALYSE"
Write-Host "Nom du PC   : $($env:COMPUTERNAME)"
Write-Host "Date/heure  : $(Get-Date)"
Write-Host "Adresses IPv4 de ce PC :"
$myIps = @()
Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -ne '127.0.0.1' } |
  ForEach-Object { $myIps += $_.IPAddress; Write-Host "   $($_.IPAddress)   ($($_.InterfaceAlias))" }

# ---------------------------------------------------------------------------
Section "PORTS EN ECOUTE  (un serveur/robot attend des connexions sur l'un d'eux)"
$listen = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Sort-Object LocalPort -Unique)
$listenPorts = @($listen | Select-Object -ExpandProperty LocalPort -Unique)
$rowsL = foreach($c in $listen){
  $pi = Get-ProcInfo $c.OwningProcess
  $flag = ""
  if (Match-Kw "$($pi.Name) $($pi.Path)" $robotKw)      { $flag = "<== ROBOT ?" }
  elseif (Match-Kw "$($pi.Name) $($pi.Path)" $lgoKw)    { $flag = "<== LGO ?" }
  elseif ($c.LocalPort -ge 1024 -and $c.LocalPort -le 20000 -and -not (Match-Kw $pi.Name $noiseKw)) { $flag = "(candidat)" }
  [pscustomobject]@{ Port=$c.LocalPort; Ecoute=$c.LocalAddress; Processus=$pi.Name; PID=$c.OwningProcess; Indice=$flag }
}
$rowsL | Sort-Object Port | Format-Table -AutoSize | Out-String -Width 200 | Write-Host

# ---------------------------------------------------------------------------
Section "CONNEXIONS ETABLIES  (LGO <-> Robot : le port + l'IP se lisent ici)"
$est = @(Get-NetTCPConnection -State Established -ErrorAction SilentlyContinue)
$rowsE = foreach($c in $est){
  if (-not (Is-Private $c.RemoteAddress)) { continue }   # on ignore Internet
  $pi = Get-ProcInfo $c.OwningProcess
  $type = ""
  if     (Match-Kw "$($pi.Name) $($pi.Path)" $robotKw) { $type = "robot" }
  elseif (Match-Kw "$($pi.Name) $($pi.Path)" $lgoKw)   { $type = "LGO" }
  elseif (Match-Kw $pi.Name $noiseKw)                  { $type = "(bruit)" }
  [pscustomobject]@{
    Local    = "$($c.LocalAddress):$($c.LocalPort)"
    Distant  = "$($c.RemoteAddress):$($c.RemotePort)"
    Processus= $pi.Name
    PID      = $c.OwningProcess
    Type     = $type
    Loopback = (Is-Loopback $c.RemoteAddress)
  }
}
$rowsE | Format-Table -AutoSize | Out-String -Width 200 | Write-Host
if ($rowsE | Where-Object { $_.Loopback }) {
  Write-Host "ATTENTION : connexions en 127.0.0.1 detectees." -ForegroundColor Yellow
  Write-Host "  -> LGO et Rowa tournent sur CE meme PC et se parlent en loopback." -ForegroundColor Yellow
  Write-Host "  -> Une capture WinDivert/Npcap classique NE VOIT PAS le loopback." -ForegroundColor Yellow
  Write-Host "     C'est tres probablement la cause du probleme. (voir resume)" -ForegroundColor Yellow
}

# ---------------------------------------------------------------------------
Section "ECOUTE TEMPS REEL : $Seconds s  ->  DECLENCHE UNE VRAIE DELIVRANCE MAINTENANT"
Write-Host "Lance la sortie d'un medicament par le robot depuis la caisse." -ForegroundColor Yellow
Write-Host "Je surveille toute NOUVELLE connexion TCP (utile si une socket s'ouvre par commande)..." -ForegroundColor Yellow
$seen = @{}
foreach($c in (Get-NetTCPConnection -State Established -ErrorAction SilentlyContinue)){
  $seen["$($c.LocalAddress):$($c.LocalPort)-$($c.RemoteAddress):$($c.RemotePort)"] = $true
}
$newOnes = New-Object System.Collections.ArrayList
$deadline = (Get-Date).AddSeconds($Seconds)
while((Get-Date) -lt $deadline){
  Start-Sleep -Milliseconds 700
  foreach($c in (Get-NetTCPConnection -State Established -ErrorAction SilentlyContinue)){
    if (-not (Is-Private $c.RemoteAddress)) { continue }
    $key = "$($c.LocalAddress):$($c.LocalPort)-$($c.RemoteAddress):$($c.RemotePort)"
    if (-not $seen.ContainsKey($key)){
      $seen[$key] = $true
      $pi = Get-ProcInfo $c.OwningProcess
      Write-Host ("[NOUVEAU]  {0}:{1}  <->  {2}:{3}   proc={4}" -f $c.LocalAddress,$c.LocalPort,$c.RemoteAddress,$c.RemotePort,$pi.Name) -ForegroundColor Green
      [void]$newOnes.Add([pscustomobject]@{ Local="$($c.LocalAddress):$($c.LocalPort)"; Distant="$($c.RemoteAddress):$($c.RemotePort)"; Processus=$pi.Name; PID=$c.OwningProcess })
    }
  }
}
if ($newOnes.Count -eq 0){
  Write-Host "Aucune nouvelle connexion pendant l'ecoute." -ForegroundColor DarkYellow
  Write-Host " -> Normal si la liaison LGO<->robot est PERMANENTE : regarde le tableau" -ForegroundColor DarkYellow
  Write-Host "    'CONNEXIONS ETABLIES' ci-dessus, le bon port y est deja." -ForegroundColor DarkYellow
}

# ---------------------------------------------------------------------------
Section "RESUME POUR CALIBRER ASCLION"
# On deduit, pour chaque liaison privee, quel cote est le PORT DE SERVICE.
$svc = @{}
foreach($c in $est){
  if (-not (Is-Private $c.RemoteAddress)) { continue }
  $pi = Get-ProcInfo $c.OwningProcess
  if (Match-Kw $pi.Name $noiseKw) { continue }
  $localIsSvc = ($listenPorts -contains $c.LocalPort)
  if     ($localIsSvc)                                              { $svcPort=$c.LocalPort;  $dir="inbound (ce PC = serveur)";  $srv=$c.LocalAddress }
  elseif ($c.RemotePort -lt 49152 -and $c.LocalPort -ge 49152)     { $svcPort=$c.RemotePort; $dir="outbound (ce PC = client)";  $srv=$c.RemoteAddress }
  elseif ($c.LocalPort -le $c.RemotePort)                          { $svcPort=$c.LocalPort;  $dir="inbound (ce PC = serveur)";  $srv=$c.LocalAddress }
  else                                                             { $svcPort=$c.RemotePort; $dir="outbound (ce PC = client)";  $srv=$c.RemoteAddress }
  $key = "$svcPort|$dir"
  if (-not $svc.ContainsKey($key)){
    $svc[$key] = [pscustomobject]@{ Port=$svcPort; Direction=$dir; ServeurIp=$srv; Process=$pi.Name; Peers=(New-Object System.Collections.Generic.HashSet[string]); Loopback=$false }
  }
  [void]$svc[$key].Peers.Add($c.RemoteAddress)
  if (Is-Loopback $c.RemoteAddress) { $svc[$key].Loopback = $true }
}

if ($svc.Count -eq 0){
  Write-Host "Aucune liaison locale candidate detectee pour l'instant." -ForegroundColor Yellow
  Write-Host "Relance le diagnostic ET declenche une delivrance pendant l'ecoute," -ForegroundColor Yellow
  Write-Host "ou verifie que tu es bien sur le PC qui heberge le robot." -ForegroundColor Yellow
} else {
  $i = 0
  foreach($k in ($svc.Keys | Sort-Object)){
    $s = $svc[$k]; $i++
    $peers = ($s.Peers | Sort-Object) -join ", "
    Write-Host ""
    Write-Host ("CANDIDAT #{0}" -f $i) -ForegroundColor Green
    Write-Host ("   Port robot (service) : {0}" -f $s.Port)
    Write-Host ("   Sens vu d'ici        : {0}" -f $s.Direction)
    Write-Host ("   IP serveur robot     : {0}" -f $s.ServeurIp)
    Write-Host ("   PC connectes (peers) : {0}" -f $peers)
    Write-Host ("   Processus            : {0}" -f $s.Process)
    if ($s.Loopback){ Write-Host "   /!\ LOOPBACK : capture WinDivert/Npcap aveugle ici (voir note)." -ForegroundColor Yellow }
    Write-Host "   --> Reglage Asclion :" -ForegroundColor Cyan
    $cd = if ($s.Direction -like 'inbound*'){'both (ou inbound)'} else {'both (ou outbound)'}
    Write-Host ("        port            = {0}" -f $s.Port)
    Write-Host ("        captureDirection= {0}" -f $cd)
    Write-Host ("        robotServerIp   = {0}" -f $s.ServeurIp)
    Write-Host ("   Pour lire le message XML de ce port, relance avec :")
    Write-Host ("        -Capture -Port {0}" -f $s.Port)
  }
}

# ---------------------------------------------------------------------------
if ($Capture -and $Port -gt 0){
  Section "CAPTURE CHARGE UTILE (pktmon) sur le port $Port pendant $Seconds s"
  if (-not (Get-Command pktmon.exe -ErrorAction SilentlyContinue)){
    Write-Host "pktmon n'est pas disponible sur ce Windows. Utilise Wireshark a la place." -ForegroundColor Yellow
  } else {
    try {
      & pktmon filter remove | Out-Null
      & pktmon filter add "AsclionRowa" -t TCP -p $Port | Out-Null
      $etl  = Join-Path $LogDir "asclion-capture-$Port-$stamp.etl"
      $pcap = [IO.Path]::ChangeExtension($etl, ".pcapng")
      Write-Host "Capture en cours... DECLENCHE une delivrance maintenant. ($Seconds s)" -ForegroundColor Yellow
      & pktmon start --capture --pkt-size 0 --file-name $etl | Out-Null
      Start-Sleep -Seconds $Seconds
      & pktmon stop | Out-Null
      & pktmon filter remove | Out-Null
      & pktmon pcapng $etl -o $pcap | Out-Null
      Write-Host "Capture enregistree :" -ForegroundColor Green
      Write-Host "   $pcap"
      Write-Host "Ouvre-la dans Wireshark -> clic droit sur un paquet -> 'Follow > TCP Stream'"
      Write-Host "pour lire le XML WWKS2 et reperer le code CIP/EAN du medicament."
    } catch {
      Write-Host "Echec pktmon : $($_.Exception.Message)" -ForegroundColor Red
      Write-Host "Solution de repli : capture avec Wireshark sur le port $Port." -ForegroundColor Yellow
    }
  }
}

Write-Host ""
Write-Host "Termine. Envoie ce fichier journal au support Asclion :" -ForegroundColor White
Write-Host "   $log" -ForegroundColor White
Write-Host "(Cette fenetre reste ouverte : ferme-la quand tu as note les infos.)" -ForegroundColor DarkGray
try { Stop-Transcript | Out-Null } catch {}
