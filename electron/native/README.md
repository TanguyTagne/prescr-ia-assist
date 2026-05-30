# Asclion — Addons natifs N-API

Deux addons C++ pour Windows qui remplacent / complètent les chemins de capture du scanner :

## `rawinput/`

Lecture des frappes clavier au niveau Win32 Raw Input (`RegisterRawInputDevices` + `RIDEV_INPUTSINK`), en process Electron. Remplace le subprocess PowerShell historique (`electron/main.js` L1538-1810).

**Avantages :**
- Pas de subprocess → non bloqué par les GPO qui interdisent `powershell.exe`
- Hérite de la signature Electron → moins de friction antivirus / EDR
- Boot ~3 secondes plus rapide (pas de compilation C# JIT)
- 1 seul thread worker, fermeture propre via `WM_QUIT`

**Limites :**
- Windows uniquement (no-op silencieux sur macOS / Linux)

## `uiawatcher/`

Watcher UI Automation qui surveille les champs "saisie code-barres" des LGO (Winpharma, LGPI, Smart Rx, Périphar…). Indépendant de tout le pipeline clavier / HID / COM.

**Configuration :** voir `electron/lgo-mappings.json` à la racine — un tableau JSON de sélecteurs UIA. À enrichir lors des premières installations en utilisant **Inspect.exe** (Windows SDK) pour relever les `AutomationId` / `Name` / `ClassName` du champ saisie de chaque LGO.

Workflow Inspect.exe :
1. Télécharger Windows SDK → `Inspect.exe` est dans `C:\Program Files (x86)\Windows Kits\10\bin\<version>\x64\`
2. Lancer Inspect en mode UIA
3. Faire passer le focus dans le champ saisie code-barres du LGO
4. Inspect affiche `AutomationId`, `Name`, `ClassName`, `ControlType` — copier les valeurs uniques dans `lgo-mappings.json`
5. Redémarrer Asclion

**Performance :** polling 200 ms par champ enregistré. Coût CPU négligeable (1 appel COM par champ par tick).

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

Le hook `postinstall` lance `scripts/build-native.js` qui compile les deux addons contre l'ABI Electron via `@electron/rebuild`. Si le build échoue (toolchain absente), l'install continue — les chemins fallback (PowerShell Raw Input + uiohook + node-hid + WebHID + SerialPort) restent actifs.

Pour rebuild manuellement après une modif C++ :

```cmd
npm run rebuild:native
```

## Packaging électron-builder

Les fichiers `.node` compilés sont déclarés dans `asarUnpack` de `electron/package.json` pour être inclus tels quels (le format `.asar` ne supporte pas les binaires natifs). Le fichier `lgo-mappings.json` est également déclaré dans `extraResources` pour permettre la modification par site sans rebuild.

## Désactivation

Pour désactiver un addon natif et forcer le fallback (debug) :
- Supprimer le dossier `native/<addon>/build/` → le chargement échouera silencieusement, le fallback prendra le relais
- Ou mettre `nativeRawInput = null` / `nativeUia = null` en haut de `main.js`

## Architecture de fallback (ordre dans `bootScannerStack()`)

1. **Native Raw Input N-API** ← préféré
2. **Native UI Automation watcher** ← universel par LGO
3. **SerialPort** (USB-CDC)
4. **node-hid direct** (HID shared mode)
5. **PowerShell Raw Input subprocess** ← fallback si native N-API absent
6. **uiohook-napi** (global keyboard hook)
7. **WebHID** (navigator.hid dans preload, mode HID POS)

Toutes les voies convergent dans `emitGlobalScan()` qui dédoublonne dans une fenêtre de 800 ms.
