/// <reference types="vite/client" />

declare global {
  interface HidDeviceInfo {
    path: string;
    vendorId: number;
    productId: number;
    vendorIdHex: string;
    productIdHex: string;
    manufacturer: string | null;
    product: string | null;
    usagePage?: number;
    usage?: number;
    interface?: number;
    likelyScanner: boolean;
    bound: boolean;
  }

  interface ScannerStatus {
    mode: "hid-direct" | "uiohook" | "none";
    hidLoaded: boolean;
    hidLoadError: string | null;
    uiohookLoaded: boolean;
    uiohookLoadError: string | null;
    uiohookStarted: boolean;
    bound: {
      vendorId: number;
      productId: number;
      path: string;
      product: string | null;
      manufacturer: string | null;
    } | null;
    lastReportAt: number | null;
    lastEnterAt: number | null;
    lastError: string | null;
    bufferLen: number;
  }

  interface ScannerAPI {
    list: () => Promise<HidDeviceInfo[]>;
    status: () => Promise<ScannerStatus>;
    bind: (path: string) => Promise<{ ok: boolean; error?: string; bound?: ScannerStatus["bound"] }>;
    unbind: () => Promise<{ ok: boolean }>;
    testCapture: (ms: number) => Promise<{ reports: { at: number; bytes: number[] }[]; durationMs: number; count: number }>;
    reload: () => Promise<ScannerStatus>;
  }

  interface ElectronAPI {
    isDesktop: true;
    platform: string;
    notify: (payload: { title: string; body: string }) => Promise<boolean>;
    onNotificationClick: (callback: () => void) => () => void;
    onLgoDetected: (callback: (payload: { lgo: string }) => void) => () => void;
    onGlobalBarcode: (callback: (payload: { ean: string; at: number }) => void) => () => void;
    autolaunch?: {
      status: () => Promise<unknown>;
      reinstall: () => Promise<any>;
      createAdminScript: () => Promise<{ ok: boolean; path: string | null; error: string | null }>;
    };
    system?: {
      isElevated: () => Promise<{ elevated: boolean; platform: string }>;
    };
    scanner?: ScannerAPI;
  }

  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
