import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import "./index.css";
import { isAsclionDesktopRuntime } from "@/lib/runtime";

const SW_VERSION = "v5";
const isDesktopRuntime = isAsclionDesktopRuntime();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    // Disable SW in desktop + dev/preview to prevent stale bundles
    if (!import.meta.env.PROD || isDesktopRuntime) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));

      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
      return;
    }

    navigator.serviceWorker
      .register(`/sw.js?${SW_VERSION}`)
      .then((registration) => registration.update())
      .catch((err) => {
        console.log("SW registration failed:", err);
      });
  });
}

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
