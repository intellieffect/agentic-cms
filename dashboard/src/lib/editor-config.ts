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

const defaultConfig: EditorConfig = {
  routePrefix: '',
  apiUrl: 'http://localhost:8092',
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
    root: '/Volumes/Media',
    finished: '~/Desktop/_미디어/완료영상',
    defaultSource: '/Volumes/Seagate/인텔리이펙트 영상소스',
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

/**
 * Media proxy prefix for stable video file serving.
 * Flask catch-all route can be unreliable; /_proxy/ is always stable.
 * Override this if your backend serves media from a different path.
 */
