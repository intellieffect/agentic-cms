/**
 * AccentBar — Colored horizontal divider line.
 *
 * Used in CoverBold, CoverCentered, CoverMinimal, CoverSplit,
 * BodyText, BodyList, HookStat as a decorative separator.
 */
import type { CSSProperties } from 'react'
import {
  accentBar,
  accentOpacity,
  accentBarStyle,
  tokenStyle,
  type AccentBarVariant,
} from '@/lib/studio/slide-tokens'

/** Convenient semantic aliases mapping to token variants */
const ALIAS: Record<string, AccentBarVariant> = {
  wide: 'wide',
  medium: 'medium',
  narrow: 'defaultRound',
  thin: 'thin',
}

export type AccentBarAlias = keyof typeof ALIAS

export interface AccentBarProps {
  /** Semantic width variant */
  variant?: AccentBarAlias | AccentBarVariant
  /** Bar color — defaults to accentColor at 80% opacity */
  accentColor?: string
  accentColorEnd?: string
  /** Hex opacity suffix appended to accentColor (from accentOpacity tokens) */
  opacity?: string
  style?: CSSProperties
}

const DEFAULT_ACCENT = '#ff6b6b'

export function AccentBar({
  variant = 'narrow',
  accentColor = DEFAULT_ACCENT,
  accentColorEnd,
  opacity = accentOpacity.high,
  style,
}: AccentBarProps) {
  const tokenKey = (ALIAS[variant] ?? variant) as AccentBarVariant
  const baseStyle = accentBarStyle(tokenKey, `${accentColor}${opacity}`)
  const gradientOverride = accentColorEnd
    ? { background: `linear-gradient(90deg, ${accentColor}${opacity}, ${accentColorEnd}${opacity})` }
    : {}
  return (
    <div
      style={tokenStyle(
        baseStyle,
        gradientOverride,
        style,
      )}
    />
  )
}
