import { useMemo } from "react";

interface Heading { id: string; text: string }

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

const TableOfContents = ({ markdown }: { markdown: string }) => {
  const headings = useMemo<Heading[]>(() => {
    const out: Heading[] = [];
    for (const line of markdown.split("\n")) {
      const m = /^##\s+(.+?)\s*$/.exec(line);
      if (m) {
        const text = m[1].trim();
        out.push({ id: slugify(text), text });
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
