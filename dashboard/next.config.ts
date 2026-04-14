import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    const editorApiUrl =
      process.env.NEXT_PUBLIC_EDITOR_API_URL || "http://localhost:8092";
    return [
      {
        source: "/editor-api/:path*",
        destination: `${editorApiUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
