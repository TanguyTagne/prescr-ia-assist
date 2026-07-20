import { useMemo } from "react";
import GithubSlugger from "github-slugger";

interface Heading { id: string; text: string }

const TableOfContents = ({ markdown }: { markdown: string }) => {
  const headings = useMemo<Heading[]>(() => {
    // Use the same slugger as rehype-slug so anchors match heading ids
    // (github-slugger preserves accented Latin letters: é, è, à, ê…).
    const slugger = new GithubSlugger();
    const out: Heading[] = [];
    let inFence = false;
    for (const line of markdown.split("\n")) {
      if (/^```/.test(line)) { inFence = !inFence; continue; }
      if (inFence) continue;
      const m = /^##\s+(.+?)\s*$/.exec(line);
      if (m) {
        const text = m[1].trim();
        out.push({ id: slugger.slug(text), text });
      }
    }
    return out;
  }, [markdown]);

  if (headings.length < 2) return null;

  return (
    <nav aria-label="Sommaire" className="rounded-xl border border-border bg-muted/30 p-4 my-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Sommaire</p>
      <ol className="space-y-1.5 text-sm">
        {headings.map((h, i) => (
          <li key={h.id}>
            <a href={`#${h.id}`} className="text-foreground/80 hover:text-primary transition-colors">
              {i + 1}. {h.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default TableOfContents;
