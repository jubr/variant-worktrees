import { defineConfig } from "vite";

// AIDEV-NOTE: host 0.0.0.0 so the instance's `open` URL, http://<slug>.vw.localhost:<port>, reaches the dev server.
export default defineConfig({
  server: {
    host: "0.0.0.0",
    // The variant's {{port}}: each variant gets its own, so several run side by side.
    port: Number(process.env.PORT ?? 5173),
    strictPort: true,
    allowedHosts: [".vw.localhost", "localhost"],
    proxy: {
      // AIDEV-NOTE: the browser stays same-origin; the `be` instance is the target. VARIANT_API_PORT is its port.
      "/api": {
        target: `http://localhost:${process.env.VARIANT_API_PORT || 3000}`,
        changeOrigin: true,
      },
    },
  },
});
