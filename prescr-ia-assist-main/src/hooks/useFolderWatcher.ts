import { useState, useRef, useCallback, useEffect } from "react";

export interface WatcherDebugEvent {
  type: "scan" | "detected" | "skipped" | "error" | "started" | "stopped";
  fileName?: string;
  reason?: string;
  size?: number;
  at: number;
}

interface FolderWatcherOptions {
  onNewFile: (file: File) => void;
  intervalMs?: number;
  accept?: string[];
  /** Filenames matching these extensions are silently ignored */
  blacklistExtensions?: string[];
  /** Maximum age (ms) of a file to be considered "new" */
  maxFileAgeMs?: number;
  /** Optional debug listener for the Hardware Diagnostic page */
  onDebug?: (event: WatcherDebugEvent) => void;
}

const DEFAULT_BLACKLIST = [".tmp", ".crdownload", ".part", ".lock", ".ds_store"];

export function useFolderWatcher({
  onNewFile,
  intervalMs = 2000,
  accept = ["image/", "application/pdf"],
  blacklistExtensions = DEFAULT_BLACKLIST,
  maxFileAgeMs = 30000,
  onDebug,
}: FolderWatcherOptions) {
  const [isWatching, setIsWatching] = useState(false);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const dirHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  /** Map of "name|lastModified|size" -> timestamp seen */
  const seenFilesRef = useRef<Map<string, number>>(new Map());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onDebugRef = useRef(onDebug);
  onDebugRef.current = onDebug;

  const isSupported = typeof window !== "undefined" && "showDirectoryPicker" in window;

  const emit = useCallback((event: WatcherDebugEvent) => {
    onDebugRef.current?.(event);
  }, []);

  const fileKey = (name: string, lastModified: number, size: number) =>
    `${name}|${lastModified}|${size}`;

  const isBlacklisted = useCallback(
    (name: string) => {
      const lower = name.toLowerCase();
      return blacklistExtensions.some((ext) => lower.endsWith(ext.toLowerCase()));
    },
    [blacklistExtensions]
  );

  const scanFolder = useCallback(async () => {
    const dirHandle = dirHandleRef.current;
    if (!dirHandle) return;

    emit({ type: "scan", at: Date.now() });

    try {
      for await (const entry of (dirHandle as any).values()) {
        if (entry.kind !== "file") continue;
        const name: string = entry.name;

        if (isBlacklisted(name)) {
          emit({ type: "skipped", fileName: name, reason: "blacklisted extension", at: Date.now() });
          continue;
        }

        let file: File;
        try {
          file = await entry.getFile();
        } catch (err: any) {
          // File locked or just being written — retry next cycle (don't mark as seen)
          emit({ type: "error", fileName: name, reason: `getFile failed: ${err?.message || err}`, at: Date.now() });
          continue;
        }

        const key = fileKey(name, file.lastModified, file.size);
        if (seenFilesRef.current.has(key)) continue;

        const isAccepted = accept.some((t) => file.type.startsWith(t));
        if (!isAccepted) {
          seenFilesRef.current.set(key, Date.now());
          emit({ type: "skipped", fileName: name, reason: `mime "${file.type}" not accepted`, at: Date.now() });
          continue;
        }

        // Only process files modified in the last `maxFileAgeMs`
        const age = Date.now() - file.lastModified;
        if (age > maxFileAgeMs) {
          seenFilesRef.current.set(key, Date.now());
          emit({ type: "skipped", fileName: name, reason: `too old (${Math.round(age / 1000)}s)`, at: Date.now() });
          continue;
        }

        seenFilesRef.current.set(key, Date.now());
        emit({ type: "detected", fileName: name, size: file.size, at: Date.now() });
        onNewFile(file);
      }
      setLastError(null);
    } catch (err: any) {
      const msg = err?.message || String(err);
      setLastError(msg);
      emit({ type: "error", reason: msg, at: Date.now() });
      console.error("Folder scan error:", err);
    }
  }, [onNewFile, accept, isBlacklisted, maxFileAgeMs, emit]);

  const startWatching = useCallback(async () => {
    if (!isSupported) return;
    try {
      const dirHandle = await (window as any).showDirectoryPicker({ mode: "read" });
      dirHandleRef.current = dirHandle;
      setFolderName(dirHandle.name);
      setLastError(null);

      // Mark all existing files as seen (only process files added AFTER start)
      for await (const entry of (dirHandle as any).values()) {
        if (entry.kind === "file") {
          try {
            const f: File = await entry.getFile();
            seenFilesRef.current.set(fileKey(entry.name, f.lastModified, f.size), Date.now());
          } catch {
            /* ignore — will be picked up on next scan */
          }
        }
      }

      setIsWatching(true);
      emit({ type: "started", reason: dirHandle.name, at: Date.now() });
      intervalRef.current = setInterval(scanFolder, intervalMs);
    } catch (err: any) {
      if (err.name !== "AbortError") {
        const msg = err?.message || String(err);
        setLastError(msg);
        emit({ type: "error", reason: `picker: ${msg}`, at: Date.now() });
        console.error("Folder picker error:", err);
      }
    }
  }, [isSupported, scanFolder, intervalMs, emit]);

  const stopWatching = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    dirHandleRef.current = null;
    seenFilesRef.current.clear();
    setIsWatching(false);
    setFolderName(null);
    setLastError(null);
    emit({ type: "stopped", at: Date.now() });
  }, [emit]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return { isSupported, isWatching, folderName, lastError, startWatching, stopWatching };
}
