import type { CapacitorConfig } from "@capacitor/cli";

// Capacitor configuration for Asclion mobile (iOS + Android).
// The same React/Vite web codebase is repackaged as a native app.
// Hot-reload from the Lovable sandbox preview is enabled via `server.url`.
const config: CapacitorConfig = {
  appId: "app.lovable.83f602d3c8f0494dacb225d7d0b7a69c",
  appName: "Asclion",
  webDir: "dist",
  server: {
    url: "https://83f602d3-c8f0-494d-acb2-25d7d0b7a69c.lovableproject.com?forceHideBadge=true&desktop=1",
    cleartext: true,
  },
  ios: {
    contentInset: "always",
    limitsNavigationsToAppBoundDomains: false,
  },
  android: {
    allowMixedContent: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#0F766E",
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0F766E",
    },
  },
};

export default config;
