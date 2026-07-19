import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { BlogFAQItem } from "@/lib/blog";

const BlogFAQ = ({ items }: { items: BlogFAQItem[] }) => {
  if (!items?.length) return null;
  return (
    <section className="my-8">
      <h2 className="text-xl font-bold mb-4">Questions fréquentes</h2>
      <Accordion type="single" collapsible className="space-y-2">
        {items.map((f, i) => (
          <AccordionItem key={i} value={`faq-${i}`} className="border border-border rounded-lg px-4">
            <AccordionTrigger className="text-sm font-semibold text-left">{f.q}</AccordionTrigger>
            <AccordionContent className="text-sm text-foreground/80 leading-relaxed">{f.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
};

export default BlogFAQ;
