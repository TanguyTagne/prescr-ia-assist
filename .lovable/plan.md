## Diagnostic

Sur le terrain, **aucun keystroke n'arrive** dans l'onglet Diagnostic Hardware en Desktop Electron. Cela exclut un problème de focus (la capture est déjà globale via `uiohook-napi`) et pointe vers la cause réelle :

- `uiohook-napi` installe un **hook clavier bas-niveau Windows** (`SetWindowsHookEx WH_KEYBOARD_LL`). C'est exactement la signature d'un **keylogger** → bloqué par la majorité des antivirus pros en pharmacie (ESET, Bitdefender, Kaspersky, Sophos, Trend Micro), souvent sans alerte visible.
- Même si l'AV laisse passer, `uiohook` échoue silencieusement si le binaire natif ne charge pas (cas réel : `console.error("uiohook-napi unavailable")` non remonté à l'UI).
- Quelques douchettes (Newland, certaines Honeywell) sortent d'usine en **USB-COM série** et non en HID clavier → uiohook ne verra jamais rien.

La consigne « il faut que chaque code scanné soit reçu par Asclion » impose donc de **ne plus dépendre du clavier** et de lire la douchette **directement comme périphérique USB HID**.

## Solution — lecture HID directe via `node-hid`

`node-hid` utilise **HIDAPI** (lecture de rapports HID bruts, pas de hook clavier). Ce n'est pas un keylogger → **non bloqué par les antivirus**. Il lit les *HID Input Reports* envoyés par la douchette, exactement ce que reçoit le driver clavier Windows, mais avant qu'il les transforme en touches. Avantages :

- Fonctionne sans aucun focus, indépendamment de l'application au premier plan (LGO inclus).
- Insensible à la disposition clavier → **plus de corruption AZERTY/QWERTY**.
- Identifie la douchette par VID/PID → on sait qui scanne quoi.
- Ne « vole » pas le scan : on lit en parallèle du driver clavier, donc le LGO continue à recevoir le code dans son champ actif si besoin.

`uiohook-napi` est conservé en **fallback** : si node-hid ne peut pas ouvrir le device (permissions exclusivité, AV qui filtre aussi HIDAPI, mode COM), on retombe sur l'ancien chemin.

## Changements

### 1. `electron/package.json`
- Ajouter dépendance `node-hid` (avec prebuilds Windows x64).
- Ajouter `node-hid` à `asarUnpack` (binding natif `.node`).
- Bump version desktop (force MAJ auto chez les pharmacies).

### 2. `electron/main.js` — nouveau module HID direct
- `loadNodeHid()` : require lazy, log erreur si indispo.
- `listScanners()` : `HID.devices()` filtrée sur :
  - VIDs connus : Honeywell `0x0C2E`, Zebra/Symbol `0x05E0`/`0x0536`, Datalogic `0x05F9`, Newland `0x1EAB`, NetumScan, Inateck, etc. (table maintenue).
  - + tout device avec `usagePage=1` & `usage=6` (clavier générique) dont le `product` matche `/scan|barcode|imager|reader/i`.
- `openScanner(device)` : ouvre en non-blocking, écoute `data` (HID keyboard report = 8 octets : modifiers + 6 keycodes).
- Décodage HID Usage ID → chiffre / Enter, avec table interne (pas de dépendance layout).
- Buffer + Enter terminator + parseur partagé `parseBarcodeToCip` (déjà présent) → `emitGlobalScan()`.
- Reconnexion auto si la douchette est débranchée/rebranchée (poll `HID.devices()` toutes les 5 s).
- Mémorisation du VID/PID choisi dans `app.getPath("userData")/scanner.json`.
- Démarrage : tente HID direct → si échec **ET** uiohook dispo → fallback uiohook (comportement actuel).

### 3. IPC + `electron/preload.js`
Nouveaux canaux exposés sous `window.electronAPI.scanner` :
- `listDevices()` → renvoie tous les devices HID (VID, PID, manufacturer, product, path, déjà-utilisé ?).
- `bind(path)` / `unbind()` → force ouverture d'un device précis.
- `getStatus()` → `{ mode: 'hid-direct' | 'uiohook' | 'none', boundDevice, hidLoaded, uiohookLoaded, lastError }`.
- `testCapture(ms)` → renvoie tous les rapports bruts reçus pendant N ms (debug).

### 4. `src/components/admin/HardwareDiagnosticTab.tsx`
Nouvelle section **« Détection matérielle »** au-dessus du log clavier existant :
- Badge mode actif (HID direct / uiohook / aucun) + couleur.
- Liste des HID détectés avec bouton « Lier cette douchette ».
- Bouton « Tester 10 s » qui scanne en mode raw et affiche les rapports.
- Bouton « Recharger les pilotes » (relance `startGlobalBarcodeListener`).
- Bannière rouge si `mode === 'none'` avec message clair : *« Aucune douchette détectée. Causes probables : (1) câble USB, (2) douchette en mode COM série → reconfigurez en USB-HID Keyboard avec le code-barres du manuel, (3) antivirus bloque HIDAPI → ajoutez Asclion en exception. »*
- Tout cela ne s'affiche qu'en mode Desktop (`isAsclionDesktopRuntime()`).

### 5. `src/hooks/useGlobalBarcodeBridge.ts`
Pas de changement fonctionnel — déjà branché sur `electronAPI.onGlobalBarcode`. Le nouveau code HID emet sur le même canal, donc transparent côté UI.

### 6. Build CI (`.github/workflows`)
- `node-hid` nécessite `node-gyp` + headers Windows. Les prebuilds officielles couvrent Electron 33 / Win x64 → aucune compilation native côté CI Linux, juste `npm install`.
- Vérifier dans le workflow desktop que les binaries `.node` sont bien recopiés dans `dist`.

## Limites assumées
- Si l'antivirus bloque **aussi** HIDAPI (rare, seulement quelques configs EDR très strictes), on tombe en fallback uiohook → si lui aussi est bloqué, l'UI affiche un message explicite avec procédure d'exception. Pas de contournement silencieux possible : aucune API Windows ne permet d'ignorer un AV qui bloque l'accès USB.
- Douchettes en mode **virtual COM** (port série) : non couvert par cette itération (faudrait `serialport`). On le détectera et on guidera l'utilisateur à reconfigurer la douchette en HID Keyboard (procédure standard chez tous les fabricants : scanner un code-barres dans le manuel).
- Aucune modification côté Web (sans Electron) : la lecture HID directe nécessite WebHID + geste utilisateur, hors scope ici.
