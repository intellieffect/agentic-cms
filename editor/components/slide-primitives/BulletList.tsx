/**
 * BulletList — List of items with accent-colored dot indicators.
 *
 * Used in HookProblem (md dots, 28px gap) and BodyCompare (sm dots, 16px gap).
 */
import type { CSSProperties } from 'react'
import {
  bullet,
  bulletStyle,
  fontSize,
  fontWeight,
  lineHeight,
  gap,
  tokenStyle,
  type BulletSize,
} from '@/lib/studio/slide-tokens'

export interface BulletListProps {
  items: string[]
  /** Dot size — sm (12px) or md (16px) */
  dotSize?: BulletSize
  /** Dot color */
  accentColor?: string
  /** Item text color */
  textColor?: string
  /** Vertical gap between items in px */
  itemGap?: number
  style?: CSSProperties
}

const DEFAULT_ACCENT = '#ff6b6b'
const DEFAULT_TEXT = '#ffffff'

export function BulletList({
  items,
  dotSize = 'md',
  accentColor = DEFAULT_ACCENT,
  textColor = DEFAULT_TEXT,
  itemGap = gap['2xl'],
  style,
}: BulletListProps) {
  return (
    <div
      style={tokenStyle(
        {
          display: 'flex',
          flexDirection: 'column',
          gap: itemGap,
        },
        style,
      )}
    >
      {(items || []).map((item, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: gap.lg,
            textAlign: 'left',
          }}
        >
          <span style={{ ...bulletStyle(dotSize, accentColor), flexShrink: 0, ...((style as Record<string, string> | undefined)?.['--accentEnd'] ? { background: `linear-gradient(135deg, ${accentColor}, ${(style as Record<string, string>)['--accentEnd']})` } : {}), marginTop: ((style?.fontSize as number) ?? fontSize.bodyMd) * 0.45 }} />
          <span
            style={{
              fontSize: style?.fontSize ?? fontSize.bodyMd,
              fontWeight: fontWeight.normal,
              lineHeight: style?.lineHeight ?? lineHeight.listItem,
              color: textColor,
              whiteSpace: 'pre-line',
              textAlign: 'left',
            }}
          >
            {item}
          </span>
        </div>
      ))}
    </div>
  )
}
