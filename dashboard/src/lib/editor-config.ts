export interface NavItem {
  href: string;
  icon: string;
  label: string;
  children?: NavItem[];
}

export interface EditorConfig {
  routePrefix: string;
  apiUrl: string;
  navItems?: NavItem[];
  editorMode?: 'iframe' | 'remotion' | 'both';
  /** Prefix for media file URLs (default: "/_proxy") */
  mediaProxyPrefix?: string;
  /** Section title for host app sidebar (default: "콘텐츠 제작") */
  sectionTitle?: string;
  media: {
    root: string;
    finished: string;
    defaultSource: string;
  };
  /** Storage mode: 'local' (default) uses filesystem, 'cloud' uses Supabase Storage */
  storageMode?: 'local' | 'cloud';
  supabase?: {
    url: string;
    serviceKey: string;
  };
}

/**
 * Editor API URL 결정
 * - 브라우저: '/editor-api' (Next.js proxy 경유, CORS 우회)
 * - 서버: 환경변수 또는 기본값 직접 사용
 */
function resolveApiUrl(): string {
  if (typeof window !== 'undefined') {
    // 브라우저에서는 Next.js rewrites proxy 경유
    return '/editor-api';
  }
  return process.env.NEXT_PUBLIC_EDITOR_API_URL || 'http://localhost:8092';
}

const defaultConfig: EditorConfig = {
  routePrefix: '',
  apiUrl: resolveApiUrl(),
  mediaProxyPrefix: process.env.NEXT_PUBLIC_MEDIA_PROXY_PREFIX || '/_proxy',
  media: {
    root: process.env.NEXT_PUBLIC_MEDIA_ROOT || '',
    finished: process.env.NEXT_PUBLIC_MEDIA_FINISHED || '',
    defaultSource: process.env.NEXT_PUBLIC_MEDIA_DEFAULT_SOURCE || '',
  },
};

let _config: EditorConfig = { ...defaultConfig };

export function setEditorConfig(config: Partial<EditorConfig>) {
  _config = {
    ...defaultConfig,
    ...config,
    media: { ...defaultConfig.media, ...config.media },
  };
}

export function getEditorConfig(): EditorConfig {
  return _config;
}

export default _config;
