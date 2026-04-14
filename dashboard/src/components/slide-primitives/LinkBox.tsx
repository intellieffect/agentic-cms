/**
 * LinkBox — Accent-bordered URL display container.
 *
 * Matches CTALink: rounded-2xl border with accent color,
 * large text for the URL value, optional small label above.
 */
import type { CSSProperties } from 'react'
import {
  fontSize,
  fontWeight,
  spacing,
  cardStyle,
  tokenStyle,
} from '@/lib/studio/slide-tokens'

export interface LinkBoxProps {
  /** The URL or link text to display */
  value: string
  accentColor?: string
  textColor?: string
  style?: CSSProperties
}

const DEFAULT_ACCENT = '#ff6b6b'
const DEFAULT_TEXT = '#ffffff'

export function LinkBox({
  value,
  accentColor = DEFAULT_ACCENT,
  textColor = DEFAULT_TEXT,
  style,
}: LinkBoxProps) {
  return (
    <div
      style={tokenStyle(
        cardStyle('linkBox'),
        {
          border: `2px solid ${accentColor}`,
          paddingLeft: spacing.cardMdH,
          paddingRight: spacing.cardMdH,
          paddingTop: spacing.cardLinkV,
          paddingBottom: spacing.cardLinkV,
          textAlign: 'center',
        },
        style,
      )}
    >
      <div
        style={{
          fontSize: fontSize.subtitleMd,
          fontWeight: fontWeight.semibold,
          color: textColor,
          wordBreak: 'break-all',
        }}
      >
        {value}
      </div>
    </div>
  )
}
