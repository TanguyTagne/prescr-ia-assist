# WinDivert capture backend

Per-till passive capture of the LGO → robot dispense order, used by
`electron/robot/sniffer.js` (`startWinDivert`). Lets each checkout PC read the
CIP/EAN it sends to the robot server and pop its own recommendation widget — no
central server PC, no HTTP fan-out, no Npcap installer.

## Files

| File | Source | Committed? |
|------|--------|-----------|
| `windivert-capture.ps1` | this repo | yes |
| `WinDivert.dll`   | official WinDivert 2.2.2 release (x64) | **yes — vendored** |
| `WinDivert64.sys` | official WinDivert 2.2.2 release (x64), **Microsoft-signed** | **yes — vendored** |

## Setup

Nothing to do — the signed x64 binaries are committed to the repo (~141 KB
total) and bundled by electron-builder via the `asarUnpack` rule in
`electron/package.json`. No download step, so CI and every PC have them.

To upgrade WinDivert later, download a newer release from
<https://reqrypt.org/windivert.html>, drop the x64 `WinDivert.dll` +
`WinDivert64.sys` into this folder, and commit them.

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
