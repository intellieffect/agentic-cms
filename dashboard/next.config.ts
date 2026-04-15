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
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "euhxmmiqfyptvsvvbbvp.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
