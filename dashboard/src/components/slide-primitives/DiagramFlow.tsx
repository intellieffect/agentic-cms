/**
 * DiagramFlow — Horizontal node-arrow-node chain.
 *
 * Matches BodyDiagram: rounded-xl bordered nodes with accent-colored
 * arrow characters between them, laid out in a horizontal flex row.
 */
import type { CSSProperties } from 'react'
import {
  fontSize,
  fontWeight,
  spacing,
  gap,
  layout,
  cardStyle,
  tokenStyle,
} from '@/lib/studio/slide-tokens'

export interface DiagramFlowProps {
  /** Text labels for each node */
  nodes: string[]
  /** Arrow character between nodes */
  arrow?: string
  accentColor?: string
  textColor?: string
  style?: CSSProperties
}

const DEFAULT_ACCENT = '#ff6b6b'
const DEFAULT_TEXT = '#ffffff'

export function DiagramFlow({
  nodes,
  arrow = '\u2192',
  accentColor = DEFAULT_ACCENT,
  textColor = DEFAULT_TEXT,
  style,
}: DiagramFlowProps) {
  return (
    <div
      style={tokenStyle(
        {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: gap.sm,
          flexWrap: 'wrap',
        },
        style,
      )}
    >
      {(nodes || []).map((label, i) => (
        <div key={i} style={{ display: 'contents' }}>
          {/* Node */}
          <div
            style={tokenStyle(cardStyle('diagramNode'), {
              paddingLeft: spacing.cardSmH,
              paddingRight: spacing.cardSmH,
              paddingTop: spacing.cardSmV,
              paddingBottom: spacing.cardSmV,
              minWidth: layout.minWidth.diagramNode,
              textAlign: 'center',
              fontSize: fontSize.captionLg,
              fontWeight: fontWeight.normal,
              color: textColor,
            })}
          >
            {label}
          </div>

          {/* Arrow (skip after last node) */}
          {i < nodes.length - 1 && (
            <span
              style={{
                fontSize: fontSize.bodyMd,
                color: accentColor,
              }}
            >
              {arrow}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
