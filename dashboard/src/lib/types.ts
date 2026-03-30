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
