## Blog SEO-first sur /blog

### 1. Stockage des articles

Markdown avec frontmatter, importés statiquement via Vite (`import.meta.glob`) — pas de backend, pas de latence, build-time SEO garanti.

```
src/content/blog/
  2026-07-15-augmenter-panier-moyen-officine.md
  2026-07-20-conseil-associe-antibiotique.md
  ...
```

Frontmatter type :
```yaml
---
title: "Comment augmenter son panier moyen en officine"
slug: "augmenter-panier-moyen-officine"
description: "3 leviers concrets..."
date: 2026-07-15
updated: 2026-07-18
category: "Développer son CA"
author: "Tanguy Tubert"
image: "/blog/panier-moyen.webp"
readingTime: 6
faq:
  - q: "Quel est le panier moyen en officine ?"
    a: "Environ 18-22€..."
relatedLinks:
  - { label: "Voir les fonctionnalités", href: "/fonctionnalites" }
  - { label: "Asclion vs LGO", href: "/vs-lgo" }
relatedPosts: ["conseil-associe-antibiotique"]
---
```

### 2. Dépendances

- `react-markdown` + `remark-gfm` + `rehype-slug` + `rehype-autolink-headings` (rendu + ancres H2/H3 pour la TOC)
- `gray-matter` (parsing frontmatter)

### 3. Nouveaux fichiers

- `src/lib/blog.ts` : charge tous les `.md` via `import.meta.glob('...', { as: 'raw', eager: true })`, parse le frontmatter, expose `getAllPosts()`, `getPostBySlug()`, `getCategories()`.
- `src/pages/Blog.tsx` : route `/blog`, liste des articles (cartes avec image WebP `loading="lazy"` + `width/height`, titre H2, extrait, date, temps de lecture, badge catégorie). Filtres par catégorie.
- `src/pages/BlogPost.tsx` : route `/blog/:slug`, template article complet (voir section 4).
- `src/components/blog/PostCard.tsx`
- `src/components/blog/TableOfContents.tsx` (extrait les H2 du markdown, ancres cliquables)
- `src/components/blog/EssentialBox.tsx` (encadré "L'essentiel" — puces générées depuis frontmatter `essential: string[]`)
- `src/components/blog/AuthorBio.tsx` (Tanguy, fondateur d'Asclion)
- `src/components/blog/BlogFAQ.tsx` (rendu FAQ + JSON-LD)
- `src/components/blog/ShareButtons.tsx` (LinkedIn + copie de lien)
- `src/components/blog/BlogCTA.tsx` (bandeau discret vers /fonctionnalites)
- `scripts/generate-blog-sitemap.ts` : régénère `public/sitemap.xml` avec les articles + met à jour la section `## Blog` de `public/llms.txt`. Hook `predev`/`prebuild` dans `package.json`.
- `scripts/generate-rss.ts` : produit `public/blog/rss.xml`, hook identique.
- 3 articles seed pour éviter une page /blog vide.

### 4. Template article (SEO/E-E-A-T)

Chaque `/blog/:slug` rend :

1. `<Seo>` : title = `${post.title} | Asclion`, description = frontmatter, canonical propre via le composant existant, `ogType="article"`, `ogImage` si fourni, JSON-LD `Article` (headline, datePublished, dateModified, author, publisher Organization, image).
2. H1 unique = `post.title`, hiérarchie H2/H3 issue du markdown (aucun autre H1 dans la page).
3. Métadonnées visibles : catégorie, date publiée, "Mis à jour le …", temps de lecture, auteur.
4. **Encart "L'essentiel"** en haut (3-4 puces depuis `essential` frontmatter).
5. **Table des matières** générée depuis les H2 (via `rehype-slug`) avec liens d'ancre.
6. Corps markdown rendu par `react-markdown` (styles Tailwind `prose` cohérents avec le design).
7. **CTA milieu** (injecté après ~50% des H2) + **CTA fin** vers `/fonctionnalites`.
8. **Liens internes** : bloc "À lire aussi" (`relatedPosts` + `relatedLinks`).
9. **Encart auteur** en fin (Tanguy, fondateur — expertise pharmacie/IA).
10. **FAQ** si présente, avec JSON-LD `FAQPage`.
11. **Partage** : LinkedIn + copier le lien.

### 5. Intégration site

- `src/App.tsx` : routes `/blog` et `/blog/:slug` (+ variantes `/en/blog` cohérentes avec le pattern i18n existant, contenu FR pour l'instant).
- Navigation : ajout de "Blog" dans le header (via `NavLink`) et dans `SiteFooter.tsx`.
- `public/sitemap.xml` : entrées générées automatiquement (changefreq `monthly`, priority `0.7`).
- `public/llms.txt` : section `## Blog` régénérée avec la liste des articles.
- `public/blog/rss.xml` : flux RSS 2.0 (titre, lien, description, pubDate).

### 6. Page index /blog

- `<Seo>` title = "Blog Asclion — Conseil associé, panier moyen et CA de votre officine"
- H1 = même wording
- Grille responsive de `PostCard`, filtres par catégorie (4 catégories fournies)
- Lien vers `/blog/rss.xml`

### 7. Performance

- Images en WebP dans `public/blog/`, `loading="lazy"`, `decoding="async"`, `width`/`height` explicites → zéro CLS.
- Cartes préchargent l'image du premier article en `fetchpriority="high"`.
- Markdown parsé au build (frontmatter) via `gray-matter` en top-level, rendu au runtime — pas d'appel réseau.

### Résumé technique

Blog 100 % statique (markdown + Vite glob), rendu React côté client avec metadata dynamique via le composant `<Seo>` existant, sitemap/llms.txt/RSS régénérés à chaque build. Ne modifie ni le design system, ni les composants existants hors nav/footer.
