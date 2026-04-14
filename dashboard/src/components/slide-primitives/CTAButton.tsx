/**
 * CTAButton — Rounded-full accent button with glow shadow.
 *
 * Matches the CTAFollow button: rounded-full, px-16 py-8, font-black,
 * accent background, white text, drop shadow with accent glow.
 */
import type { CSSProperties, ReactNode } from 'react'
import {
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
  shadow,
  tokenStyle,
} from '@/lib/studio/slide-tokens'

export interface CTAButtonProps {
  children: ReactNode
  /** Background color (start) */
  accentColor?: string
  /** Background color (end — gradient) */
  accentColorEnd?: string
  /** Text color */
  textColor?: string
  /** Custom shadow — defaults to accent glow */
  glowShadow?: string
  style?: CSSProperties
}

const DEFAULT_ACCENT = '#ff6b6b'

export function CTAButton({
  children,
  accentColor = DEFAULT_ACCENT,
  accentColorEnd,
  textColor = '#ffffff',
  glowShadow,
  style,
}: CTAButtonProps) {
  const resolvedShadow =
    glowShadow ?? `0 12px 35px ${accentColor}80`
  const bgStyle = accentColorEnd
    ? { background: `linear-gradient(90deg, ${accentColor}, ${accentColorEnd})` }
    : { backgroundColor: accentColor }

  return (
    <div
      style={tokenStyle(
        {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          paddingLeft: spacing.buttonH,
          paddingRight: spacing.buttonH,
          paddingTop: spacing.buttonV,
          paddingBottom: spacing.buttonV,
          borderRadius: borderRadius.full,
          ...bgStyle,
          color: textColor,
          fontSize: fontSize.buttonLg,
          fontWeight: fontWeight.black,
          boxShadow: resolvedShadow,
        },
        style,
      )}
    >
      {children}
    </div>
  )
}
