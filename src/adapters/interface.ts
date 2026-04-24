import type {
  Content,
  ContentCreateInput,
  ContentFilter,
  ContentUpdateInput,
  Idea,
  IdeaCreateInput,
  IdeaUpdateInput,
  IdeaFilter,
  Topic,
  TopicCreateInput,
  Variant,
  VariantCreateInput,
  VariantUpdateInput,
  MetricsResult,
  Publication,
  PublicationCreateInput,
  ActivityLog,
  ActivityLogCreateInput,
  ActivityLogFilter,
  Revision,
  Media,
  MediaCreateInput,
  GalleryItem,
  GalleryItemCreateInput,
  GalleryItemFilter,
  GalleryFeaturedUpdate,
  GalleryItemUpdateInput,
  GalleryItemMedia,
  GalleryMediaAttachInput,
  GalleryMediaReorderInput,
} from '../types.js';

export interface CMSAdapter {
  // Contents
  listContents(filter?: ContentFilter): Promise<Content[]>;
  getContent(idOrSlug: string): Promise<Content>;
  createContent(input: ContentCreateInput): Promise<Content>;
  updateContent(id: string, input: ContentUpdateInput): Promise<Content>;

  // Ideas
  listIdeas(filter?: IdeaFilter): Promise<Idea[]>;
  getIdea(id: string): Promise<Idea>;
  createIdea(input: IdeaCreateInput): Promise<Idea>;
  updateIdea(id: string, input: IdeaUpdateInput): Promise<Idea>;
  promoteIdea(ideaId: string, contentData: ContentCreateInput): Promise<Content>;

  // Topics
  listTopics(): Promise<Topic[]>;
  createTopic(input: TopicCreateInput): Promise<Topic>;

  // Variants
  listVariants(contentId: string): Promise<Variant[]>;
  createVariant(input: VariantCreateInput): Promise<Variant>;
  updateVariant(id: string, input: VariantUpdateInput): Promise<Variant>;

  // Publications
  createPublication(input: PublicationCreateInput): Promise<Publication>;
  getMetrics(contentId: string): Promise<MetricsResult>;

  // Activity Logs
  logActivity(data: ActivityLogCreateInput): Promise<ActivityLog>;
  getActivityLogs(filter?: ActivityLogFilter): Promise<ActivityLog[]>;

  // Revisions
  createRevision(contentId: string, data: Record<string, unknown>, createdBy?: string, actorType?: 'agent' | 'human'): Promise<Revision>;
  getRevisions(contentId: string): Promise<Revision[]>;
  getHumanFeedback(contentId: string): Promise<Revision[]>;

  // Media
  listMedia(limit?: number): Promise<Media[]>;
  createMedia(data: MediaCreateInput): Promise<Media>;

  // Gallery (AWC Web + APP 페어링)
  listGalleryItems(filter?: GalleryItemFilter): Promise<GalleryItem[]>;
  getGalleryItem(id: string): Promise<GalleryItem | null>;
  createGalleryItem(input: GalleryItemCreateInput): Promise<GalleryItem>;
  updateGalleryItem(id: string, patch: GalleryItemUpdateInput): Promise<GalleryItem>;
  deleteGalleryItem(id: string): Promise<void>;
  setGalleryFeatured(input: GalleryFeaturedUpdate): Promise<GalleryItem>;

  // Gallery item media (1 item → N media)
  listGalleryMedia(itemId: string): Promise<GalleryItemMedia[]>;
  attachGalleryMedia(input: GalleryMediaAttachInput): Promise<GalleryItemMedia>;
  detachGalleryMedia(linkId: string): Promise<void>;
  reorderGalleryMedia(updates: GalleryMediaReorderInput[]): Promise<void>;
  setGalleryCover(itemId: string, mediaId: string): Promise<GalleryItem>;
}
