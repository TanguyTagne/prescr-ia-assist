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
    leoClientLogPath?: string;
    [k: string]: unknown;
  }

  interface LeoClientLogCheck {
    exists: boolean;
    path: string;
    lastModified: string | Date | null;
    size?: number;
  }

  interface LeoLastDetection {
    cip13: string | null;
    timestamp: number | null;
  }

  interface LogScanCandidate {
    path: string;
    sizeBefore: number;
    sizeAfter: number;
    sizeDelta: number;
    mtimeMs: number;
    cipMatches: string[];
    frCipMatches: string[];
    snippet: string;
    score: number;
  }

  interface LogScanResult {
    phase: "done";
    reason: string;
    fileCount: number;
    rootCount: number;
    roots: string[];
    candidates: LogScanCandidate[];
    candidatesWithCip: number;
  }

  type LogScanEvent =
    | { phase: "discover" }
    | { phase: "ready"; deadlineMs: number; fileCount: number; rootCount: number }
    | LogScanResult;

  interface ElectronAPI {
    isDesktop: true;
    platform: string;
    notify: (payload: { title: string; body: string }) => Promise<boolean>;
    onNotificationClick: (callback: () => void) => () => void;
    onLgoDetected: (callback: (payload: { lgo: string }) => void) => () => void;
    onGlobalBarcode: (callback: (payload: { ean: string; at: number }) => void) => () => void;
    onRobotDispensed?: (
      callback: (payload: { cip13: string; source: string; timestamp: number }) => void
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
      checkClientLog: () => Promise<LeoClientLogCheck>;
      setClientLogPath: (path: string) => Promise<{ ok: boolean; error?: string; path?: string }>;
      getLastDetection: () => Promise<LeoLastDetection>;
      scanStart: (durationMs?: number, extraRoots?: string[]) => Promise<{
        ok: boolean; error?: string; deadlineMs?: number; fileCount?: number; rootCount?: number;
      }>;
      scanStop: () => Promise<{ ok: boolean; error?: string; result?: LogScanResult | null }>;
      scanStatus: () => Promise<{ running: boolean; startedAt?: number; deadlineMs?: number; fileCount?: number; rootCount?: number; error?: string }>;
      onScanEvent: (cb: (payload: LogScanEvent) => void) => () => void;
    };
  }

  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
