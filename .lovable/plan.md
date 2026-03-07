

## Bonne nouvelle : c'est déjà possible

Le système actuel supporte **déjà** l'analyse d'images d'ordonnances via l'IA (Gemini). Le flux existe :

1. Le préparateur scanne l'ordonnance → le scanner produit un fichier image/PDF
2. Le préparateur glisse ou sélectionne ce fichier dans PrescrIA (mode "Photo ordonnance" déjà en place)
3. L'Edge Function envoie l'image à Gemini qui fait l'OCR + extraction des médicaments
4. Le widget affiche les résultats

### Ce qu'on peut améliorer pour le rendre ultra rapide

**Flux optimisé "Scanner" :**

1. **Dossier de scan automatique** — Utiliser l'API File System Access du navigateur pour surveiller un dossier local (ex: `C:\Scans`). Dès qu'un nouveau fichier apparaît, PrescrIA le détecte et lance l'analyse automatiquement. Le préparateur n'a qu'à scanner — zéro clic supplémentaire.

2. **Mode scan dédié** — Ajouter un bouton "Scanner" dans le widget qui ouvre directement le sélecteur de fichier, optimisé pour les images PDF/JPEG du scanner.

3. **Analyse PDF** — Ajouter le support des fichiers PDF (les scanners produisent souvent des PDF), en les convertissant en image côté client avant envoi.

4. **Feedback instantané** — Afficher un indicateur de progression pendant l'OCR (1-3 secondes).

### Limites honnêtes

- L'API File System Access (surveillance dossier) ne fonctionne que sur **Chrome/Edge** — pas Firefox/Safari. Mais les pharmacies utilisent quasi toutes Windows + Chrome/Edge, donc c'est viable.
- Le préparateur devra autoriser l'accès au dossier **une seule fois** (au premier lancement le matin).
- Sans cette API, le préparateur devra glisser/sélectionner le fichier manuellement (2 secondes max).

### Plan d'implémentation

1. **Ajouter le support PDF** dans le composant `PrescriptionInput` — convertir PDF en image canvas côté client
2. **Créer un mode "Dossier scanner"** — utiliser `window.showDirectoryPicker()` pour surveiller un dossier et détecter les nouveaux fichiers automatiquement
3. **Optimiser le feedback** — loader animé pendant l'OCR, notification sonore quand les résultats sont prêts
4. **Mettre à jour l'Edge Function** — s'assurer que les images de scanner (haute résolution) sont bien gérées

Le résultat : le préparateur scanne → PrescrIA détecte → résultats en 2-3 secondes, zéro clic.

