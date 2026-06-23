# Codes-barres de configuration douchettes

Ce dossier contient les images PNG des codes-barres de configuration officiels
des douchettes, capturés depuis les manuels constructeurs.

## Pourquoi des images au lieu de codes générés ?

Les fabricants **Datalogic**, **Zebra** et **Newland** encodent leurs commandes
de configuration avec des préfixes propriétaires et des checksums internes que
nous ne pouvons pas régénérer à partir d'une chaîne ASCII. Il faut donc capturer
le code-barres exact depuis le PDF officiel du modèle.

**Honeywell** utilise des commandes PAP-format en ASCII : pas besoin d'image,
le code est généré à la volée par `src/lib/code128.ts`.

## Workflow d'enrichissement

À chaque première installation d'un nouveau modèle :

1. Ouvre le manuel constructeur (lien dans la modale du dashboard).
2. Va à la page indiquée dans `manualPage` du modèle.
3. Capture chaque code-barres en image PNG (snipping tool, capture macOS, etc.).
4. Sauvegarde-les dans le sous-dossier du modèle, en respectant les noms
   attendus dans `src/lib/scannerConfigCodes.ts` (champ `imageFile`).
5. Pousse les images sur Git → tous les comptes en bénéficient.

## Arborescence attendue

```
public/scanner-codes/
├── datalogic-gryphon-gd4500/
│   ├── 1-restore-defaults.png
│   ├── 2-usb-com.png
│   └── 3-keyboard-wedge-concurrent.png
├── datalogic-quickscan-qd2500/
│   └── …
├── zebra-ds2208/
│   └── …
├── zebra-ds2278/
│   └── …
├── newland-hr32/
│   └── …
└── newland-hr22/
    └── …
```

Tant qu'un fichier est absent, l'UI affiche un placeholder explicite avec le
chemin attendu. Aucune erreur, aucune URL cassée — tu peux compléter
progressivement.

## Conseils de capture

- Résolution minimum : ~600 px de large pour que les bars restent nets.
- Fond strictement blanc autour du code-barres (pas de texte parasite).
- Si possible, capturer aussi le libellé "Restore Defaults" / "USB CDC" au-dessus
  pour éviter toute confusion lors d'une relecture future.
- Préfère PNG (sans compression destructive) à JPEG.

## Modèles déjà couverts par génération (Honeywell — pas d'image nécessaire)

- Honeywell Xenon 1900 / 1902 / 1950g
- Honeywell Voyager 1450g / 1452g
- Honeywell Genesis XP 7680g
- Honeywell Vuquest 3320g

Pour ces modèles, les codes `DEFALT.`, `PAPSPP.` et `SAVE.` sont générés à la
volée en Code 128 par le composant `ScannerConfigGuide`.
