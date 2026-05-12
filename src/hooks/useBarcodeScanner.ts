import { useEffect, useRef, useCallback } from "react";

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
  maxLength?: number;
  maxKeyInterval?: number;
  /** Window (ms) during which an identical code is ignored (anti-rebond). 0 = disabled */
  dedupeWindowMs?: number;
  /** Optional debug listener — fires for every keystroke and decision */
  onDebug?: (event: BarcodeDebugEvent) => void;
}

/**
 * Detects HID barcode scanner input (USB/Bluetooth douchette).
 * Scanners emulate keyboard: they type digits very fast (<60ms) then press Enter.
 * Human typing is much slower, so we distinguish by keystroke speed.
 *
 * Robustness:
 * - Dedup window prevents the same EAN being fired twice (some scanners double-trigger)
 * - Optional debug callback for the Hardware Diagnostic page
 */
export function useBarcodeScanner({
  onScan,
  enabled = true,
  minLength = 7,
  maxLength = 13,
  maxKeyInterval = 60,
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

      // Clear any pending reset
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      emit({ type: "key", key: e.key, elapsedMs: elapsed, bufferLen: bufferRef.current.length, at: now });

      if (e.key === "Enter" || e.key === "Tab") {
        const code = bufferRef.current;
        if (
          code.length >= minLength &&
          code.length <= maxLength &&
          /^\d+$/.test(code)
        ) {
          // Anti-rebond: ignore identical scan within dedup window
          if (
            dedupeWindowMs > 0 &&
            lastScanRef.current &&
            lastScanRef.current.code === code &&
            now - lastScanRef.current.at < dedupeWindowMs
          ) {
            emit({ type: "dedup", code, elapsedMs: now - lastScanRef.current.at, at: now });
            e.preventDefault();
            e.stopPropagation();
            resetBuffer();
            return;
          }
          e.preventDefault();
          e.stopPropagation();
          lastScanRef.current = { code, at: now };
          emit({ type: "scan", code, at: now });
          onScan(code);
        } else if (code.length > 0) {
          emit({ type: "rejected", code, reason: `length=${code.length} not in [${minLength},${maxLength}] or non-digit`, at: now });
        }
        resetBuffer();
        return;
      }

      // Only accumulate digits
      if (/^\d$/.test(e.key)) {
        if (bufferRef.current.length === 0 || elapsed < maxKeyInterval) {
          bufferRef.current += e.key;
        } else {
          // Too slow — human typing, reset
          bufferRef.current = e.key;
        }
      } else if (bufferRef.current.length > 0) {
        // Non-digit key breaks the sequence
        resetBuffer();
      }

      // Auto-reset after inactivity
      timeoutRef.current = setTimeout(resetBuffer, 300);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [enabled, onScan, minLength, maxLength, maxKeyInterval, dedupeWindowMs, resetBuffer, emit]);
}
