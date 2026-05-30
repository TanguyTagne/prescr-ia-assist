## Diagnostic

Le site n'est pas blanc — il est juste lent au chargement. Le profil réseau sur `/admin` montre :

- **TTFB** : 301 ms (OK)
- **First Contentful Paint** : 2 768 ms (lent)
- **Full load** : 2 828 ms

Cause principale identifiée : **la requête `profiles?select=pharmacy_id&id=eq.<user>` est tirée 4 fois en parallèle au montage**, chacune prenant **1 358 ms à 2 165 ms**. Sur les autres pages, jusqu'à 13 hooks/composants refont indépendamment le même appel :

```
useAuth, useRegister, useScanQueue, useAnalytics, usePcFeedback,
useLgoPreset, useInstanceHeartbeat, ReportButton, ProductMappingSettings,
PrescriptionInput, OnboardingTour, Widget, LgoAutoDetectPrompt
```

`useAuth` charge déjà `pharmacy_id` au login. Il suffit de l'exposer dans le contexte et de faire lire les autres consommateurs depuis le contexte au lieu de re-requêter.

Cause secondaire : la requête elle-même est lente (~2 s pour un lookup PK). À regarder après si le problème persiste — probablement RLS recursive ou cold-start Postgres.

## Plan

### 1. Exposer `pharmacyId` dans `AuthContext`

`src/hooks/useAuth.tsx` :
- Ajouter `pharmacyId: string | null` au type + état + valeur du provider
- `fetchPharmacyStatus` stocke déjà `profile.pharmacy_id` localement → l'écrire aussi dans le state

### 2. Refactor des 13 consommateurs

Pour chaque fichier ci-dessous, remplacer le bloc :
```ts
const { data: profile } = await supabase.from("profiles").select("pharmacy_id").eq("id", user.id)...
const pharmacyId = profile?.pharmacy_id;
```
par une lecture directe de `useAuth().pharmacyId` (ou via un argument passé depuis le composant parent pour les utilitaires non-React).

Fichiers à mettre à jour :
- `src/hooks/useRegister.tsx`
- `src/hooks/useScanQueue.ts`
- `src/hooks/useAnalytics.ts`
- `src/hooks/usePcFeedback.ts`
- `src/hooks/useLgoPreset.ts`
- `src/hooks/useInstanceHeartbeat.ts`
- `src/components/ReportButton.tsx`
- `src/components/ProductMappingSettings.tsx`
- `src/components/PrescriptionInput.tsx`
- `src/components/OnboardingTour.tsx`
- `src/components/Widget.tsx`
- `src/components/LgoAutoDetectPrompt.tsx`

### 3. Vérification

Recharger `/admin` et `/dashboard`, contrôler dans le profileur que la requête `profiles?select=pharmacy_id` n'apparaît plus qu'**une seule fois** (celle de `useAuth`), et que le FCP redescend sous 1.5 s.

## Impact attendu

- Disparition de ~12 requêtes réseau redondantes par page
- Gain ~1 à 2 s sur le temps perçu de chargement, surtout sur `/admin` et `/dashboard`
- Zéro changement fonctionnel — pure optimisation
