import type { NextConfig } from 'next';

export function withBrxceEditor(
  nextConfig: NextConfig,
  options: { apiPort?: number; routePrefix?: string } = {},
): NextConfig {
  const port = options.apiPort ?? 8092;
  const base = `http://localhost:${port}`;

  const apiPrefixes = [
    'projects', 'references', 'carousels', 'finished', 'presets',
    'render', 'media', 'whisper', 'bgm', 'plans', 'content',
    'auto-project', 'resolver', 'ref-posts', 'collections',
  ];

  const mediaExtensions = ['mp4', 'mov', 'MP4', 'MOV', 'mkv', 'webm', 'mp3', 'wav'];

  return {
    ...nextConfig,
    async rewrites() {
      const existing = nextConfig.rewrites ? await nextConfig.rewrites() : [];

      const editorRewrites = [
        ...apiPrefixes.flatMap((p) => [
          { source: `/api/${p}/:path*`, destination: `${base}/api/${p}/:path*` },
          { source: `/api/${p}`, destination: `${base}/api/${p}` },
        ]),
        ...mediaExtensions.map((ext) => ({
          source: `/:file*.${ext}`,
          destination: `${base}/:file*.${ext}`,
        })),
        { source: '/index.html', destination: `${base}/index.html` },
        { source: '/editor.html', destination: `${base}/editor.html` },
        { source: '/js/:path*', destination: `${base}/js/:path*` },
        { source: '/_proxy/:path*', destination: `${base}/_proxy/:path*` },
        { source: '/_fonts/:path*', destination: `${base}/_fonts/:path*` },
      ];

      if (Array.isArray(existing)) {
        return [...existing, ...editorRewrites];
      }

      return {
        ...existing,
        fallback: [...(existing.fallback || []), ...editorRewrites],
      };
    },
  };
}
