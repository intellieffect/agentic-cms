#!/usr/bin/env node

import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SupabaseAdapter } from './adapters/supabase.js';
import { registerContentTools } from './tools/contents.js';
import { registerIdeaTools } from './tools/ideas.js';
import { registerPublicationTools } from './tools/publications.js';

async function main(): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const adapter = new SupabaseAdapter(supabaseUrl, supabaseKey);

  const server = new McpServer({
    name: 'agentic-cms',
    version: '0.1.0',
  });

  registerContentTools(server, adapter);
  registerIdeaTools(server, adapter);
  registerPublicationTools(server, adapter);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('Agentic CMS MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
