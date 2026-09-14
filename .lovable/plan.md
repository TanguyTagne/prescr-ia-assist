# Épurer l’affichage des produits complémentaires

## Résultat attendu
L’écran de résultat se concentre sur la valeur principale d’Asclion : les produits complémentaires pertinents et la phrase conseil courte associée.

## Modifications
- Ne plus afficher la ligne « Sécurité / Vigilance » dans l’application Electron ni dans la démo.
- Retirer le chargement de secours dédié aux phrases de vigilance afin d’éviter des requêtes inutiles.
- Ne plus ouvrir l’application lorsqu’un médicament ne possède qu’une vigilance : elle réagit uniquement lorsqu’au moins un PC est disponible.
- Masquer le code ATC à côté du médicament.
- Retirer le titre répétitif « Produit complémentaire » au-dessus des suggestions.
- Retirer l’aide clavier visible sous les résultats ; les raccourcis continuent de fonctionner.
- Conserver : nom du médicament, nom des PC, courte phrase conseil, clic d’acceptation, détection automatique par CIP, compteur d’acceptations, nouveau scan et mention légale.

## Périmètre
- Épuration identique dans l’application Electron et la démo pour garder une présentation cohérente.
- Les données de vigilance restent dans la base et dans l’import ; elles ne sont simplement plus affichées ni utilisées pour déclencher l’écran.
- Aucun changement à la logique de sélection des PC, au suivi des acceptations ou aux indicateurs.

## Vérification
- Tester un médicament avec PC et vigilance : seuls les PC et leurs phrases conseil apparaissent.
- Tester un médicament avec vigilance mais sans PC : aucun résultat conseil ne s’ouvre.
- Vérifier le clic d’acceptation, la détection automatique CIP, le compteur et les raccourcis.
- Contrôler les formats compact et large, puis vérifier la compilation.
