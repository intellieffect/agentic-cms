#!/usr/bin/env node

import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SupabaseAdapter } from './adapters/supabase.js';
import { registerContentTools } from './tools/contents.js';
import { registerIdeaTools } from './tools/ideas.js';
import { registerTopicTools } from './tools/topics.js';
import { registerVariantTools } from './tools/variants.js';
import { registerPublicationTools } from './tools/publications.js';
import { registerActivityTools } from './tools/activity.js';
import { registerRevisionTools } from './tools/revisions.js';
import { registerMediaTools } from './tools/media.js';
import { registerVideoTools } from './tools/video.js';
import { registerBlogPostTools } from './tools/blog-posts.js';
import { registerCarouselTools } from './tools/carousels.js';
import { registerNewsletterTools } from './tools/newsletter.js';
import { registerVideoLinkTools } from './tools/video-link.js';

async function main(): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const editorApiUrl = process.env.EDITOR_API_URL || 'http://localhost:8092';
  const adapter = new SupabaseAdapter(supabaseUrl, supabaseKey);

  const server = new McpServer({
    name: 'agentic-cms',
    version: '0.2.0',
  });

  // Core tools
  registerContentTools(server, adapter);
  registerIdeaTools(server, adapter);
  registerTopicTools(server, adapter);
  registerVariantTools(server, adapter);
  registerPublicationTools(server, adapter);

  // Phase 2 tools
  registerActivityTools(server, adapter);
  registerRevisionTools(server, adapter);
  registerMediaTools(server, adapter);

  // Video editor tools
  registerVideoTools(server, editorApiUrl);

  // Blog post tools (AWC blog — blog_posts table, markdown → PlateJS)
  registerBlogPostTools(server);

  // Carousel tools (AWC carousels table — slide deck CRUD)
  registerCarouselTools(server, adapter);

  // Newsletter — HTTP wrap over dashboard send endpoint + email_logs.variant_id linking
  registerNewsletterTools(server, adapter);

  // video_projects 는 brxce-editor 경유 생성이라 variant_id 를 post-link 로 채우는 전용 도구.
  registerVideoLinkTools(server, adapter);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('Agentic CMS MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
