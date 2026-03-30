import type {
  Content,
  ContentCreateInput,
  ContentFilter,
  ContentUpdateInput,
  Idea,
  MetricsResult,
  Publication,
  PublicationCreateInput,
  ActivityLog,
  ActivityLogCreateInput,
  ActivityLogFilter,
  Revision,
  Media,
  MediaCreateInput,
} from '../types.js';

export interface CMSAdapter {
  // Contents
  listContents(filter?: ContentFilter): Promise<Content[]>;
  getContent(idOrSlug: string): Promise<Content>;
  createContent(input: ContentCreateInput): Promise<Content>;
  updateContent(id: string, input: ContentUpdateInput): Promise<Content>;

  // Ideas
  listIdeas(): Promise<Idea[]>;
  promoteIdea(ideaId: string, contentData: ContentCreateInput): Promise<Content>;

  // Publications
  createPublication(input: PublicationCreateInput): Promise<Publication>;
  getMetrics(contentId: string): Promise<MetricsResult>;

  // Activity Logs
  logActivity(data: ActivityLogCreateInput): Promise<ActivityLog>;
  getActivityLogs(filter?: ActivityLogFilter): Promise<ActivityLog[]>;

  // Revisions
  createRevision(contentId: string, data: Record<string, unknown>, createdBy?: string, actorType?: 'agent' | 'human'): Promise<Revision>;
  getRevisions(contentId: string): Promise<Revision[]>;

  // Media
  listMedia(limit?: number): Promise<Media[]>;
  createMedia(data: MediaCreateInput): Promise<Media>;
}
