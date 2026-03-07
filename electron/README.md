# PrescrIA Desktop

Application desktop pour Windows qui encapsule l'application web PrescrIA.

## Prérequis

- Node.js 18+
- npm ou yarn

## Installation des dépendances

```bash
cd electron
npm install
```

## Développement

```bash
npm start
```

## Créer l'installeur Windows (.exe)

```bash
npm run build:win
```

L'installeur sera généré dans `electron/dist/`.

## Icône

Placez votre icône dans `electron/assets/icon.ico` (256x256 minimum, format ICO).

Pour convertir un PNG en ICO, utilisez un outil en ligne ou ImageMagick :
```bash
magick convert icon.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico
```

## Mises à jour automatiques

Les mises à jour utilisent `electron-updater` avec GitHub Releases.

1. Modifiez `publish.owner` et `publish.repo` dans `package.json`
2. Créez un token GitHub avec les permissions `repo`
3. Définissez `GH_TOKEN` dans votre environnement
4. Publiez : `npx electron-builder --win --publish always`

Chaque nouvelle release GitHub déclenchera une mise à jour automatique de l'application chez les utilisateurs.

## Architecture

```
electron/
├── main.js          # Processus principal Electron
├── preload.js       # Script de préchargement (sécurité)
├── package.json     # Configuration Electron + electron-builder
├── assets/
│   └── icon.ico     # Icône de l'application
└── README.md        # Ce fichier
```

L'application charge simplement `https://prescr-ia-assist.lovable.app` dans une fenêtre Electron sans barre d'adresse, offrant une expérience desktop native.
