// Fixture tests for the license/credit rules in tools/check-assets.mjs
// (openspec change stl-piece-models, task 3.2; specs/asset-theming "Asset credits",
// "Licensing guard").
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vite-plus/test";

const SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "check-assets.mjs");

// A minimal valid GLB: header + empty JSON chunk ("{}" padded to 4 bytes).
function tinyGlb() {
  const json = Buffer.from(
    '{"asset":{"version":"2.0"},"extensionsUsed":["EXT_meshopt_compression"]}',
  );
  const pad = (4 - (json.length % 4)) % 4;
  const chunk = Buffer.concat([json, Buffer.alloc(pad, 0x20)]);
  const buf = Buffer.alloc(20 + chunk.length);
  buf.writeUInt32LE(0x46546c67, 0);
  buf.writeUInt32LE(2, 4);
  buf.writeUInt32LE(buf.length, 8);
  buf.writeUInt32LE(chunk.length, 12);
  buf.writeUInt32LE(0x4e4f534a, 16);
  chunk.copy(buf, 20);
  return buf;
}

let dirs = [];
afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs = [];
});

/** Writes one theme "t" with models/city.glb and the given manifest; runs the check. */
function check(manifest) {
  const root = mkdtempSync(join(tmpdir(), "hexfall-themes-"));
  dirs.push(root);
  mkdirSync(join(root, "t", "models"), { recursive: true });
  writeFileSync(join(root, "t", "models", "city.glb"), tinyGlb());
  writeFileSync(join(root, "t", "theme.json"), JSON.stringify({ id: "t", ...manifest }));
  const r = spawnSync(process.execPath, [SCRIPT, "--themes", root], { encoding: "utf8" });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

const assets = { "piece.city": { model: "models/city.glb" } };
const credit = {
  keys: ["piece.city"],
  title: "City",
  author: "Someone",
  url: "https://example.com/city",
  license: "CC-BY-4.0",
};

describe("check-assets licensing", () => {
  it("passes a CC0 theme with a credited CC-BY piece", () => {
    const r = check({ license: "CC0-1.0", source: "x", assets, credits: [credit] });
    expect(r.out).not.toContain("error");
    expect(r.status).toBe(0);
  });

  it("fails a credit naming an unmapped key", () => {
    const r = check({
      license: "CC0-1.0",
      source: "x",
      assets,
      credits: [{ ...credit, keys: ["piece.city", "piece.robber"] }],
    });
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/theme "t".*piece\.robber.*does not map/);
  });

  it.each(["author", "url"])("fails a credit with no %s", (field) => {
    const r = check({
      license: "CC0-1.0",
      source: "x",
      assets,
      credits: [{ ...credit, [field]: "" }],
    });
    expect(r.status).toBe(1);
    expect(r.out).toMatch(new RegExp(`theme "t".*piece\\.city.*missing "${field}"`));
  });

  it("rejects a non-commercial credit license", () => {
    const r = check({
      license: "CC0-1.0",
      source: "x",
      assets,
      credits: [{ ...credit, license: "CC-BY-NC-4.0" }],
    });
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/theme "t".*piece\.city.*CC-BY-NC-4\.0/);
  });

  it("rejects a manifest license outside the allowlist", () => {
    const r = check({ license: "Proprietary", source: "x", assets: {} });
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/theme "t".*"Proprietary" is not allowed/);
  });

  it("fails an attribution manifest license with an uncredited key", () => {
    const r = check({ license: "CC-BY-4.0", source: "x", assets });
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/theme "t", key "piece\.city".*requires attribution/);
  });

  it("still requires a license/source declaration", () => {
    const r = check({ assets });
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/theme "t": manifest lacks a license\/source/);
  });
});
