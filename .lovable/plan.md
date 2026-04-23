

## Tracking des visiteurs démo + relance commerciale

### Ce qui sera mis en place

**1. Tracking anonyme automatique (zéro friction)**

À chaque clic sur une ordonnance démo, un événement est enregistré sans rien demander au visiteur :
- Ordonnance choisie (Médecine générale / Soins infirmiers / Cardiologie)
- Date / heure
- Pays + ville approximative (via géoloc IP côté backend)
- User-agent (desktop/mobile, navigateur)
- Source de trafic (referrer : LinkedIn, Google, direct…)
- ID de session anonyme (localStorage) — permet de voir si un visiteur revient et teste plusieurs ordonnances
- Booléen `converted` mis à `true` si le visiteur soumet ensuite le formulaire

**2. Formulaire opt-in après la démo (non bloquant, ultra simple)**

Une fois le résultat de la démo affiché, un encart compact apparaît sous les recommandations :

> *"Cette démo vous parle ? Recevez une présentation personnalisée pour votre officine."*
>
> Champs : **Nom · Officine · Email**
>
> Bouton **"Être recontacté"** + petit lien **"Plus tard"** pour fermer.

Le formulaire est lié à la session de tracking : on saura précisément quelle(s) ordonnance(s) ce lead a testée(s) avant de laisser ses coordonnées.

**3. Email instantané sur chaque lead**

Dès qu'un visiteur soumet le formulaire, tu reçois un email automatique contenant :
- Nom · Officine · Email
- Ordonnance(s) testée(s) + durée passée sur la démo
- Source de trafic (LinkedIn / Google / direct)
- Lien direct vers la fiche dans l'admin

**4. Nouvel onglet "Démos" dans /admin**

Deux sous-vues :

- **Sessions** (toutes les démos lancées, même anonymes) : table filtrable par date / ordonnance / pays / source. Compteur global, taux de conversion (sessions → leads).
- **Leads** (formulaires soumis) : table avec Nom, Officine, Email, ordonnances testées, statut de relance (`nouveau` / `contacté` / `converti` / `pas intéressé`), notes libres. Bouton **Export CSV** pour ta prospection. Mailto en un clic.

### Détails techniques

| Aspect | Décision |
|---|---|
| Table `demo_sessions` | `session_id` (text), `ordonnance_id`, `ip_country`, `ip_city`, `referrer`, `user_agent`, `created_at`, `converted_to_lead` (bool) |
| Table `demo_leads` | `session_id` (lien), `nom`, `officine`, `email`, `status`, `notes`, `contacted_at`, `created_at` |
| RLS | Insert public (anon) sur les 2 tables. Select/update réservé aux admins. |
| Edge function `track-demo-session` | Reçoit le clic démo, enrichit avec géoloc IP (header `x-forwarded-for`) et insère. Bypass du `useAnalytics` actuel qui bloque les anonymes. |
| Edge function `submit-demo-lead` | Validation Zod (nom 1-100, officine 1-150, email valide), insère le lead, envoie email Resend, met `converted_to_lead=true` sur la session. |
| Composant `<DemoLeadForm />` | Affiché sous `<AnalysisResults demoMode />` dans `Widget.tsx` (WidgetAuth) et `WidgetDemo.tsx`. |
| Onglets admin | `src/components/admin/DemoSessionsTab.tsx` + `DemoLeadsTab.tsx`, ajoutés à `src/pages/Admin.tsx`. |
| Cookie consent | Tracking anonyme respecte `hasAnalyticsConsent()`. Formulaire = consentement explicite par soumission. |
| RGPD | Mention sous le formulaire : "En soumettant, vous acceptez d'être recontacté par Asclion. Données conservées 12 mois max." + lien politique de confidentialité. |

### Fichiers impactés

**Créés** : 1 migration (2 tables + RLS), 2 edge functions, `src/components/DemoLeadForm.tsx`, `src/components/admin/DemoSessionsTab.tsx`, `src/components/admin/DemoLeadsTab.tsx`.

**Modifiés** : `src/components/Widget.tsx`, `src/components/WidgetDemo.tsx`, `src/pages/Admin.tsx`.

### Hors scope

- Pas de relance email/SMS automatique (relance manuelle depuis l'admin).
- Pas de scoring de lead, pas de fingerprinting avancé.

### Question avant implémentation

Sur quelle adresse email veux-tu recevoir les notifications de nouveaux leads ?

