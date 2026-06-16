# Asclion Mobile (iOS + Android via Capacitor)

The same React/Vite codebase that powers the web and Electron desktop apps
is repackaged into native iOS and Android apps using Capacitor. The mobile
shell forces the "desktop widget" runtime so the UI is **identical** to
the Windows desktop app (full-screen widget, no landing page), which works
great on tablets and phones.

## What's already wired in this repo

- `capacitor.config.ts` — appId `app.lovable.83f602d3c8f0494dacb225d7d0b7a69c`,
  appName `Asclion`, hot-reload from the Lovable preview URL.
- `src/lib/capacitor.ts` — native bootstrap (status bar color, splash hide,
  Android back-button handling).
- `src/lib/runtime.ts` — `Capacitor.isNativePlatform()` triggers the
  desktop-widget UI so the mobile app looks identical to the desktop app.
- `index.html` — `viewport-fit=cover` + iOS web-app meta tags.
- `src/index.css` — `env(safe-area-inset-*)` padding for notches/gesture bars.
- `@capacitor/core`, `@capacitor/ios`, `@capacitor/android`,
  `@capacitor/app`, `@capacitor/status-bar`, `@capacitor/splash-screen`
  installed.

## One-time setup on your local machine

You need a Mac with Xcode (for iOS) and/or Android Studio (for Android).

```bash
# 1. Export the project to your own GitHub repo via Lovable's "Export to GitHub"
#    button, then clone it locally.
git clone <your-repo>
cd <your-repo>

# 2. Install dependencies
npm install

# 3. Add the native platforms (creates ios/ and android/ folders)
npx cap add ios
npx cap add android

# 4. Update native platform deps
npx cap update ios
npx cap update android

# 5. Build the web bundle
npm run build

# 6. Sync web build into native projects
npx cap sync

# 7. Run on simulator / device
npx cap run ios        # opens Xcode / iOS simulator
npx cap run android    # opens Android Studio / emulator
```

## After each `git pull` from Lovable

```bash
npm install
npm run build
npx cap sync
```

## Hot-reload during development

`capacitor.config.ts` points `server.url` to the Lovable sandbox preview, so
the mobile app loads the live preview from your Lovable workspace — every
edit you make in Lovable shows up on the device instantly, no rebuild needed.

For a **production build** (submission to App Store / Play Store), remove
the `server.url` block before running `npx cap sync` so the app ships the
bundled `dist/` rather than fetching from the network.

## App icon & splash screen

Drop a 1024×1024 PNG into `resources/icon.png` and a 2732×2732 PNG into
`resources/splash.png`, then run:

```bash
npx @capacitor/assets generate
```

(Install `@capacitor/assets` first if needed: `npm i -D @capacitor/assets`.)

## Useful reading

- Capacitor docs: https://capacitorjs.com/docs
- Lovable blog post on Capacitor + Lovable:
  https://lovable.dev/blog/2025-mobile-development-lovable-capacitor
