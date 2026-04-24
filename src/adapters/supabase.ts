import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { CMSAdapter } from './interface.js';
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
import { hooks } from '../hooks.js';

export class SupabaseAdapter implements CMSAdapter {
  private client: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient(url, serviceRoleKey);
  }

  // ─── Contents ──────────────────────────────────────────────

  async listContents(filter?: ContentFilter): Promise<Content[]> {
    let query = this.client.from('contents').select('*');

    if (filter?.status) {
      query = query.eq('status', filter.status);
    }
    if (filter?.category) {
      query = query.eq('category', filter.category);
    }
    if (filter?.tags && filter.tags.length > 0) {
      query = query.overlaps('tags', filter.tags);
    }
    if (filter?.limit) {
      query = query.limit(filter.limit);
    }
    if (filter?.offset) {
      query = query.range(filter.offset, filter.offset + (filter.limit ?? 50) - 1);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw new Error(`Failed to list contents: ${error.message}`);
    return data as Content[];
  }

  async getContent(idOrSlug: string): Promise<Content> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);

    const { data, error } = await this.client
      .from('contents')
      .select('*')
      .eq(isUuid ? 'id' : 'slug', idOrSlug)
      .single();

    if (error) throw new Error(`Content not found: ${error.message}`);
    return data as Content;
  }

  async createContent(input: ContentCreateInput): Promise<Content> {
    const record = {
      ...input,
      status: 'draft' as const,
    };

    // Run beforeCreate hooks
    await hooks.run({
      action: 'beforeCreate',
      collection: 'contents',
      data: record as unknown as Record<string, unknown>,
    });

    const { data, error } = await this.client
      .from('contents')
      .insert(record)
      .select()
      .single();

    if (error) throw new Error(`Failed to create content: ${error.message}`);
    const content = data as Content;

    // Run afterCreate hooks
    await hooks.run({
      action: 'afterCreate',
      collection: 'contents',
      data: record as unknown as Record<string, unknown>,
      result: content as unknown as Record<string, unknown>,
    });

    // Auto-log activity
    await this.logActivity({
      action: 'create',
      collection: 'contents',
      item_id: content.id,
      actor_type: 'agent',
      payload: { title: content.title, slug: content.slug },
    }).catch((err) => console.error('Failed to log activity:', err));

    // Auto-create initial revision
    await this.createRevision(
      content.id,
      content as unknown as Record<string, unknown>,
    ).catch((err) => console.error('Failed to create revision:', err));

    return content;
  }

  async updateContent(id: string, input: ContentUpdateInput): Promise<Content> {
    // Run beforeUpdate hooks (includes the published-status block)
    await hooks.run({
      action: 'beforeUpdate',
      collection: 'contents',
      data: input as unknown as Record<string, unknown>,
    });

    const { data, error } = await this.client
      .from('contents')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update content: ${error.message}`);
    const content = data as Content;

    // Run afterUpdate hooks
    await hooks.run({
      action: 'afterUpdate',
      collection: 'contents',
      data: input as unknown as Record<string, unknown>,
      result: content as unknown as Record<string, unknown>,
    });

    // Auto-log activity
    await this.logActivity({
      action: 'update',
      collection: 'contents',
      item_id: content.id,
      actor_type: 'agent',
      payload: input as Record<string, unknown>,
    }).catch((err) => console.error('Failed to log activity:', err));

    // Auto-create revision
    await this.createRevision(
      content.id,
      content as unknown as Record<string, unknown>,
    ).catch((err) => console.error('Failed to create revision:', err));

    return content;
  }

  // ─── Ideas ─────────────────────────────────────────────────

  async listIdeas(filter?: IdeaFilter): Promise<Idea[]> {
    let query = this.client.from('ideas').select('*');
    if (filter?.topic_id) query = query.eq('topic_id', filter.topic_id);
    if (filter?.promoted === true) query = query.not('promoted_to', 'is', null);
    if (filter?.promoted === false) query = query.is('promoted_to', null);
    if (filter?.limit) query = query.limit(filter.limit);
    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw new Error(`Failed to list ideas: ${error.message}`);
    return data as Idea[];
  }

  async getIdea(id: string): Promise<Idea> {
    const { data, error } = await this.client
      .from('ideas')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(`Failed to fetch idea ${id}`);
    if (!data) throw new Error(`Idea not found: ${id}`);
    return data as Idea;
  }

  async createIdea(input: IdeaCreateInput): Promise<Idea> {
    // topic_id 가 넘어온 경우 존재 여부 먼저 확인 — FK 위반 에러 대신 친절한 메시지.
    if (input.topic_id) {
      const { data: topic, error: topicErr } = await this.client
        .from('topics')
        .select('id')
        .eq('id', input.topic_id)
        .maybeSingle();
      if (topicErr) throw new Error('Failed to verify topic_id');
      if (!topic) {
        throw new Error(
          `Topic not found: ${input.topic_id}. Use list_topics to discover valid ids.`,
        );
      }
    }

    const payload = {
      raw_text: input.raw_text,
      source: input.source ?? 'agent',
      topic_id: input.topic_id ?? null,
      angle: input.angle ?? null,
      target_audience: input.target_audience ?? null,
    };
    const { data, error } = await this.client
      .from('ideas')
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(`Failed to create idea: ${error.message}`);
    const idea = data as Idea;

    await this.logActivity({
      action: 'create',
      collection: 'ideas',
      item_id: idea.id,
      actor_type: 'agent',
      payload: { source: idea.source, topic_id: idea.topic_id, angle: idea.angle },
    }).catch((err) => console.error('Failed to log idea create activity:', err));

    return idea;
  }

  async updateIdea(id: string, input: IdeaUpdateInput): Promise<Idea> {
    const { data, error } = await this.client
      .from('ideas')
      .update(input)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(`Failed to update idea ${id}: ${error.message}`);
    const idea = data as Idea;

    await this.logActivity({
      action: 'update',
      collection: 'ideas',
      item_id: idea.id,
      actor_type: 'agent',
      payload: { updated_fields: Object.keys(input) },
    }).catch((err) => console.error('Failed to log idea update activity:', err));

    return idea;
  }

  async promoteIdea(ideaId: string, contentData: ContentCreateInput): Promise<Content> {
    // Create the content (status forced to draft, activity + revision auto-logged)
    const content = await this.createContent(contentData);

    // Link the idea to the new content
    const { error } = await this.client
      .from('ideas')
      .update({ promoted_to: content.id })
      .eq('id', ideaId);

    if (error) {
      console.error(`Warning: Content created but failed to link idea: ${error.message}`);
    }

    // Log promote activity
    await this.logActivity({
      action: 'promote',
      collection: 'ideas',
      item_id: ideaId,
      actor_type: 'agent',
      payload: { promoted_to: content.id, title: content.title },
    }).catch((err) => console.error('Failed to log promote activity:', err));

    return content;
  }

  // ─── Topics ────────────────────────────────────────────────

  async listTopics(): Promise<Topic[]> {
    const { data, error } = await this.client
      .from('topics')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) throw new Error(`Failed to list topics: ${error.message}`);
    return data as Topic[];
  }

  async createTopic(input: TopicCreateInput): Promise<Topic> {
    const { data, error } = await this.client
      .from('topics')
      .insert(input)
      .select()
      .single();

    if (error) throw new Error(`Failed to create topic: ${error.message}`);
    const topic = data as Topic;

    await this.logActivity({
      action: 'create',
      collection: 'topics',
      item_id: topic.id,
      actor_type: 'agent',
      payload: { name: topic.name, sort_order: topic.sort_order },
    }).catch((err) => console.error('Failed to log topic activity:', err));

    return topic;
  }

  // ─── Variants ──────────────────────────────────────────────

  async listVariants(contentId: string): Promise<Variant[]> {
    const { data, error } = await this.client
      .from('variants')
      .select('*')
      .eq('content_id', contentId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to list variants: ${error.message}`);
    return data as Variant[];
  }

  async createVariant(input: VariantCreateInput): Promise<Variant> {
    const { data, error } = await this.client
      .from('variants')
      .insert(input)
      .select()
      .single();

    if (error) throw new Error(`Failed to create variant: ${error.message}`);
    const variant = data as Variant;

    await this.logActivity({
      action: 'create',
      collection: 'variants',
      item_id: variant.id,
      actor_type: 'agent',
      payload: {
        content_id: variant.content_id,
        platform: variant.platform,
        format: variant.format,
      },
    }).catch((err) => console.error('Failed to log variant activity:', err));

    return variant;
  }

  async updateVariant(id: string, input: VariantUpdateInput): Promise<Variant> {
    const { data, error } = await this.client
      .from('variants')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update variant: ${error.message}`);
    const variant = data as Variant;

    await this.logActivity({
      action: 'update',
      collection: 'variants',
      item_id: variant.id,
      actor_type: 'agent',
      payload: input as Record<string, unknown>,
    }).catch((err) => console.error('Failed to log variant activity:', err));

    return variant;
  }

  // ─── Publications ──────────────────────────────────────────

  async createPublication(input: PublicationCreateInput): Promise<Publication> {
    const { data, error } = await this.client
      .from('publications')
      .insert(input)
      .select()
      .single();

    if (error) throw new Error(`Failed to create publication: ${error.message}`);
    const publication = data as Publication;

    // Log activity
    await this.logActivity({
      action: 'publish',
      collection: 'publications',
      item_id: publication.id,
      actor_type: 'agent',
      payload: { content_id: input.content_id, channel: input.channel },
    }).catch((err) => console.error('Failed to log publish activity:', err));

    return publication;
  }

  async getMetrics(contentId: string): Promise<MetricsResult> {
    const { data, error } = await this.client
      .from('publications')
      .select('*')
      .eq('content_id', contentId)
      .order('published_at', { ascending: false });

    if (error) throw new Error(`Failed to get metrics: ${error.message}`);

    const publications = data as Publication[];
    return {
      content_id: contentId,
      publications,
      total_publications: publications.length,
    };
  }

  // ─── Activity Logs ─────────────────────────────────────────

  async logActivity(data: ActivityLogCreateInput): Promise<ActivityLog> {
    const { data: result, error } = await this.client
      .from('activity_logs')
      .insert({
        action: data.action,
        collection: data.collection,
        item_id: data.item_id,
        actor: data.actor ?? null,
        actor_type: data.actor_type ?? 'agent',
        payload: data.payload ?? {},
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to log activity: ${error.message}`);
    return result as ActivityLog;
  }

  async getActivityLogs(filter?: ActivityLogFilter): Promise<ActivityLog[]> {
    let query = this.client.from('activity_logs').select('*');

    if (filter?.collection) {
      query = query.eq('collection', filter.collection);
    }
    if (filter?.action) {
      query = query.eq('action', filter.action);
    }
    if (filter?.actor_type) {
      query = query.eq('actor_type', filter.actor_type);
    }

    const limit = filter?.limit ?? 50;
    query = query.order('timestamp', { ascending: false }).limit(limit);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to get activity logs: ${error.message}`);
    return data as ActivityLog[];
  }

  // ─── Revisions ─────────────────────────────────────────────

  async createRevision(
    contentId: string,
    data: Record<string, unknown>,
    createdBy?: string,
    actorType?: 'agent' | 'human',
  ): Promise<Revision> {
    // Get next version number
    const { count, error: countError } = await this.client
      .from('revisions')
      .select('id', { count: 'exact', head: true })
      .eq('content_id', contentId);

    if (countError) throw new Error(`Failed to count revisions: ${countError.message}`);

    const versionNumber = (count ?? 0) + 1;

    const { data: result, error } = await this.client
      .from('revisions')
      .insert({
        content_id: contentId,
        version_number: versionNumber,
        data,
        created_by: createdBy ?? null,
        actor_type: actorType ?? 'agent',
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create revision: ${error.message}`);
    return result as Revision;
  }

  async getRevisions(contentId: string): Promise<Revision[]> {
    const { data, error } = await this.client
      .from('revisions')
      .select('*')
      .eq('content_id', contentId)
      .order('version_number', { ascending: false });

    if (error) throw new Error(`Failed to get revisions: ${error.message}`);
    return data as Revision[];
  }

  async getHumanFeedback(contentId: string): Promise<Revision[]> {
    const { data, error } = await this.client
      .from('revisions')
      .select('*')
      .eq('content_id', contentId)
      .eq('actor_type', 'human')
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to get human feedback: ${error.message}`);
    return data as Revision[];
  }

  // ─── Media ─────────────────────────────────────────────────

  async listMedia(limit?: number): Promise<Media[]> {
    const { data, error } = await this.client
      .from('media')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit ?? 50);

    if (error) throw new Error(`Failed to list media: ${error.message}`);
    return data as Media[];
  }

  async createMedia(input: MediaCreateInput): Promise<Media> {
    const { data, error } = await this.client
      .from('media')
      .insert(input)
      .select()
      .single();

    if (error) throw new Error(`Failed to create media: ${error.message}`);
    return data as Media;
  }

  // ─── Gallery ──────────────────────────────────────────────

  async listGalleryItems(filter: GalleryItemFilter = {}): Promise<GalleryItem[]> {
    let q = this.client.from('gallery_items').select('*');

    if (filter.status) q = q.eq('status', filter.status);
    if (filter.kind) q = q.eq('kind', filter.kind);
    if (typeof filter.is_featured === 'boolean') q = q.eq('is_featured', filter.is_featured);
    if (filter.visibility) q = q.eq('visibility', filter.visibility);

    q = q.order('is_featured', { ascending: false })
      .order('featured_rank', { ascending: true, nullsFirst: false })
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(filter.limit ?? 50);

    if (filter.offset) {
      q = q.range(filter.offset, filter.offset + (filter.limit ?? 50) - 1);
    }

    const { data, error } = await q;
    if (error) throw new Error(`Failed to list gallery items: ${error.message}`);
    return data as GalleryItem[];
  }

  async createGalleryItem(input: GalleryItemCreateInput): Promise<GalleryItem> {
    const payload = {
      status: 'draft' as const,
      visibility: 'public' as const,
      is_featured: false,
      cover_aspect: '16:9' as const,
      source_label: 'Agentic CMS',
      brand: 'awc',
      tags: [] as string[],
      ...input,
    };

    const { data, error } = await this.client
      .from('gallery_items')
      .insert(payload)
      .select()
      .single();

    if (error) throw new Error(`Failed to create gallery item: ${error.message}`);
    return data as GalleryItem;
  }

  async setGalleryFeatured(input: GalleryFeaturedUpdate): Promise<GalleryItem> {
    const patch: Record<string, unknown> = {
      is_featured: input.is_featured,
      featured_rank: input.is_featured ? (input.featured_rank ?? null) : null,
      featured_at: input.is_featured ? new Date().toISOString() : null,
    };

    const { data, error } = await this.client
      .from('gallery_items')
      .update(patch)
      .eq('id', input.id)
      .select()
      .single();

    if (error) throw new Error(`Failed to set gallery featured: ${error.message}`);
    return data as GalleryItem;
  }

  async getGalleryItem(id: string): Promise<GalleryItem | null> {
    const { data, error } = await this.client
      .from('gallery_items')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(`Failed to get gallery item: ${error.message}`);
    return (data as GalleryItem) ?? null;
  }

  async updateGalleryItem(id: string, patch: GalleryItemUpdateInput): Promise<GalleryItem> {
    const finalPatch: Record<string, unknown> = { ...patch };
    if (patch.status === 'published' && !('published_at' in patch)) {
      finalPatch.published_at = new Date().toISOString();
    }
    if (patch.is_featured === true && !('featured_at' in patch)) {
      finalPatch.featured_at = new Date().toISOString();
    }
    if (patch.is_featured === false) {
      finalPatch.featured_rank = null;
      finalPatch.featured_at = null;
    }

    const { data, error } = await this.client
      .from('gallery_items')
      .update(finalPatch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(`Failed to update gallery item: ${error.message}`);
    return data as GalleryItem;
  }

  async deleteGalleryItem(id: string): Promise<void> {
    const { error } = await this.client.from('gallery_items').delete().eq('id', id);
    if (error) throw new Error(`Failed to delete gallery item: ${error.message}`);
  }

  // ─── Gallery item media ─────────────────────────────────────

  async listGalleryMedia(itemId: string): Promise<GalleryItemMedia[]> {
    const { data, error } = await this.client
      .from('gallery_item_media')
      .select('*')
      .eq('item_id', itemId)
      .order('sort_order', { ascending: true });
    if (error) throw new Error(`Failed to list gallery media: ${error.message}`);
    return data as GalleryItemMedia[];
  }

  async attachGalleryMedia(input: GalleryMediaAttachInput): Promise<GalleryItemMedia> {
    const payload = {
      item_id: input.item_id,
      media_id: input.media_id,
      role: input.role ?? 'gallery',
      sort_order: input.sort_order ?? 0,
    };
    const { data, error } = await this.client
      .from('gallery_item_media')
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(`Failed to attach gallery media: ${error.message}`);
    return data as GalleryItemMedia;
  }

  async detachGalleryMedia(linkId: string): Promise<void> {
    const { error } = await this.client
      .from('gallery_item_media')
      .delete()
      .eq('id', linkId);
    if (error) throw new Error(`Failed to detach gallery media: ${error.message}`);
  }

  async reorderGalleryMedia(updates: GalleryMediaReorderInput[]): Promise<void> {
    const results = await Promise.all(
      updates.map((u) =>
        this.client
          .from('gallery_item_media')
          .update({ sort_order: u.sort_order })
          .eq('id', u.id)
          .then((r) => ({ id: u.id, error: r.error }))
      )
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      throw new Error(`Failed to reorder gallery media (${failed.id}): ${failed.error.message}`);
    }
  }

  async setGalleryCover(itemId: string, mediaId: string): Promise<GalleryItem> {
    const { data, error } = await this.client
      .from('gallery_items')
      .update({ cover_media_id: mediaId })
      .eq('id', itemId)
      .select()
      .single();
    if (error) throw new Error(`Failed to set gallery cover: ${error.message}`);
    return data as GalleryItem;
  }
}
