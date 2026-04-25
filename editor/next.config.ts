import type { NextConfig } from 'next';
import path from 'path';

const API_URL = process.env.BRXCE_API_URL || 'http://localhost:8092';

const nextConfig: NextConfig = {
  // Strict Mode causes the Player tree to mount → unmount → mount in dev,
  // which double-invokes every <Video> element's fetch and shows up as
  // (canceled) + 2x success per clip in DevTools. HTML5 <video> is an
  // external resource (not React-managed), so Strict Mode's protection
  // brings no benefit here while doubling network noise during media editing.
  // Production builds are unaffected (Strict Mode is dev-only behavior).
  reactStrictMode: false,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_URL}/api/:path*`,
      },
      // 영상/미디어 파일 프록시
      {
        source: '/:file*.mp4',
        destination: `${API_URL}/:file*.mp4`,
      },
      {
        source: '/:file*.mov',
        destination: `${API_URL}/:file*.mov`,
      },
      {
        source: '/:file*.MP4',
        destination: `${API_URL}/:file*.MP4`,
      },
      {
        source: '/:file*.MOV',
        destination: `${API_URL}/:file*.MOV`,
      },
      {
        source: '/:file*.mkv',
        destination: `${API_URL}/:file*.mkv`,
      },
      {
        source: '/:file*.webm',
        destination: `${API_URL}/:file*.webm`,
      },
      {
        source: '/:file*.mp3',
        destination: `${API_URL}/:file*.mp3`,
      },
      {
        source: '/:file*.wav',
        destination: `${API_URL}/:file*.wav`,
      },
    ];
  },
  turbopack: {
    resolveAlias: {
      canvas: { browser: '' },
    },
  },
};

export default nextConfig;
