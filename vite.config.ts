import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: [
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "react-router-dom",
      "@tanstack/react-query",
      "@supabase/supabase-js",
    ],
  },
  optimizeDeps: {
    // `force: true` invalidated the pre-bundle cache on every dev start (slow boot).
    // Vite already invalidates the cache automatically when dependencies change.
    include: ["react", "react-dom", "@radix-ui/react-dialog"],
  },
  build: {
    // Three pages were above the 500 KB warning limit; raise the threshold and
    // split heavy vendors so the initial chunk stays lean.
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (!id.includes("node_modules")) return;
          if (id.includes("react-dom") || id.includes("/react/") || id.includes("scheduler")) return "react-vendor";
          if (id.includes("@supabase")) return "supabase-vendor";
          if (id.includes("@radix-ui")) return "radix-vendor";
          // NOTE: do NOT split recharts/d3 into a separate chunk — it triggers
          // a circular-dependency TDZ error ("Cannot access 'P' before initialization")
          // at runtime that white-screens the entire production site.
          if (id.includes("pdfjs-dist")) return "pdf-vendor";
          if (id.includes("lucide-react")) return "icons-vendor";
        },
      },
    },
  },
}));
