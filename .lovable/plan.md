
# Plan : Pack RGPD B2B + Quotas applicatifs

Deux chantiers parallèles à livrer en 2-4 semaines pour être prêt à signer un groupement.

---

## CHANTIER 1 — Pack RGPD B2B opposable

Objectif : pouvoir répondre "oui" à toutes les questions juridiques d'un acheteur groupement, et fournir les documents sur demande en moins de 24h.

### 1.1 — Registre des traitements (Article 30 RGPD)

Créer `mem://compliance/rgpd-registre` + une page admin `/admin` onglet **"RGPD"** affichant le registre structuré :

Pour chaque traitement (analyse d'ordonnance, CRM patient, analytics, leads démo, traçabilité clinique) :
- Finalité
- Base légale (intérêt légitime / consentement / contrat)
- Catégories de données (hash patient, métadonnées, pas de PII directe)
- Catégories de personnes concernées (patients indirects, pharmaciens, prospects)
- Destinataires (Lovable Cloud / Supabase EU Frankfurt, Resend, Twilio si activé)
- Transferts hors UE (aucun, ou garanties SCC)
- Durée de conservation
- Mesures de sécurité (RLS, JWT, hash, TLS)

Stocké dans une nouvelle table `rgpd_processing_register` éditable par admin uniquement, exportable en PDF.

### 1.2 — DPA type signable

Document Markdown généré dans `/mnt/documents/` en version statique + accessible via `/legal/dpa` côté pharmacien.

Contenu standard :
- Identification responsable de traitement (pharmacie) / sous-traitant (Asclion)
- Objet, durée, nature des traitements
- Obligations Asclion (sécurité, confidentialité, sous-traitants ultérieurs)
- Localisation données (UE)
- Droit d'audit
- Notification de violation < 72h
- Sort des données en fin de contrat

Bouton "Télécharger le DPA pré-rempli" dans l'onglet Conformité côté pharmacien (utilise les données pharmacie depuis la table `pharmacies`).

### 1.3 — Procédure droit à l'effacement / portabilité

Edge function `gdpr-data-request` :
- Endpoint `POST /functions/v1/gdpr-data-request` avec action `export` ou `delete`
- Accessible depuis page pharmacien `/admin` → onglet "Mes données"
- **Export** : génère un ZIP JSON contenant toutes les données liées à `pharmacy_id` (analyses, feedback, ventes, registres)
- **Effacement** : anonymise (pas de DELETE pour préserver KPIs anonymisés) → remplace `pharmacy_id` par un UUID `deleted_pharmacy` et purge les hashes patient associés
- Logue chaque demande dans nouvelle table `gdpr_requests` (audit)

### 1.4 — PIA simplifié (Privacy Impact Assessment)

Document statique `/legal/pia` (page React) répondant aux 6 questions CNIL :
1. Description du traitement
2. Nécessité et proportionnalité
3. Risques pour les personnes (faible : pas de PII directe, hash irréversible)
4. Mesures pour traiter les risques
5. Validation
6. Plan d'action

Téléchargeable en PDF depuis l'onglet RGPD admin.

### 1.5 — Page "Conformité & Sécurité" admin (synthèse opposable)

Nouvel onglet `/admin` → **"Conformité"** centralisant :
- Statut RGPD (registre à jour, DPA dispo, PIA dispo)
- Statut sécurité (RLS actif, JWT, chiffrement TLS, hash patients)
- Hébergement (Lovable Cloud / Supabase EU Frankfurt — analyse HDS écrite)
- Traçabilité clinique (lien vers onglet existant)
- Liens téléchargement : DPA type, PIA, Politique Confidentialité, CGU
- Bouton "Générer pack PDF complet" → ZIP unique pour acheteur

### 1.6 — Analyse HDS (Hébergeur Données de Santé)

Document Markdown justifiant **pourquoi Asclion n'est pas soumis à HDS** :
- Données traitées : hashes irréversibles + métadonnées non-nominatives
- Pas d'hébergement de dossier patient
- Référence à la doctrine ANS : seuils d'identifiabilité
- Vérification région Supabase = Frankfurt (UE)

À placer dans la page Conformité admin.

---

## CHANTIER 2 — Quotas applicatifs par pharmacie

⚠️ **Contrainte plateforme** : la plateforme Lovable n'a pas encore de primitives de rate limiting backend natif. On implémente donc des **quotas applicatifs** au niveau DB (compteurs + alertes), suffisants pour protéger budget AI et détecter les abus.

### 2.1 — Table `pharmacy_quotas`

Nouvelle table :
- `pharmacy_id` (PK)
- `daily_analyses_limit` (default 500)
- `monthly_ai_calls_limit` (default 15000)
- `max_upload_size_mb` (default 10)
- `current_daily_analyses` (compteur, reset 24h)
- `current_monthly_ai_calls` (compteur, reset mensuel)
- `last_reset_daily`, `last_reset_monthly`
- `over_limit` (bool — déclencheur alerte)

RLS : admin lecture totale, pharmacie lecture de sa propre ligne uniquement.

### 2.2 — Fonction DB `check_and_increment_quota`

Fonction PL/pgSQL `SECURITY DEFINER` :
- Input : `pharmacy_id`, `quota_type` (`analysis` | `ai_call`)
- Auto-reset compteur si nouveau jour/mois
- Incrémente le compteur
- Renvoie `{ allowed: bool, current: int, limit: int, remaining: int }`
- Si dépassement : renvoie `allowed: false` ET insère dans `group_alerts` (severity warning)

### 2.3 — Intégration dans edge functions sensibles

Modifier `analyze-prescription/index.ts` et toute autre edge function consommant Lovable AI :
- Avant l'appel AI : `supabase.rpc('check_and_increment_quota', { ... })`
- Si `allowed: false` → réponse 429 avec message clair pour l'utilisateur ("Quota journalier atteint, contactez admin")
- Logger côté `analytics_events` avec `event_type: 'quota_exceeded'`

### 2.4 — UI quota côté admin

Onglet `/admin` → **"Quotas"** :
- Tableau pharmacie / quotas / consommation / % utilisé
- Édition manuelle des limites par pharmacie (ex : groupement premium = 2000 analyses/jour)
- Graphique top 10 consommatrices (30j)
- Alertes "Pharmacie X a dépassé son quota X fois"

### 2.5 — UI quota côté pharmacien (discret)

Dans page `/admin` pharmacien (ou settings) :
- Petite jauge "Vous avez utilisé X / Y analyses aujourd'hui"
- Affichée seulement si > 70% de consommation
- Bouton "Demander une augmentation" → email admin via edge function existante

### 2.6 — Validation taille upload

Côté `analyze-prescription` :
- Vérifier `max_upload_size_mb` depuis `pharmacy_quotas` avant traitement image/PDF
- Refus 413 avec message clair

---

## Architecture résumée

```text
┌─────────────────────────────────────────────────────┐
│  /admin                                             │
│  ├─ Onglet "Conformité"   → RGPD + HDS + sécurité  │
│  ├─ Onglet "RGPD"         → Registre traitements   │
│  ├─ Onglet "Quotas"       → Gestion limites        │
│  └─ Onglet "Traçabilité"  → (existant)             │
└─────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────┐
│  Edge Functions                                     │
│  ├─ gdpr-data-request   → Export/Effacement        │
│  └─ analyze-prescription → check_and_increment     │
└─────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────┐
│  Database (nouvelles tables)                        │
│  ├─ rgpd_processing_register                        │
│  ├─ gdpr_requests (audit)                           │
│  └─ pharmacy_quotas + check_and_increment_quota()   │
└─────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────┐
│  Pharmacien                                         │
│  ├─ /legal/dpa       → DPA pré-rempli              │
│  ├─ /legal/pia       → PIA téléchargeable          │
│  └─ Onglet "Mes données" → Export/Suppression      │
└─────────────────────────────────────────────────────┘
```

---

## Détails techniques

**Migrations DB** :
- 3 nouvelles tables : `rgpd_processing_register`, `gdpr_requests`, `pharmacy_quotas`
- 1 fonction SECURITY DEFINER : `check_and_increment_quota`
- RLS strictes : admin total, pharmacie lecture restreinte à `pharmacy_id`
- Trigger `set_updated_at` sur les nouvelles tables

**Edge functions** :
- `gdpr-data-request` (nouveau) — export ZIP / anonymisation
- `analyze-prescription` (modifié) — intègre check quota
- Pas d'autres edge functions à modifier dans le périmètre initial

**Frontend** :
- 4 nouveaux composants admin : `ConformiteTab.tsx`, `RgpdTab.tsx`, `QuotasTab.tsx`, `MesDonneesPanel.tsx`
- 2 nouvelles pages publiques : `/legal/dpa`, `/legal/pia`
- Génération PDF côté client via `jspdf` (déjà disponible) ou via edge function dédiée

**Mémoires à créer** :
- `mem://compliance/rgpd-registre` — registre des traitements de référence
- `mem://compliance/quotas-policy` — politique de quotas par défaut
- `mem://compliance/hds-analysis` — analyse pourquoi non-soumis HDS

---

## Hors périmètre (à faire plus tard)

- Dépôt INPI de la marque (action externe, pas de code)
- CGV B2B avec SLA (rédaction juridique)
- Sentry / observabilité (chantier séparé déjà identifié)
- Environnement staging (chantier séparé)

---

## Livrables

À la fin du chantier, tu pourras :
1. Cliquer sur "Générer pack RGPD complet" et obtenir un ZIP signable à envoyer à n'importe quel groupement / juriste
2. Garantir contractuellement le droit à l'effacement et à la portabilité
3. Avoir un quota technique qui protège ton budget AI Gateway même en cas d'abus
4. Répondre "oui, document disponible" à toutes les questions de due diligence RGPD

Veux-tu que j'attaque l'implémentation dans cet ordre ?
