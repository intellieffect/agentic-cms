/**
 * Overline — Small tracked text above a title (kicker/tag).
 *
 * Used in CoverBold (tag), CoverCentered (kicker), HookTeaser (overline),
 * CTALink (linkLabel), HookStat (badge text).
 */
import type { CSSProperties, ReactNode } from 'react'
import {
  fontSize,
  fontWeight,
  letterSpacing,
  tokenStyle,
} from '@/lib/studio/slide-tokens'

export type OverlineVariant = 'tag' | 'kicker' | 'badge' | 'linkLabel'

const VARIANT_MAP: Record<OverlineVariant, CSSProperties> = {
  /** CoverBold tag: 38px semibold, narrow tracking */
  tag: {
    fontSize: fontSize.bodyLg,
    fontWeight: fontWeight.semibold,
    letterSpacing: letterSpacing.tag,
    textTransform: 'none',
  },
  /** CoverCentered kicker: 24px, wide tracking, uppercase */
  kicker: {
    fontSize: fontSize.captionMd,
    fontWeight: fontWeight.normal,
    letterSpacing: letterSpacing.kicker,
    textTransform: 'uppercase',
  },
  /** HookStat badge: 30px, medium tracking, uppercase */
  badge: {
    fontSize: fontSize.captionLg,
    fontWeight: fontWeight.normal,
    letterSpacing: letterSpacing.badge,
    textTransform: 'uppercase',
  },
  /** CTALink label: 20px, wide tracking, uppercase */
  linkLabel: {
    fontSize: fontSize.captionSm,
    fontWeight: fontWeight.normal,
    letterSpacing: letterSpacing.linkLabel,
    textTransform: 'uppercase',
  },
} as const

export interface OverlineProps {
  children: ReactNode
  variant?: OverlineVariant
  /** Text color — defaults to accentColor */
  accentColor?: string
  accentColorEnd?: string
  style?: CSSProperties
}

const DEFAULT_ACCENT = '#ff6b6b'

export function Overline({
  children,
  variant = 'kicker',
  accentColor = DEFAULT_ACCENT,
  accentColorEnd,
  style,
}: OverlineProps) {
  return (
    <div
      style={tokenStyle(
        VARIANT_MAP[variant],
        accentColorEnd
          ? { background: `linear-gradient(90deg, ${accentColor}, ${accentColorEnd})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }
          : { color: accentColor },
        style,
      )}
    >
      {children}
    </div>
  )
}
