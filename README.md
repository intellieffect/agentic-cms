# Agentic CMS

> Open-source MCP server that turns any CMS backend into an AI-agent-ready content management system.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## What is this?

Agentic CMS is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that gives AI agents full access to your content management workflows — create, read, update, publish, and track content through a standardized protocol.

Instead of building AI features *into* your CMS, Agentic CMS wraps *around* it. Your CMS stays as-is. The agents get a clean interface to work with.

```
┌─────────────────┐     MCP Protocol     ┌──────────────┐
│  AI Agents       │ ◄──────────────────► │  Agentic CMS │
│                  │     stdio / SSE      │  MCP Server   │
│  · Claude        │                      │               │
│  · OpenClaw      │                      │  Adapters:    │
│  · Cursor        │                      │  · Supabase   │
│  · Any MCP client│                      │  · Payload    │
└─────────────────┘                      │  · Strapi     │
                                          │  · (yours)    │
                                          └───────┬───────┘
                                                  │
                                          ┌───────▼───────┐
                                          │  Your CMS DB  │
                                          └───────────────┘
```

## Why?

- **Your CMS, your data** — Self-hosted, no vendor lock-in
- **Adapter pattern** — Supabase today, Payload/Strapi/anything tomorrow
- **MCP standard** — Works with Claude Desktop, OpenClaw, Cursor, and any MCP-compatible client
- **Safety first** — Publishing requires human approval by default. Agents create drafts, humans publish.
- **Open source** — MIT licensed. Use it, fork it, extend it.

## Features

### Tools (MCP)

| Tool | Description |
|------|-------------|
| `list_contents` | List content with filters (status, category, tags) |
| `get_content` | Get a single content item by slug or ID |
| `create_content` | Create new content (always starts as `draft`) |
| `update_content` | Update content fields (title, body, tags, etc.) |
| `list_ideas` | List content ideas |
| `promote_idea` | Promote an idea to a draft content item |
| `create_publication` | Record a publication event (channel, URL, metrics) |
| `get_metrics` | Get performance metrics for content |

### Safety

- `create_content` always sets status to `draft` — agents cannot publish directly
- `update_content` blocks status changes to `published` — human approval required
- All operations are logged and auditable

## Quick Start

### 1. Install

```bash
npm install @brxce/agentic-cms
```

### 2. Configure

Create `.env`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Run

```bash
npx agentic-cms
```

### 4. Connect to Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "agentic-cms": {
      "command": "npx",
      "args": ["@brxce/agentic-cms"],
      "env": {
        "SUPABASE_URL": "https://your-project.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "your-key"
      }
    }
  }
}
```

### 5. Connect to OpenClaw

```yaml
# ~/.openclaw/config.yaml
mcp:
  servers:
    agentic-cms:
      command: npx
      args: ["@brxce/agentic-cms"]
      env:
        SUPABASE_URL: https://your-project.supabase.co
        SUPABASE_SERVICE_ROLE_KEY: your-key
```

## Adapters

Agentic CMS uses an adapter pattern to support different CMS backends.

### Available

- **Supabase** — For Supabase/PostgreSQL-based CMS setups

### Planned

- **Payload CMS** — TypeScript-native headless CMS
- **Strapi** — Popular open-source headless CMS
- **Directus** — SQL-based headless CMS
- **Custom** — Implement the `CMSAdapter` interface for any backend

### Writing Your Own Adapter

```typescript
import { CMSAdapter } from '@brxce/agentic-cms';

export class MyAdapter implements CMSAdapter {
  async listContents(filter?: ContentFilter): Promise<Content[]> {
    // Your implementation
  }
  async getContent(idOrSlug: string): Promise<Content> {
    // Your implementation
  }
  // ... other methods
}
```

## Architecture

```
src/
├── server.ts              # MCP server entry point
├── tools/                 # MCP tool definitions
│   ├── contents.ts        # Content CRUD tools
│   ├── ideas.ts           # Idea management tools
│   └── publications.ts    # Publication tracking tools
├── adapters/
│   ├── interface.ts       # CMSAdapter interface
│   ├── supabase.ts        # Supabase adapter
│   └── (future adapters)
└── types.ts               # Shared types
```

## Supabase Schema

If you're starting fresh, here's the minimum schema:

```sql
-- Contents
create table contents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  status text default 'draft' check (status in ('draft', 'review', 'published')),
  category text,
  body_md text,
  tags text[],
  hook text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Ideas
create table ideas (
  id uuid primary key default gen_random_uuid(),
  raw_text text not null,
  source text default 'manual',
  promoted_to uuid references contents(id),
  created_at timestamptz default now()
);

-- Publications
create table publications (
  id uuid primary key default gen_random_uuid(),
  content_id uuid references contents(id),
  channel text not null,
  url text,
  published_at timestamptz default now(),
  metrics jsonb default '{}'
);
```

## Philosophy

> "Nobody cares about your tech. They care that their problem got solved."

Agentic CMS isn't about adding AI to your CMS. It's about making your content workflow AI-native — so agents handle the repetitive work and humans focus on judgment and creativity.

Built by [IntelliEffect](https://intellieffect.com) as part of the [Agentic Workflow Club](https://agenticworkflows.club).

## Contributing

Contributions welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting PRs.

## License

[MIT](LICENSE)
