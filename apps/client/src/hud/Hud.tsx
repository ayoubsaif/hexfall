import type { ConnectionStatus } from "../net/connection.ts";
import { useConnectionStore } from "../store/connection.ts";

const LABEL: Record<ConnectionStatus, string> = {
  connecting: "Connecting",
  open: "Connected",
  reconnecting: "Reconnecting",
  closed: "Offline",
  version_mismatch: "Outdated",
};

function ConnectionBadge() {
  const status = useConnectionStore((s) => s.status);
  const latencyMs = useConnectionStore((s) => s.latencyMs);
  const attempts = useConnectionStore((s) => s.attempts);
  const showPing = status === "open" && latencyMs !== null;
  return (
    <div className="hud-badge" data-status={status} role="status" aria-live="polite">
      <span className="hud-dot" aria-hidden="true" />
      <span className="hud-status">{LABEL[status]}</span>
      {showPing && <span className="hud-ping">{Math.round(latencyMs)} ms</span>}
      {status === "reconnecting" && attempts > 1 && (
        <span className="hud-ping">try {attempts}</span>
      )}
    </div>
  );
}

export function ReloadBanner() {
  const mismatch = useConnectionStore((s) => s.status === "version_mismatch");
  if (!mismatch) return null;
  return (
    <div className="hud-banner" role="alert">
      <span>A new version is available, please reload.</span>
      <button type="button" className="hud-button" onClick={() => window.location.reload()}>
        Reload
      </button>
    </div>
  );
}

/** DOM overlay above the canvas. The container ignores the pointer; interactive children opt in. */
export function Hud() {
  return (
    <div className="hud">
      <ConnectionBadge />
      <ReloadBanner />
    </div>
  );
}
