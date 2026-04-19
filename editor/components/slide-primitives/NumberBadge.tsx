/**
 * NumberBadge — Circular numbered indicator.
 *
 * Used in BodyList (sm: 56px) and BodyStep (lg: 96px).
 */
import type { CSSProperties, ReactNode } from 'react'
import {
  numberBadgeStyle,
  tokenStyle,
  type NumberBadgeSize,
} from '@/lib/studio/slide-tokens'

export interface NumberBadgeProps {
  children: ReactNode
  /** Badge size — sm (56px) or lg (96px) */
  size?: NumberBadgeSize
  /** Background color */
  accentColor?: string
  accentColorEnd?: string
  /** Text color — defaults to white */
  textColor?: string
  style?: CSSProperties
}

const DEFAULT_ACCENT = '#ff6b6b'

export function NumberBadge({
  children,
  size = 'sm',
  accentColor = DEFAULT_ACCENT,
  accentColorEnd,
  textColor = '#ffffff',
  style,
}: NumberBadgeProps) {
  const baseStyle = numberBadgeStyle(size, accentColor)
  const gradientOverride = accentColorEnd
    ? { background: `linear-gradient(135deg, ${accentColor}, ${accentColorEnd})` }
    : {}
  return (
    <div
      style={tokenStyle(
        baseStyle,
        gradientOverride,
        { color: textColor },
        style,
      )}
    >
      {children}
    </div>
  )
}
