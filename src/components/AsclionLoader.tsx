import { Loader2 } from "lucide-react";

type AsclionLoaderProps = {
  size?: "compact" | "section" | "page";
  label?: string;
  className?: string;
};

const iconSize = {
  compact: "h-5 w-5",
  section: "h-7 w-7",
  page: "h-8 w-8",
};

export default function AsclionLoader({
  size = "section",
  label = "Chargement en cours",
  className = "",
}: AsclionLoaderProps) {
  const spinner = (
    <Loader2 className={`${iconSize[size]} animate-spin text-primary`} aria-hidden="true" />
  );

  if (size === "page") {
    return (
      <div
        className={`flex min-h-[60vh] w-full items-center justify-center ${className}`}
        role="status"
        aria-live="polite"
        aria-label={label}
      >
        {spinner}
        <span className="sr-only">{label}</span>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-center ${className}`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      {spinner}
      <span className="sr-only">{label}</span>
    </div>
  );
}
