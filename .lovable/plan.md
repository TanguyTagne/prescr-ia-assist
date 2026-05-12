
# Plan — Asclion 100% pro (marché FR, focus rétention pilote)

Objectif : que ta pharmacie pilote (et les 5 prochaines) ne puissent plus s'en passer au quotidien. On laisse de côté l'anglais, les pages légales, les sujets VC pur. On muscle le **produit utilisé en officine**.

---

## Sprint 1 — Fiabiliser le hardware (bloquant aujourd'hui)

Le scan code-barres et le watcher de documents sont marqués "pas fiables". C'est le différenciateur #1 d'Asclion : sans hardware fluide, on est juste un chatbot.

1. **Page "Diagnostic Hardware"** dans Réglages
   - Test live scanner code-barres (HID) : on voit chaque keystroke en temps réel, latence, complétude
   - Test live watcher documents : statut du dossier surveillé, dernier fichier détecté, erreurs
   - Bouton "Lancer un scan test" + "Importer un PDF test"
   - Export d'un rapport texte à m'envoyer si problème

2. **Mode debug visible** (toggle dans header en local/desktop)
   - Affiche overlay : événements clavier captés, fichiers détectés, état de la file de scan
   - Toast d'erreur explicite ("Scanner détecté mais code mal formé", "Dossier inaccessible : permission refusée")

3. **Robustesse du watcher**
   - Retry exponentiel sur fichier verrouillé (cas Windows fréquent)
   - Détection des doublons (hash fichier) pour éviter de relancer 2x la même analyse
   - Blacklist auto des extensions ignorées (.tmp, .crdownload)

4. **Robustesse du scan HID**
   - Anti-rebond configurable (certains scanners envoient l'EAN 2x)
   - Reconnaissance des préfixes/suffixes scanner (CR/LF/Tab) configurables
   - File d'attente visible si plusieurs scans rapides

---

## Sprint 2 — Rétention quotidienne (faire revenir le préparateur)

Aujourd'hui le préparateur ouvre Asclion → analyse → ferme. Il faut qu'il y revienne **plusieurs fois par jour sans y penser**.

5. **Notifications discrètes desktop**
   - "3 patients fidélisés cette semaine grâce à tes recos" (vendredi 17h)
   - "Rappel SMS programmé envoyé à 12 patients aujourd'hui"
   - "Nouvelle interaction médicamenteuse détectée dans ta dernière analyse"

6. **Widget "Ma journée"** (page d'accueil app)
   - Compteur ordonnances analysées du jour
   - Top 3 recos commandées
   - 1 patient à rappeler aujourd'hui (si CRM activé)
   - Score équipe vs hier (gamification légère, pas de classement public)

7. **Mode "Comptoir rapide"**
   - Vue ultra-condensée : ordonnance scannée → 3 produits avec stock LGO → 1 phrase de conseil → bouton "Commander"
   - Tout tient sur 1 écran sans scroll
   - Raccourci clavier (ex : F2) pour basculer mode rapide ↔ mode complet

8. **Historique patient au scan carte vitale** (si déjà supporté côté hardware)
   - Affiche les 3 dernières ordonnances anonymisées (hash) du même patient
   - "Ce patient a refusé X la dernière fois → propose Y"

---

## Sprint 3 — Confiance & qualité des recommandations

Si une reco est mauvaise 2 fois, le préparateur ne te fait plus confiance et arrête.

9. **Bouton "Reco non pertinente"** sur chaque produit recommandé
   - 1 clic → motif rapide (déjà pris / pas adapté / patient refuse / autre)
   - Boucle de feedback qui ajuste le ranking en temps réel pour cette pharmacie

10. **Explication visible "Pourquoi cette reco ?"**
    - Hover/clic sur un produit → "Recommandé car : interaction X, carence Y, protocole Z"
    - Sources cliquables (ATC, base patho)

11. **Garde-fou "Reco déjà refusée par ce patient"**
    - Si le hash patient a refusé un produit dans les 30 derniers jours, on l'enlève automatiquement
    - Ou on l'affiche barré avec mention discrète

12. **Auto-curation continue**
    - Tâche planifiée hebdo qui identifie les produits avec >70% de "non pertinent" et alerte l'admin
    - Tu peux désactiver/remplacer en 1 clic depuis le dashboard admin

---

## Sprint 4 — Onboarding pilote en 10 minutes

Pour signer les prochains pilotes sans passer 2h en visio à expliquer.

13. **Assistant onboarding interactif** (premier login pharmacie)
    - Étape 1 : connecte ton LGO (auto-détect existante)
    - Étape 2 : branche ton scanner (test live de Sprint 1)
    - Étape 3 : configure le dossier surveillé (test live)
    - Étape 4 : analyse une ordonnance test
    - Étape 5 : configure tes raccourcis clavier
    - Validation = badge "Pharmacie configurée" visible côté admin

14. **Page "Démarrage rapide"** (Aide enrichie)
    - Vidéo 2 min embedded
    - Checklist persistante (apparait tant que pas terminée)

15. **Ping santé pharmacie** (côté admin)
    - Vue : "Pharmacie X — dernière analyse il y a 4 jours" → alerte rouge → t'envoie un mail auto
    - Permet de détecter le décrochage avant qu'il devienne définitif

---

## Hors-sprint (à confirmer ensemble)

- Email de notification leads démo va aujourd'hui à `tanguytubert@gmail.com` ✅, à conserver
- Pas de pages légales pour l'instant ✅
- Code signing Windows : reporté
- Pages About/Pricing/Trust center : reporté

---

## Ordre proposé d'exécution

```text
Semaine 1 → Sprint 1 (Hardware) — bloquant
Semaine 2 → Sprint 2 (Rétention) — quick wins visibles
Semaine 3 → Sprint 3 (Qualité recos) — base feedback
Semaine 4 → Sprint 4 (Onboarding) — préparation scale
```

## Détails techniques

- Sprint 1 : extension de `useBarcodeScanner.ts`, `useFolderWatcher.ts`, nouvelle page `/settings/hardware`
- Sprint 2 : nouvelle table `daily_user_stats`, edge function `daily-digest` cron, refactor `Dashboard.tsx`
- Sprint 3 : ajout colonne `relevance_feedback` sur `recommendation_metrics`, exploitation dans le ranker
- Sprint 4 : nouvelle table `pharmacy_onboarding_steps`, composant `OnboardingWizard.tsx` (remplace `OnboardingTour` actuel pour les pilotes)

Dis-moi si on attaque par le **Sprint 1 (hardware)** ou si tu veux réordonner.
