/**
 * brxce-editor API Client
 *
 * Usage:
 *   const client = new BrxceEditorClient('http://localhost:8090')
 *   const projects = await client.listProjects()
 */

import type {
  VideoProject,
  VideoProjectSummary,
  RenderStatus,
  Preset,
} from './types'

export class BrxceEditorClient {
  private baseUrl: string

  constructor(baseUrl = 'http://localhost:8090') {
    this.baseUrl = baseUrl.replace(/\/$/, '')
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`${res.status} ${res.statusText}: ${body}`)
    }
    return res.json()
  }

  // ─── Projects ───

  async listProjects(opts?: {
    status?: string
    limit?: number
    offset?: number
  }): Promise<{ projects: VideoProjectSummary[] }> {
    const params = new URLSearchParams()
    if (opts?.status) params.set('status', opts.status)
    if (opts?.limit) params.set('limit', String(opts.limit))
    if (opts?.offset) params.set('offset', String(opts.offset))
    const qs = params.toString()
    return this.request(`/api/projects${qs ? '?' + qs : ''}`)
  }

  async getProject(id: string): Promise<{ project: VideoProject }> {
    return this.request(`/api/projects/${id}`)
  }

  async createProject(data: {
    name: string
    projectData: Record<string, unknown>
    orientation?: string
  }): Promise<{ project: VideoProject }> {
    return this.request('/api/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateProject(
    id: string,
    patch: Partial<Omit<VideoProject, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<{ project: VideoProject }> {
    return this.request(`/api/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
  }

  async deleteProject(id: string): Promise<{ ok: boolean }> {
    return this.request(`/api/projects/${id}`, { method: 'DELETE' })
  }

  // ─── Render ───

  async startRender(data: Record<string, unknown>): Promise<{ status: string; total: number }> {
    return this.request('/api/render', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getRenderStatus(): Promise<RenderStatus> {
    return this.request('/api/render/status')
  }

  // ─── Presets ───

  async listPresets(): Promise<{ presets: Preset[] }> {
    return this.request('/api/presets')
  }

  async getPreset(id: string): Promise<Preset> {
    return this.request(`/api/presets/${id}`)
  }
}
