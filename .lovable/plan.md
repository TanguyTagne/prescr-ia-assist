# Animation Asclion pour les chargements

## Objectif
Remplacer les principaux indicateurs de chargement visibles par la vidéo fournie, jouée en boucle, sans son et à vitesse ×2 afin que son cycle dure environ 4 secondes.

## Modifications
- Ajouter la vidéo au stockage d’assets du projet.
- Créer un indicateur de chargement Asclion réutilisable, avec tailles adaptées aux pages complètes, sections et analyses.
- Remplacer les ronds verts et les écrans « Asclion… » lors du chargement des pages, de l’authentification, des zones d’administration et de l’analyse.
- Conserver les petits indicateurs intégrés aux boutons lorsqu’ils servent à signaler une action locale, afin de ne pas déformer les boutons.
- Respecter la réduction des animations demandée par les réglages d’accessibilité.

## Vérification
- Vérifier le démarrage automatique, la boucle, l’absence de son et la vitesse ×2.
- Contrôler le rendu sur l’accueil, une page protégée, l’administration et l’application Electron.
- Vérifier qu’aucune erreur de compilation ou d’exécution n’est introduite.
