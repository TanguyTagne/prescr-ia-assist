/// <reference types="vite/client" />

interface ElectronAPI {
  isDesktop: true;
  platform: string;
  notify: (payload: { title: string; body: string }) => Promise<boolean>;
  onNotificationClick: (callback: () => void) => () => void;
  onLgoDetected: (callback: (payload: { lgo: string }) => void) => () => void;
  onGlobalBarcode: (callback: (payload: { ean: string; at: number }) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
