<#
  windivert-capture.ps1 — passive WinDivert capture helper for Asclion.

  Spawned by electron/robot/sniffer.js (startWinDivert). Opens WinDivert in
  passive SNIFF mode and streams every matching packet to STDOUT as one JSON
  line:

      {"b64":"<base64 of the whole packet>","len":<bytes>}

  plus a one-off status line once the handle is open:

      {"status":"open filter=<...>"}

  Errors go to STDERR and set a non-zero exit code so the parent can surface
  them in getStatus().lastError.

  Why PowerShell P/Invoke instead of a compiled native addon: it needs no
  compiler, no SDK, no node-gyp, and no Electron-ABI rebuild — only the two
  bundled WinDivert binaries (WinDivert.dll + WinDivert64.sys) sitting next to
  this script. Add-Type compiles the tiny C# shim with the .NET Framework csc
  that ships with every Windows install.

  SNIFF mode means we only receive COPIES of packets — the originals are never
  removed from the network stack, so the robot keeps receiving its dispense
  orders untouched even if this helper dies.
#>
param(
  [Parameter(Mandatory = $true)][string]$DllPath,
  [Parameter(Mandatory = $true)][int]$Port,
  [string]$DstIp = "",
  [string]$Direction = "outbound",
  # When set, captures loopback traffic (LGO ↔ local middleware like LMS).
  # WinDivert 2.x exposes a dedicated `loopback` filter token that matches
  # packets traveling on 127.0.0.0/8 / ::1 — invisible to the default
  # NETWORK layer filter. Direction is ignored in this mode (loopback is
  # neither inbound nor outbound from the stack's point of view).
  [switch]$Loopback
)

$ErrorActionPreference = "Stop"

try {
  # ── Build the WinDivert filter string ──────────────────────────────────
  $parts = @()
  switch ($Direction.ToLower()) {
    "inbound" { $parts += "inbound" }
    "both"    { }                       # no direction clause = both ways
    default   { $parts += "outbound" }  # per-till: the order WE send out
  }
  $parts += "tcp.DstPort == $Port"
  if ($DstIp -and $DstIp.Trim().Length -gt 0) {
    $parts += "ip.DstAddr == $($DstIp.Trim())"
  }
  $filter = ($parts -join " and ")

  # ── C# P/Invoke shim for the three WinDivert calls we need ─────────────
  $shim = @"
using System;
using System.Runtime.InteropServices;
public static class WD {
  [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern IntPtr LoadLibrary(string path);

  // HANDLE WinDivertOpen(const char *filter, WINDIVERT_LAYER layer,
  //                      INT16 priority, UINT64 flags);
  [DllImport("WinDivert.dll", CharSet = CharSet.Ansi, SetLastError = true)]
  public static extern IntPtr WinDivertOpen(string filter, int layer, short priority, ulong flags);

  // BOOL WinDivertRecv(HANDLE h, PVOID pPacket, UINT packetLen,
  //                    UINT *pRecvLen, WINDIVERT_ADDRESS *pAddr);
  [DllImport("WinDivert.dll", SetLastError = true)]
  public static extern bool WinDivertRecv(IntPtr handle, byte[] pPacket, uint packetLen, out uint recvLen, IntPtr pAddr);

  [DllImport("WinDivert.dll", SetLastError = true)]
  public static extern bool WinDivertClose(IntPtr handle);
}
"@
  Add-Type -TypeDefinition $shim -Language CSharp

  # Pre-load WinDivert.dll by ABSOLUTE path so the later DllImport("WinDivert.dll")
  # binds to this already-resident module. This also lets WinDivert locate its
  # driver (WinDivert64.sys) which must sit in the same folder as the DLL.
  $loaded = [WD]::LoadLibrary($DllPath)
  if ($loaded -eq [IntPtr]::Zero) {
    $e = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
    [Console]::Error.WriteLine("LoadLibrary('$DllPath') failed (win32=$e)")
    exit 3
  }

  # WINDIVERT_LAYER_NETWORK = 0
  # WINDIVERT_FLAG_SNIFF = 0x1, WINDIVERT_FLAG_RECV_ONLY = 0x4
  $LAYER_NETWORK = 0
  $flags = [uint64](0x1 -bor 0x4)
  $INVALID = [IntPtr](-1)

  $handle = [WD]::WinDivertOpen($filter, $LAYER_NETWORK, [int16]0, $flags)
  if ($handle -eq $INVALID -or $handle -eq [IntPtr]::Zero) {
    $e = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
    # win32 5 = access denied (need admin); 2 = driver .sys not found next to DLL.
    [Console]::Error.WriteLine("WinDivertOpen failed (filter='$filter', win32=$e)")
    exit 2
  }

  [Console]::Out.WriteLine('{"status":"open filter=' + $filter.Replace('"','\"') + '"}')
  [Console]::Out.Flush()

  $buf = New-Object byte[] 65535
  while ($true) {
    [uint32]$recvLen = 0
    $ok = [WD]::WinDivertRecv($handle, $buf, [uint32]$buf.Length, [ref]$recvLen, [IntPtr]::Zero)
    if (-not $ok) {
      $e = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
      if ($e -eq 232) { break }   # ERROR_NO_DATA = handle shut down → exit loop
      [Console]::Error.WriteLine("WinDivertRecv failed (win32=$e)")
      Start-Sleep -Milliseconds 50
      continue
    }
    if ($recvLen -gt 0) {
      $b64 = [Convert]::ToBase64String($buf, 0, [int]$recvLen)
      [Console]::Out.WriteLine('{"b64":"' + $b64 + '","len":' + $recvLen + '}')
      [Console]::Out.Flush()
    }
  }

  [WD]::WinDivertClose($handle) | Out-Null
}
catch {
  [Console]::Error.WriteLine($_.Exception.Message)
  exit 1
}
