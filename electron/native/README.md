# Asclion — Addons natifs N-API

## `rawinput/`

Lecture des frappes clavier au niveau Win32 Raw Input (`RegisterRawInputDevices` + `RIDEV_INPUTSINK`), en process Electron. Remplace le subprocess PowerShell historique (`electron/main.js` L1538-1810).

**Avantages :**

- Pas de subprocess → non bloqué par les GPO qui interdisent `powershell.exe`
- Hérite de la signature Electron → moins de friction antivirus / EDR
- Boot ~3 secondes plus rapide (pas de compilation C# JIT)
- 1 seul thread worker, fermeture propre via `WM_QUIT`

**Limites :**

- Windows uniquement (no-op silencieux sur macOS / Linux)

---

## Build local (dev)

Prérequis Windows :

- **Visual Studio Build Tools 2022** avec le workload "Desktop development with C++"
- **Python 3.x** dans le PATH
- **Node.js 18+** (déjà installé pour le reste du projet)

Depuis `electron/` :

```cmd
npm install
```

Le hook `postinstall` lance `scripts/build-native.js` qui compile l'addon contre l'ABI Electron via `@electron/rebuild`. Si le build échoue (toolchain absente), l'install continue — les chemins fallback (PowerShell Raw Input + uiohook + node-hid + WebHID + SerialPort) restent actifs.

Pour rebuild manuellement après une modif C++ :

```cmd
npm run rebuild:native
```

## Packaging électron-builder

Les fichiers `.node` compilés sont déclarés dans `asarUnpack` de `electron/package.json` pour être inclus tels quels (le format `.asar` ne supporte pas les binaires natifs).

## Désactivation

Pour désactiver l'addon natif et forcer le fallback (debug) :

- Supprimer le dossier `native/rawinput/build/` → le chargement échouera silencieusement, le fallback PowerShell prendra le relais
- Ou mettre `nativeRawInput = null` en haut de `main.js`

## Architecture de fallback (ordre dans `bootScannerStack()`)

1. **Native Raw Input N-API** ← préféré
2. **SerialPort** (USB-CDC)
3. **node-hid direct** (HID shared mode)
4. **PowerShell Raw Input subprocess** ← fallback si native N-API absent
5. **uiohook-napi** (global keyboard hook)
6. **WebHID** (navigator.hid dans preload, mode HID POS)

Toutes les voies convergent dans `emitGlobalScan()` qui dédoublonne dans une fenêtre de 800 ms.
