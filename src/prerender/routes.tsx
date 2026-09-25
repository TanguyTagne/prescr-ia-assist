/**
 * Static route table used ONLY by the build-time prerenderer
 * (scripts/prerender.mjs). Pages are imported statically here so that
 * react-dom/server can render them synchronously (no React.lazy suspension).
 *
 * The runtime app keeps its own lazy route table in src/App.tsx — this file
 * must stay in sync for the PUBLIC (indexable) routes only.
 */
import type { ReactElement } from "react";
import Landing from "@/pages/Landing";
import VsLgo from "@/pages/VsLgo";
import Tarifs from "@/pages/Tarifs";
import Presentation from "@/pages/Presentation";
import Demo from "@/pages/Demo";
import CompatibiliteRobot from "@/pages/CompatibiliteRobot";
import Aide from "@/pages/Aide";
import Fonctionnalites from "@/pages/Fonctionnalites";
import Blog from "@/pages/Blog";
import BlogPost from "@/pages/BlogPost";
import Auteur from "@/pages/Auteur";
import APropos from "@/pages/APropos";
import MentionsLegales from "@/pages/legal/MentionsLegales";
import Confidentialite from "@/pages/legal/Confidentialite";
import CookiesPage from "@/pages/legal/Cookies";
import CGU from "@/pages/legal/CGU";
import CGV from "@/pages/legal/CGV";
import DPA from "@/pages/legal/DPA";
import PIA from "@/pages/legal/PIA";
import ConseilAssocieHub from "@/pages/ConseilAssocieHub";
import ConseilAssocieFiche from "@/pages/ConseilAssocieFiche";
import CompatibiliteLgo from "@/pages/CompatibiliteLgo";
import { getAllPosts } from "@/lib/blog";
import { CONSEILS, LGOS } from "@/lib/seoContent";

export interface PrerenderRoute {
  /** URL path to render, language prefix included. */
  path: string;
  /** Route pattern registered in <Routes> (differs for dynamic blog posts). */
  pattern: string;
  element: ReactElement;
}

/** Public pages that exist in both FR and EN. */
const BILINGUAL: Array<[string, ReactElement]> = [
  ["/", <Landing />],
  ["/vs-lgo", <VsLgo />],
  ["/tarifs", <Tarifs />],
  ["/presentation", <Presentation />],
  ["/demo", <Demo />],
  ["/compatibilite-robot", <CompatibiliteRobot />],
  ["/aide", <Aide />],
  ["/fonctionnalites", <Fonctionnalites />],
];

/** French-only public pages (legal + editorial entity pages). */
const FR_ONLY: Array<[string, ReactElement]> = [
  ["/blog", <Blog />],
  ["/conseil-associe", <ConseilAssocieHub />],
  ["/auteur/tanguy", <Auteur />],
  ["/a-propos", <APropos />],
  ["/mentions-legales", <MentionsLegales />],
  ["/confidentialite", <Confidentialite />],
  ["/cookies", <CookiesPage />],
  ["/cgu", <CGU />],
  ["/cgv", <CGV />],
  ["/legal/dpa", <DPA />],
  ["/legal/pia", <PIA />],
];

export function getPrerenderRoutes(): PrerenderRoute[] {
  const routes: PrerenderRoute[] = [];
  for (const [path, element] of BILINGUAL) {
    routes.push({ path, pattern: path, element });
    const en = path === "/" ? "/en" : `/en${path}`;
    routes.push({ path: en, pattern: en, element });
  }
  for (const [path, element] of FR_ONLY) routes.push({ path, pattern: path, element });
  for (const post of getAllPosts()) {
    routes.push({ path: `/blog/${post.slug}`, pattern: "/blog/:slug", element: <BlogPost /> });
  }
  return routes;
}
