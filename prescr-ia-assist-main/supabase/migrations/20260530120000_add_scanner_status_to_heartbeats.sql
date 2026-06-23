-- Add scanner diagnostic snapshot to instance heartbeats.
--
-- Every 60s (see useInstanceHeartbeat.ts) each connected pharmacy instance
-- upserts a row here. We piggy-back the scanner status as a JSONB blob so the
-- admin can see, for any pharmacy, which capture path is currently active
-- (N-API Raw Input, PowerShell Raw Input, uiohook, node-hid, SerialPort,
-- WebHID) — without needing remote desktop access.

ALTER TABLE public.pharmacy_instance_heartbeats
  ADD COLUMN IF NOT EXISTS scanner_status JSONB,
  ADD COLUMN IF NOT EXISTS last_scan_at TIMESTAMPTZ;

-- Helpful for admin filters ("show pharmacies where no path is active")
CREATE INDEX IF NOT EXISTS idx_heartbeats_last_scan_at
  ON public.pharmacy_instance_heartbeats (last_scan_at DESC NULLS LAST);

COMMENT ON COLUMN public.pharmacy_instance_heartbeats.scanner_status IS
  'Snapshot du getScannerStatus() Electron : mode, nativeRawInputStarted, rawInputStarted, hidLoaded, uiohookStarted, serialStarted, serialOpenPorts, lastError, etc. Renvoyé tel quel par main.js.';

COMMENT ON COLUMN public.pharmacy_instance_heartbeats.last_scan_at IS
  'Timestamp du dernier scan détecté (toutes voies confondues) au moment du dernier heartbeat. NULL si aucun scan vu depuis le démarrage.';
