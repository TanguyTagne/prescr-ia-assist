

## Plan : Detection automatique des ordonnances scannees

### Probleme actuel
Le folder watcher (surveillance du dossier scanner) est cache dans le mode "Scanner" du composant `PrescriptionInput`. Le pharmacien doit manuellement basculer en mode Scanner puis selectionner un dossier. Ce n'est pas automatique.

### Solution
Remonter la surveillance du dossier scanner au niveau de la page principale (`Index.tsx`) pour qu'elle soit **toujours active** une fois configuree, independamment du mode de saisie. Le pharmacien clique une seule fois sur "Connecter le scanner" dans `ScannerStatus`, selectionne le dossier de son scanner, et ensuite chaque nouvelle ordonnance scannee est automatiquement detectee et analysee.

### Changements

**1. `src/components/ScannerStatus.tsx`** — Refonte de l'UI
- Ajouter le hook `useFolderWatcher` directement dans ce composant
- Remplacer le panneau webhook complexe par une interface simple :
  - Bouton "Connecter le scanner" qui ouvre le folder picker
  - Une fois connecte : indicateur vert "Scanner actif — dossier : [nom]" + bouton Stop
  - Garder le panneau webhook/API keys accessible via un lien "Configuration avancee (caisse)" en bas
- Quand un fichier est detecte dans le dossier, appeler le callback `onNewFile` qui remonte a `Index.tsx`

**2. `src/pages/Index.tsx`** — Integration de la detection automatique
- Recevoir le callback de nouveau fichier depuis `ScannerStatus`
- Convertir automatiquement le fichier (image/PDF) en base64 via les fonctions existantes (`pdfToImageBase64` ou `FileReader`)
- Appeler `analyzePrescriptionImage(base64)` automatiquement
- Afficher un toast "Ordonnance detectee — analyse en cours..." avec son de notification
- Afficher les resultats dans le meme flux que l'analyse manuelle

**3. `src/hooks/useBarcodeScanner.ts`** — Nouveau hook pour codes-barres CIP
- Ecouter les `keydown` globaux, detecter les saisies rapides (< 50ms entre frappes)
- Si sequence de 7-13 chiffres + Entree : callback `onBarcodeScan(code)`
- Lookup direct dans la table `medicaments` par `cip_code` pour afficher les suggestions

**4. `src/components/PrescriptionInput.tsx`** — Nettoyage
- Retirer le mode "scanner" (maintenant gere par `ScannerStatus` au niveau parent)
- Garder les 3 modes : Saisie, Texte, Photo

### Flux pharmacien final

**Ordonnance :** Clic unique "Connecter scanner" → selectionner le dossier du scanner → toute nouvelle ordonnance scannee est automatiquement analysee

**Code-barres produit :** L'app est ouverte → scanner un code CIP avec la douchette → suggestions complementaires instantanees

**Saisie manuelle :** Toujours disponible via les modes Saisie/Texte/Photo

