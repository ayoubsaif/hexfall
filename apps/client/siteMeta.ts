// Absolute Open Graph URLs and canonical link from VITE_SITE_URL (openspec change
// turn-sound-and-push; specs/web-metadata "Page metadata"). Used by vite.config.ts.

const IMAGE_TAG = /(<meta (?:property="og:image"|name="twitter:image") content=")(\/[^"]*)(")/g;

/** Normalizes a site URL to its origin plus path without a trailing slash, or null. */
export function normalizeSiteUrl(raw: string | undefined): string | null {
  const v = raw?.trim();
  if (!v) return null;
  let url: URL;
  try {
    url = new URL(v);
  } catch {
    throw new Error(`VITE_SITE_URL is not a valid URL: ${v}`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`VITE_SITE_URL must be http(s): ${v}`);
  }
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}

/**
 * With a site URL: makes og:image / twitter:image absolute and adds og:url and the canonical
 * link before </head>. Without one: returns the HTML unchanged (root-relative images).
 */
export function applySiteUrl(html: string, siteUrl: string | null): string {
  if (!siteUrl) return html;
  const home = `${siteUrl}/`;
  return html
    .replace(IMAGE_TAG, (_m, a: string, path: string, b: string) => `${a}${siteUrl}${path}${b}`)
    .replace(
      "</head>",
      `  <meta property="og:url" content="${home}" />\n    <link rel="canonical" href="${home}" />\n  </head>`,
    );
}
