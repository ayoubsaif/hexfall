import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite-plus";
import pkg from "./package.json" with { type: "json" };
import { applySiteUrl, normalizeSiteUrl } from "./siteMeta.ts";

export default defineConfig(({ mode }) => {
  const siteUrl = normalizeSiteUrl(loadEnv(mode, process.cwd(), "VITE_").VITE_SITE_URL);
  return {
    // The app version shown in Settings and sent in `hello`: package.json, unless VITE_APP_VERSION overrides it.
    define: { __APP_VERSION__: JSON.stringify(pkg.version) },
    plugins: [
      react(),
      tailwindcss(),
      // Absolute og:image / og:url / canonical when VITE_SITE_URL is set (specs/web-metadata).
      {
        name: "hexfall-site-meta",
        transformIndexHtml: (html: string) => applySiteUrl(html, siteUrl),
      },
    ],
    // shadcn/ui convention: "@/..." is apps/client/src.
    // Root-relative, because node:* imports are banned in apps/client.
    resolve: { alias: [{ find: /^@\//, replacement: "/src/" }] },
    server: { port: 5173, strictPort: true },
    // Pre-bundle heavy deps up front so dev never re-optimizes mid-session
    // (that caused "504 Outdated Optimize Dep" and a blank page).
    optimizeDeps: {
      include: [
        "react",
        "react-dom/client",
        "react/jsx-dev-runtime",
        "three",
        "@react-three/fiber",
        "@react-three/drei",
        "zustand",
        "zod",
        "i18next",
        "react-i18next",
        "radix-ui",
        "lucide-react",
        "@radix-ui/react-dialog",
        "@radix-ui/react-slot",
        "@radix-ui/react-tabs",
        "@radix-ui/react-tooltip",
      ],
    },
    test: { environment: "happy-dom", setupFiles: ["./test/setup.ts"] },
  };
});
