import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Build identifier injected into the client bundle and into /version.json.
// Generated once per build so all bundled chunks AND the publicly-served
// version.json share the same value. Lovable/Vite re-runs the config on
// each build, so a module-level constant is sufficient.
const BUILD_ID = process.env.VITE_BUILD_ID || String(Date.now());

// Emits /version.json containing the current BUILD_ID. Two responsibilities:
//  - dev: serve it from a middleware so the version-check runs end-to-end in dev
//  - build: emit it as a static asset alongside index.html
function versionJsonPlugin(): Plugin {
  const payload = () => JSON.stringify({ version: BUILD_ID });
  return {
    name: "asclion-version-json",
    configureServer(server) {
      server.middlewares.use("/version.json", (_req, res) => {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-store");
        res.end(payload());
      });
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: payload(),
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  define: {
    // Exposed to the client as import.meta.env.VITE_BUILD_ID.
    "import.meta.env.VITE_BUILD_ID": JSON.stringify(BUILD_ID),
  },
  plugins: [
    react(),
    versionJsonPlugin(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
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
    include: ["react", "react-dom", "@radix-ui/react-dialog"],
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (!id.includes("node_modules")) return;
          if (id.includes("react-dom") || id.includes("/react/") || id.includes("scheduler")) return "react-vendor";
          if (id.includes("@supabase")) return "supabase-vendor";
          if (id.includes("@radix-ui")) return "radix-vendor";
          if (id.includes("pdfjs-dist")) return "pdf-vendor";
          if (id.includes("lucide-react")) return "icons-vendor";
        },
      },
    },
  },
}));
