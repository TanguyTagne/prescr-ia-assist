# Pass "anti-vibecode" — tech & moderne, pas archaïque

On garde l'ADN tech/produit (sans-serif, dense, fonctionnel) mais on retire tous les tics qui crient "généré par IA". Inspiration : Linear, Vercel, Resend, Arc — sites tech faits par des humains qui ont une opinion.

Périmètre : Landing, Fonctionnalités, VsLgo, Aide, Auth, footer, légales.
Hors périmètre : Widget desktop, Dashboard, Admin.

---

## 1. Les "tells" à éliminer (audit concret du code actuel)

Repérés en lecture :

- **VsLgo** : 4 blobs `blur-3xl animate-pulse` + grille décorative en background → archétype "hero IA".
- **Landing** : badge pill `<Zap /> + texte` au-dessus du H1 → pattern shadcn par défaut.
- `pharmacy-gradient` (linear-gradient vert→teal) sur le CTA principal → dégradé "wow" générique.
- `glass-card` (`backdrop-blur-sm`) → glassmorphism daté.
- Tagline avec **"Copilote IA pour pharmaciens d'officine"** dans `index.html`, `Seo`, OG, Landing → à reformuler.
- "The future of…" / "Réinventez…" → à traquer dans `translations.ts`.
- Emojis ✨/⚡ dans labels et titres → retirés.
- Mention "Lovable AI", "Gemini Flash" en façade utilisateur (Fonctionnalités) → reformulé en bénéfice.
- Année copyright OK (`new Date().getFullYear()` déjà en place).
- Police Plus Jakarta Sans → c'est la police shadcn "starter" par excellence, on change.

## 2. Direction visuelle "tech humain"

Pas éditorial/serif. Sans-serif moderne, dense, opinions visuelles fortes.

**Tokens (`src/index.css`)**

- `--background` : `0 0% 100%` (blanc franc, pas de teinté vert)
- `--foreground` : `220 15% 12%` (presque noir, légère pointe froide)
- `--muted-foreground` : `220 10% 42%` (meilleur contraste)
- `--border` : `220 13% 91%` (filets nets)
- `--primary` : on garde `173 58% 32%` (vert officine = signal métier crédible)
- `--accent` : `220 14% 96%` (gris très clair, plus de vert pâle)
- `--radius` : `0.5rem` (descend de 0.75, moins "bubble shadcn")
- Mode sombre : ajusté en parallèle (`220 20% 8%` fond, vrais noirs profonds)

**Typographies** (chargées non-bloquant dans `index.html`)

- UI : **Geist Sans** (la police Vercel — sans-serif tech avec personnalité, pas Plus Jakarta/Inter par défaut)
- Mono pour chiffres/tags : **Geist Mono**
- `tailwind.config.ts` : `font-sans` → Geist, `font-mono` → Geist Mono.

**Suppressions visuelles**

- ❌ Tous les `blur-3xl animate-pulse` (VsLgo).
- ❌ Grille décorative SVG background (VsLgo).
- ❌ `pharmacy-gradient` sur les CTA → bouton plein vert mat. Le dégradé reste réservé à 1 seul élément hero subtil (gradient texte sur 2 mots du H1, type "from-foreground to-foreground/60").
- ❌ `glass-card`, `backdrop-blur-sm` → fond solide + border.
- ❌ Badge pill avec icône Zap en haut du hero.
- ❌ Hover `scale`/`translate` sur cartes → seulement bordure qui passe en `border-foreground/20`.

**Ajouts visuels avec opinion**

- Filets de séparation horizontaux fins (`border-t border-border`) entre sections au lieu de fonds alternés `bg-secondary/50`.
- Tags mono pour labels techniques ("v2.3", "OFFICINE", "TEMPS RÉEL") — petite typo monospace caps.
- Numérotation des sections en mono petit (`01 / 03`, `02 / 03`).
- Curseur métier : ligne fine verte 2px à gauche des blocs clés (citation, KPI), au lieu de carrés icônes en accent.
- Une vraie touche tech : un mini "status dot" pulsant vert dans la nav ("Disponible · v0.9 bêta") — signal humain, opérationnel.

## 3. Réécriture rédactionnelle (anti-IA)

Règles :

- Pas de "Copilote IA", pas de "intelligent", pas de "réinventer", pas de "future of".
- Phrases courtes, vocabulaire officinal concret.
- Bénéfice mesurable plutôt que techno.

Exemples de substitutions clés :

- "Copilote pharmacien intelligent au comptoir" → **"Le conseil associé, sans le chercher."**
- "Copilote IA pour pharmaciens d'officine" (meta/OG) → **"Asclion lit l'ordonnance ou les médicaments scannés et propose le conseil associé pertinent en moins de 3 secondes."**
- "Pipeline optimisé Gemini Flash via Lovable AI" (Fonctionnalités) → **"Réponse en moins de 3s."**
- Badge "✨ Zap — Lancement bêta" → **"v0.9 · pharmacies pilotes ouvertes"** (mono, sobre).
- Bullets emojis dans titres → retirés partout.
- Section "Comment ça marche" : titres concrets ("Vous scannez. On lit. On propose.") au lieu de "Step 1, Step 2, Step 3".

À modifier dans `src/i18n/translations.ts` (valeurs FR et EN, pas les clés) + `index.html` (title/desc/OG) + `Seo` defaults.

## 4. Fichiers modifiés

**Tokens & config**

- `src/index.css` — palette, radius, suppression des utilitaires `pharmacy-gradient`/`glass-card` (ou redéfinis en versions sobres).
- `tailwind.config.ts` — fontFamily Geist, keyframes inutiles retirés.
- `index.html` — chargement Geist + Geist Mono (preconnect + swap), retrait Plus Jakarta, title/description/OG réécrits.

**Pages**

- `src/pages/Landing.tsx` — nav avec status dot, hero sans badge pill, H1 avec gradient texte subtil sur 1 mot, CTA plein, section "comment ça marche" en colonnes filets + numérotation mono, suppression `pharmacy-gradient`.
- `src/pages/Fonctionnalites.tsx` — header non-sticky, cards remplacées par sections avec filet vert à gauche, icônes plus petites alignées au titre, reformulation copy techno.
- `src/pages/VsLgo.tsx` — **suppression complète** des blobs + grille décorative + dégradés bg. Background blanc. Tableau comparatif style produit (header sticky discret, lignes alternées gris très clair). Differentiators en liste numérotée mono.
- `src/pages/Aide.tsx` — FAQ format liste alignée gauche, pas de cards.
- `src/pages/Auth.tsx` — formulaire centré sans card, juste filets et focus ring vert.
- `src/pages/legal/*` (5 fichiers) — wrapper container étroit `max-w-2xl`, `prose` tailwind, suppression des `Card`.
- `src/components/SiteFooter.tsx` — filet top plus marqué, liens en `text-xs uppercase tracking-wide`, status dot version mini.

**Contenu**

- `src/i18n/translations.ts` — réécriture des entrées FR/EN listées section 3 (taglines, badges, CTA, descriptions de features). Aucune clé supprimée/renommée.
- `src/components/Seo.tsx` — pas de changement structurel, juste s'assurer que les valeurs viennent bien des traductions.

**Cleanup**

- Audit `rg "✨|⚡|🚀|💊"` dans `src/` → suppression.
- Audit `rg "Step \d|TODO|placeholder"` dans le JSX rendu utilisateur → suppression/réécriture.
- Audit imports `lucide-react` non utilisés sur les fichiers touchés.

## 5. Hors-scope explicite

- Aucun changement logique (auth, RLS, edge functions, hooks, analyzer).
- Pas de nouveau composant, pas de nouvelle dépendance npm.
- Pas de modification du Widget desktop, Dashboard, Admin, Quiz.
- Clés i18n inchangées (seules les **valeurs** FR/EN évoluent).
- Pas de refonte du composant `Button` shadcn — on l'utilise avec classes sobres.

## 6. Vérification finale

- Screenshots desktop (1200) + mobile (375) sur Landing, Fonctionnalités, VsLgo.
- `bunx vitest run` pour s'assurer que rien ne casse.
- Vérifier aucune couleur en dur (`text-white`, `bg-black`) dans les fichiers touchés.
- Re-scanner les pages avec les "tells" listés section 1 → 0 occurrence.

---

**Effort** : ~12 fichiers, 0 dep ajoutée, présentation + copy uniquement, zéro impact métier.