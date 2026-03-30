export type ContentStatus = "draft" | "review" | "published";

export interface Content {
  id: string;
  title: string;
  slug: string;
  status: ContentStatus;
  category: string | null;
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
  promoted_to: string | null;
  created_at: string;
}

export interface Publication {
  id: string;
  content_id: string;
  channel: string;
  channel_post_id: string | null;
  url: string | null;
  published_at: string;
  metrics: Record<string, unknown> | null;
  contents?: { title: string } | null;
}

export interface PipelineStats {
  ideas: number;
  drafts: number;
  inReview: number;
  published: number;
}

export interface ChannelCount {
  channel: string;
  count: number;
}
