/**
 * SlideTitle — Heading text primitive with semantic size variants.
 *
 * Maps to title/heading patterns found across all 19 slide templates.
 * Uses token fontSize, fontWeight, and lineHeight values.
 */
import type { CSSProperties, ReactNode } from 'react'
import {
  fontSize,
  fontWeight,
  lineHeight,
  tokenStyle,
} from '@/lib/studio/slide-tokens'

const VARIANT_MAP = {
  /** 94–100px cover/hook titles (CoverBold, CoverGradient, HookQuestion) */
  hero: {
    fontSize: fontSize.coverMd,
    fontWeight: fontWeight.black,
    lineHeight: lineHeight.tighter,
  },
  /** 62–66px body section headings (BodyText, BodyList, BodyStep, BodyDiagram) */
  title: {
    fontSize: fontSize.heading,
    fontWeight: fontWeight.bold,
    lineHeight: lineHeight.default,
  },
  /** 44–56px secondary headings (CoverBold subtitle, BodyQuote text) */
  subtitle: {
    fontSize: fontSize.subtitleLg,
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.subtitle,
  },
  /** 36–38px body copy (BodyText body, descriptions) */
  body: {
    fontSize: fontSize.bodyLg,
    fontWeight: fontWeight.normal,
    lineHeight: lineHeight.body,
  },
} as const satisfies Record<string, CSSProperties>

export type SlideTitleVariant = keyof typeof VARIANT_MAP

export interface SlideTitleProps {
  children: ReactNode
  /** Semantic size variant */
  variant?: SlideTitleVariant
  /** Text color — defaults to white */
  textColor?: string
  /** Override any style token */
  style?: CSSProperties
}

const DEFAULT_TEXT_COLOR = '#ffffff'

/** Parse **bold** markdown in text strings with gradient support. */
function renderBold(node: ReactNode, accentColor?: string, accentColorEnd?: string): ReactNode {
  if (typeof node !== 'string') return node
  if (!node.includes('**')) return node
  return node.split(/(\*\*[^*]+\*\*)/g).map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const gradientStyle = accentColorEnd
        ? { background: `linear-gradient(90deg, ${accentColor || '#ff6b6b'}, ${accentColorEnd})`, WebkitBackgroundClip: 'text' as const, backgroundClip: 'text' as const, color: 'transparent' }
        : { color: accentColor || '#ff6b6b' }
      return <span key={idx} style={gradientStyle}>{part.slice(2, -2)}</span>
    }
    return <span key={idx}>{part}</span>
  })
}

export function SlideTitle({
  children,
  variant = 'title',
  textColor = DEFAULT_TEXT_COLOR,
  accentColor,
  accentColorEnd,
  style,
}: SlideTitleProps & { accentColor?: string; accentColorEnd?: string }) {
  return (
    <div
      style={tokenStyle(
        VARIANT_MAP[variant],
        { color: textColor, whiteSpace: 'pre-line' },
        style,
      )}
    >
      {renderBold(children, accentColor, accentColorEnd)}
    </div>
  )
}
