/** Core types for brxce-editor SDK */

export interface VideoProject {
  id: string
  name: string
  orientation: 'vertical' | 'horizontal' | 'square'
  status: 'draft' | 'published' | 'archived'
  projectData: Record<string, unknown>
  thumbnailUrl?: string
  duration?: number
  clipCount: number
  sourceFiles?: Record<string, unknown>[]
  createdBy?: string
  createdAt: string
  updatedAt: string
}

export interface VideoProjectSummary {
  id: string
  name: string
  orientation: string
  status: string
  thumbnailUrl?: string
  duration?: number
  clipCount: number
  createdBy?: string
  createdAt: string
  updatedAt: string
}

export interface RenderJob {
  id: string
  projectId: string
  status: 'queued' | 'rendering' | 'done' | 'failed'
  outputUrl?: string
  progress: number
  error?: string
  startedAt?: string
  completedAt?: string
  createdAt: string
}

export interface RenderStatus {
  state: 'idle' | 'rendering' | 'done' | 'error'
  progress: number
  total: number
  error?: string | null
  output?: string | null
}

export interface Preset {
  id: string
  name: string
  description: string
  traits: string[]
  clipCount: string
  duration: string
  editStyle: string
  subtitleStyle: string
  bgmStyle: string
  icon: string
  color: string
  references: string[]
  defaultProject: {
    name: string
    clips: Array<{
      source: string
      start: number
      end: number
      subtitle: string
      speed?: number
      zoom?: { scale: number; panX: number; panY: number }
    }>
    globalSubs?: Array<{
      text: string
      start: number
      end: number
      style?: Record<string, unknown>
    }>
    bgm?: string
    fps?: number
  }
  referenceNote: string
}

export interface BrxceEditorOptions {
  /** Base URL of the editor server */
  serverUrl?: string
  /** Initial project ID to load */
  projectId?: string
  /** Preset to apply */
  preset?: Preset['defaultProject']
  /** Allowed parent origins for postMessage */
  allowedOrigins?: string[]
}

export type MessageType =
  | 'brxce-load-preset'
  | 'brxce-preset-loaded'
  | 'brxce-save'
  | 'brxce-render'
