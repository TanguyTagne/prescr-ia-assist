

## Plan déploiement — Vague combinée (ergonomie + production-ready)

Items retenus : **1** (onboarding), **2** (raccourcis personnalisables), **3** (skeleton + progression sans toast), **5** (page aide), **6** (notifications natives Electron), **7** (détection LGO auto), **8** (a11y/polish), **11** (SEO/OG), **12** (sitemap).

### 1. Onboarding 3 étapes (premier login)

- Migration : ajout colonne `onboarding_completed boolean default false` sur `profiles`
- Composant `OnboardingTour.tsx` (modale shadcn `Dialog`, non bloquante, skip possible)
- Étapes :
  1. **Connecter scanner** → bouton qui appelle `startWatching()` + démo audio
  2. **Choisir LGO** → réutilise `LgoPreviewPicker` + persist via `pharmacy_lgo_config`
  3. **Personnaliser raccourcis clavier** → ouvre directement la nouvelle section Réglages (item 2)
  4. (Bonus) Tester ordonnance exemple "Amoxicilline, Doliprane"
- Déclencheur : `useAuth` charge `onboarding_completed`, affiche si `false`. Bouton "Revoir le tour" dans Réglages.

### 2. Raccourcis clavier personnalisables

- Migration : table `user_shortcuts (user_id uuid pk, shortcuts jsonb default '{}')` + RLS user_id = auth.uid()
- Hook `useShortcuts()` : charge mapping JSON, valeurs par défaut (`Escape` reset, `Enter` analyse, `Ctrl+K` focus, `Ctrl+1/2/3` modes, `?` aide), enregistre listeners globaux
- Nouvelle section dans `Dashboard` (ou nouveau composant `ShortcutsSettings.tsx`) :
  - Liste des actions, capture clavier au clic ("Appuyez sur la combinaison…")
  - Validation anti-conflit + reset par défaut
- Légende discrète en pied de widget : "Échap · Entrée · Ctrl+K · ?"
- Modale `?` listant tous les raccourcis actuels

### 3. Skeleton loader + progression

- Composant `AnalysisSkeleton.tsx` reproduisant la structure (header med, 3 cartes recommandation grisées) via `Skeleton` shadcn
- Étapes textuelles dans `Widget.tsx` état `isLoading` : array `["Lecture ordonnance…", "Recherche clinique…", "Préparation suggestions…"]`, rotation toutes les 800ms via `setInterval`
- Pas de toast persistant (retiré du scope)

### 5. Page Aide `/aide`

- Route `/aide` publique, accessible sans login
- Sections `Accordion` shadcn : Scanner, LGO, Recommandations manquantes, Performance, Raccourcis clavier, Confidentialité, Contact
- Lien depuis `SiteFooter` + bouton `?` (icône `HelpCircle`) dans header widget → ouvre `/aide` dans nouvel onglet (web) ou modale (Electron)

### 6. Notifications natives Electron

- `electron/main.js` : ajout handler IPC `show-notification`, expose dans `preload.js` via `contextBridge`
- Dans `useScanQueue.ts` : à la réception d'un scan complété, si `window.electronAPI?.isDesktop` et `document.hidden`, appeler `window.electronAPI.notify({ title, body })`
- Click sur notification → `mainWindow.show()` + `focus()` + envoi event au renderer pour ouvrir le résultat

### 7. Détection LGO automatique (Electron)

- `electron/main.js` : au démarrage, exécuter `child_process.exec('tasklist')` (Windows uniquement)
- Mapping process → LGO :
  - `Winpharma.exe` / `WP*.exe` → `winpharma`
  - `LGPI*.exe` / `Pharmagest*.exe` → `lgpi` ou `pharmagest`
  - `SmartRx*.exe` → `smart_rx`
  - `LEO*.exe` → `leo`
- Envoi via IPC au renderer → si `pharmacy_lgo_config.lgo_type === 'autre'` ou non défini, proposer modale "Nous avons détecté Winpharma, configurer automatiquement ?" (Oui/Non)
- Persist dans `pharmacy_lgo_config` après acceptation
- Fallback silencieux si non-Windows ou aucun match

### 8. Polish a11y (WCAG AA)

- Audit contrastes dans `AnalysisResults.tsx`, `Widget.tsx`, `ScannerStatus.tsx` : remonter `text-[9px]/[10px]` à `text-xs` minimum sur fonds muted, ou renforcer couleurs (`text-muted-foreground` → `text-foreground/80`)
- Ajout `aria-label` sur tous boutons icône-only restants (audit `<button>` sans label)
- `focus-visible:ring-2 focus-visible:ring-primary` sur boutons custom
- CSS global `@media (prefers-reduced-motion: reduce)` désactivant `animate-*` et `transition-*` longs

### 11. Métadonnées SEO/OG

- `index.html` : compléter `<meta name="description">` français + `og:title`, `og:description`, `og:image` (1200×630), `og:url`, `twitter:card="summary_large_image"`
- `<link rel="canonical" href="https://asclion.com/">`
- Génération image OG : artefact PNG simple texte "Asclion — Copilote pharmacien" sur fond gradient pharmacy, déposé dans `/public/og-image.png`
- Hreflang `fr-FR`

### 12. Sitemap & robots

- `public/sitemap.xml` listant : `/`, `/vs-lgo`, `/aide`, `/cgu`, `/confidentialite`, `/mentions-legales`, `/cookies` (priorités 1.0 → 0.3, lastmod auto à la date du build)
- `public/robots.txt` (déjà existant) : vérifier qu'il référence bien `https://asclion.com/sitemap.xml`

### Détails techniques

| Aspect | Décision |
|---|---|
| Migrations DB | `profiles.onboarding_completed`, table `user_shortcuts` avec RLS |
| Stockage shortcuts | JSONB `{ "reset": "Escape", "analyze": "Enter", "focus": "Ctrl+K", ... }` |
| Détection LGO | `tasklist` Windows uniquement, fallback silencieux Mac/Linux |
| Notifications Electron | Native `Notification` API, fallback son existant maintenu |
| Skeleton | `@/components/ui/skeleton` (déjà présent) |
| Page `/aide` | Publique, lazy-loaded via React.lazy, ajoutée à `App.tsx` |
| OG image | PNG statique généré une fois, pas de génération dynamique |

### Hors scope cette vague

- Toast persistant > 4s (retiré)
- Page `/status` publique (reportée)
- Email bienvenue automatisé (reporté)
- Mode sombre / i18n / mobile native

### Fichiers impactés

**Créés** : `src/components/OnboardingTour.tsx`, `src/components/ShortcutsSettings.tsx`, `src/components/AnalysisSkeleton.tsx`, `src/hooks/useShortcuts.ts`, `src/pages/Aide.tsx`, `public/sitemap.xml`, `public/og-image.png`

**Modifiés** : `src/App.tsx` (route /aide + tour), `src/components/Widget.tsx` (skeleton, étapes, raccourcis, bouton aide), `src/hooks/useScanQueue.ts` (notif Electron), `src/hooks/useAuth.tsx` (onboarding_completed), `src/pages/Dashboard.tsx` (section raccourcis), `src/components/SiteFooter.tsx` (lien aide), `src/components/AnalysisResults.tsx` (a11y), `src/components/ScannerStatus.tsx` (a11y), `electron/main.js` (notif + détection LGO), `electron/preload.js` (expose API), `index.html` (meta SEO/OG), `src/index.css` (prefers-reduced-motion)

**SQL migrations** : 2 migrations (ajout colonne profiles + table user_shortcuts)

