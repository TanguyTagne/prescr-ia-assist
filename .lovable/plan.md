## Objectif

Produire `/mnt/documents/asclion-brief-claude.md` : un dossier de présentation exhaustif d'Asclion, prêt à coller dans Claude, structuré pour qu'il puisse estimer de façon argumentée :
- l'uplift du panier moyen,
- le taux d'acceptation des produits complémentaires (PC),
- le revenu additionnel par ordonnance / par jour / par pharmacie / par an,
- le ROI vs coût d'abonnement.

Hypothèse cadre : **Asclion est utilisé sur 100% des médicaments vendus en pharmacie** (chaque délivrance déclenche une analyse).

## Structure du document Markdown

1. **Identité & pitch**
   - Nom, mission, public cible (titulaire, préparateur, pharmacien adjoint)
   - Phrase de positionnement vs LGO (Winpharma, LGPI, Pharmagest)

2. **Le problème**
   - Vente associée sous-exploitée en officine
   - LGO = règles statiques sponsorisées labos
   - Préparateurs non formés au discours conseil
   - Manque de temps au comptoir

3. **La solution Asclion**
   - Copilote IA "invisible" : douchette HID → analyse <2,5s → pop-up coin écran
   - Pipeline clinique multi-niveaux : Médicament → Molécule → ATC → Pathologie → PC
   - Top 3 / Top 2 / Top 1 PC selon nb de médicaments scannés, max 1 besoin latent
   - Phrase conseil 15-25 mots prête-à-dire (mi-commerciale / mi-technique)
   - Zéro friction : pas de clic, pas de config, fonctionne par-dessus n'importe quel LGO

4. **Différenciateurs vs LGO**
   - Indépendance commerciale (pas de deal labo)
   - Raisonnement IA vs table CIP→CIP figée
   - Phrase prête à dire vs simple nom produit
   - Feedback loop apprenant + benchmark inter-officines anonymisé
   - Overlay non-intrusif

5. **Stack technique condensée** (pour crédibilité)
   - Gemini Flash (Lovable AI Gateway), latence <2,5s
   - Base clinique curatée + fallback RxNav/OpenFDA
   - Sécurité : RLS, JWT, hash SHA-256 noms patients, RGPD B2B opposable
   - Hardware : HID global (uiohook-napi), surveillance dossier scan
   - Distribution : Electron Windows, web

6. **Modèle de données business**
   - Détection médicament → recommandations PC pondérées (40% med / 30% conv / 20% latent / 10% ctx)
   - `Commander` = feedback accepté + métriques + push LGO
   - Custom mapping par pharmacie (substitution catégorie → produit en stock)
   - Suivi conversion : recommandation → vente via webhook

7. **Données de cadrage pour l'estimation** (section que Claude utilisera)
   - Volume officine FR moyenne : ~600-900 ordonnances/semaine, ~150-200 délivrances/jour
   - Panier moyen officine FR : ~17-20 €
   - Taux de vente associée moyen actuel : ~8-12 % des délivrances
   - Prix moyen d'un PC typique (cosmétique, complément, dispositif) : ~6-12 €
   - Hypothèse Asclion : utilisé sur 100% des médicaments vendus, 1-3 PC suggérés par scan, phrase conseil systématique

8. **Demande explicite à Claude** (prompt final intégré en bas du fichier)
   - "Sur la base de ce dossier, estime de façon argumentée :
     - taux d'acceptation moyen attendu des PC suggérés (fourchette basse / médiane / haute)
     - uplift % du panier moyen
     - € additionnels / ordonnance, / jour, / pharmacie / an
     - ROI vs abonnement SaaS B2B pharma (50-300 €/mois/officine)
     - Quels leviers feraient bouger l'estimation (formation équipe, qualité phrase conseil, mix produits…)"
   - Demande explicitement à Claude de citer ses hypothèses et fourchettes.

## Livrable

Un seul fichier : `/mnt/documents/asclion-brief-claude.md`, puis tag `<presentation-artifact>` pour téléchargement immédiat. Pas de modification du code applicatif.