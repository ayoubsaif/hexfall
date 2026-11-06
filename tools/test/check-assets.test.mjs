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

describe("check-assets water textures", () => {
  function checkWater(water, files) {
    const root = mkdtempSync(join(tmpdir(), "hexfall-themes-"));
    dirs.push(root);
    mkdirSync(join(root, "t", "water"), { recursive: true });
    for (const [name, buf] of Object.entries(files))
      writeFileSync(join(root, "t", "water", name), buf);
    writeFileSync(
      join(root, "t", "theme.json"),
      JSON.stringify({ id: "t", license: "CC0-1.0", source: "x", assets: {}, water }),
    );
    const r = spawnSync(process.execPath, [SCRIPT, "--themes", root], { encoding: "utf8" });
    return { status: r.status, out: `${r.stdout}${r.stderr}` };
  }

  // Minimal PNG header carrying a width and height (enough for the size probe).
  const png = (w, h, pad = 0) => {
    const b = Buffer.alloc(33 + pad);
    Buffer.from("89504e470d0a1a0a", "hex").copy(b, 0);
    b.writeUInt32BE(13, 8);
    b.write("IHDR", 12, "ascii");
    b.writeUInt32BE(w, 16);
    b.writeUInt32BE(h, 20);
    return b;
  };

  it("passes square textures within budget", () => {
    const r = checkWater({ sand: "water/s.png" }, { "s.png": png(512, 512) });
    expect(r.status).toBe(0);
  });

  it("fails a missing texture file", () => {
    const r = checkWater({ sand: "water/s.png" }, {});
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/does not exist/);
  });

  it("fails a non-square texture", () => {
    const r = checkWater({ sand: "water/s.png" }, { "s.png": png(512, 256) });
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/water "sand".*must be square/);
  });

  it("fails textures over the total budget", () => {
    const r = checkWater(
      { sand: "water/s.png", caustics: "water/l.png" },
      { "s.png": png(512, 512, 200 * 1024), "l.png": png(512, 512, 200 * 1024) },
    );
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/water textures total .*budget/);
  });

  it("fails an unknown texture slot", () => {
    const r = checkWater({ foam: "water/s.png" }, { "s.png": png(512, 512) });
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/unknown water texture "foam"/);
  });
});
