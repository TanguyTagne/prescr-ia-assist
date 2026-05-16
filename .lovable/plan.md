## État actuel

**Besoins latents : 21** (1 par molécule). Couvre uniquement : paracetamol, ibuprofène, kétoprofène, IPP (oméprazole/eso/panto), antihistaminiques (cétirizine/lorat/deslo), antibiotiques (amox/augmentin/azithro), statines (atorva/rosuva), antidépresseurs (escitalo/sertra), corticoïdes (predni/prednisolone), metformine.

**Médicaments sans PC liés : 397 / 1 324 (30%)**
- 184 sans code ATC → orphelins (impossible de matcher une pathologie)
- 213 avec ATC mais sans lien `medicament_pathologie` → pathologie existe mais lien manquant

## Plan

### 1. Étendre les besoins latents (~25 classes additionnelles)
Ajouter des `latent_needs` ciblées pour les grandes classes thérapeutiques qui en manquent :
- **Cardio** : IEC/ARA2 (toux/hydratation), bêtabloquants (fatigue/froid), calciques (œdèmes), diurétiques (déshydratation/photosensibilité), anti-arythmiques
- **Anticoagulants** : AOD (saignements gingivaux), HBPM (DASRI), AVK (alimentation), antiplaquettaires (gastrite)
- **Diabète** : GLP-1 (nausées), SGLT2 (mycoses), DPP-4 (carence D), sulfamides (hypoglycémie), insulines (kits)
- **Neuro/psy** : benzodiazépines (somnolence/mémoire), Z-drugs (rebond), SSRI (libido/sécheresse), antiépileptiques (folates)
- **Respi** : β2-agonistes (sécheresse bouche), corticoïdes inhalés (candidose), antitussifs
- **Uro/gynéco** : alpha-bloquants (hypoTA orthostatique), pilules (carence B9), HBP (mictions)
- **Dermato** : corticoïdes topiques (atrophie), antifongiques topiques (récidive)
- **Métabolisme** : biphosphonates (œsophagite), thyroïde (Ca/Fe), allopurinol (hydratation)

→ Objectif : passer de 21 à ~45-50 besoins latents.

### 2. Combler les 213 liens médicament→pathologie manquants
Pour chaque médicament avec `atc_code` mais sans `medicament_pathologie` :
- Trouver une molécule sœur (même ATC5) qui a déjà un lien pathologie
- Cloner le lien `medicament_pathologie` → le médicament hérite automatiquement des PCs

### 3. Enrichir l'ATC des 184 médicaments orphelins
- Matching nom → molécule existante dans `molecules`
- Pour ceux qui restent (vraiment génériques type « Doliprane Pédiatrique », « Sodium Chl », vaccins anciens) : marquer `est_produit_conseil = true` et accepter qu'ils n'aient pas de PC pharmacologique
- Ne **pas** forcer une pathologie/PC si pas pertinent (sécurité clinique)

### 4. Vérification finale
Re-query :
- Nombre de médicaments cliniquement pertinents (hors OTC pédiatriques/vaccins) sans PC → cible **0**
- Nombre de besoins latents → cible **~45**

### Technique
- Migration SQL unique pour les `latent_needs`
- Script d'insertion en batch pour `medicament_pathologie` (clone par ATC5)
- Update batch pour `est_produit_conseil` sur les orphelins non-cliniques

Aucun changement frontend.