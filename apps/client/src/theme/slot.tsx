// Loading/failure wrapper shared by themed images and models (specs/asset-theming,
// "Procedural fallback for every key", "Load failure handling"). While the file loads the
// fallback shows (Suspense); if it fails to load or decode, an error boundary swaps in the
// fallback for good and one warning naming the key and theme is emitted per URL. Later
// instances of a failed URL skip the load entirely (see `effectiveResolution`).
import { Component, type ReactNode, Suspense } from "react";
import type { AssetKey } from "./keys.ts";
import { type AssetResolution, type ThemedFileKind, loadFailureMessage } from "./resolve.ts";

const failedUrls = new Set<string>();

/** Records a failed URL and warns once per URL. Returns whether a warning was emitted. */
export function reportLoadFailure(
  key: AssetKey,
  themeId: string,
  fileKind: ThemedFileKind,
  url: string,
  error: unknown,
): boolean {
  if (failedUrls.has(url)) return false;
  failedUrls.add(url);
  console.warn(`[theme] ${loadFailureMessage(key, themeId, fileKind, url, error)}`);
  return true;
}

export function hasLoadFailed(url: string): boolean {
  return failedUrls.has(url);
}

/** Test helper: forgets every recorded failure. */
export function resetLoadFailures(): void {
  failedUrls.clear();
}

/** A themed resolution whose URL already failed becomes a "failed" fallback. */
export function effectiveResolution(resolution: AssetResolution): AssetResolution {
  if (resolution.kind !== "fallback" && failedUrls.has(resolution.url)) {
    return { kind: "fallback", key: resolution.key, reason: "failed" };
  }
  return resolution;
}

interface BoundaryProps {
  fallback: ReactNode;
  onError: (error: unknown) => void;
  children: ReactNode;
}

export class AssetErrorBoundary extends Component<BoundaryProps, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }
  override componentDidCatch(error: unknown): void {
    this.props.onError(error);
  }
  override render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export interface ThemedSlotProps {
  assetKey: AssetKey;
  themeId: string;
  fileKind: ThemedFileKind;
  url: string;
  /** Procedural fallback, shown while loading and after a failure. */
  fallback: ReactNode;
  /** The themed asset; may suspend while loading and throw when loading fails. */
  children: ReactNode;
}

export function ThemedSlot({
  assetKey,
  themeId,
  fileKind,
  url,
  fallback,
  children,
}: ThemedSlotProps) {
  return (
    <AssetErrorBoundary
      key={url}
      fallback={fallback}
      onError={(error) => reportLoadFailure(assetKey, themeId, fileKind, url, error)}
    >
      <Suspense fallback={fallback}>{children}</Suspense>
    </AssetErrorBoundary>
  );
}
