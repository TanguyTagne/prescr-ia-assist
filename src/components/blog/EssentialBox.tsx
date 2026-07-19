import { Sparkles } from "lucide-react";

const EssentialBox = ({ items }: { items: string[] }) => {
  if (!items?.length) return null;
  return (
    <aside className="rounded-xl border border-primary/20 bg-primary/5 p-5 my-6">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-primary uppercase tracking-wide m-0">L'essentiel</h2>
      </div>
      <ul className="list-disc pl-5 space-y-1.5 text-sm text-foreground/90 marker:text-primary/60">
        {items.map((it, i) => (<li key={i}>{it}</li>))}
      </ul>
    </aside>
  );
};

export default EssentialBox;
