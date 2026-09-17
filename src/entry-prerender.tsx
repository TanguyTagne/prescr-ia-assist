/**
 * SSR entry used at build time by scripts/prerender.mjs.
 * Renders a public route to static HTML + head tags so every marketing and
 * blog URL is fully readable without JavaScript.
 */
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { Routes, Route } from "react-router-dom";
import { HelmetProvider, type FilledContext } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/i18n/I18nProvider";
import { getPrerenderRoutes } from "@/prerender/routes";
import { getAllPosts } from "@/lib/blog";

export interface RenderResult {
  html: string;
  head: string;
  htmlAttributes: string;
}

export function listRoutes(): string[] {
  return getPrerenderRoutes().map((r) => r.path);
}

/** [route, YYYY-MM-DD] pairs for blog posts, used for sitemap <lastmod>. */
export function listBlogLastmod(): Array<[string, string]> {
  return getAllPosts().map((p) => [
    `/blog/${p.slug}`,
    (p.updated || p.date).slice(0, 10),
  ]);
}

export function render(url: string): RenderResult {
  const routes = getPrerenderRoutes();
  const helmetContext = {} as FilledContext;
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });

  const html = renderToString(
    <HelmetProvider context={helmetContext}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <StaticRouter location={url}>
            <I18nProvider>
              <Routes>
                {routes.map((r) => (
                  <Route key={r.path} path={r.path} element={r.element} />
                ))}
              </Routes>
            </I18nProvider>
          </StaticRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </HelmetProvider>,
  );

  const { helmet } = helmetContext;
  const head = [
    helmet?.title?.toString(),
    helmet?.meta?.toString(),
    helmet?.link?.toString(),
    helmet?.script?.toString(),
  ]
    .filter(Boolean)
    .join("\n    ");

  return {
    html,
    head,
    htmlAttributes: helmet?.htmlAttributes?.toString() ?? 'lang="fr"',
  };
}
