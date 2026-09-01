import type { NextConfig } from "next";

// Phase 2 addendum – Static File-Based Multi-App Integration.
// Admin is static-exported into `frontend/dist/admin/` and served under the
// `/admin` base path. All asset URLs (/_next/*, etc.) are auto-prefixed with
// `/admin` so they resolve correctly from the subfolder.
const nextConfig: NextConfig = {
  output: "export",
  basePath: "/admin",
  // Static export cannot run the server-side image optimizer.
  images: { unoptimized: true },
};

export default nextConfig;
