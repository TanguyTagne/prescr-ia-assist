

## Démo intégrée dans le widget web — 3 ordonnances pré-analysées

Pas de page `/demo` séparée, pas de lien public, pas de saisie libre. Les 3 ordonnances apparaissent comme **boutons d'exemple cliquables** dans le widget web (mode non-authentifié uniquement, ou avant analyse). Résultats stockés en dur, simulation de 2-3s de traitement.

### Comportement

- Sur `Landing.tsx` (le widget web embarqué), si l'utilisateur n'est pas connecté **OU** si aucun résultat n'est encore affiché : remplacer la section actuelle "Essayer : Amoxicilline, Doliprane / Ibuprofène, Oméprazole / Metformine, Ramipril" par 3 cartes cliquables nommées d'après les ordonnances réelles :
  1. **Médecine générale** — Doliprane + Amoxicilline + Drill
  2. **Soins infirmiers** — Compresses + Set pansement + Sparadrap + Sérum physio
  3. **Cardiologie** — Kardegic + Bisoprolol + Crestor + Lasilix
- Au clic : skeleton loader + étapes de progression existantes (`AnalysisSkeleton`) pendant **2,5 secondes** (timer fixe), puis affichage du résultat pré-stocké via le composant `AnalysisResults` standard.
- Pas d'appel à `analyze-prescription`, pas d'écriture DB, pas d'IA sollicitée.
- Bouton "Réinitialiser" (`Échap`) ramène aux 3 cartes.
- Bandeau discret sous les résultats : "Démonstration — activez votre officine pour analyser vos vraies ordonnances et bénéficier du mapping LGO personnalisé."

### Contenu des 3 analyses pré-stockées

Pour chaque ordonnance, le résultat respecte la structure `AnalysisResult` actuelle (medicaments + recommendations + conseil + interactions + contextes). Les recommandations + phrases conseils sont rédigées selon les specs en mémoire (15-25 mots, mi-commercial / mi-technique, focus bénéfice patient, max 3 produits par med pour 1 ordonnance type 1, dégressif sinon).

**Ordonnance 1 — Médecine générale (3 médicaments → Top 1 par med)**
- *Doliprane 1000 mg* → Magnésium marin (récup post-fièvre)
- *Amoxicilline 1g* → Probiotiques (Ultra-Levure / Lactibiane ATB) — phrase : "Préserve le confort digestif pendant l'antibiotique en limitant ballonnements et diarrhées passagères."
- *Drill Miel Citron* → Spray gorge propolis — phrase : "Apaise localement et complète l'action de la pastille pour soulager plus vite les irritations."
- Conseil global : hydratation, repos, surveillance T° ; pas d'interaction majeure.

**Ordonnance 2 — Soins infirmiers (matériel uniquement, cas spécial)**
- Bloc unique "Soins de cicatrice" avec 3 produits complémentaires :
  - Crème cicatrisante (Cicalfate / Cicabio) — phrase : "Accélère la régénération cutanée après la cicatrisation initiale et limite les marques."
  - Pansement hydrocolloïde de secours — phrase : "Pratique en remplacement si le pansement se décolle entre deux passages infirmier."
  - Solution antiseptique douce (chlorhexidine) — phrase : "Utile en cas de salissure inattendue avant le prochain passage soignant."
- Pas d'interactions, contexte "soins post-op".

**Ordonnance 3 — Cardiologie (4 médicaments → Top 1 + 1 besoin latent max)**
- *Kardegic 75 mg* → Pas de PC (anti-agrégant, prudence — phrase : "Surveillance des saignements, éviter aspirine en automédication.")
- *Bisoprolol 2,5 mg* → Tensiomètre auto-poignet — phrase : "Permet un suivi régulier de l'efficacité du traitement et rassure le patient au quotidien."
- *Crestor 10 mg* → CoQ10 100 mg — phrase : "Soutient le tonus musculaire, souvent recherché par les patients sous statine sur le long terme."
- *Lasilix 40 mg* → Magnésium + potassium (banane, eau riche) — phrase : "Compense les pertes minérales liées au diurétique et limite crampes nocturnes."
- Interaction signalée : Bisoprolol + Lasilix (modérée — surveillance kaliémie).
- Conseil global : observance matin/soir, suivi tensionnel hebdo.

### Détails techniques

| Aspect | Décision |
|---|---|
| Stockage | Fichier `src/lib/demoPrescriptions.ts` exportant `DEMO_PRESCRIPTIONS: { id, label, description, icon, result: AnalysisResult }[]` |
| Délai simulé | `setTimeout(2500ms)` avant `setResult(...)` pour laisser le skeleton tourner |
| Pas d'IA | Aucun appel à `analyze-prescription`, aucun appel Supabase |
| Pas de DB write | Aucune écriture `analysis_history` / `recommendation_metrics` |
| Tracking | `trackEvent("demo_analyzed", { ordonnance: id })` analytics local uniquement |
| Bouton "Commander" | Reste cliquable mais avec toast "Démonstration — connectez-vous pour activer la commande LGO" au lieu d'écrire en DB |
| Position dans Landing | Remplace le bloc actuel `["Amoxicilline, Doliprane", ...]` quand `!result && !user` |
| Mode authentifié | Si l'utilisateur est connecté à une vraie officine, on garde le widget normal sans les 3 cartes démo |

### Fichiers impactés

**Créés** :
- `src/lib/demoPrescriptions.ts` (3 résultats hardcodés conformes au type `AnalysisResult`)
- `src/components/DemoPrescriptionCards.tsx` (UI des 3 cartes cliquables)

**Modifiés** :
- `src/pages/Landing.tsx` (remplacer le bloc "Essayer : ..." par `<DemoPrescriptionCards>`, gérer le timer + skeleton + affichage `AnalysisResults`, intercepter "Commander" en mode démo)

**Aucune migration DB**, aucune edge function, aucun changement backend.

### Hors scope

- Page `/demo` publique (annulé sur ta demande)
- Saisie de texte libre en mode démo (annulé)
- Limite IP / anti-abus (inutile sans saisie libre ni appel IA)
- A3 (Wizard LGO) et A7 (Parrainage) — reportés à une vague suivante pour rester focus sur la démo intégrée

