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
} from '../types.js';

export class SupabaseAdapter implements CMSAdapter {
  private client: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient(url, serviceRoleKey);
  }

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
    // SAFETY: Always force status to 'draft'
    const record = {
      ...input,
      status: 'draft' as const,
    };

    const { data, error } = await this.client
      .from('contents')
      .insert(record)
      .select()
      .single();

    if (error) throw new Error(`Failed to create content: ${error.message}`);
    return data as Content;
  }

  async updateContent(id: string, input: ContentUpdateInput): Promise<Content> {
    // SAFETY: Block any attempt to set status to 'published'
    if (input.status === 'published') {
      throw new Error(
        'Cannot set status to "published" via agent. Publishing requires human approval.'
      );
    }

    const { data, error } = await this.client
      .from('contents')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update content: ${error.message}`);
    return data as Content;
  }

  async listIdeas(): Promise<Idea[]> {
    const { data, error } = await this.client
      .from('ideas')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to list ideas: ${error.message}`);
    return data as Idea[];
  }

  async promoteIdea(ideaId: string, contentData: ContentCreateInput): Promise<Content> {
    // Create the content (status forced to draft)
    const content = await this.createContent(contentData);

    // Link the idea to the new content
    const { error } = await this.client
      .from('ideas')
      .update({ promoted_to: content.id })
      .eq('id', ideaId);

    if (error) {
      console.error(`Warning: Content created but failed to link idea: ${error.message}`);
    }

    return content;
  }

  async createPublication(input: PublicationCreateInput): Promise<Publication> {
    const { data, error } = await this.client
      .from('publications')
      .insert(input)
      .select()
      .single();

    if (error) throw new Error(`Failed to create publication: ${error.message}`);
    return data as Publication;
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
}
