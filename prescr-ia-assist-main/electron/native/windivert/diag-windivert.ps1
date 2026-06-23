# diag-windivert.ps1 - pinpoint WHY the WinDivert capture exits immediately.
#
# A lancer dans un PowerShell ADMINISTRATEUR, a la racine du repo:
#   powershell -NoProfile -ExecutionPolicy Bypass -File electron\native\windivert\diag-windivert.ps1
#
# Teste chaque etape et imprime un VERDICT. Compatible Windows PowerShell 5.1.
# (ASCII uniquement, pas d operateurs < > dans les messages.)

$ErrorActionPreference = "Continue"
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$dll = Join-Path $dir "WinDivert.dll"
$sys = Join-Path $dir "WinDivert64.sys"

Write-Host "=== Asclion - diagnostic WinDivert ==="

# 1) Elevation reelle
$id = [Security.Principal.WindowsIdentity]::GetCurrent()
$pr = New-Object Security.Principal.WindowsPrincipal($id)
if ($pr.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Host "1. Administrateur       : OUI"
} else {
  Write-Host "1. Administrateur       : NON  (WinDivert exige l admin)"
}

# 2) Binaires
if (Test-Path $dll) { Write-Host ("2. WinDivert.dll        : OK " + (Get-Item $dll).Length + " o") }
else                { Write-Host ("2. WinDivert.dll        : MANQUANT " + $dll) }
if (Test-Path $sys) { Write-Host ("   WinDivert64.sys      : OK " + (Get-Item $sys).Length + " o") }
else                { Write-Host ("   WinDivert64.sys      : MANQUANT " + $sys) }

# 3) Service WinDivert preexistant (conflit possible avec une autre app)
$drv = Get-CimInstance Win32_SystemDriver -Filter "Name='WinDivert'" -ErrorAction SilentlyContinue
if ($drv) {
  Write-Host ("3. Service WinDivert    : DEJA INSTALLE  etat=" + $drv.State + " demarrage=" + $drv.StartMode)
  Write-Host ("   chemin .sys          : " + $drv.PathName)
  Write-Host "   (s il pointe vers un AUTRE .sys = conflit de version, voir fix sc delete plus bas)"
} else {
  Write-Host "3. Service WinDivert    : aucun preexistant (bon)"
}

# 4) Add-Type (compilation du shim C#)
$shim = @"
using System;
using System.Runtime.InteropServices;
public static class WDDiag {
  [DllImport("kernel32.dll", SetLastError=true, CharSet=CharSet.Unicode)]
  public static extern IntPtr LoadLibrary(string p);
  [DllImport("WinDivert.dll", CharSet=CharSet.Ansi, SetLastError=true)]
  public static extern IntPtr WinDivertOpen(string f, int l, short pr, ulong fl);
  [DllImport("WinDivert.dll", SetLastError=true)]
  public static extern bool WinDivertClose(IntPtr h);
}
"@
try {
  Add-Type -TypeDefinition $shim -Language CSharp
  Write-Host "4. Add-Type (C#)        : OK"
} catch {
  Write-Host ("4. Add-Type             : ECHEC  " + $_.Exception.Message)
  Write-Host "VERDICT: compilateur C# .NET Framework indisponible pour PowerShell."
  exit 1
}

# 5) LoadLibrary (charge la DLL par chemin absolu)
$h = [WDDiag]::LoadLibrary($dll)
if ($h -eq [IntPtr]::Zero) {
  $e = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
  Write-Host ("5. LoadLibrary          : ECHEC win32=" + $e)
  if ($e -eq 126) {
    Write-Host "VERDICT: win32=126 dependance manquante. Installe Microsoft Visual C++ Redistributable x64 (vc_redist.x64.exe) puis relance."
  } else {
    Write-Host ("VERDICT: la DLL ne se charge pas, win32=" + $e)
  }
  exit 1
}
Write-Host "5. LoadLibrary          : OK"

# 6) WinDivertOpen filtre TRIVIAL -> isole le driver des questions de filtre
$INVALID = [IntPtr](-1)
$flags = [uint64](0x1 -bor 0x4)   # SNIFF + RECV_ONLY
$h1 = [WDDiag]::WinDivertOpen("true", 0, [int16]0, $flags)
if ($h1 -eq $INVALID -or $h1 -eq [IntPtr]::Zero) {
  $e = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
  Write-Host ("6. WinDivertOpen true   : ECHEC win32=" + $e)
  if     ($e -eq 5)    { Write-Host "VERDICT: win32=5 ACCES REFUSE. Le process n est pas reellement eleve (admin)." }
  elseif ($e -eq 2)    { Write-Host "VERDICT: win32=2. WinDivert64.sys introuvable a cote de la DLL." }
  elseif ($e -eq 577)  { Write-Host "VERDICT: win32=577. Driver refuse par la signature." }
  elseif ($e -eq 1275) { Write-Host "VERDICT: win32=1275 ERROR_DRIVER_BLOCKED. Secure Boot ou strategie bloque le driver." }
  elseif ($e -eq 1058) { Write-Host "VERDICT: win32=1058. Service driver desactive." }
  elseif ($e -eq 1072) { Write-Host "VERDICT: win32=1072. Service en cours de suppression. Redemarre Windows puis relance." }
  else                 { Write-Host ("VERDICT: win32=" + $e + ". Tres souvent un WinDivert d une AUTRE app deja installe (conflit). Voir point 3 + fix sc delete plus bas.") }
  exit 1
}
[WDDiag]::WinDivertClose($h1) | Out-Null
Write-Host "6. WinDivertOpen true   : OK  (le driver s ouvre)"

# 7) WinDivertOpen avec le filtre EXACT du scan (plage de ports)
$f2 = "tcp and ip and ((tcp.DstPort >= 1024 and tcp.DstPort <= 20000) or (tcp.SrcPort >= 1024 and tcp.SrcPort <= 20000))"
$h2 = [WDDiag]::WinDivertOpen($f2, 0, [int16]0, $flags)
if ($h2 -eq $INVALID -or $h2 -eq [IntPtr]::Zero) {
  $e = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
  Write-Host ("7. WinDivertOpen scan   : ECHEC win32=" + $e)
  Write-Host ("VERDICT: le driver marche mais le FILTRE du scan est rejete, win32=" + $e + ". Bug filtre cote Asclion, dis-le-moi.")
  exit 1
}
[WDDiag]::WinDivertClose($h2) | Out-Null
Write-Host "7. WinDivertOpen scan   : OK"
Write-Host "VERDICT: WinDivert s ouvre parfaitement. Si la capture ne voit RIEN = loopback sur un seul PC (teste avec une VM ou un 2e PC)."
exit 0
