import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

function editorUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}${path}`;
}

async function editorFetch(base: string, path: string, options?: RequestInit): Promise<unknown> {
  const url = editorUrl(base, path);
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Editor API ${res.status}: ${body || res.statusText}`);
  }
  return res.json();
}

function textResult(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

function errorResult(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

export function registerVideoTools(server: McpServer, editorApiUrl: string): void {
  // 1. list_video_projects
  server.tool(
    'list_video_projects',
    'List video projects from the editor.',
    {
      limit: z.number().min(1).max(100).optional().describe('Max results'),
      offset: z.number().min(0).optional().describe('Offset for pagination'),
    },
    async (params) => {
      try {
        const query = new URLSearchParams();
        if (params.limit !== undefined) query.set('limit', String(params.limit));
        if (params.offset !== undefined) query.set('offset', String(params.offset));
        const qs = query.toString();
        const data = await editorFetch(editorApiUrl, `/api/projects${qs ? `?${qs}` : ''}`);
        return textResult(data);
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // 2. get_video_project
  server.tool(
    'get_video_project',
    'Get details of a specific video project.',
    {
      id: z.string().describe('Project ID'),
    },
    async (params) => {
      try {
        const data = await editorFetch(editorApiUrl, `/api/projects/load/${encodeURIComponent(params.id)}`);
        return textResult(data);
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // 3. create_video_project
  server.tool(
    'create_video_project',
    'Create or save a video project.',
    {
      name: z.string().describe('Project name'),
      orientation: z.enum(['landscape', 'portrait']).optional().describe('Video orientation'),
      clips: z.array(z.record(z.unknown())).optional().describe('Array of clip objects'),
      clipMeta: z.record(z.unknown()).optional().describe('Clip metadata map'),
      bgmClips: z.array(z.record(z.unknown())).optional().describe('Array of BGM clip objects'),
    },
    async (params) => {
      try {
        const data = await editorFetch(editorApiUrl, '/api/projects/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        });
        return textResult(data);
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // 4. extract_beats
  server.tool(
    'extract_beats',
    'Extract beats from a music file for syncing video cuts.',
    {
      source: z.string().describe('Music file path or URL'),
      mode: z.enum(['all', 'impact', 'downbeat']).optional().describe('Beat detection mode (default: all)'),
      minGap: z.number().optional().describe('Minimum gap between beats in seconds'),
    },
    async (params) => {
      try {
        const data = await editorFetch(editorApiUrl, '/api/bgm/beats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        });
        return textResult(data);
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // 5. list_videos
  server.tool(
    'list_videos',
    'List available video source files.',
    {},
    async () => {
      try {
        const data = await editorFetch(editorApiUrl, '/api/list-videos');
        return textResult(data);
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // 6. probe_media
  server.tool(
    'probe_media',
    'Get metadata (duration, resolution, codec, etc.) for a media file.',
    {
      filename: z.string().describe('Filename to probe'),
    },
    async (params) => {
      try {
        const data = await editorFetch(editorApiUrl, `/api/media/probe/${encodeURIComponent(params.filename)}`);
        return textResult(data);
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // 7. render_video
  server.tool(
    'render_video',
    'Start rendering a video project.',
    {
      project: z.record(z.unknown()).describe('Project data to render'),
    },
    async (params) => {
      try {
        const data = await editorFetch(editorApiUrl, '/api/render', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params.project),
        });
        return textResult(data);
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // 8. get_render_status
  server.tool(
    'get_render_status',
    'Check the current rendering status.',
    {},
    async () => {
      try {
        const data = await editorFetch(editorApiUrl, '/api/render/status');
        return textResult(data);
      } catch (error) {
        return errorResult(error);
      }
    }
  );
}
