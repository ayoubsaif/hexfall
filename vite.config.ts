import { defineConfig } from "vite-plus";

// Import bans per workspace (design.md decision 2). Engine purity also has a
// separate check in tools/check-engine.mjs.
const NODE_BUILTINS = [{ group: ["node:*"], message: "No Node built-ins here." }];
const APP_PACKAGES = [
  {
    group: ["@hexfall/server", "@hexfall/server/*", "@hexfall/client", "@hexfall/client/*"],
    message: "Apps are never imported by other workspaces.",
  },
];
const REFERENCE_ART = [
  {
    group: ["**/assets/*", "**/assets/**"],
    message: "Reference art in assets/ must never be used.",
  },
];

export default defineConfig({
  fmt: {
    ignorePatterns: [
      "AGENTS.md",
      "assets/**",
      "openspec/**",
      "**/dist/**",
      "pnpm-lock.yaml",
      ".agents/**",
      ".claude/**",
      ".codegraph/**",
      ".devin/**",
      ".opencode/**",
    ],
  },
  lint: {
    ignorePatterns: [
      "assets/**",
      "openspec/**",
      "**/dist/**",
      ".agents/**",
      ".claude/**",
      ".codegraph/**",
      ".devin/**",
      ".opencode/**",
    ],
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
    overrides: [
      {
        files: ["packages/engine/**"],
        rules: {
          "no-restricted-properties": [
            "error",
            { object: "Math", property: "random", message: "Use the seeded RNG in src/rng.ts." },
          ],
          "no-restricted-globals": [
            "error",
            { name: "Date", message: "The engine has no clock; pass time in." },
          ],
          "no-restricted-imports": [
            "error",
            {
              paths: ["fs", "path", "ws", "ioredis", "redis", "react", "react-dom", "three", "zod"],
              patterns: [
                ...NODE_BUILTINS,
                ...APP_PACKAGES,
                ...REFERENCE_ART,
                { group: ["@hexfall/*"], message: "The engine depends on nothing." },
              ],
            },
          ],
        },
      },
      {
        files: ["packages/protocol/**"],
        rules: {
          "no-restricted-imports": [
            "error",
            {
              paths: ["fs", "path", "ws", "ioredis", "redis", "react", "three"],
              patterns: [...NODE_BUILTINS, ...APP_PACKAGES, ...REFERENCE_ART],
            },
          ],
        },
      },
      {
        files: ["apps/client/**"],
        rules: {
          "no-restricted-imports": [
            "error",
            {
              paths: ["ws", "ioredis", "redis", "fs", "path"],
              patterns: [
                ...NODE_BUILTINS,
                ...APP_PACKAGES,
                ...REFERENCE_ART,
                {
                  group: ["@hexfall/engine/*", "!@hexfall/engine/geometry"],
                  message:
                    "Client may only import @hexfall/engine (types) and @hexfall/engine/geometry.",
                },
                {
                  group: ["**/packages/engine/**"],
                  message: "Import the engine through its package exports.",
                },
              ],
            },
          ],
        },
      },
      {
        files: ["apps/server/**"],
        rules: {
          "no-restricted-imports": [
            "error",
            {
              paths: ["react", "react-dom", "three"],
              patterns: [
                {
                  group: ["@hexfall/client", "@hexfall/client/*"],
                  message: "Server never imports the client.",
                },
                ...REFERENCE_ART,
              ],
            },
          ],
        },
      },
    ],
  },
  run: {
    cache: true,
  },
});
