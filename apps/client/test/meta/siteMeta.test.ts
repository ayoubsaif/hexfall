import { describe, expect, it } from "vite-plus/test";
import { applySiteUrl, normalizeSiteUrl } from "../../siteMeta.ts";
import html from "../../index.html?raw";

describe("site metadata (specs/web-metadata)", () => {
  it("leaves the page unchanged without a site URL", () => {
    expect(normalizeSiteUrl(undefined)).toBeNull();
    expect(normalizeSiteUrl("  ")).toBeNull();
    const out = applySiteUrl(html, null);
    expect(out).toBe(html);
    expect(out).not.toContain("og:url");
    expect(out).not.toContain("canonical");
    expect(out).not.toMatch(/%VITE_/);
  });

  it("makes images absolute and adds og:url and canonical", () => {
    const site = normalizeSiteUrl("https://hexfall.example.com/");
    expect(site).toBe("https://hexfall.example.com");
    const out = applySiteUrl(html, site);
    expect(out).toContain('property="og:image" content="https://hexfall.example.com/og-image.png"');
    expect(out).toContain(
      'name="twitter:image" content="https://hexfall.example.com/og-image.png"',
    );
    expect(out).toContain('property="og:url" content="https://hexfall.example.com/"');
    expect(out).toContain('rel="canonical" href="https://hexfall.example.com/"');
  });

  it("rejects invalid URLs", () => {
    expect(() => normalizeSiteUrl("not a url")).toThrow(/VITE_SITE_URL/);
    expect(() => normalizeSiteUrl("ftp://x.example")).toThrow(/http/);
  });

  it("links icons, manifest and social tags", () => {
    for (const s of [
      'rel="icon" href="/favicon.ico"',
      'rel="apple-touch-icon"',
      'rel="manifest" href="/manifest.webmanifest"',
      'name="theme-color"',
      'name="description"',
      'property="og:title"',
      'name="twitter:card" content="summary_large_image"',
    ])
      expect(html).toContain(s);
  });
});
