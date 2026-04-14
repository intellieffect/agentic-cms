/**
 * QuoteBlock — Large decorative quotation marks wrapping text.
 *
 * Matches BodyQuote: 190px font-black quote marks at accent color,
 * 56px semibold quote text, optional author attribution.
 */
import type { CSSProperties } from 'react'
import {
  fontSize,
  fontWeight,
  lineHeight,
  accentOpacity,
  tokenStyle,
} from '@/lib/studio/slide-tokens'
import { renderMarkdownBold } from '@/lib/studio/render-markdown'

export interface QuoteBlockProps {
  /** The quoted text */
  text: string
  /** Custom font size for quote marks */
  quoteFontSize?: number
  /** Custom line height for quote text */
  quoteLineHeight?: number
  /** Custom font size for author text */
  bodyFontSize?: number
  /** Attribution line (rendered with em-dash prefix) */
  author?: string
  accentColor?: string
  accentColorEnd?: string
  textColor?: string
  mutedColor?: string
  style?: CSSProperties
}

const DEFAULT_ACCENT = '#ff6b6b'
const DEFAULT_TEXT = '#ffffff'
const DEFAULT_MUTED = '#e0e0e0'

export function QuoteBlock({
  text,
  quoteFontSize,
  quoteLineHeight,
  bodyFontSize,
  author,
  accentColor = DEFAULT_ACCENT,
  accentColorEnd,
  textColor = DEFAULT_TEXT,
  mutedColor = DEFAULT_MUTED,
  style,
}: QuoteBlockProps) {
  const markColor = `${accentColor}${accentOpacity.text}`

  const markStyle: CSSProperties = {
    fontSize: 60,
    fontWeight: fontWeight.black,
    lineHeight: '0.5',
    color: markColor,
    height: 48,
    overflow: 'visible',
  }

  return (
    <div style={tokenStyle({ position: 'relative' }, style)}>
      {/* Opening mark — above text, left aligned */}
      <div style={{ ...markStyle, textAlign: 'left' }}>
        {'\u201C'}
      </div>

      {/* Quote text */}
      <div
        style={{
          fontSize: quoteFontSize ?? fontSize.bodyMd,
          fontWeight: fontWeight.medium,
          lineHeight: quoteLineHeight ?? lineHeight.relaxed,
          color: textColor,
          whiteSpace: 'pre-line',
          textAlign: 'center',
        }}
      >
        {renderMarkdownBold(text, accentColor, accentColorEnd)}
      </div>

      {/* Closing mark — below text, right aligned */}
      <div style={{ ...markStyle, textAlign: 'right', marginTop: 24 }}>
        {'\u201D'}
      </div>

      {/* Author */}
      {author && (
        <div
          style={{
            fontSize: bodyFontSize ?? fontSize.captionLg,
            color: mutedColor,
            textAlign: 'center',
            marginTop: 24,
          }}
        >
          {`\u2014 ${author} \u2014`}
        </div>
      )}
    </div>
  )
}
