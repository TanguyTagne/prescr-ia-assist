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

  interface AsclionConfig {
    wwks2SourceId?: number;
    isAsclionPrincipal?: boolean;
    leoLogPath?: string;
    [k: string]: unknown;
  }

  interface WwksDetectCandidate { sourceId: number; ip?: string; path?: string }
  interface WwksDetectResult {
    sourceId: number | null;
    confidence: "high" | "medium" | "low";
    method: "ip" | "config" | "log" | null;
    candidates: {
      ip: WwksDetectCandidate | null;
      config: WwksDetectCandidate | null;
      log: WwksDetectCandidate | null;
    };
  }

  interface ElectronAPI {
    isDesktop: true;
    platform: string;
    notify: (payload: { title: string; body: string }) => Promise<boolean>;
    onNotificationClick: (callback: () => void) => () => void;
    onLgoDetected: (callback: (payload: { lgo: string }) => void) => () => void;
    onGlobalBarcode: (callback: (payload: { ean: string; at: number }) => void) => () => void;
    onRobotDispensed?: (
      callback: (payload: { cip: string; at: number; wwks2SourceId: number | null; messageId: string | null }) => void
    ) => () => void;
    autolaunch?: {
      status: () => Promise<unknown>;
      reinstall: () => Promise<any>;
      createAdminScript: () => Promise<{ ok: boolean; path: string | null; error: string | null }>;
      openAdminScript: () => Promise<{ ok: boolean; path: string | null; error: string | null; opened?: boolean }>;
    };
    system?: {
      isElevated: () => Promise<{ elevated: boolean; platform: string }>;
    };
    scanner?: ScannerAPI;
    config?: {
      get: () => Promise<AsclionConfig>;
      set: (patch: Partial<AsclionConfig>) => Promise<{ ok: boolean; config?: AsclionConfig; path?: string; error?: string }>;
    };
    leo?: {
      detectSource: () => Promise<WwksDetectResult>;
      readLogTail: (lines?: number) => Promise<{ ok: boolean; filePath?: string; lines: string[]; error?: string }>;
    };
  }

  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
