import { useState } from "react";
import { Linkedin, Link as LinkIcon, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const ShareButtons = ({ url, title }: { url: string; title: string }) => {
  const [copied, setCopied] = useState(false);
  const linkedIn = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 my-6">
      <span className="text-xs text-muted-foreground mr-1">Partager :</span>
      <Button asChild variant="outline" size="sm" className="gap-1.5">
        <a href={linkedIn} target="_blank" rel="noopener noreferrer" aria-label={`Partager sur LinkedIn : ${title}`}>
          <Linkedin className="h-3.5 w-3.5" /> LinkedIn
        </a>
      </Button>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={copy}>
        {copied ? <Check className="h-3.5 w-3.5" /> : <LinkIcon className="h-3.5 w-3.5" />}
        {copied ? "Copié" : "Copier le lien"}
      </Button>
    </div>
  );
};

export default ShareButtons;
