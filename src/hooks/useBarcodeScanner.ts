import { useEffect, useRef, useCallback } from "react";

interface BarcodeScannerOptions {
  onScan: (code: string) => void;
  enabled?: boolean;
  minLength?: number;
  maxLength?: number;
  maxKeyInterval?: number;
}

/**
 * Detects HID barcode scanner input (USB/Bluetooth douchette).
 * Scanners emulate keyboard: they type digits very fast (<50ms) then press Enter.
 * Human typing is much slower, so we distinguish by keystroke speed.
 */
export function useBarcodeScanner({
  onScan,
  enabled = true,
  minLength = 7,
  maxLength = 13,
  maxKeyInterval = 60,
}: BarcodeScannerOptions) {
  const bufferRef = useRef("");
  const lastKeyTimeRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetBuffer = useCallback(() => {
    bufferRef.current = "";
  }, []);

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

      if (e.key === "Enter") {
        const code = bufferRef.current;
        if (
          code.length >= minLength &&
          code.length <= maxLength &&
          /^\d+$/.test(code)
        ) {
          e.preventDefault();
          e.stopPropagation();
          onScan(code);
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
  }, [enabled, onScan, minLength, maxLength, maxKeyInterval, resetBuffer]);
}
