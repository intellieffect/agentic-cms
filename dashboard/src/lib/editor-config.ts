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
  tables: {
    videos: string;
    accounts: string;
    carousels: string;
    projects: string;
    finished: string;
    presets: string;
    renderJobs: string;
    refPosts: string;
    refAccounts: string;
    refSlides: string;
    storyboards: string;
    subtitles: string;
    collections: string;
    collectionItems: string;
    plans: string;
  };
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
  tables: {
    videos: 'reference_videos',
    accounts: 'reference_accounts',
    carousels: 'carousels',
    projects: 'projects',
    finished: 'finished_videos',
    presets: 'presets',
    renderJobs: 'render_jobs',
    refPosts: 'ref_posts',
    refAccounts: 'ref_accounts',
    refSlides: 'ref_slides',
    storyboards: 'storyboards',
    subtitles: 'subtitles',
    collections: 'reference_collections',
    collectionItems: 'reference_collection_items',
    plans: 'plans',
  },
  media: {
    root: process.env.NEXT_PUBLIC_MEDIA_ROOT || '/Volumes/Media',
    finished: process.env.NEXT_PUBLIC_MEDIA_FINISHED || '~/Desktop/_미디어/완료영상',
    defaultSource: process.env.NEXT_PUBLIC_MEDIA_DEFAULT_SOURCE || '/Volumes/Seagate/인텔리이펙트 영상소스',
  },
};

let _config: EditorConfig = { ...defaultConfig };

export function setEditorConfig(config: Partial<EditorConfig>) {
  _config = {
    ...defaultConfig,
    ...config,
    tables: { ...defaultConfig.tables, ...config.tables },
    media: { ...defaultConfig.media, ...config.media },
  };
}

export function getEditorConfig(): EditorConfig {
  return _config;
}

export default _config;
