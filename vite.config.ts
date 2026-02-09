import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(async ({ mode }) => {
  const isReplit = process.env.REPL_ID !== undefined;
  const plugins = [react()];

  if (mode !== "production" && isReplit) {
    try {
      const runtimeErrorOverlay = await import("@replit/vite-plugin-runtime-error-modal").then(m => m.default || m);
      const cartographer = await import("@replit/vite-plugin-cartographer").then(m => m.cartographer);
      const devBanner = await import("@replit/vite-plugin-dev-banner").then(m => m.devBanner);

      plugins.push(runtimeErrorOverlay());
      plugins.push(cartographer());
      plugins.push(devBanner());
    } catch (e) {
      console.warn("Replit plugins failed to load, skipping...");
    }
  }

  return {
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "client", "src"),
        "@shared": path.resolve(import.meta.dirname, "shared"),
        "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      },
    },
    root: path.resolve(import.meta.dirname, "client"),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
    },
    server: {
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
    },
  };
});
