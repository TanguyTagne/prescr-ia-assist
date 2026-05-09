## Mode "Toujours visible" (Picture-in-Picture)

Objectif : que la fenêtre Asclion reste flottante au-dessus du LGO, du navigateur ou de n'importe quelle autre application, comme une mini-fenêtre vidéo en PiP. Le préparateur peut cliquer ailleurs sans que l'app disparaisse derrière.

### Comportement

- **Always-on-top activé par défaut** au démarrage du desktop : la fenêtre Asclion reste devant toutes les autres, même quand elle perd le focus.
- **Bouton de bascule** dans le header de l'app (icône épingle) pour activer/désactiver le mode flottant à la volée. État mémorisé entre sessions.
- **Niveau "floating"** (au-dessus des fenêtres normales mais sous les notifications système) pour ne pas masquer les alertes critiques.
- **Visible sur tous les bureaux virtuels** Windows/macOS (`visibleOnAllWorkspaces`).
- **Compact mode optionnel** : un second bouton réduit la fenêtre à une taille mini (≈ 280×400) pour qu'elle prenne encore moins de place quand on travaille dans le LGO.
- **Web (navigateur)** : non concerné — le widget reste un overlay dans la page. Le PiP réel ne s'applique qu'au build desktop Electron, seul cas où on peut sortir du navigateur.

### Détails techniques

1. `electron/main.js`
   - `mainWindow.setAlwaysOnTop(true, "floating")` au create.
   - `setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })`.
   - IPC handlers : `pip:toggle`, `pip:get-state`, `pip:set-compact`.
   - Persister l'état via `electron-store` léger (ou simple fichier JSON dans `app.getPath("userData")`).

2. `electron/preload.js`
   - Exposer `window.electronAPI.pip = { toggle, getState, setCompact }`.

3. `src/components/Widget.tsx` (header desktop)
   - Bouton épingle (lucide `Pin` / `PinOff`) visible uniquement si `isAsclionDesktopRuntime()` ET `window.electronAPI?.pip` présent.
   - Petit bouton `Minimize2` pour le compact mode.
   - Tooltip explicatif au premier affichage.

4. Aucun changement DB, aucun edge function, aucune migration.

### Hors scope

- Pas de "vraie" Picture-in-Picture HTML5 (réservé aux `<video>`, inadapté à une UI React).
- Pas de transparence / fenêtre sans cadre (risque de gêner le drag et l'accessibilité). Si tu veux un look "pilule flottante" sans bordure, on peut l'ajouter dans une seconde itération.
