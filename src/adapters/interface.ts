import type {
  Content,
  ContentCreateInput,
  ContentFilter,
  ContentUpdateInput,
  Idea,
  MetricsResult,
  Publication,
  PublicationCreateInput,
} from '../types.js';

export interface CMSAdapter {
  listContents(filter?: ContentFilter): Promise<Content[]>;
  getContent(idOrSlug: string): Promise<Content>;
  createContent(input: ContentCreateInput): Promise<Content>;
  updateContent(id: string, input: ContentUpdateInput): Promise<Content>;
  listIdeas(): Promise<Idea[]>;
  promoteIdea(ideaId: string, contentData: ContentCreateInput): Promise<Content>;
  createPublication(input: PublicationCreateInput): Promise<Publication>;
  getMetrics(contentId: string): Promise<MetricsResult>;
}
