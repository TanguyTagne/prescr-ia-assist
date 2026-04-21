

## Adaptation visuelle du widget Asclion par LGO

Objectif : le widget s'affiche **automatiquement à la position et taille optimale selon le LGO connecté** par la pharmacie, pour s'intégrer dans les zones vides de chaque interface (Winpharma, id./LGPI Pharmagest, Smart Rx, LEO, Pharmagest Crystal). Appliqué à la fois à la version Desktop Electron (overlay always-on-top) et au bouton flottant Web.

### Presets fixes par LGO (top 5)

Basés sur l'analyse des écrans comptoir/vente publics de chaque éditeur. Ces valeurs sont **codées en dur** comme demandé (pas d'ajustement pharmacie).

| LGO | Position | Taille | Zone visée |
|---|---|---|---|
| **Winpharma** | top-right | 320 × 200 px | Bandeau supérieur droit (zone infos secondaire) |
| **id. / LGPI** (Pharmagest) | bottom-right | 280 × 240 px | Coin inférieur sous la zone produits |
| **Smart Rx (NEV)** | top-left | 300 × 180 px | Bandeau supérieur gauche au-dessus du panier |
| **LEO Officine** | right side | 260 × 320 px | Colonne latérale droite (zone vide à côté du tactile) |
| **Pharmagest Crystal** | bottom-left | 300 × 200 px | Coin inférieur gauche (zone alertes) |
| **Autre / non configuré** | bottom-right (défaut) | 320 × 480 px | Bouton flottant classique actuel |

### Modifications de fichiers

**1. `src/lib/lgoPresets.ts`** *(nouveau)*
Module exportant :
- `type LgoType = "winpharma" | "lgpi" | "smart_rx" | "leo" | "pharmagest" | "autre"`
- `type WidgetPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right" | "right-center"`
- `interface LgoPreset { position: WidgetPosition; width: number; height: number; label: string; }`
- `LGO_PRESETS: Record<LgoType, LgoPreset>` avec les 6 presets ci-dessus
- `getPresetClasses(position)` → classes Tailwind pour `fixed`, ex: `top-4 right-4`, `bottom-4 left-4`, etc.

**2. `src/hooks/useLgoPreset.ts`** *(nouveau)*
Hook qui :
- Récupère `pharmacy_id` via `profiles` (auth user courant)
- Lit `pharmacy_lgo_config.lgo_type` depuis Supabase
- Retourne `{ preset: LgoPreset, lgoType: LgoType, loading: boolean }`
- Fallback sur preset `"autre"` si non configuré ou non connecté

**3. `src/components/Widget.tsx`** *(modifié)*
Dans le bloc `Widget` (lignes 264-321) :
- Importer `useLgoPreset()` 
- Remplacer les classes hardcodées du bouton flottant (`fixed bottom-4 right-4`) et de la modale (`fixed bottom-[4.5rem] right-4 w-[320px] max-h-[480px]`) par celles dérivées du preset
- Le bouton trigger garde sa position en bas-à-droite, **mais la modale ouverte** suit la position et taille du preset LGO
- Ajouter un petit badge texte `LGO Winpharma` (ou autre) en haut de la modale pour confirmer l'adaptation visuelle

**4. `electron/main.cjs`** *(à vérifier)*
La fenêtre Electron doit déjà être configurable. Si `forceOpen` est utilisé en mode desktop, on respecte le preset directement via les classes Tailwind appliquées (pas besoin de redimensionner la fenêtre Electron elle-même dans cette V1 — la fenêtre reste plein écran et le contenu se cale dans le coin du preset, laissant le reste transparent ne sera pas couvert ici).

### Détails techniques

```text
Flow:
useAuth() → profiles.pharmacy_id → pharmacy_lgo_config.lgo_type → LGO_PRESETS[lgo_type] → classes Tailwind
```

- Aucune migration DB requise (la colonne `lgo_type` existe déjà)
- Performance : le hook met le résultat en cache via state local (un seul fetch par session)
- Les valeurs en pixels sont exprimées en classes Tailwind arbitraires : `w-[320px] h-[200px]`
- Transition douce (`transition-all duration-300`) quand le preset change

### Hors scope (V1)

- Pas de drag/resize manuel par la pharmacie (sera proposé en V2 si besoin)
- Pas de sauvegarde de position custom dans `pharmacy_lgo_config`
- Pas de mesure réelle des zones vides via screenshot du LGO en cours (impossible techniquement sans accord éditeur)
- Les 5 presets sont des estimations raisonnables ; ajustables ultérieurement après retours pharmacies pilotes

