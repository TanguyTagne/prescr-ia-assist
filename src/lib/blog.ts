import { Buffer } from "buffer";
if (typeof globalThis !== "undefined" && !(globalThis as any).Buffer) {
  (globalThis as any).Buffer = Buffer;
}
import matter from "gray-matter";

export interface BlogFAQItem { q: string; a: string }
export interface BlogRelatedLink { label: string; href: string }

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  updated?: string;
  category: string;
  author: string;
  image?: string;
  readingTime: number;
  essential?: string[];
  faq?: BlogFAQItem[];
  relatedLinks?: BlogRelatedLink[];
  relatedPosts?: string[];
  content: string;
}

export const BLOG_CATEGORIES = [
  "Développer son CA",
  "Conseil associé",
  "Outils & logiciels",
  "Gestion d'officine",
] as const;

// Eager-load every markdown file at build time.
const files = import.meta.glob("/src/content/blog/*.md", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

function estimateReadingTime(raw: string) {
  const words = raw.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 220));
}

function parseFile(raw: string): BlogPost | null {
  const parsed = matter(raw);
  const fm = parsed.data as Partial<BlogPost>;
  if (!fm.slug || !fm.title) return null;
  const dateStr = fm.date ? new Date(fm.date as unknown as string).toISOString() : new Date().toISOString();
  const updatedStr = fm.updated ? new Date(fm.updated as unknown as string).toISOString() : undefined;
  return {
    slug: fm.slug,
    title: fm.title,
    description: fm.description || "",
    date: dateStr,
    updated: updatedStr,
    category: fm.category || "Conseil associé",
    author: fm.author || "Tanguy Tubert",
    image: fm.image,
    readingTime: fm.readingTime || estimateReadingTime(parsed.content),
    essential: fm.essential,
    faq: fm.faq,
    relatedLinks: fm.relatedLinks,
    relatedPosts: fm.relatedPosts,
    content: parsed.content,
  };
}

let cache: BlogPost[] | null = null;

export function getAllPosts(): BlogPost[] {
  if (cache) return cache;
  const posts: BlogPost[] = [];
  for (const raw of Object.values(files)) {
    const post = parseFile(raw);
    if (post) posts.push(post);
  }
  posts.sort((a, b) => (a.date < b.date ? 1 : -1));
  cache = posts;
  return posts;
}

export function getPostBySlug(slug: string): BlogPost | undefined {
  return getAllPosts().find((p) => p.slug === slug);
}

export function getRelated(post: BlogPost): BlogPost[] {
  if (!post.relatedPosts?.length) {
    return getAllPosts().filter((p) => p.slug !== post.slug && p.category === post.category).slice(0, 3);
  }
  const all = getAllPosts();
  return post.relatedPosts
    .map((s) => all.find((p) => p.slug === s))
    .filter((p): p is BlogPost => !!p);
}

export function formatDate(iso: string, lang: "fr" | "en" = "fr") {
  return new Date(iso).toLocaleDateString(lang === "en" ? "en-US" : "fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
