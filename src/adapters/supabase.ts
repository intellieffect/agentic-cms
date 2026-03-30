import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { CMSAdapter } from './interface.js';
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

  async listIdeas(): Promise<Idea[]> {
    const { data, error } = await this.client
      .from('ideas')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to list ideas: ${error.message}`);
    return data as Idea[];
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
}
