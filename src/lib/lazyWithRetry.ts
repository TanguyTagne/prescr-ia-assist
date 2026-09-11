import { createElement, lazy, type ComponentType } from "react";
import { purgeClientCaches } from "@/lib/versionCheck";

/** Écran de secours si le chargement d'une page échoue définitivement. */
function StaleBundleFallback() {
  return createElement(
    "div",
    {
      style: {
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "16px",
        padding: "24px",
        textAlign: "center",
        fontFamily: "system-ui, sans-serif",
      },
    },
    createElement("p", { style: { fontSize: "15px", opacity: 0.8 } },
      "Une nouvelle version d'Asclion est disponible."),
    createElement(
      "button",
      {
        style: {
          padding: "10px 18px",
          borderRadius: "8px",
          border: "1px solid currentColor",
          background: "transparent",
          cursor: "pointer",
          font: "inherit",
        },
        onClick: async () => {
          await purgeClientCaches();
          const url = new URL(window.location.href);
          url.searchParams.set("__asclion_reload", String(Date.now()));
          window.location.replace(url.toString());
        },
      },
      "Recharger",
    ),
  );
}

/**
 * React.lazy résistant aux manifestes Vite périmés (chunk hash disparu après
 * un nouveau déploiement).
 * 1er échec : nouvelle tentative. 2e échec : purge des caches + rechargement.
 * Si un rechargement vient déjà d'avoir lieu (boucle), on affiche un écran de
 * secours avec un bouton plutôt qu'une page blanche.
 */
export const lazyWithRetry = <T extends ComponentType<never>>(
  factory: () => Promise<{ default: T }>
) =>
  lazy(() =>
    factory().catch(async (err: unknown) => {
      console.warn("Dynamic import failed, retrying...", err);
      await new Promise((r) => setTimeout(r, 500));
      return factory().catch(async (err2: unknown) => {
        console.error("Dynamic import failed twice, purging caches and reloading...", err2);
        const key = "__chunk_reload_at";
        let last = 0;
        try {
          last = Number(sessionStorage.getItem(key) || 0);
        } catch {
          /* storage indisponible */
        }
        if (Date.now() - last > 20_000) {
          try {
            sessionStorage.setItem(key, String(Date.now()));
          } catch {
            /* storage indisponible */
          }
          await purgeClientCaches();
          const url = new URL(window.location.href);
          url.searchParams.set("__asclion_reload", String(Date.now()));
          window.location.replace(url.toString());
          // Laisse le temps au navigateur de naviguer avant de rendre quoi que ce soit.
          await new Promise((r) => setTimeout(r, 5_000));
        }
        // Jamais de page blanche : on rend un écran de secours actionnable.
        return { default: StaleBundleFallback as unknown as T };
      });
    })
  );

export default lazyWithRetry;
