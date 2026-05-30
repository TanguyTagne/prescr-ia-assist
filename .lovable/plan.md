
# Tracking automatique des ventes additionnelles Asclion

Deux mécanismes complémentaires pour capter les ventes additionnelles **même quand le pharmacien oublie de cliquer Accepter**.

---

## 1. Auto-match HID ↔ suggestions (temps réel)

### Principe
Après chaque analyse, on garde en session les PC proposés avec leurs CIP. Chaque code-barres scanné par la douchette HID dans les **5 minutes** suivantes est comparé : si match → PC marqué `accepted` automatiquement (source = `hid_auto`).

### Flux
```text
Analyse ordonnance
   ↓
basket_context.proposed_pcs = [{nom, cip, categorie}, ...]
   ↓
Scan HID (EAN/CIP) ───┐
                       ├─ lookup medicament_cip → nom produit
                       ├─ match avec proposed_pcs ?
                       │     ├─ oui → pc_feedback (action=accepted, detection_source=hid_auto)
                       │     │       + recommendation_metrics.times_sold++
                       │     │       + badge "auto-détecté" sur la carte PC
                       │     └─ non → ignoré (peut être le médicament d'ordonnance)
                       └─ fenêtre expirée (>5min ou Esc/nouvelle analyse) → reset
```

### Garde-fous
- **Déduplication** : si le pharmacien a déjà cliqué Accepter manuellement → on ignore le scan auto (pas de double comptage)
- **Fenêtre 5 min** glissante depuis l'analyse, reset sur `Esc` ou nouvelle ordonnance
- **Anti-faux-positif** : on ne compte que les PC qui ont un `cip_code` connu dans `medicament_cip`. Sinon, fallback sur match nom (fuzzy) avec score > 0.85.

### UI
Le bouton **Accepter** passe en vert avec un petit badge `⚡ auto-détecté` à côté (discret, conforme au style minimal Asclion).

---

## 2. Inférence statistique mensuelle

### Principe
Job mensuel qui croise `analytics_events` (analyses Asclion) avec les ventes réelles agrégées par catégorie (issues du LGO ou des données saisies manuellement), pour estimer le **taux de conversion implicite** par pharmacie et par catégorie de PC.

### Métriques calculées
- `lift_rate` : (ventes catégorie X les jours avec proposition Asclion) / (ventes catégorie X jours sans)
- `implicit_conversion_rate` : ventes attribuables ÷ propositions
- `revenue_lift_estimated` : CA additionnel imputable à Asclion (€/mois)

### Affichage
Nouvel encart dans l'**Admin > InvestorKPIs** et **PharmacyKPIs** :
> *« Sur 100 propositions de probiotiques, 18 ont été cliquées + 12 auto-détectées + 9 ventes inférées = 39% de conversion totale »*

Permet de pitcher le ROI réel même quand HID ne capte pas tout.

---

## Détails techniques

### Schéma DB
- Ajouter `pc_feedback.detection_source TEXT DEFAULT 'manual_click'` (valeurs : `manual_click`, `hid_auto`, `lgo_sale`, `inferred`)
- Nouvelle table `sales_attribution_monthly` (pharmacy_id, month, category, proposed_count, clicked_count, hid_auto_count, inferred_count, total_attributed, revenue_estimate)

### Code frontend
- Nouveau hook `useBasketAttributionTracker` dans `src/hooks/` : écoute `asclion:global-barcode`, maintient `proposedPCs` en ref, déclenche `handleOrder(..., 'hid_auto')` sur match
- Modifier `AnalysisResults.tsx` : exposer les proposed_pcs au tracker via context ou ref, afficher badge `auto-détecté`
- Modifier `usePcFeedback.recordFeedback` : accepter un 5e param `detectionSource`
- Étendre `eanLookup.ts` : lookup CIP local prioritaire (table `medicament_cip`)

### Edge function
- Nouvelle `compute-sales-attribution` (cron mensuel via pg_cron + pg_net) : calcule l'inférence et remplit `sales_attribution_monthly`
- Lecture par les composants Admin KPI

### Migrations
1. `ALTER TABLE pc_feedback ADD COLUMN detection_source TEXT DEFAULT 'manual_click'`
2. `CREATE TABLE sales_attribution_monthly` + GRANT + RLS scopée pharmacy_id
3. (data) backfill `detection_source = 'manual_click'` pour l'existant

### Hors scope
- Réconciliation LGO temps réel (option 2) — nécessite intégration LGO complète, à faire en V2
- Prompt sortie ordonnance (option 3) — rejeté pour rester minimaliste
- Calcul du `revenue_estimate` précis : version 1 utilise un prix moyen par catégorie hardcodé ; V2 lira les prix LGO réels
