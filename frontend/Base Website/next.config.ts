import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  // Only export in production. In dev, we need standard server mode to support rewrites.
  ...(isDev ? {} : { output: "export" }),
  images: { unoptimized: true },
  
  // Conditionally apply rewrites so the Base Website acts as a reverse proxy during dev.
  // This binds all 4 separate dev servers into a single localhost:3000 link.
  ...(isDev && {
    async rewrites() {
      return [
        { source: "/patient/:path*", destination: "http://localhost:5173/patient/:path*" },
        { source: "/patient", destination: "http://localhost:5173/patient/" },
        { source: "/doctor/:path*", destination: "http://localhost:5174/doctor/:path*" },
        { source: "/doctor", destination: "http://localhost:5174/doctor/" },
        { source: "/admin/:path*", destination: "http://localhost:3001/admin/:path*" },
        { source: "/admin", destination: "http://localhost:3001/admin" },
      ];
    },
  }),
};

export default nextConfig;
