import { defineConfig } from "vite";

// The variant's {{port}}: each variant picks its own so several can run side by side.
const port = Number(process.env.PORT ?? 5173);

export default defineConfig({ server: { port, strictPort: true } });
