export type ContentStatus = 'draft' | 'review' | 'published';

export interface Content {
  id: string;
  title: string;
  slug: string;
  status: ContentStatus;
  category?: string | null;
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
  promoted_to?: string | null;
  created_at: string;
}

export interface Publication {
  id: string;
  content_id: string;
  channel: string;
  channel_post_id?: string | null;
  url?: string | null;
  published_at: string;
  metrics?: Record<string, unknown> | null;
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

export interface PublicationCreateInput {
  content_id: string;
  channel: string;
  channel_post_id?: string;
  url?: string;
  metrics?: Record<string, unknown>;
}

export interface MetricsResult {
  content_id: string;
  publications: Publication[];
  total_publications: number;
}
