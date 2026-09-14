# Remplacement des vidéos Asclion

## Objectif
Remplacer les deux vidéos actuelles par les nouvelles versions fournies via Google Drive.

## Fichiers sources (Google Drive)
Dossier : `1QoW7HTqHBkVef7SirNQy9g3wRzWnPfBf`
- Vidéo 45 s : `Asclion-Presentation-45s-sansvoix.mp4` (39,7 Mo)
- VSL long : `Asclion-VSL-HOMME-SOUS-TITRES-SYNC.mp4` (119,7 Mo)

## État actuel
- `src/assets/asclion-45s.mp4.asset.json` → vidéo 45 s sur la page d'accueil
- `src/assets/asclion-vsl.mp4.asset.json` → VSL long sur `/presentation`
- Imports dans `src/pages/Landing.tsx` et `src/pages/Presentation.tsx`

## Étapes
1. Télécharger les deux vidéos depuis Google Drive vers `/tmp`.
2. Uploader chaque vidéo via `lovable-assets create --file <chemin>` pour obtenir de nouveaux pointeurs CDN.
3. Remplacer `src/assets/asclion-45s.mp4.asset.json` et `src/assets/asclion-vsl.mp4.asset.json` par les nouveaux pointeurs.
4. Mettre à jour les imports dans `Landing.tsx` et `Presentation.tsx` si les noms de fichiers changent (conserver les mêmes noms de variables pour minimiser les changements).
5. Supprimer les anciens assets CDN via `lovable-assets delete` sur les anciens pointeurs.
6. Vérifier le build (`bun run build`) et le rendu sur `/` et `/presentation`.

## Livrables
- Nouveaux pointeurs CDN pour les deux vidéos
- Code source mis à jour
- Build validé

## Notes
- La VSL fait 119,7 Mo : upload possible mais temps de traitement plus long.
- Conserver les mêmes noms de fichiers (`asclion-45s.mp4`, `asclion-vsl.mp4`) pour éviter de renommer les imports.
