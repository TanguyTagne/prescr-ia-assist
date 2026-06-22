<#
  windivert-port-scan.ps1 — short passive capture used by Paramètres → Robot
  to find the TCP port/IP actually used between the LGO and the robot server.

  It intentionally captures TCP in BOTH directions for a few seconds: on some
  Rowa installations Asclion runs on the robot-server PC and the LGO packets are
  inbound, while per-till installs see outbound packets.
#>
param(
  [Parameter(Mandatory = $true)][string]$DllPath,
  [int]$DurationSec = 20
)

$ErrorActionPreference = "Stop"

try {
  $shim = @"
using System;
using System.Runtime.InteropServices;
public static class WDPortScan {
  [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern IntPtr LoadLibrary(string path);
  [DllImport("WinDivert.dll", CharSet = CharSet.Ansi, SetLastError = true)]
  public static extern IntPtr WinDivertOpen(string filter, int layer, short priority, ulong flags);
  [DllImport("WinDivert.dll", SetLastError = true)]
  public static extern bool WinDivertRecv(IntPtr handle, byte[] pPacket, uint packetLen, out uint recvLen, IntPtr pAddr);
  [DllImport("WinDivert.dll", SetLastError = true)]
  public static extern bool WinDivertClose(IntPtr handle);
}
"@
  Add-Type -TypeDefinition $shim -Language CSharp

  $loaded = [WDPortScan]::LoadLibrary($DllPath)
  if ($loaded -eq [IntPtr]::Zero) {
    $e = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
    [Console]::Error.WriteLine("LoadLibrary('$DllPath') failed (win32=$e)")
    exit 3
  }

  $filter = "tcp and ip and ((tcp.DstPort >= 1024 and tcp.DstPort <= 20000) or (tcp.SrcPort >= 1024 and tcp.SrcPort <= 20000))"
  $LAYER_NETWORK = 0
  $flags = [uint64](0x1 -bor 0x4) # SNIFF + RECV_ONLY
  $INVALID = [IntPtr](-1)
  $handle = [WDPortScan]::WinDivertOpen($filter, $LAYER_NETWORK, [int16]0, $flags)
  if ($handle -eq $INVALID -or $handle -eq [IntPtr]::Zero) {
    $e = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
    [Console]::Error.WriteLine("WinDivertOpen failed (filter='$filter', win32=$e)")
    exit 2
  }

  [Console]::Out.WriteLine('{"status":"open filter=' + $filter.Replace('"','\"') + '"}')
  [Console]::Out.Flush()

  # Cap haute à 120 s pour que l'appelant pilote vraiment la fenêtre (le
  # self-test demande 60 s, le test manuel jusqu'à 75 s). Plancher 5 s.
  $deadline = (Get-Date).AddSeconds([Math]::Max(5, [Math]::Min(120, $DurationSec)))
  $buf = New-Object byte[] 65535
  while ((Get-Date) -lt $deadline) {
    [uint32]$recvLen = 0
    $ok = [WDPortScan]::WinDivertRecv($handle, $buf, [uint32]$buf.Length, [ref]$recvLen, [IntPtr]::Zero)
    if (-not $ok) { Start-Sleep -Milliseconds 25; continue }
    if ($recvLen -gt 0) {
      $b64 = [Convert]::ToBase64String($buf, 0, [int]$recvLen)
      [Console]::Out.WriteLine('{"b64":"' + $b64 + '","len":' + $recvLen + '}')
      [Console]::Out.Flush()
    }
  }
  [WDPortScan]::WinDivertClose($handle) | Out-Null
}
catch {
  [Console]::Error.WriteLine($_.Exception.Message)
  exit 1
}