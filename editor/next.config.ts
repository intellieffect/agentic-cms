import type { NextConfig } from 'next';
import path from 'path';

const API_URL = process.env.BRXCE_API_URL || 'http://localhost:8092';

const nextConfig: NextConfig = {
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
