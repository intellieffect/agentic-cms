export type ContentStatus = 'draft' | 'review' | 'published';

export interface Content {
  id: string;
  title: string;
  slug: string;
  status: ContentStatus;
  topic_id?: string | null;
  category?: string | null;
  content_type?: string | null;
  body_md?: string | null;
  tags?: string[] | null;
  hook?: string | null;
  core_message?: string | null;
  media_type?: string | null;
  media_urls?: Record<string, unknown> | null;
  funnel_stage?: string | null;
  cta?: string | null;
  fact_checked?: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface Idea {
  id: string;
  raw_text: string;
  source: string;
  topic_id?: string | null;
  angle?: string | null;
  target_audience?: string | null;
  promoted_to?: string | null;
  created_at: string;
}

export interface IdeaCreateInput {
  raw_text: string;
  source?: string;
  topic_id?: string;
  angle?: string;
  target_audience?: string;
}

export interface IdeaUpdateInput {
  raw_text?: string;
  source?: string;
  topic_id?: string | null;
  angle?: string | null;
  target_audience?: string | null;
}

export interface IdeaFilter {
  topic_id?: string;
  promoted?: boolean; // true = only promoted, false = only unpromoted, undefined = both
  limit?: number;
}

export interface Publication {
  id: string;
  content_id: string;
  variant_id?: string | null;
  channel: string;
  channel_post_id?: string | null;
  postiz_post_id?: string | null;
  url?: string | null;
  published_at: string;
  metrics?: Record<string, unknown> | null;
}

export interface Topic {
  id: string;
  name: string;
  keywords: string[];
  intent: string;
  description: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Variant {
  id: string;
  content_id: string;
  platform: string;
  format: string;
  body_text: string;
  hashtags: string[];
  character_count: number;
  platform_settings: Record<string, unknown> | null;
  status: string;
  actor_type: ActorType;
  created_at: string;
  updated_at: string;
}

export interface ContentFilter {
  status?: ContentStatus;
  category?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}

export type ContentCreateInput = Omit<Content, 'id' | 'created_at' | 'updated_at' | 'status'> & {
  status?: ContentStatus; // Will be forced to 'draft'
};

export type ContentUpdateInput = Partial<Omit<Content, 'id' | 'created_at' | 'updated_at'>>;

export interface TopicCreateInput {
  name: string;
  keywords?: string[];
  intent?: string;
  description?: string;
  sort_order?: number;
}

export interface VariantCreateInput {
  content_id: string;
  platform: string;
  format: string;
  body_text?: string;
  hashtags?: string[];
  character_count?: number;
  platform_settings?: Record<string, unknown>;
  status?: string;
  actor_type?: ActorType;
}

export interface VariantUpdateInput {
  content_id?: string;
  platform?: string;
  format?: string;
  body_text?: string;
  hashtags?: string[];
  character_count?: number;
  platform_settings?: Record<string, unknown>;
  status?: string;
  actor_type?: ActorType;
}

export interface PublicationCreateInput {
  content_id: string;
  variant_id?: string;
  channel: string;
  channel_post_id?: string;
  postiz_post_id?: string;
  url?: string;
  metrics?: Record<string, unknown>;
}

export interface MetricsResult {
  content_id: string;
  publications: Publication[];
  total_publications: number;
}

// Phase 2 types

export type ActivityAction = 'create' | 'update' | 'delete' | 'publish' | 'revert' | 'promote';
export type ActorType = 'agent' | 'human';

export interface ActivityLog {
  id: string;
  action: ActivityAction;
  collection: string;
  item_id: string;
  actor?: string | null;
  actor_type: ActorType;
  payload?: Record<string, unknown> | null;
  timestamp: string;
}

export interface ActivityLogCreateInput {
  action: ActivityAction;
  collection: string;
  item_id: string;
  actor?: string;
  actor_type?: ActorType;
  payload?: Record<string, unknown>;
}

export interface ActivityLogFilter {
  collection?: string;
  action?: ActivityAction;
  actor_type?: ActorType;
  limit?: number;
}

export interface Revision {
  id: string;
  content_id: string;
  version_number: number;
  data: Record<string, unknown>;
  delta?: Record<string, unknown> | null;
  created_by?: string | null;
  actor_type: ActorType;
  created_at: string;
}

export interface Media {
  id: string;
  filename: string;
  mime_type?: string | null;
  file_size?: number | null;
  width?: number | null;
  height?: number | null;
  url: string;
  storage_path?: string | null;
  alt_text?: string | null;
  caption?: string | null;
  created_by?: string | null;
  created_at: string;
}

export interface MediaCreateInput {
  filename: string;
  mime_type?: string;
  file_size?: number;
  width?: number;
  height?: number;
  url: string;
  storage_path?: string;
  alt_text?: string;
  caption?: string;
  created_by?: string;
}

export interface ContentMedia {
  id: string;
  content_id: string;
  media_id: string;
  role: string;
  sort_order: number;
}

export interface ContentRelation {
  id: string;
  source_id: string;
  target_id: string;
  relation_type: 'related' | 'series' | 'parent-child';
  sort_order: number;
}

// ── Gallery (AWC Web + APP 공용) ──────────────────────────────
export type GalleryKind =
  | 'landing'
  | 'ad'
  | 'case_study'
  | 'ai_influencer'
  | 'other';

export type GalleryCoverAspect = '1:1' | '16:9' | '9:16' | '4:5' | '3:4';

export type GalleryStatus = 'draft' | 'published' | 'archived';

export type GalleryVisibility = 'internal' | 'member' | 'public';

export interface GalleryItem {
  id: string;
  slug: string;
  title: string;
  subtitle?: string | null;
  summary?: string | null;
  kind: GalleryKind;
  kinds: GalleryKind[];
  source_table?: string | null;
  source_id?: string | null;
  cover_media_id?: string | null;
  cover_aspect: GalleryCoverAspect;
  status: GalleryStatus;
  visibility: GalleryVisibility;
  is_featured: boolean;
  featured_rank?: number | null;
  published_at?: string | null;
  featured_at?: string | null;
  created_at: string;
  updated_at: string;
  tags: string[];
  brand: string;
  author?: string | null;
  duration_minutes?: number | null;
  source_label: string;
  metrics: Record<string, unknown>;
}

export interface GalleryItemCreateInput {
  slug: string;
  title: string;
  subtitle?: string;
  summary?: string;
  kinds: GalleryKind[];
  source_table?: string;
  source_id?: string;
  cover_media_id?: string;
  cover_aspect?: GalleryCoverAspect;
  status?: GalleryStatus;
  visibility?: GalleryVisibility;
  is_featured?: boolean;
  featured_rank?: number;
  published_at?: string;
  tags?: string[];
  author?: string;
  duration_minutes?: number;
  source_label?: string;
}

export interface GalleryItemFilter {
  status?: GalleryStatus;
  kinds?: GalleryKind[];
  is_featured?: boolean;
  visibility?: GalleryVisibility;
  limit?: number;
  offset?: number;
}

export interface GalleryFeaturedUpdate {
  id: string;
  is_featured: boolean;
  featured_rank?: number | null;
}

export interface GalleryItemUpdateInput {
  title?: string;
  subtitle?: string | null;
  summary?: string | null;
  kinds?: GalleryKind[];
  cover_media_id?: string | null;
  cover_aspect?: GalleryCoverAspect;
  status?: GalleryStatus;
  visibility?: GalleryVisibility;
  is_featured?: boolean;
  featured_rank?: number | null;
  published_at?: string | null;
  tags?: string[];
  author?: string | null;
  duration_minutes?: number | null;
}

export type GalleryMediaRole = 'cover' | 'gallery' | 'detail' | 'hero_video';

export interface GalleryItemMedia {
  id: string;
  item_id: string;
  media_id: string;
  role: GalleryMediaRole;
  sort_order: number;
  created_at: string;
}

export interface GalleryMediaAttachInput {
  item_id: string;
  media_id: string;
  role?: GalleryMediaRole;
  sort_order?: number;
}

export interface GalleryMediaReorderInput {
  id: string;
  sort_order: number;
}
