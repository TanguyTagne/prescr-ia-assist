/**
 * Build-time prerenderer.
 *
 * Runs after `vite build`:
 *   1. builds the SSR bundle (src/entry-prerender.tsx)
 *   2. renders every public route to static HTML
 *   3. writes dist/<route>/index.html with the head tags (title, description,
 *      canonical, hreflang, og, JSON-LD) inlined in the RAW HTML
 *   4. regenerates sitemap.xml from the same route list
 *
 * App routes (/auth, /dashboard, /admin, ...) are untouched: they keep the
 * SPA fallback on dist/index.html.
 */
import { build } from "vite";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DIST = path.join(ROOT, "dist");
const SSR_OUT = path.join(ROOT, ".prerender");
const SITE = "https://www.asclion.com";
/** Hard safety cap on generated files (publish limit is far higher). */
const MAX_PRERENDER_PAGES = 2000;

// Minimal browser globals so module-level browser code does not crash in Node.
function installDomShims() {
  const store = new Map();
  const storage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    get length() {
      return store.size;
    },
  };
  if (!globalThis.localStorage) globalThis.localStorage = storage;
  if (!globalThis.sessionStorage) globalThis.sessionStorage = storage;
  if (!globalThis.matchMedia)
    globalThis.matchMedia = () => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
    });
}

async function buildSsrBundle() {
  await build({
    logLevel: "warn",
    build: {
      ssr: path.join(ROOT, "src/entry-prerender.tsx"),
      outDir: SSR_OUT,
      emptyOutDir: true,
      minify: false,
      rollupOptions: { output: { format: "es", entryFileNames: "entry-prerender.mjs" } },
    },
  });
  return path.join(SSR_OUT, "entry-prerender.mjs");
}

/**
 * Remove the static head tags that Helmet re-emits per page, so the prerendered
 * HTML never ships two titles / descriptions / social tags.
 */
function stripDuplicateHead(template) {
  return template
    .replace(/\s*<title>[\s\S]*?<\/title>/i, "")
    .replace(/\s*<meta\s+name="description"[^>]*>/gi, "")
    .replace(/\s*<meta\s+property="og:(title|description|url|type|locale|image)"[^>]*>/gi, "")
    .replace(/\s*<meta\s+name="twitter:(title|description|card|image)"[^>]*>/gi, "")
    .replace(/\s*<link\s+rel="alternate"\s+hreflang[^>]*>/gi, "")
    .replace(
      /\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/gi,
      "",
    );
}

/** Inline guard shipped only in dist/index.html (the SPA fallback document). */
const FALLBACK_GUARD = `<script>(function(){try{var p=location.pathname.replace(/\\/+$/,"" )||"/";if(p==="/")return;var r=document.getElementById("root");if(r)r.innerHTML='<div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:hsl(150 20% 98%);"><video src="/__l5e/assets-v1/8e15643f-eea8-4d54-8404-effd458d3a04/asclion-loader.mp4" autoplay loop muted playsinline preload="auto" aria-label="Chargement en cours" style="width:min(14rem,55vw);height:auto;object-fit:contain;"></video></div>';var v=r&&r.querySelector("video");if(v){v.playbackRate=2;if(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches){v.pause();v.currentTime=0;}}document.title="Asclion";var s=document.querySelectorAll('head link[rel="canonical"],head link[rel="alternate"],head meta[property^="og:"],head meta[name^="twitter:"],head meta[name="description"],head script[type="application/ld+json"]');for(var i=0;i<s.length;i++)s[i].parentNode.removeChild(s[i]);}catch(e){}})();</script>`;

function outputPathFor(route) {
  const clean = route === "/" ? "/index" : route.replace(/\/$/, "");
  return path.join(DIST, `${clean === "/index" ? "/index" : clean + "/index"}.html`);
}

function buildSitemap(routes, blogLastmod) {
  const twins = new Set(routes);
  const entry = (loc, extra) => `  <url>\n    <loc>${loc}</loc>\n${extra}  </url>`;
  const urls = routes
    .filter((r) => !r.startsWith("/en/blog/") )
    .map((route) => {
      const loc = `${SITE}${route === "/" ? "/" : route}`;
      let extra = "";
      const isEn = route === "/en" || route.startsWith("/en/");
      const frPath = isEn ? (route === "/en" ? "/" : route.slice(3)) : route;
      const enPath = frPath === "/" ? "/en" : `/en${frPath}`;
      if (twins.has(frPath) && twins.has(enPath)) {
        extra +=
          `    <xhtml:link rel="alternate" hreflang="fr-FR" href="${SITE}${frPath}" />\n` +
          `    <xhtml:link rel="alternate" hreflang="en" href="${SITE}${enPath}" />\n` +
          `    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}${frPath}" />\n`;
      }
      const lastmod = blogLastmod.get(route);
      if (lastmod) extra += `    <lastmod>${lastmod}</lastmod>\n`;
      const priority =
        route === "/" ? "1.0" : route === "/en" ? "0.9" : route.startsWith("/legal/") || route.includes("cgu") ? "0.3" : "0.7";
      const changefreq = route.startsWith("/blog") ? "monthly" : route === "/" || route === "/en" ? "weekly" : "monthly";
      extra += `    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n`;
      return entry(loc, extra);
    });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join("\n")}\n</urlset>\n`;
}

async function main() {
  if (!existsSync(DIST)) {
    console.error("[prerender] dist/ not found — run vite build first.");
    process.exit(1);
  }
  installDomShims();

  const bundle = await buildSsrBundle();
  const mod = await import(`file://${bundle}`);
  const routes = mod.listRoutes();
  if (routes.length > MAX_PRERENDER_PAGES) {
    throw new Error(`[prerender] too many pages (${routes.length} > ${MAX_PRERENDER_PAGES})`);
  }

  const rawTemplate = await readFile(path.join(DIST, "index.html"), "utf8");
  const template = stripDuplicateHead(rawTemplate);

  const blogLastmod = new Map();
  for (const route of routes) {
    const { html, head, htmlAttributes } = mod.render(route);

    let page = template
      .replace(/<html[^>]*>/i, `<html ${htmlAttributes}>`)
      .replace("</head>", `  ${head}\n  </head>`)
      .replace(/<div id="root">[\s\S]*<\/div>/i, () => `<div id="root">${html}</div>`)
      // react-helmet-async serializes the React prop name; raw HTML needs the
      // lowercase attribute so crawlers read the alternates.
      .replace(/hrefLang=/g, "hreflang=");

    // dist/index.html doubles as the SPA fallback for every non-prerendered
    // route (/auth, /dashboard, /souscrire, ...). Wipe the marketing markup and
    // head tags before the app mounts so those routes never flash the homepage.
    if (route === "/") {
      page = page.replace(
        '<script type="module"',
        `${FALLBACK_GUARD}\n    <script type="module"`,
      );
    }

    const file = outputPathFor(route);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, page, "utf8");
  }

  // Blog lastmod straight from the markdown front-matter exposed by the bundle.
  if (typeof mod.listBlogLastmod === "function") {
    for (const [route, date] of mod.listBlogLastmod()) blogLastmod.set(route, date);
  }

  const sitemap = buildSitemap(routes, blogLastmod);
  await writeFile(path.join(DIST, "sitemap.xml"), sitemap, "utf8");
  await writeFile(path.join(ROOT, "public/sitemap.xml"), sitemap, "utf8");

  // RSS feed regenerated from the markdown front-matter.
  if (typeof mod.listBlogFeed === "function") {
    const esc = (s) =>
      String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const items = mod
      .listBlogFeed()
      .map(
        (p) =>
          `    <item>\n      <title>${esc(p.title)}</title>\n      <link>${SITE}/blog/${p.slug}</link>\n      <guid>${SITE}/blog/${p.slug}</guid>\n      <pubDate>${new Date(p.date).toUTCString()}</pubDate>\n      <description>${esc(p.description)}</description>\n    </item>`,
      )
      .join("\n");
    const rss = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n  <channel>\n    <title>Blog Asclion</title>\n    <link>${SITE}/blog</link>\n    <description>Conseil associé, panier moyen et développement du CA en officine.</description>\n    <language>fr-FR</language>\n    <atom:link href="${SITE}/blog/rss.xml" rel="self" type="application/rss+xml" />\n${items}\n  </channel>\n</rss>\n`;
    await mkdir(path.join(DIST, "blog"), { recursive: true });
    await writeFile(path.join(DIST, "blog/rss.xml"), rss, "utf8");
    await writeFile(path.join(ROOT, "public/blog/rss.xml"), rss, "utf8");
  }

  await rm(SSR_OUT, { recursive: true, force: true });
  console.log(`[prerender] ${routes.length} pages written + sitemap.xml`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
