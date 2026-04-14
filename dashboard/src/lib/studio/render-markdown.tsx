import React from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { fontWeight } from './slide-tokens'

/** 그라디언트 텍스트 스타일 */
function accentStyle(start?: string, end?: string): CSSProperties {
  if (end && start) {
    return {
      background: `linear-gradient(90deg, ${start}, ${end})`,
      WebkitBackgroundClip: 'text',
      backgroundClip: 'text',
      color: 'transparent',
    }
  }
  return { color: start || '#ff6b6b' }
}

/* ── Code-block styling ────────────────────────────── */
const codeBlockStyle: CSSProperties = {
  display: 'block',
  fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
  fontSize: '0.82em',
  lineHeight: 1.6,
  background: 'rgba(255,255,255,0.06)',
  borderRadius: 12,
  padding: '20px 24px',
  margin: '16px 0',
  whiteSpace: 'pre',
  overflowX: 'auto',
  color: 'inherit',
}

const inlineCodeStyle: CSSProperties = {
  fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
  fontSize: '0.88em',
  background: 'rgba(255,255,255,0.08)',
  borderRadius: 6,
  padding: '2px 8px',
  color: 'inherit',
}

/* ── Markdown renderer ─────────────────────────────── */

/**
 * Parse markdown subset in text and return React nodes.
 * Supports: **bold**, ```code blocks```, `inline code`
 */
export function renderMarkdownBold(text: string, accentColor?: string, accentColorEnd?: string): ReactNode[] {
  if (!text) return []
  // Step 1: split by fenced code blocks (``` ... ```)
  const blockParts = text.split(/(```[\s\S]*?```)/g)

  const nodes: ReactNode[] = []

  blockParts.forEach((block, blockIdx) => {
    if (block.startsWith('```') && block.endsWith('```')) {
      // Fenced code block — strip ``` delimiters and optional language tag
      const inner = block.slice(3, -3).replace(/^\w*\n?/, '')
      nodes.push(
        <code key={`cb-${blockIdx}`} style={codeBlockStyle}>
          {inner.replace(/^\n|\n$/g, '')}
        </code>
      )
      return
    }

    // Step 2: split by inline code (` ... `)
    const inlineParts = block.split(/(`.+?`)/g)

    inlineParts.forEach((part, inlineIdx) => {
      if (part.startsWith('`') && part.endsWith('`')) {
        nodes.push(
          <code key={`ic-${blockIdx}-${inlineIdx}`} style={inlineCodeStyle}>
            {part.slice(1, -1)}
          </code>
        )
        return
      }

      // Step 3: split by **bold**
      const boldParts = part.split(/(\*\*[^*]+\*\*)/g)

      boldParts.forEach((seg, segIdx) => {
        if (seg.startsWith('**') && seg.endsWith('**')) {
          nodes.push(
            <span
              key={`b-${blockIdx}-${inlineIdx}-${segIdx}`}
              style={{ fontWeight: fontWeight.bold, ...accentStyle(accentColor, accentColorEnd) }}
            >
              {seg.slice(2, -2)}
            </span>
          )
        } else if (seg) {
          nodes.push(
            <span key={`t-${blockIdx}-${inlineIdx}-${segIdx}`}>{seg}</span>
          )
        }
      })
    })
  })

  return nodes
}

// Re-export for slide templates that render text directly
export function renderBold(text: string, accentColor?: string, accentColorEnd?: string): React.ReactNode {
  if (!text || !text.includes('**')) return text
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <span key={idx} style={accentStyle(accentColor, accentColorEnd)}>{part.slice(2, -2)}</span>
    }
    return <span key={idx}>{part}</span>
  })
}
