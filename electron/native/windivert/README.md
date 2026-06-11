# WinDivert capture backend

Per-till passive capture of the LGO → robot dispense order, used by
`electron/robot/sniffer.js` (`startWinDivert`). Lets each checkout PC read the
CIP/EAN it sends to the robot server and pop its own recommendation widget — no
central server PC, no HTTP fan-out, no Npcap installer.

## Files

| File | Source | Committed? |
|------|--------|-----------|
| `windivert-capture.ps1` | this repo | yes |
| `WinDivert.dll`   | official WinDivert release (x64) | no — fetched |
| `WinDivert64.sys` | official WinDivert release (x64), **Microsoft-signed** | no — fetched |

## Setup

```sh
cd electron
npm run fetch:windivert
```

Downloads the signed x64 binaries from the official release and drops them here.
If it 404s, grab them manually from <https://reqrypt.org/windivert.html> and
place `WinDivert.dll` + `WinDivert64.sys` in this folder.

## How it works

The PS1 helper P/Invokes `WinDivert.dll` (no compiler / SDK / node-gyp needed —
`Add-Type` uses the .NET Framework `csc` present on every Windows box). It opens
WinDivert in **SNIFF + RECV_ONLY** mode, so it only receives *copies* of
packets — the robot keeps getting its dispense orders untouched even if the
helper dies. Each captured packet is streamed to the parent as one base64 JSON
line; `sniffer.js` runs the existing brand adapters on it and fires the local
scan pipeline.

Filter: `outbound and tcp.DstPort == <port>` (optionally `and ip.DstAddr ==
<robotServerIp>`). "outbound" is also how WinDivert reports loopback, so the
`dev-fake-robot.js` / `dev-fake-lgo.js` desk test works on one machine.

## Requirements & caveats

- **Admin.** `WinDivertOpen` installs/starts the driver service on first call;
  it needs admin (Asclion already runs elevated). win32 error 5 = not elevated.
- **win32 error 2 on open** = `WinDivert64.sys` missing next to the DLL.
- **x64 only.** The app ships x64; use the x64 WinDivert build.
- **Encrypted links can't be read** by any sniffer — if a site's LGO↔robot link
  is TLS, the captured payload is ciphertext. Diagnostic mode reveals this (the
  dump is gibberish instead of readable XML).
- **AV / code-signing.** The driver is Microsoft-signed. Asclion's own build is
  not yet code-signed; sign it before fleet rollout so managed AV doesn't
  quarantine a packet-capturing process. Pilot on one site's AV first.

## Licensing

WinDivert is LGPLv3 / GPLv3 (<https://reqrypt.org/windivert.html>). Asclion ships
`WinDivert.dll` as a separate, replaceable file (LGPL §4 dynamic-linking route),
so app code stays closed. Keep a WinDivert attribution line in the About/Legal
screen.
