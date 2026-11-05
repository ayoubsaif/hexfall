// The derived app icons and their pixel sizes (specs/web-metadata "App icon set").
// Shared by tools/icons.mjs (writes them) and tools/check-assets.mjs (checks them).
// Dependency-free on purpose: check-assets must run without sharp.

/** Path under apps/client/public → [width, height]. */
export const ICON_OUTPUTS = {
  "icons/favicon-32.png": [32, 32],
  "icons/apple-touch-icon.png": [180, 180],
  "icons/icon-192.png": [192, 192],
  "icons/icon-512.png": [512, 512],
  "icons/icon-maskable-512.png": [512, 512],
  "icons/badge-96.png": [96, 96],
  "og-image.png": [1200, 630],
};
export const ICO_SIZES = [16, 32, 48];
/** Open Graph image size budget. */
export const OG_MAX_BYTES = 300 * 1024;
