/**
 * SlideCard — Semi-transparent bordered container.
 *
 * Wraps content in a glass-effect card matching patterns from
 * BodyList, BodyStep, BodyCompare, BodyQuote, BodyDiagram, HookStat.
 */
import type { CSSProperties, ReactNode } from 'react'
import { cardStyle, tokenStyle } from '@/lib/studio/slide-tokens'

export type SlideCardVariant =
  | 'listItem'
  | 'stepCard'
  | 'compareCard'
  | 'quoteCard'
  | 'diagramNode'
  | 'badge'
  | 'linkBox'

export interface SlideCardProps {
  children: ReactNode
  /** Card style variant */
  variant?: SlideCardVariant
  style?: CSSProperties
}

export function SlideCard({
  children,
  variant = 'listItem',
  style,
}: SlideCardProps) {
  return (
    <div style={tokenStyle(cardStyle(variant), style)}>
      {children}
    </div>
  )
}
