/**
 * Capacitor native bootstrap.
 * Safe no-op in the browser: every call is wrapped in `Capacitor.isNativePlatform()`.
 * Only runs when the app is loaded inside the iOS/Android shell.
 */
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";
import { App as CapApp } from "@capacitor/app";

export const initCapacitor = async () => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await StatusBar.setStyle({ style: Style.Light });
    if (Capacitor.getPlatform() === "android") {
      await StatusBar.setBackgroundColor({ color: "#0F766E" });
    }
  } catch (e) {
    console.warn("[capacitor] status bar setup failed", e);
  }

  try {
    await SplashScreen.hide({ fadeOutDuration: 250 });
  } catch (e) {
    console.warn("[capacitor] splash hide failed", e);
  }

  // Hardware back button on Android → browser-style history back, exit when at root.
  CapApp.addListener("backButton", ({ canGoBack }) => {
    if (canGoBack) window.history.back();
    else CapApp.exitApp();
  });
};

export const isNativeMobile = () =>
  typeof window !== "undefined" && Capacitor.isNativePlatform();
