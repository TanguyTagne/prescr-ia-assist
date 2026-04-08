

# Plan : Optimiser la latence d'analyse (objectif < 2s)

## Diagnostic des bottlenecks actuels

L'analyse actuelle suit un pipeline **séquentiel** avec 8 étapes bloquantes :

```text
Requête
  │
  ├─ Step 1: Appel IA (extraction médicaments)     ~2-4s  ← GROS BOTTLENECK
  ├─ Step 2: Clinical lookups (séquentiel/med)      ~0.5-1s
  ├─ Step 3: Legacy DB + APIs externes (RxNav/FDA)  ~1-3s  ← BOTTLENECK
  ├─ Step 3.5: Latent needs (fetch ALL rows)        ~0.2s
  ├─ Step 4: Protocols + ATC/class fallbacks         ~0.5s
  ├─ Step 5: Interactions OpenFDA (par paire)        ~0.5-2s ← BOTTLENECK
  ├─ Step 8: Sauvegarde historique/métriques         ~0.5-1s ← BLOQUANT
  │
  └─ Réponse                                    TOTAL: 5-8s
```

## Optimisations (5 axes)

### 1. Modèle IA plus rapide
- **OCR (image)** : remplacer `gemini-3.1-pro-preview` par `google/gemini-2.5-flash` — 3x plus rapide, multimodal, suffisant pour lire une ordonnance
- **Texte** : garder `google/gemini-3-flash-preview` (déjà rapide)
- Gain estimé : **~1.5-2s**

### 2. Paralléliser les lookups cliniques
- Les recherches DB par médicament (`clinicalLookup`) sont dans une boucle `for` séquentielle → les lancer en `Promise.all`
- Idem pour `findMedicationsInDB` (legacy) : boucle séquentielle → paralléliser
- Gain estimé : **~0.5-1s** (pour 3+ médicaments)

### 3. Paralléliser les appels API externes
- `rxnavGetATC` + `openFDAGetDrugInfo` sont déjà en `Promise.all` par med, mais les meds sont traités séquentiellement → paralléliser les meds entre eux
- Les appels `openFDAGetInteractions` en Step 5 (boucle imbriquée) → les lancer en `Promise.all`
- Gain estimé : **~1-2s**

### 4. Déplacer les écritures DB après la réponse
- Step 8 (analysis_history, recommendation_metrics, latent_need_metrics, basket_context) bloque la réponse pour ~0.5-1s d'écritures
- Utiliser le pattern fire-and-forget : envoyer la réponse HTTP **immédiatement**, puis écrire en arrière-plan
- Gain estimé : **~0.5-1s**

### 5. Pré-charger les données globales en parallèle avec l'IA
- Lancer les chargements de `protocole_pathologie`, `pathology_protocol`, `latent_needs` **en parallèle** avec l'appel IA (Step 1), au lieu d'attendre après
- Gain estimé : **~0.3s**

## Résultat attendu

```text
Requête
  │
  ├─ [PARALLÈLE] Step 1: IA (gemini-2.5-flash)  ~1-1.5s
  │              + Pré-chargement protocols/latent
  │
  ├─ [PARALLÈLE] Steps 2+3: Clinical + Legacy    ~0.3-0.5s
  │              lookups (tous meds en //​)
  │
  ├─ [PARALLÈLE] Steps 4+5: Fallbacks +          ~0.3-0.5s
  │              Interactions (en //​)
  │
  └─ Réponse HTTP                          TOTAL: ~1.5-2.5s
  │
  └─ [ARRIÈRE-PLAN] Step 8: Historique/métriques
```

## Fichier modifié
- `supabase/functions/analyze-prescription/index.ts` — restructuration du pipeline

