# Remplacement des vidéos Asclion

## Objectif
Remplacer les deux vidéos actuelles (45 s accueil + VSL long `/presentation`) par de nouvelles versions fournies par l'utilisateur.

## État actuel
Les vidéos sont hébergées sur le CDN Lovable et référencées par des pointeurs `.asset.json` :
- `src/assets/asclion-45s.mp4.asset.json` → vidéo 45 s sur la page d'accueil
- `src/assets/asclion-vsl.mp4.asset.json` → VSL long sur `/presentation`
Les imports correspondants sont dans `src/pages/Landing.tsx` et `src/pages/Presentation.tsx`.

## Étapes
1. Recevoir les deux nouveaux fichiers vidéo (joindre dans le chat ou lien de téléchargement).
2. Uploader chaque vidéo via `lovable-assets create --file <chemin>` pour obtenir de nouveaux pointeurs CDN.
3. Remplacer les fichiers `src/assets/asclion-45s.mp4.asset.json` et `src/assets/asclion-vsl.mp4.asset.json` par les nouveaux pointeurs.
4. Mettre à jour les imports et utilisations dans `Landing.tsx` et `Presentation.tsx` si les noms de fichiers changent.
5. Supprimer les anciens pointeurs inutilisés si nécessaire via `lovable-assets delete`.
6. Vérifier le build (`bun run build`) et le rendu sur les pages concernées.

## Livrables
- Nouveaux pointeurs CDN pour les deux vidéos
- Code source mis à jour
- Build validé

## Questions en attente
- Quels noms de fichiers pour les nouvelles vidéos ?
- Faut-il conserver les mêmes emplacements de lecteur / même UX (lecteur muet, bouton play, etc.) ?
