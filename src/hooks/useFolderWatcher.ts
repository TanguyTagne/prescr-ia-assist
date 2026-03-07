import { useState, useRef, useCallback, useEffect } from "react";

interface FolderWatcherOptions {
  onNewFile: (file: File) => void;
  intervalMs?: number;
  accept?: string[];
}

export function useFolderWatcher({ onNewFile, intervalMs = 2000, accept = ["image/", "application/pdf"] }: FolderWatcherOptions) {
  const [isWatching, setIsWatching] = useState(false);
  const [folderName, setFolderName] = useState<string | null>(null);
  const dirHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const seenFilesRef = useRef<Set<string>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isSupported = typeof window !== "undefined" && "showDirectoryPicker" in window;

  const scanFolder = useCallback(async () => {
    const dirHandle = dirHandleRef.current;
    if (!dirHandle) return;

    try {
      for await (const entry of (dirHandle as any).values()) {
        if (entry.kind !== "file") continue;
        const name: string = entry.name;

        if (seenFilesRef.current.has(name)) continue;

        const file: File = await entry.getFile();
        const isAccepted = accept.some((t) => file.type.startsWith(t));
        if (!isAccepted) continue;

        // Only process files modified in the last 30 seconds (new scans)
        const age = Date.now() - file.lastModified;
        if (age > 30000) {
          seenFilesRef.current.add(name);
          continue;
        }

        seenFilesRef.current.add(name);
        onNewFile(file);
      }
    } catch (err) {
      console.error("Folder scan error:", err);
    }
  }, [onNewFile, accept]);

  const startWatching = useCallback(async () => {
    if (!isSupported) return;
    try {
      const dirHandle = await (window as any).showDirectoryPicker({ mode: "read" });
      dirHandleRef.current = dirHandle;
      setFolderName(dirHandle.name);

      // Mark all existing files as seen
      for await (const entry of (dirHandle as any).values()) {
        if (entry.kind === "file") {
          seenFilesRef.current.add(entry.name);
        }
      }

      setIsWatching(true);
      intervalRef.current = setInterval(scanFolder, intervalMs);
    } catch (err: any) {
      if (err.name !== "AbortError") console.error("Folder picker error:", err);
    }
  }, [isSupported, scanFolder, intervalMs]);

  const stopWatching = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    dirHandleRef.current = null;
    seenFilesRef.current.clear();
    setIsWatching(false);
    setFolderName(null);
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return { isSupported, isWatching, folderName, startWatching, stopWatching };
}
