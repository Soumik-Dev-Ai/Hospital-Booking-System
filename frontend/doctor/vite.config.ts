import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Phase 2 addendum – Static File-Based Multi-App Integration.
// The doctor dashboard is built to `frontend/dist/doctor/` and served under
// `/doctor/`. See frontend/patient/vite.config.ts for the same rationale.
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  base: "/doctor/",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: "../dist/doctor",
    emptyOutDir: true,
  },
});
