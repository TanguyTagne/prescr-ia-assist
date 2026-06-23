export const SCANNER = {
  // Dedup window: prevents double-fire when keyboard path + IPC path both trigger
  DEDUP_WINDOW_MS: 1000,

  // localStorage keys
  STORAGE_REGISTER_ID:      "asclion_register_id",
  STORAGE_SCANNER_DETECTED: "asclion_scanner_detected",

  // DOM CustomEvent dispatched by useGlobalBarcodeBridge
  DOM_EVENT: "asclion:global-barcode",

  // analysis_history source tags
  SOURCE_HID:        "hid_scan",
  SOURCE_BARCODE_HID: "barcode_hid",
} as const;
