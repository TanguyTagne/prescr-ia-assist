import { useMemo } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import { ArrowLeft, Calendar, Clock, RefreshCw, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import SiteFooter from "@/components/SiteFooter";
import Seo from "@/components/Seo";
import TableOfContents from "@/components/blog/TableOfContents";
import EssentialBox from "@/components/blog/EssentialBox";
import AuthorBio from "@/components/blog/AuthorBio";
import BlogFAQ from "@/components/blog/BlogFAQ";
import ShareButtons from "@/components/blog/ShareButtons";
import BlogCTA from "@/components/blog/BlogCTA";
import PostCard from "@/components/blog/PostCard";
import { useI18n } from "@/i18n/I18nProvider";
import { formatDate, getPostBySlug, getRelated } from "@/lib/blog";

const SITE = "https://www.asclion.com";

const BlogPost = () => {
  const { slug = "" } = useParams();
  const { lp, lang } = useI18n();
  const post = useMemo(() => getPostBySlug(slug), [slug]);

  if (!post) return <Navigate to={lp("/blog")} replace />;

  const related = getRelated(post);
  const url = `${SITE}${lp(`/blog/${post.slug}`)}`;

  const midpoint = Math.max(1, Math.floor(post.content.split("\n## ").length / 2));
  const parts = post.content.split(/\n(?=## )/);
  const beforeCta = parts.slice(0, midpoint).join("\n");
  const afterCta = parts.slice(midpoint).join("\n");

  const articleLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.updated || post.date,
    author: { "@type": "Person", name: post.author },
    publisher: {
      "@type": "Organization",
      name: "Asclion",
      logo: { "@type": "ImageObject", url: `${SITE}/icon-512.png` },
    },
    mainEntityOfPage: url,
  };
  if (post.image) articleLd.image = post.image.startsWith("http") ? post.image : `${SITE}${post.image}`;

  const jsonLd: Record<string, unknown>[] = [articleLd];
  if (post.faq?.length) {
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: post.faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    });
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Seo
        title={`${post.title} | Asclion`}
        description={post.description}
        path={`/blog/${post.slug}`}
        ogType="article"
        ogImage={post.image ? (post.image.startsWith("http") ? post.image : `${SITE}${post.image}`) : undefined}
        jsonLd={jsonLd}
      />
      <header className="pharmacy-gradient px-4 py-4">
        <div className="container max-w-3xl mx-auto flex items-center gap-3">
          <Link to={lp("/blog")}>
            <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10" aria-label="Retour au blog">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <span className="text-primary-foreground font-semibold tracking-tight">Blog Asclion</span>
        </div>
      </header>

      <main className="container max-w-3xl mx-auto px-4 py-8 flex-1">
        <article>
          <div className="mb-4">
            <span className="inline-flex items-center rounded-full bg-primary/10 text-primary text-xs font-medium px-2.5 py-1">
              {post.category}
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight mb-4">{post.title}</h1>
          <p className="text-lg text-muted-foreground mb-5">{post.description}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mb-6">
            <span className="inline-flex items-center gap-1"><User className="h-3 w-3" />{post.author}</span>
            <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />Publié le {formatDate(post.date, lang)}</span>
            {post.updated && post.updated !== post.date && (
              <span className="inline-flex items-center gap-1"><RefreshCw className="h-3 w-3" />Mis à jour le {formatDate(post.updated, lang)}</span>
            )}
            <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{post.readingTime} min de lecture</span>
          </div>

          {post.image && (
            <img
              src={post.image}
              alt={post.title}
              width={1200}
              height={630}
              loading="eager"
              decoding="async"
              className="w-full h-auto rounded-xl border border-border mb-6"
            />
          )}

          {post.essential?.length ? <EssentialBox items={post.essential} /> : null}

          <TableOfContents markdown={post.content} />

          <div className="prose prose-sm sm:prose-base max-w-none prose-headings:scroll-mt-20 prose-headings:tracking-tight prose-a:text-primary prose-strong:text-foreground prose-code:text-primary">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug, [rehypeAutolinkHeadings, { behavior: "wrap" }]]}>
              {beforeCta}
            </ReactMarkdown>
            <BlogCTA />
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug, [rehypeAutolinkHeadings, { behavior: "wrap" }]]}>
              {afterCta}
            </ReactMarkdown>
          </div>

          {post.relatedLinks?.length ? (
            <section className="my-8">
              <h2 className="text-lg font-semibold mb-3">Pour aller plus loin</h2>
              <ul className="space-y-1.5 text-sm">
                {post.relatedLinks.map((l) => (
                  <li key={l.href}>
                    <Link to={lp(l.href)} className="text-primary hover:underline">→ {l.label}</Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <BlogCTA variant="banner" />

          {post.faq?.length ? <BlogFAQ items={post.faq} /> : null}

          <ShareButtons url={url} title={post.title} />

          <AuthorBio author={post.author} />

          {related.length > 0 && (
            <section className="mt-12">
              <h2 className="text-xl font-bold mb-4">À lire aussi</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {related.map((p) => (<PostCard key={p.slug} post={p} />))}
              </div>
            </section>
          )}
        </article>
      </main>

      <SiteFooter />
    </div>
  );
};

export default BlogPost;
