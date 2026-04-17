import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  // repo 루트에도 package-lock.json(MCP server 용)이 있어, Next.js 가 workspace root 를
  // dashboard 가 아니라 repo 루트로 잘못 추론해 webpack module resolution 이 깨지는 문제가
  // CI 에서 발견됨("Cannot read properties of undefined (reading 'call')").
  // dashboard 디렉토리를 tracing root 로 고정한다.
  outputFileTracingRoot: path.join(__dirname),
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
