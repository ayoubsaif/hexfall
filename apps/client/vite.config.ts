import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [react()],
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
    ],
  },
  test: { environment: "happy-dom" },
});
