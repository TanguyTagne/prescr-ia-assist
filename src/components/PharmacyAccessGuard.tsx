import { ShieldX } from "lucide-react";
import { usePharmacyAccessGuard } from "@/hooks/usePharmacyAccessGuard";

/**
 * Mounts the pharmacy access guard globally. When the pharmacy is suspended,
 * overlays a full-screen blocking message and prevents any further use.
 */
export function PharmacyAccessGuard({ children }: { children: React.ReactNode }) {
  const { blocked } = usePharmacyAccessGuard();

  if (blocked) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background p-6">
        <div className="max-w-md text-center space-y-4">
          <ShieldX className="h-16 w-16 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold">Accès Asclion suspendu</h1>
          <p className="text-sm text-muted-foreground">
            L'accès de votre pharmacie a été suspendu.
            Contactez Asclion pour rétablir votre compte.
          </p>
          <a
            href="mailto:contact@asclion.com"
            className="inline-block text-sm text-primary underline"
          >
            contact@asclion.com
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
