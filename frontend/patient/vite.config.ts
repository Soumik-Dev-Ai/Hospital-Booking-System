import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Phase 2 addendum – Static File-Based Multi-App Integration.
// The patient dashboard is built to `frontend/dist/patient/` and served under
// `/patient/`. `base` prefixes every asset URL so inlined chunks, web workers
// and dynamic imports resolve from the subfolder. `viteSingleFile` keeps the
// output to a single index.html so the inbound transition loader (hardcoded in
// index.html) survives the build untouched.
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  base: "/patient/",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: "../dist/patient",
    // outDir is outside the project root – tell Vite we intend this and that
    // it may safely empty it (only the patient/ subfolder, never the parent).
    emptyOutDir: true,
  },
});
