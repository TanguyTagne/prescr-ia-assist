## Objectif

Garantir qu'**au moins quelques médicaments représentatifs** existent dans la base pour **chacune des 22 grandes catégories** demandées, afin que toute ordonnance courante soit reconnue, quel que soit son domaine thérapeutique.

## État actuel (audit DB)

Base : 895 médicaments, 434 pathologies, 2557 produits complémentaires, 18 classes thérapeutiques structurées.

Répartition ATC niveau 1 des médicaments présents :

```
A (digestif/métabolisme) 104   N (SNC)               117
B (sang)                  25   P (parasitaires)        8
C (cardio)                60   R (respiratoire)       50
D (dermato)               31   S (organes sensoriels) 18
G (génito-urinaire)       25   L (oncologie/immuno)    9
H (hormones)              20   V (divers)              1
J (anti-infectieux)       24
```

Sans code ATC : 348 médicaments (à compléter, hors scope ici).

### Catégories bien couvertes (✓ — aucun seed)
Antalgiques I/II, AINS, antibiotiques, antiseptiques, antihypertenseurs, diurétiques, anti­agrégants/anti­coagulants, hypolipémiants, broncho­dilatateurs/CSI, antihistaminiques, IPP/anti-H2, anti­diarrhéiques, laxatifs, anti­spasmodiques, anti­dépresseurs, anxio­lytiques/hypnotiques, anti­épileptiques, anti­diabétiques (incl. GLP-1), thyroïde, corticoïdes systémiques, contraceptifs/THM, gynéco locaux, prostate/incontinence/IPDE5, myo­relaxants, corticoïdes topiques, anti­fongiques cutanés, antibio topiques, acné, émollients, ophtalmo, ORL, vitamines/minéraux, substituts nicotiniques, TSO.

### Catégories sous-couvertes ou absentes (à seeder)

| # | Catégorie | Manque |
|---|-----------|--------|
| 1 | Anti­viraux (J05) | herpès (aciclovir, valaciclovir), grippe (osel­tamivir), VHC (sofosbuvir/velpatasvir), VIH (bictégravir, dolutégravir, emtricitabine/ténofovir) |
| 2 | Anti­fongiques systémiques (J02) | fluconazole, itraconazole, terbinafine PO, vori­conazole |
| 3 | Anti­arythmiques & digitaliques (C01) | amiodarone, flécaïnide, sotalol, digoxine |
| 4 | Hépatique/biliaire (A05) | acide ursodéoxycholique, sili­marine |
| 5 | Anti­émétiques (A04) | métoclopramide, dom­péridone, ondan­sétron, métopimazine |
| 6 | MICI (A07E) | mésa­lazine, sulfasalazine, budésonide locale |
| 7 | Anti­parkinsoniens (N04) | L-DOPA/carbi­dopa, ropinirole, prami­pexole, rasagiline |
| 8 | Démences (N06D) | donépézil, riva­stigmine, galanta­mine, mémantine |
| 9 | Psychostimulants (N06B) | méthyl­phénidate (Ritaline, Concerta, Quasym) |
| 10 | Ostéoporose (M05) | alen­dronate, risé­dronate, zolé­dronate, dénos­umab, calcium+vit D |
| 11 | Anti­goutteux (M04) | allo­purinol, fébu­xostat, colchicine |
| 12 | Polyarthrite/biothérapies (L04) | métho­trexate, lé­flu­no­mide, adali­mumab, étaner­cept, hydro­xychloroquine |
| 13 | Psoriasis (D05) | calci­potriol, calci­potriol+béta­métha­sone |
| 14 | Anti­parasitaires cutanés (P03) | per­méthrine, ivermectine topique, mala­thion (gale & poux) |
| 15 | Cicatrisants (D03) | trolamine, sulfa­diazine d'argent |
| 16 | Vaccins (J07) | DTPolio, ROR, grippe, COVID-19, HPV, pneumo­coque, zona, méningo, hépatites |
| 17 | Anti­hémorragiques (B02) | acide tranex­amique, vitamine K, facteur VIII (1 entrée symbolique) |
| 18 | Anti­dotes / urgences (V03) | naloxone, N-acétyl­cystéine antidote, atropine, charbon activé |
| 19 | Adrénaline auto-injectable | EpiPen, Anapen, Jext, Emerade |
| 20 | Immuno­globulines (J06) | Ig polyvalentes IV, Ig anti-D, Ig spécifiques |
| 21 | Désensibilisation (V01) | Stallergènes (acariens, pollens) |
| 22 | Oncologie orale & hormono­thérapie (L01/L02) | imatinib, létrozole, tamoxifène, anastrozole, capéci­tabine |
| 23 | Soins de support oncologie | aprépitant, fil­grastim |
| 24 | Anesthésiques locaux dentaires (N01B) | articaïne, lidocaïne dentaire |
| 25 | Probiotiques (A07F) | Saccharomyces, Lacto­bacillus rhamnosus |
| 26 | Nutrition clinique (V06) | CNO Fortimel/Resource, Kaleorid, Phlexy (PCU) |
| 27 | Mucoviscidose (R07) | Kaftrio (élexa/téza/iva), Symkevi |
| 28 | Arthrose (chondro­protecteurs) | Structum (chondroïtine), Piascledine, acide hyalu­ronique injectable |
| 29 | Alcool (sevrage) | naltrexone PO, acam­prosate, baclofène, disulfirame |
| 30 | Tabac (médicaments) | varé­nicline (Champix), bupropion (Zyban) |

> Hors scope : « dispositifs médicaux & para­pharmacie » (pansements, contention, glucomètres) — c'est du LGO/parapharmacie, pas de la table `medicaments`.

## Plan d'action

### Étape 1 — Migration de seed (`seed-coverage-22-categories`)

Insérer ~120-150 médicaments représentatifs dans `medicaments` couvrant les 30 lacunes ci-dessus, avec :
- `nom_commercial`, `atc_code`, `laboratoire`, `forme_galenique`, `dosage`
- `statut_officine = 'officine'`, `est_otc` calculé selon le produit
- `source_code = 'asclion-coverage-v1'` pour traçabilité

Insérer en parallèle les **molécules** (`molecules`) manquantes et les liens `medicament_pathologie` minimaux pour 5-10 nouvelles `pathologies` essentielles non encore listées (Maladie de Parkinson, Alzheimer, Goutte, Mucoviscidose, Allergie sévère/anaphylaxie, Sevrage alcool…).

Volume estimé : 150 INSERT médicaments + 30 molécules + 10 pathologies + 50 liens. Batché par groupes de 30-50 (cf. memory `data-operations-constraints`).

### Étape 2 — Edge function `audit-coverage` (mise à jour)

Étendre la liste des "catégories cibles" auditées par le tableau de bord Admin → onglet **Couverture clinique** pour matcher les 22 grandes catégories pharmacie (au lieu d'une liste interne plus courte). Génération automatique d'un rapport % de couverture par catégorie.

### Étape 3 — Vérification

Requêtes de contrôle après seed :
```sql
SELECT substr(atc_code,1,3), COUNT(*) FROM medicaments GROUP BY 1;
```
Objectif : aucune cellule du tableau d'audit < 3 médicaments pour les 22 catégories.

### Notes de sécurité clinique
Conformément aux memories `clinical-safety` et `legal-constraints` :
- **Exclus** : chimios IV hospitalières, anesthésiques généraux, médicaments réservés réa.
- **Inclus uniquement** : présentations délivrées en officine de ville.
- Aucun protocole posologique ne sera ajouté — seulement l'identification produit (pour reconnaissance d'ordonnance).

## Livrables

1. Migration SQL avec seed batché.
2. Mise à jour `supabase/functions/audit-coverage/index.ts`.
3. Confirmation visuelle dans Admin → Couverture clinique que les 22 catégories sont à ≥ "minimal" (≥3 médicaments représentatifs).
