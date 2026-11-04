import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["src/main.ts"],
    format: ["esm"],
    platform: "node",
    target: "node24",
    dts: false,
    // Inline workspace TS packages; keep real npm deps external.
    deps: { alwaysBundle: [/^@hexfall\//] },
  },
});
