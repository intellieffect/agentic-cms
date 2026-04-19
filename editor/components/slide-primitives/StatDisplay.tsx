/**
 * StatDisplay — Large hero number with a label beneath.
 *
 * Matches HookStat: 220px font-black stat value in accent color,
 * 64px semibold label, optional detail text below.
 */
import type { CSSProperties } from 'react'
import {
  fontSize,
  fontWeight,
  lineHeight,
  tokenStyle,
} from '@/lib/studio/slide-tokens'

export interface StatDisplayProps {
  /** The hero number/stat (e.g. "73%") */
  value: string
  /** Label below the stat */
  label: string
  accentColor?: string
  accentColorEnd?: string
  textColor?: string
  mutedColor?: string
  style?: CSSProperties
  valueFontSize?: number
  labelFontSize?: number
}

const DEFAULT_ACCENT = '#ff6b6b'
const DEFAULT_TEXT = '#ffffff'
const DEFAULT_MUTED = '#e0e0e0'

export function StatDisplay({
  value,
  label,
  accentColor = DEFAULT_ACCENT,
  accentColorEnd,
  textColor = DEFAULT_TEXT,
  mutedColor = DEFAULT_MUTED,
  style,
  valueFontSize,
  labelFontSize: labelFontSizeOverride,
}: StatDisplayProps) {
  return (
    <div
      style={tokenStyle(
        {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        },
        style,
      )}
    >
      {/* Hero stat value */}
      <div
        style={{
          fontSize: valueFontSize ?? fontSize.displayXl,
          fontWeight: fontWeight.black,
          lineHeight: lineHeight.none,
          ...(accentColorEnd
            ? { background: `linear-gradient(90deg, ${accentColor}, ${accentColorEnd})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }
            : { color: accentColor }),
        }}
      >
        {value}
      </div>

      {/* Stat label */}
      <div
        style={{
          fontSize: labelFontSizeOverride ?? fontSize.headingSm,
          fontWeight: fontWeight.semibold,
          lineHeight: lineHeight.default,
          color: textColor,
          marginTop: 16,
        }}
      >
        {label}
      </div>
    </div>
  )
}
