export type ContentStatus = "draft" | "review" | "published";

export interface Topic {
  id: string;
  name: string;
  keywords: string[];
  intent: string;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Content {
  id: string;
  title: string;
  slug: string;
  status: ContentStatus;
  topic_id?: string;
  category: string | null;
  content_type?: string;
  body_md: string | null;
  tags: string[] | null;
  hook: string | null;
  core_message: string | null;
  media_type: string | null;
  media_urls: Record<string, unknown> | null;
  funnel_stage: string | null;
  cta: string | null;
  fact_checked: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface Idea {
  id: string;
  raw_text: string;
  source: string | null;
  topic_id?: string;
  angle?: string;
  target_audience?: string;
  promoted_to: string | null;
  created_at: string;
}

export interface Variant {
  id: string;
  content_id: string;
  platform: string;
  format: string;
  body_text: string | null;
  hashtags: string[];
  character_count: number | null;
  platform_settings: Record<string, unknown> | null;
  status: string;
  actor_type: string;
  created_at: string;
  updated_at: string;
  contents?: { title: string } | null;
}

// Variant 에 연결된 format 별 파생 레코드. Contents 상세의 "Derivatives" 섹션용.
export interface VariantBlogPost {
  id: string;
  title: string;
  slug: string;
  status: string;
}
export interface VariantCarousel {
  id: string;
  title: string;
  caption: string | null;
}
export interface VariantVideoProject {
  id: string;
  name: string;
  status: string;
}
export interface VariantEmailLog {
  id: string;
  subject: string;
  status: string;
  sent_at: string | null;
  sent_to_count: number | null;
}
export interface VariantWithDerivatives extends Variant {
  blog_post: VariantBlogPost | null;
  carousel: VariantCarousel | null;
  video_project: VariantVideoProject | null;
  emails: VariantEmailLog[];
}

export interface Publication {
  id: string;
  content_id: string;
  variant_id?: string;
  channel: string;
  channel_post_id: string | null;
  postiz_post_id?: string;
  url: string | null;
  published_at: string;
  metrics: Record<string, unknown> | null;
  contents?: { title: string } | null;
}

export interface PipelineStats {
  topics: number;
  ideas: number;
  variants: number;
  drafts: number;
  inReview: number;
  published: number;
}

export interface ChannelCount {
  channel: string;
  count: number;
}

// Phase 2 types

export type ActivityAction = 'create' | 'update' | 'delete' | 'publish' | 'revert' | 'promote';
export type ActorType = 'agent' | 'human';

export interface ActivityLog {
  id: string;
  action: ActivityAction;
  collection: string;
  item_id: string;
  actor: string | null;
  actor_type: ActorType;
  payload: Record<string, unknown> | null;
  timestamp: string;
}

export interface Revision {
  id: string;
  content_id: string;
  version_number: number;
  data: Record<string, unknown>;
  delta: Record<string, unknown> | null;
  created_by: string | null;
  actor_type: ActorType;
  created_at: string;
}

// Video editor types

export interface Project {
  id: string;
  name: string;
  clipCount?: number;
  totalDuration?: number;
  sources?: Array<string | { filename: string }>;
  updatedAt?: number | string;
  source?: string;
  locked?: boolean;
}

export interface ReferenceAccount {
  id: string;
  username?: string;
  account_name?: string;
  platform?: string;
  profile_pic_url?: string;
  video_count?: number;
}

export interface ReferenceVideo {
  id: string;
  caption?: string;
  platform?: string;
  url?: string;
  video_url?: string;
  duration_sec?: number;
  like_count?: number;
  comment_count?: number;
  view_count?: number;
  style_tags?: string[];
  transition_tags?: string[];
  music_tags?: string[];
  notes?: string;
  created_at?: string;
  account_name?: string;
  username?: string;
  favorite?: boolean;
  music_artist?: string;
  music_title?: string;
}

export interface FinishedVideo {
  id: string;
  name?: string;
  duration?: number;
  file_size?: number;
  width?: number;
  height?: number;
  tags?: string[];
  notes?: string;
  created_at?: string;
}

// ── Gallery ──────────────────────────────────────────────
export type GalleryKind =
  | 'landing'
  | 'video'
  | 'ad'
  | 'image'
  | 'carousel'
  | 'case_study'
  | 'other';

export type GalleryCoverAspect = '1:1' | '16:9' | '9:16' | '4:5' | '3:4';

export type GalleryItemStatus = 'draft' | 'published' | 'archived';

export type GalleryVisibility = 'internal' | 'member' | 'public';

export interface GalleryItem {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  kind: GalleryKind;
  kinds: GalleryKind[];
  source_table: string | null;
  source_id: string | null;
  cover_media_id: string | null;
  cover_aspect: GalleryCoverAspect;
  status: GalleryItemStatus;
  visibility: GalleryVisibility;
  is_featured: boolean;
  featured_rank: number | null;
  published_at: string | null;
  featured_at: string | null;
  created_at: string;
  updated_at: string;
  tags: string[];
  brand: string;
  author: string | null;
  duration_minutes: number | null;
  source_label: string;
  metrics: Record<string, unknown>;
}

export interface GalleryItemWithCover extends GalleryItem {
  cover_url: string | null;
  cover_mime: string | null;
}

export type GalleryMediaRole = 'cover' | 'gallery' | 'detail' | 'hero_video';

export interface GalleryItemMediaLink {
  id: string;
  item_id: string;
  media_id: string;
  role: GalleryMediaRole;
  sort_order: number;
  created_at: string;
  media_url: string | null;
  media_mime: string | null;
  media_filename: string | null;
}

export interface GalleryItemDetail extends GalleryItemWithCover {
  media_links: GalleryItemMediaLink[];
}
