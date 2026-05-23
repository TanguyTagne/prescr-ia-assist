# Lancement automatique robuste d'Asclion

## Objectif

Garantir qu'Asclion se lance automatiquement chez le pharmacien, quel que soit l'état du PC :
- **À l'allumage du PC** (avant même la connexion utilisateur)
- **Tous les jours à 8h30** (même si personne n'est connecté)
- **Rattrapage à 9h00** si le PC était éteint à 8h30
- Si le PC est en veille, on le réveille

## Problèmes actuels (`electron/main.js`, `registerDailyAutoLaunch`)

1. Tâche créée en `/RL LIMITED` → ne tourne que si **l'utilisateur est sessionné**.
2. Aucun rattrapage si l'heure est manquée (PC éteint).
3. Aucun réveil de veille.
4. Pas de tâche au démarrage du PC.
5. Tâche orpheline après désinstallation.
6. Aucun retour visible si `schtasks` échoue (antivirus, GPO entreprise).

## Solution proposée

### 1. Trois tâches Windows au lieu d'une

Recréées à chaque lancement d'Asclion (idempotent via `/F`) :

| Tâche | Déclencheur | Comportement |
|---|---|---|
| `AsclionAtBoot` | Au démarrage du PC | Lance Asclion dès le boot, sans attendre de session |
| `AsclionDaily0830` | Quotidien 08:30 | Lance Asclion, rattrape si manqué, réveille le PC |
| `AsclionDaily0900` | Quotidien 09:00 | Filet de sécurité ; ne fait rien si Asclion déjà ouvert |

### 2. Exécution en contexte SYSTEM

Pour fonctionner **sans utilisateur connecté**, on passe en `/RU SYSTEM` + `/RL HIGHEST`. Cela demande une élévation UAC **une seule fois** au premier lancement après installation.

Si l'élévation est refusée (pharmacien non admin local), fallback automatique en `/RU <utilisateur courant>` avec `/IT` (interactive) — comportement actuel, mais avec les options de rattrapage en plus.

### 3. Options XML avancées

`schtasks /Create` en ligne de commande ne supporte pas toutes les options (rattrapage, réveil). On bascule sur une définition XML passée à `schtasks /Create /XML` :

- `StartWhenAvailable = true` → rattrapage si l'heure est manquée
- `WakeToRun = true` → sort de veille
- `RestartOnFailure` → 3 tentatives à 5 min d'intervalle
- `MultipleInstancesPolicy = IgnoreNew` → ne relance pas si déjà ouvert (évite la tâche 09h de doublonner)

### 4. Anti-doublon côté Electron

Le verrou `requestSingleInstanceLock()` est déjà en place : si la tâche 09h se déclenche alors qu'Asclion tourne, la 2e instance se ferme immédiatement et focus la fenêtre existante. Aucun changement nécessaire.

### 5. UI Admin : état du lancement automatique

Nouveau bloc dans `src/pages/Admin.tsx` (onglet existant) :
- État des 3 tâches Windows (`schtasks /Query /TN ... /FO LIST`)
- Bouton "Réinstaller le lancement automatique" (rejoue la création des tâches avec demande UAC)
- Affichage de la dernière exécution + prochain déclenchement

Exposé via 2 nouveaux IPC dans `electron/main.js` + `preload.js` :
- `autolaunch:status` → renvoie l'état des 3 tâches
- `autolaunch:reinstall` → relance la création avec UAC

### 6. Désinstallation propre

Dans `electron/package.json` (electron-builder NSIS), ajout d'un `include` script `installer.nsh` qui exécute `schtasks /Delete /TN AsclionAtBoot /F` (et les 2 autres) lors de la désinstallation.

## Détails techniques

### Fichier `electron/main.js`

Remplace `registerDailyAutoLaunch()` par `registerAutoLaunch()` qui :

1. Écrit 3 fichiers XML temporaires dans `app.getPath('temp')` (templates avec `${EXE_PATH}` interpolé)
2. Pour chaque XML : `schtasks /Create /TN <name> /XML <path> /F /RU SYSTEM /RL HIGHEST`
3. Si exit code ≠ 0 → retry sans `/RU SYSTEM`
4. Log structuré (`console.info` + écrit dans `userData/autolaunch.log` pour diagnostic)
5. Stocke le résultat dans `userData/autolaunch-state.json` pour exposition via IPC

### Squelette XML (tâche 8h30)

```xml
<?xml version="1.0" encoding="UTF-16"?>
<Task xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <Triggers>
    <CalendarTrigger>
      <StartBoundary>2026-01-01T08:30:00</StartBoundary>
      <ScheduleByDay><DaysInterval>1</DaysInterval></ScheduleByDay>
      <Enabled>true</Enabled>
    </CalendarTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <UserId>S-1-5-18</UserId>            <!-- SYSTEM -->
      <RunLevel>HighestAvailable</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <StartWhenAvailable>true</StartWhenAvailable>   <!-- rattrapage -->
    <WakeToRun>true</WakeToRun>                     <!-- réveil veille -->
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <RestartOnFailure><Interval>PT5M</Interval><Count>3</Count></RestartOnFailure>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
  </Settings>
  <Actions>
    <Exec><Command>${EXE_PATH}</Command></Exec>
  </Actions>
</Task>
```

Tâche `AtBoot` : remplacer `CalendarTrigger` par `BootTrigger` avec `Delay = PT30S`.
Tâche 09h : identique à 08h30 avec `StartBoundary` à 09:00.

### Hiérarchie de priorité

```text
Boot PC ─▶ AsclionAtBoot          (instantané dès allumage)
            │
            ├─ Si déjà ouvert ────▶ IgnoreNew, rien ne se passe
            │
08h30 ────▶ AsclionDaily0830      (rattrapage StartWhenAvailable)
09h00 ────▶ AsclionDaily0900      (filet, IgnoreNew si déjà ouvert)
```

## Fichiers modifiés

- `electron/main.js` — remplacer `registerDailyAutoLaunch`, ajouter génération XML + IPC
- `electron/preload.js` — exposer `autolaunch.status()` et `autolaunch.reinstall()`
- `electron/package.json` — ajouter `nsis.include: "installer.nsh"`
- `electron/installer.nsh` — **nouveau**, suppression des 3 tâches à la désinstallation
- `src/pages/Admin.tsx` — bloc "Lancement automatique" (visible uniquement si `window.electronAPI` présent)
- `electron/README.md` — documentation utilisateur du comportement
