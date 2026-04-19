/**
 * brxce-editor embed helper
 *
 * Usage:
 *   import { createBrxceEditor } from 'brxce-editor/embed'
 *   const editor = createBrxceEditor(document.getElementById('editor')!, {
 *     serverUrl: 'http://localhost:8090',
 *   })
 *   editor.loadPreset(presetProject)
 */

import type { BrxceEditorOptions, MessageType } from './types'

export interface BrxceEditor {
  /** The iframe element */
  iframe: HTMLIFrameElement
  /** Load a preset project into the editor */
  loadPreset(project: Record<string, unknown>): void
  /** Listen for messages from the editor */
  on(type: MessageType, handler: (data: unknown) => void): () => void
  /** Remove the editor */
  destroy(): void
}

export function createBrxceEditor(
  container: HTMLElement,
  options: BrxceEditorOptions = {}
): BrxceEditor {
  const serverUrl = (options.serverUrl || 'http://localhost:8090').replace(/\/$/, '')
  const allowedOrigins = options.allowedOrigins || [serverUrl]

  // Create iframe
  const iframe = document.createElement('iframe')
  iframe.src = `${serverUrl}/editor.html`
  iframe.style.width = '100%'
  iframe.style.height = '100%'
  iframe.style.border = 'none'
  iframe.allow = 'autoplay; fullscreen'
  container.appendChild(iframe)

  const listeners = new Map<string, Set<(data: unknown) => void>>()

  // Listen for messages from editor
  function handleMessage(event: MessageEvent) {
    if (!allowedOrigins.includes(event.origin)) return
    const { type, ...rest } = event.data || {}
    if (!type) return
    const handlers = listeners.get(type)
    if (handlers) {
      handlers.forEach((h) => h(rest))
    }
  }
  window.addEventListener('message', handleMessage)

  // Load preset when iframe is ready
  if (options.preset) {
    iframe.addEventListener('load', () => {
      iframe.contentWindow?.postMessage(
        { type: 'brxce-load-preset', project: options.preset },
        serverUrl
      )
    })
  }

  return {
    iframe,

    loadPreset(project: Record<string, unknown>) {
      iframe.contentWindow?.postMessage(
        { type: 'brxce-load-preset', project },
        serverUrl
      )
    },

    on(type: MessageType, handler: (data: unknown) => void) {
      if (!listeners.has(type)) {
        listeners.set(type, new Set())
      }
      listeners.get(type)!.add(handler)
      return () => {
        listeners.get(type)?.delete(handler)
      }
    },

    destroy() {
      window.removeEventListener('message', handleMessage)
      container.removeChild(iframe)
    },
  }
}
