import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
    ],
  },
  test: { environment: "happy-dom", setupFiles: ["./test/setup.ts"] },
});
