import { useEffect, useRef, useCallback } from "react";
import { parseBarcodeToCip } from "@/lib/barcodeParser";

export interface BarcodeDebugEvent {
  type: "key" | "scan" | "rejected" | "dedup" | "reset";
  key?: string;
  code?: string;
  reason?: string;
  elapsedMs?: number;
  bufferLen?: number;
  at: number;
}

interface BarcodeScannerOptions {
  onScan: (code: string) => void;
  enabled?: boolean;
  minLength?: number;
  /** Max buffer length — kept large to accept GS1 DataMatrix payloads */
  maxLength?: number;
  maxKeyInterval?: number;
  /** Window (ms) during which an identical code is ignored (anti-rebond). 0 = disabled */
  dedupeWindowMs?: number;
  /** Optional debug listener — fires for every keystroke and decision */
  onDebug?: (event: BarcodeDebugEvent) => void;
}

/**
 * Detects HID barcode scanner input (USB/Bluetooth douchette).
 *
 * Supports:
 * - EAN-13 / CIP-13 (13 digits + Enter)
 * - CIP-7 ancien (7 digits + Enter)
 * - GS1 DataMatrix 2D : long payload with AI `01` + GTIN-14 → extracted to CIP-13
 * - AZERTY/QWERTY layouts (we read e.key, so digits work regardless of Shift)
 * - Numpad without NumLock fallback via e.code
 */
export function useBarcodeScanner({
  onScan,
  enabled = true,
  minLength = 7,
  maxLength = 60,
  maxKeyInterval = 80,
  dedupeWindowMs = 800,
  onDebug,
}: BarcodeScannerOptions) {
  const bufferRef = useRef("");
  const lastKeyTimeRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScanRef = useRef<{ code: string; at: number } | null>(null);
  const onDebugRef = useRef(onDebug);
  onDebugRef.current = onDebug;

  const emit = useCallback((event: BarcodeDebugEvent) => {
    onDebugRef.current?.(event);
  }, []);

  const resetBuffer = useCallback(() => {
    if (bufferRef.current.length > 0) {
      emit({ type: "reset", bufferLen: bufferRef.current.length, at: Date.now() });
    }
    bufferRef.current = "";
  }, [emit]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const now = Date.now();
      const elapsed = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      emit({ type: "key", key: e.key, elapsedMs: elapsed, bufferLen: bufferRef.current.length, at: now });

      if (e.key === "Enter" || e.key === "Tab") {
        const raw = bufferRef.current;
        if (raw.length >= minLength) {
          const parsed = parseBarcodeToCip(raw);
          if (parsed) {
            if (
              dedupeWindowMs > 0 &&
              lastScanRef.current &&
              lastScanRef.current.code === parsed &&
              now - lastScanRef.current.at < dedupeWindowMs
            ) {
              emit({ type: "dedup", code: parsed, elapsedMs: now - lastScanRef.current.at, at: now });
              e.preventDefault();
              e.stopPropagation();
              resetBuffer();
              return;
            }
            e.preventDefault();
            e.stopPropagation();
            lastScanRef.current = { code: parsed, at: now };
            emit({ type: "scan", code: parsed, at: now });
            onScan(parsed);
          } else {
            emit({ type: "rejected", code: raw, reason: `cannot parse to CIP (len=${raw.length})`, at: now });
          }
        } else if (raw.length > 0) {
          emit({ type: "rejected", code: raw, reason: `length=${raw.length} < min=${minLength}`, at: now });
        }
        resetBuffer();
        return;
      }

      // Accept digits AND GS1 punctuation (parens, GS char) AND letters (for LOT/AI codes in DataMatrix)
      const isAccepted = e.key.length === 1 && /[0-9A-Za-z()\x1d]/.test(e.key);
      // Numpad fallback when NumLock off
      const numpadDigit =
        !isAccepted && /^Numpad[0-9]$/.test(e.code) ? e.code.slice(-1) : null;

      const charToAdd = isAccepted ? e.key : numpadDigit;

      if (charToAdd) {
        if (bufferRef.current.length === 0 || elapsed < maxKeyInterval) {
          if (bufferRef.current.length < maxLength) {
            bufferRef.current += charToAdd;
          }
        } else {
          bufferRef.current = charToAdd;
        }
      } else if (bufferRef.current.length > 0 && e.key.length === 1) {
        resetBuffer();
      }

      timeoutRef.current = setTimeout(resetBuffer, 400);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [enabled, onScan, minLength, maxLength, maxKeyInterval, dedupeWindowMs, resetBuffer, emit]);
}
